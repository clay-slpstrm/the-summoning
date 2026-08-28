#!/usr/bin/env bash
#
# Full-stack Sepolia rehearsal of the self-perpetuating Summoning.
#
# Deploys the REAL 5-contract stack (DeploySepolia, burner-owned, gathering=0,
# ritual=300s), then drives the actual game loop with real ETH through the real
# curve: mint → genesis auto-open → loss → decay → VRF glyph claim → Shattered
# Ritual artifact → retry auto-open → owner-override win → Harbinger → +150k
# escalation → Old One advance. Asserts every transition.
#
# Requirements (contracts/.env.sepolia):
#   SEPOLIA_RPC_URL          — Sepolia RPC
#   REHEARSAL_PRIVATE_KEY    — throwaway BURNER key holding ~0.2 Sepolia ETH.
#                              This key becomes the owner of the rehearsal stack.
#                              NEVER a real key. Testnet only.
#   VRF_COORDINATOR / VRF_SUBSCRIPTION_ID / VRF_KEY_HASH  — existing Sepolia sub
#
# One manual step: after deploy, the script prints an `addConsumer` command that
# the VRF SUBSCRIPTION OWNER (deployer EOA) must run; the script polls the
# coordinator and continues automatically once the consumer appears.
#
# Runtime: ~20-25 min (two 300s ritual windows + VRF fulfillment waits).
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env.sepolia; set +a
: "${REHEARSAL_PRIVATE_KEY:?Add REHEARSAL_PRIVATE_KEY=0x... (funded burner) to contracts/.env.sepolia}"
RPC="$SEPOLIA_RPC_URL"
PK="$REHEARSAL_PRIVATE_KEY"
ME="$(cast wallet address --private-key "$PK")"

# Rehearsal shape: mainnet config but fast — gathering collapsed, 5-min ritual.
export GATHERING_DURATION_SECONDS=0
export RITUAL_DURATION_SECONDS=300
unset MULTISIG_ADDRESS   # burner owns everything; no Safe on Sepolia

OUT="${REHEARSAL_OUT:-/tmp/sepolia-rehearsal.env}"

send() { cast send --rpc-url "$RPC" --private-key "$PK" "$@" >/dev/null; }
call() { cast call --rpc-url "$RPC" "$@" | sed 's/ *\[.*\]//'; }
w()     { cast to-wei "$1" ether; }
field() { echo "$1" | sed -n "${2}p"; }
EPOCH_SIG="getEpoch(uint256)(uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,uint256)"

assert_eq() { if [ "$2" != "$3" ]; then echo "  ✗ FAIL: $1 — expected $2, got $3"; exit 1; fi; echo "  ✓ $1 = $3"; }

bal=$(cast balance "$ME" --rpc-url "$RPC")
echo "=== Burner $ME balance: $(cast from-wei "$bal") ETH ==="
python3 -c "import sys; sys.exit(0 if int('$bal') >= 15*10**16 else 1)" \
  || { echo "Fund the burner with ≥0.15 Sepolia ETH first"; exit 1; }

# ── Phase A: deploy the real 5-contract stack ────────────────────────────────
# Resumable: if a prior run already deployed (addresses saved + engine has code),
# skip straight to the consumer wait + loop.
if [ -f "$OUT" ] && source "$OUT" && [ "$(cast code "${ENGINE:-0x0}" --rpc-url "$RPC" 2>/dev/null | wc -c)" -gt 3 ]; then
  echo "=== Phase A: SKIPPED — reusing deployed stack from $OUT ==="
  cat "$OUT" | sed 's/^/  /'
else
echo "=== Phase A: DeploySepolia (burner-owned, gathering=0, ritual=300s) ==="
forge script script/DeploySepolia.s.sol:DeploySepolia \
  --rpc-url "$RPC" --private-key "$PK" --broadcast -vv 2>&1 | tail -30

python3 - "$OUT" <<'PY'
import json, sys
path = "broadcast/DeploySepolia.s.sol/11155111/run-latest.json"
d = json.load(open(path))
names = {}
for tx in d["transactions"]:
    if tx.get("transactionType") == "CREATE":
        names[tx["contractName"]] = tx["contractAddress"]
