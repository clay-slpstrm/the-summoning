#!/usr/bin/env bash
#
# Self-perpetuating loop rehearsal — drives the full auto-open / on-chain
# escalation / resolve loop with real transactions on a live node, and asserts
# every transition. Deploys a minimal stack (RitualToken + ElderArtifacts +
# SummoningEngine, gathering=0). Glyph/VRF is out of scope for the loop, so the
# ElderArtifacts address is passed as the unused `glyphs` constructor arg
# (claimGlyphs is never called).
#
# Single signer drives everything (it is the token minter, funds itself, opens
# and resolves each epoch). On a dev node it fast-forwards time via
# evm_increaseTime; on a real testnet it sleeps for the ritual window.
#
# Usage:
#   Local anvil (default — uses the well-known dev key):
#     anvil & ; bash rehearse_selfperpetuating.sh
#
#   Sepolia (supply a funded THROWAWAY test key + RPC; short ritual so waits are bearable):
#     RPC=$SEPOLIA_RPC_URL PRIVATE_KEY=0x<throwaway> RITUAL_DUR=300 \
#       bash rehearse_selfperpetuating.sh
#
#   (RITUAL_DUR is the ritual window in seconds; keep it small on a testnet — the
#    script waits RITUAL_DUR+5s per epoch before resolving.)
set -euo pipefail
cd "$(dirname "$0")/.."

RPC="${RPC:-http://127.0.0.1:8545}"
RITUAL_DUR="${RITUAL_DUR:-300}"
# Default to anvil's first well-known dev key (PUBLIC test key, not a secret).
PRIVATE_KEY="${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
D="$(cast wallet address --private-key "$PRIVATE_KEY")"

send() { cast send --rpc-url "$RPC" --private-key "$PRIVATE_KEY" "$@" >/dev/null; }
call() { cast call --rpc-url "$RPC" "$@" | sed 's/ *\[.*\]//'; }
w()     { cast to-wei "$1" ether; }
field() { echo "$1" | sed -n "${2}p"; }

EPOCH_SIG="getEpoch(uint256)(uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,uint256)"

advance_time() {
  if cast rpc --rpc-url "$RPC" evm_increaseTime $((RITUAL_DUR+2)) >/dev/null 2>&1; then
    cast rpc --rpc-url "$RPC" evm_mine >/dev/null
  else
    echo "  (real network — waiting $((RITUAL_DUR+5))s for ritualEnd)"; sleep $((RITUAL_DUR+5))
  fi
}

assert_eq() { # label expected actual
  if [ "$2" != "$3" ]; then echo "  ✗ FAIL: $1 — expected $2, got $3"; exit 1; fi
  echo "  ✓ $1 = $3"
}

echo "=== Deploy (signer $D, gathering=0, ritual=${RITUAL_DUR}s) on $RPC ==="
TOKEN=$(forge create src/RitualToken.sol:RitualToken --rpc-url "$RPC" --private-key "$PRIVATE_KEY" --broadcast --constructor-args "$D" | awk '/Deployed to:/{print $3}')
ART=$(forge create src/ElderArtifacts.sol:ElderArtifacts --rpc-url "$RPC" --private-key "$PRIVATE_KEY" --broadcast --constructor-args "https://x/{id}" "$D" | awk '/Deployed to:/{print $3}')
ENGINE=$(forge create src/SummoningEngine.sol:SummoningEngine --rpc-url "$RPC" --private-key "$PRIVATE_KEY" --broadcast --constructor-args "$TOKEN" "$ART" "$ART" "$D" 0 "$RITUAL_DUR" | awk '/Deployed to:/{print $3}')
echo "  TOKEN=$TOKEN  ART=$ART  ENGINE=$ENGINE"

send "$TOKEN" "setMinter(address)" "$D"
send "$ART"   "setEngine(address)" "$ENGINE"
send "$TOKEN" "mint(address,uint256)" "$D" "$(w 2000000)"
send "$TOKEN" "approve(address,uint256)" "$ENGINE" "$(w 100000000)"

# One epoch: open with `commit` RITUAL, advance past ritualEnd, resolve, then
# assert oldOne/threshold/outcome and the pre-computed next threshold.
run_epoch() { # id commitAmount expectOldOne expectThreshold expectSuccess expectNext
  local id="$1" commit="$2" eOld="$3" eThr="$4" eOk="$5" eNext="$6"
  send "$ENGINE" "commitRitual(uint256)" "$(w "$commit")"
  local E; E=$(call "$ENGINE" "$EPOCH_SIG" "$id")
  assert_eq "epoch$id oldOneId"  "$eOld"      "$(field "$E" 1)"
  assert_eq "epoch$id threshold" "$(w "$eThr")" "$(field "$E" 2)"
  advance_time
  send "$ENGINE" "resolveEpoch()"
  E=$(call "$ENGINE" "$EPOCH_SIG" "$id")
  assert_eq "epoch$id resolved"   "true" "$(field "$E" 8)"
  assert_eq "epoch$id successful" "$eOk"  "$(field "$E" 7)"
  assert_eq "epoch$id nextThreshold" "$(w "$eNext")" "$(call "$ENGINE" "nextThreshold()(uint256)")"
}

echo "=== Idle: nextThreshold() = GENESIS (75000), currentEpochId = 0 ==="
assert_eq "idle nextThreshold" "$(w 75000)" "$(call "$ENGINE" "nextThreshold()(uint256)")"
assert_eq "currentEpochId (pre-genesis)" "0" "$(call "$ENGINE" "currentEpochId()(uint256)")"

echo "=== Epoch 1 — WIN at genesis (Cthulhu, 75k) → next 225k, Old One 1→2 ==="
run_epoch 1 75000  1 75000  true  225000

echo "=== Epoch 2 — LOSS (Old One 2, 225k; commit 100) → decay ×0.75 to 168750, retry Old One 2 ==="
run_epoch 2 100    2 225000 false 168750

echo "=== Epoch 3 — WIN from decayed (Old One 2 retried, 168750) → next 318750, Old One 2→3 ==="
run_epoch 3 168750 2 168750 true  318750

echo "=== Epoch 4 — auto-opens at 318750 with Old One advanced 2→3 ==="
send "$ENGINE" "commitRitual(uint256)" "$(w 100)"
E4=$(call "$ENGINE" "$EPOCH_SIG" 4)
assert_eq "epoch4 oldOneId (advanced)" "3"           "$(field "$E4" 1)"
assert_eq "epoch4 threshold"           "$(w 318750)" "$(field "$E4" 2)"

echo ""
echo "=== ✓ ALL REHEARSAL ASSERTIONS PASSED ($RPC) ==="
