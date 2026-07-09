---
name: mainnet-status
description: Read-only health check of The Summoning's full mainnet stack (contracts, wiring, epoch state, VRF, backend, frontend). Use before ANY ops change, as RUNBOOK.md Part 1 pre-flight, or when the user asks "is everything ok / what's the current state".
---

# Mainnet Status Check

All checks are read-only. Run them all; report deviations from EXPECTED.

## Setup

```bash
# Prefer the Alchemy URL from backend/.env.mainnet (gitignored); fallback is public.
RPC=$(grep '^RPC_URL=' backend/.env.mainnet 2>/dev/null | cut -d= -f2)
RPC=${RPC:-https://ethereum-rpc.publicnode.com}
```

## Addresses (mainnet, deploy block 25439683)

```
TOKEN=0x8daA5B21136de9B5ac43fd89fDc98cDe934E7863   # RitualToken
CURVE=0x8c7c1C76f32277EDc12B28440224fEF0f6985462   # MintingCurve
ARTIFACTS=0x832436cdf21d6732fAfD22938ee2b7617D74af5A
GLYPHS=0xe820607743E95a694Aa50a9BFFf628C3E202D156
ENGINE=0x5D474E68c08B2aF16dFEd50377B98573e17a5be5  # SummoningEngine
SAFE=0x67c6f1dA08Cd99A661ec6f77A060E985d9672baB    # 2-of-3 owner/treasury
VRF_COORD=0xD7f86b4b8Cae7D942340FF628F82735b7a20893a
VRF_SUB=52852180395622422298976725799065845662039909661842116426618431057701842590203
```

## 1. Wiring invariants (must NEVER change)

```bash
cast call $TOKEN "minter()(address)" --rpc-url $RPC        # EXPECTED: $CURVE
cast call $ARTIFACTS "summoningEngine()(address)" --rpc-url $RPC  # EXPECTED: $ENGINE
cast call $GLYPHS "owner()(address)" --rpc-url $RPC        # EXPECTED: $SAFE
cast call $ENGINE "owner()(address)" --rpc-url $RPC        # EXPECTED: $SAFE
cast call $CURVE "owner()(address)" --rpc-url $RPC         # EXPECTED: $SAFE
```

## 2. Pause flags (expected false in normal ops)

```bash
cast call $CURVE "paused()(bool)" --rpc-url $RPC
cast call $ENGINE "paused()(bool)" --rpc-url $RPC
```

## 3. Epoch state

```bash
cast call $ENGINE "currentEpochId()(uint256)" --rpc-url $RPC
# If > 0:
cast call $ENGINE "getEpoch(uint256)(uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,uint256)" <id> --rpc-url $RPC
# Fields: oldOneId, threshold, totalCommitted, gatheringStart, ritualStart, ritualEnd, successful, resolved, participantCount
# Phase: now < ritualStart = Gathering; < ritualEnd = Ritual; else Resolved (or awaiting resolveEpoch if resolved=false)
```

## 4. VRF subscription (glyph claims depend on it)

```bash
cast call $VRF_COORD "getSubscription(uint256)(uint96,uint96,uint64,address,address[])" $VRF_SUB --rpc-url $RPC
# Field 1 = LINK balance (18 dec). ALERT below 5 LINK. Consumers must include $GLYPHS.
```

## 5. Off-chain surfaces

```bash
curl -s https://api.thesummoning.xyz/health          # expect {"status":"ok",...}
curl -s https://api.thesummoning.xyz/api/health      # "degraded" on a QUIET chain is the KNOWN heartbeat quirk (only ticks on events) — not a fault by itself
curl -s https://api.thesummoning.xyz/api/epochs/current  # must MATCH on-chain epoch state (null when currentEpochId=0)
curl -s -o /dev/null -w "%{http_code}" https://thesummoning.xyz   # expect 200
```

Render logs (dashboard → the-summoning-backend → Logs) should tick `[EPOCH] ...` every 60s.

## Interpretation notes

- Backend serving data that contradicts the chain = env/DB drift; see memory of the 2026-07-02 cutover incident (stale Sepolia values on Render).
- Epoch auto-resolution = the backend's own keeper (`epochKeeper.ts`; Chainlink Automation sunset 2026-07-31). Check Render boot logs for `[KEEPER] Epoch keeper started` and the keeper wallet's gas ETH. `resolveEpoch()` is permissionless after ritualEnd — if the keeper missed it, anyone can call it.
- Treasury balance (info, not fault): `cast balance $CURVE` — all withdrawable by Safe via withdraw().