mapping = {"RitualToken":"TOKEN","MintingCurve":"CURVE","ElderArtifacts":"ART","EldritchGlyphs":"GLYPHS","SummoningEngine":"ENGINE"}
with open(sys.argv[1], "w") as f:
    for cn, var in mapping.items():
        addr = names[cn]
        f.write(f"{var}={addr}\n")
        print(f"  {var}={addr}")
PY
fi
source "$OUT"

# ── Phase A2: wait for VRF consumer registration (sub owner action) ──────────
echo ""
echo "=== ACTION REQUIRED (VRF subscription owner) — run from the deployer keystore: ==="
echo ""
echo "  cast send $VRF_COORDINATOR 'addConsumer(uint256,address)' $VRF_SUBSCRIPTION_ID $GLYPHS \\"
echo "    --rpc-url \$SEPOLIA_RPC_URL --account deployer"
echo ""
echo "Polling the coordinator until the consumer appears..."
for i in $(seq 1 360); do
  # NOTE: raw `cast call` here, NOT the call() helper — call()'s annotation-stripping
  # sed also eats the bracketed consumers array, which made this poll blind forever.
  if cast call --rpc-url "$RPC" "$VRF_COORDINATOR" "getSubscription(uint256)(uint96,uint96,uint64,address,address[])" "$VRF_SUBSCRIPTION_ID" \
      | tr '[:upper:]' '[:lower:]' | grep -q "$(echo "$GLYPHS" | tr '[:upper:]' '[:lower:]')"; then
    echo "  ✓ consumer registered"; break
  fi
  [ "$i" = 360 ] && { echo "  ✗ timed out waiting for addConsumer (60 min)"; exit 1; }
  sleep 10
done

# ── Phase B: the real game loop ──────────────────────────────────────────────
echo "=== B1: idle state — genesis preview ==="
assert_eq "currentEpochId" "0" "$(call "$ENGINE" 'currentEpochId()(uint256)')"
assert_eq "idle nextThreshold (genesis)" "$(w 75000)" "$(call "$ENGINE" 'nextThreshold()(uint256)')"

echo "=== B2: mint ~600 RITUAL through the real curve ==="
QUOTE=$(call "$CURVE" "getTokensOut(uint256)(uint256)" "$(w 0.07)")
MIN_OUT=$(python3 -c "print(int($QUOTE)*99//100)")
send "$CURVE" "mint(uint256)" "$MIN_OUT" --value "$(w 0.07)"
BALT=$(call "$TOKEN" "balanceOf(address)(uint256)" "$ME")
echo "  ✓ minted $(cast from-wei "$BALT") RITUAL for 0.07 ETH"
send "$TOKEN" "approve(address,uint256)" "$ENGINE" "$(w 1000000)"

echo "=== B3: 100-RITUAL sacrifice auto-opens epoch 1 (genesis 75k, Cthulhu, no gathering) ==="
send "$ENGINE" "commitRitual(uint256)" "$(w 100)"
E=$(call "$ENGINE" "$EPOCH_SIG" 1)
assert_eq "epoch1 oldOneId"   "1"          "$(field "$E" 1)"
assert_eq "epoch1 threshold"  "$(w 75000)" "$(field "$E" 2)"
assert_eq "epoch1 committed"  "$(w 100)"   "$(field "$E" 3)"
RS=$(field "$E" 5); RE=$(field "$E" 6)
assert_eq "ritual window = 300s (gathering collapsed)" "300" "$((RE - RS))"
assert_eq "nextThreshold while active" "0" "$(call "$ENGINE" 'nextThreshold()(uint256)')"

echo "=== B4: wait out the ritual (300s) → permissionless resolve → LOSS ==="
NOW=$(cast block latest --rpc-url "$RPC" -f timestamp); WAIT=$((RE - NOW + 15)); [ "$WAIT" -gt 0 ] && { echo "  (waiting ${WAIT}s)"; sleep "$WAIT"; }
send "$ENGINE" "resolveEpoch()"
E=$(call "$ENGINE" "$EPOCH_SIG" 1)
assert_eq "epoch1 resolved"   "true"  "$(field "$E" 8)"
assert_eq "epoch1 successful" "false" "$(field "$E" 7)"
assert_eq "loss decay 75k→56,250" "$(w 56250)" "$(call "$ENGINE" 'nextThreshold()(uint256)')"

