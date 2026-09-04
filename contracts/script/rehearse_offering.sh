#!/usr/bin/env bash
# Sepolia rehearsal for Offering.sol against the live rehearsal-stack RitualToken.
# Drives real claims from ephemeral wallets: happy path, double-claim guard,
# vessel-floor rejection + top-up recovery, funding exhaustion, sweep guards.
# Env: contracts/.env.sepolia (SEPOLIA_RPC_URL, REHEARSAL_PRIVATE_KEY) +
#      /tmp/sepolia-rehearsal.env (TOKEN=...)
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env.sepolia; set +a
source /tmp/sepolia-rehearsal.env
RPC="$SEPOLIA_RPC_URL"; BK="$REHEARSAL_PRIVATE_KEY"
B=$(cast wallet address --private-key "$BK")

call() { cast call --rpc-url "$RPC" "$@" | sed 's/ *\[.*\]//'; }
send() { local k="$1"; shift; cast send --rpc-url "$RPC" --private-key "$k" "$@" >/dev/null; }
expect_revert() { # key target sig [args...] — succeeds iff the tx would revert
  local k="$1"; shift
  if cast send --rpc-url "$RPC" --private-key "$k" "$@" >/dev/null 2>&1; then
    echo "  ✗ FAIL: expected revert, tx succeeded: $*"; exit 1
  fi; echo "  ✓ reverted as expected: ${2:-$1}"
}
assert_eq() { if [ "$2" != "$3" ]; then echo "  ✗ FAIL: $1 — expected $2, got $3"; exit 1; fi; echo "  ✓ $1 = $3"; }
w() { cast to-wei "$1" ether; }

echo "=== A: deploy Offering(token, burner-as-safe) ==="
OFFERING=$(forge create src/Offering.sol:Offering --rpc-url "$RPC" --private-key "$BK" --broadcast \
  --constructor-args "$TOKEN" "$B" | awk '/Deployed to:/{print $3}')
echo "  OFFERING=$OFFERING"
assert_eq "seatsRemaining (unfunded)" "0" "$(call $OFFERING 'seatsRemaining()(uint256)')"

echo "=== B: fund with 300 RITUAL (3 seats) ==="
send "$BK" "$TOKEN" "transfer(address,uint256)" "$OFFERING" "$(w 300)"
assert_eq "seatsRemaining" "3" "$(call $OFFERING 'seatsRemaining()(uint256)')"
assert_eq "seatsRemainingToday" "25" "$(call $OFFERING 'seatsRemainingToday()(uint256)')"

echo "=== C: ephemeral vessels ==="
AK=$(cast wallet new | awk '/Private key:/{print $3}'); A=$(cast wallet address --private-key "$AK")
CK=$(cast wallet new | awk '/Private key:/{print $3}'); C=$(cast wallet address --private-key "$CK")
send "$BK" "$A" --value "$(w 0.05)"    # worthy vessel (gas headroom for spiky Sepolia)
send "$BK" "$C" --value "$(w 0.004)"   # below the 0.005 floor
echo "  A=$A (0.01 ETH)  C=$C (0.004 ETH)"

echo "=== D: happy claim (A) ==="
send "$AK" "$OFFERING" "claim()"
assert_eq "A RITUAL balance" "$(w 100)" "$(call $TOKEN 'balanceOf(address)(uint256)' $A)"
assert_eq "totalClaims" "1" "$(call $OFFERING 'totalClaims()(uint256)')"
assert_eq "seatsRemaining" "2" "$(call $OFFERING 'seatsRemaining()(uint256)')"

echo "=== E: double-claim guard (A again) ==="
expect_revert "$AK" "$OFFERING" "claim()"

echo "=== F: unworthy vessel (C, 0.004 ETH) then top-up recovery ==="
expect_revert "$CK" "$OFFERING" "claim()"
send "$BK" "$C" --value "$(w 0.05)"    # now ≥ floor, with gas headroom
send "$CK" "$OFFERING" "claim()"
assert_eq "C RITUAL balance" "$(w 100)" "$(call $TOKEN 'balanceOf(address)(uint256)' $C)"
assert_eq "totalClaims" "2" "$(call $OFFERING 'totalClaims()(uint256)')"

echo "=== G: burner takes the last seat; funding exhausts ==="
send "$BK" "$OFFERING" "claim()"
assert_eq "seatsRemaining (empty)" "0" "$(call $OFFERING 'seatsRemaining()(uint256)')"
echo "  (fresh worthy vessel must now hit Exhausted)"
DK=$(cast wallet new | awk '/Private key:/{print $3}'); D=$(cast wallet address --private-key "$DK")
send "$BK" "$D" --value "$(w 0.05)"
expect_revert "$DK" "$OFFERING" "claim()"

echo "=== H: sweep guards ==="
expect_revert "$BK" "$OFFERING" "sweep(address)" "$B"   # empty → NothingToSweep
send "$BK" "$TOKEN" "transfer(address,uint256)" "$OFFERING" "$(w 13)"
PRE=$(call $TOKEN 'balanceOf(address)(uint256)' $B)
send "$BK" "$OFFERING" "sweep(address)" "$B"
POST=$(call $TOKEN 'balanceOf(address)(uint256)' $B)
python3 -c "import sys; d=int('$POST')-int('$PRE'); sys.exit(0 if d==13*10**18 else 1)" && echo "  ✓ sweep returned 13 RITUAL" || { echo "  ✗ FAIL: sweep delta wrong"; exit 1; }

echo ""
echo "=== ✓ OFFERING REHEARSAL PASSED ($OFFERING on Sepolia) ==="