echo "=== B5: claimGlyphs(1) → REAL Chainlink VRF round trip ==="
send "$ENGINE" "claimGlyphs(uint256)" 1
echo "  claim tx sent (1 glyph, 100 RITUAL contribution) — polling VRF fulfillment..."
for i in $(seq 1 60); do
  GC=$(call "$GLYPHS" "glyphCount(address)(uint256)" "$ME")
  [ "$GC" = "1" ] && { echo "  ✓ VRF fulfilled — glyph minted (glyphCount=1)"; break; }
  [ "$i" = 60 ] && { echo "  ✗ VRF not fulfilled after 10 min — check LINK balance on sub"; exit 1; }
  sleep 10
done

echo "=== B6: claimReward(1) → Shattered Ritual (failed epoch, tokenId 1000) ==="
send "$ENGINE" "claimReward(uint256)" 1
assert_eq "Shattered Ritual balance" "1" "$(call "$ART" 'balanceOf(address,uint256)(uint256)' "$ME" 1000)"

echo "=== B7: next sacrifice auto-opens epoch 2 at the decayed threshold, SAME Old One ==="
send "$ENGINE" "commitRitual(uint256)" "$(w 1)"
E=$(call "$ENGINE" "$EPOCH_SIG" 2)
assert_eq "epoch2 oldOneId (retry)"    "1"          "$(field "$E" 1)"
assert_eq "epoch2 threshold (decayed)" "$(w 56250)" "$(field "$E" 2)"
RE=$(field "$E" 6)
NOW=$(cast block latest --rpc-url "$RPC" -f timestamp); WAIT=$((RE - NOW + 15)); [ "$WAIT" -gt 0 ] && { echo "  (waiting ${WAIT}s)"; sleep "$WAIT"; }
send "$ENGINE" "resolveEpoch()"   # fails again (1 RITUAL committed)
assert_eq "epoch2 resolved" "true" "$(field "$(call "$ENGINE" "$EPOCH_SIG" 2)" 8)"

echo "=== B8: owner override (L-01 path) — small-threshold epoch 3, then WIN it ==="
send "$ENGINE" "startEpoch(uint256,uint256)" 1 "$(w 200)"
sleep 31                                        # sacrifice cooldown
send "$ENGINE" "commitRitual(uint256)" "$(w 200)"
E=$(call "$ENGINE" "$EPOCH_SIG" 3)
assert_eq "epoch3 committed meets threshold" "$(w 200)" "$(field "$E" 3)"
RE=$(field "$E" 6)
NOW=$(cast block latest --rpc-url "$RPC" -f timestamp); WAIT=$((RE - NOW + 15)); [ "$WAIT" -gt 0 ] && { echo "  (waiting ${WAIT}s)"; sleep "$WAIT"; }
send "$ENGINE" "resolveEpoch()"
E=$(call "$ENGINE" "$EPOCH_SIG" 3)
assert_eq "epoch3 successful (WIN)" "true" "$(field "$E" 7)"
assert_eq "win escalation +150k"    "$(w 150200)" "$(call "$ENGINE" 'nextThreshold()(uint256)')"

echo "=== B9: Harbinger artifact (sole contributor, M-01) + Old One advances on next open ==="
send "$ENGINE" "claimReward(uint256)" 3
assert_eq "Harbinger balance (tokenId 3001)" "1" "$(call "$ART" 'balanceOf(address,uint256)(uint256)' "$ME" 3001)"
send "$ENGINE" "commitRitual(uint256)" "$(w 1)"
E=$(call "$ENGINE" "$EPOCH_SIG" 4)
assert_eq "epoch4 oldOneId (advanced 1→2)" "2"           "$(field "$E" 1)"
assert_eq "epoch4 threshold (+150k)"       "$(w 150200)" "$(field "$E" 2)"

echo ""
echo "=== ✓ SEPOLIA FULL-STACK REHEARSAL PASSED ==="
echo "Addresses saved to $OUT (for backend/frontend cutover):"
cat "$OUT"
echo "Epoch 4 left open (resolves 300s after its open; keeper can take it)."
