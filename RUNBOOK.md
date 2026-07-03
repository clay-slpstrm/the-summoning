# RUNBOOK — Starting & Cycling Summoning Epochs

> Operational checklist for opening each ritual on Ethereum mainnet.
> Follow top-to-bottom every time. One epoch = 48h Gathering + 24h Ritual = 72h total.
> **The clock starts the instant `startEpoch` executes** — do not execute until you
> are ready to announce.

## Addresses (mainnet, deployed 2026-07-01 @ block 25439683)

| Contract | Address |
|---|---|
| SummoningEngine | `0x5D474E68c08B2aF16dFEd50377B98573e17a5be5` |
| RitualToken | `0x8daA5B21136de9B5ac43fd89fDc98cDe934E7863` |
| MintingCurve | `0x8c7c1C76f32277EDc12B28440224fEF0f6985462` |
| ElderArtifacts | `0x832436cdf21d6732fAfD22938ee2b7617D74af5A` |
| EldritchGlyphs | `0xe820607743E95a694Aa50a9BFFf628C3E202D156` |
| Safe (owner, 2-of-3) | `0x67c6f1dA08Cd99A661ec6f77A060E985d9672baB` |

`RPC` below means any mainnet RPC URL (e.g. the Alchemy endpoint in `backend/.env.mainnet`).

## Old One IDs

| id | Name | Subtitle |
|---|---|---|
| 1 | Cthulhu | The Dreaming One Stirs |
| 2 | Nyarlathotep | The Crawling Chaos Whispers |
| 3 | Azathoth | The Blind Idiot God Writhes |
| 4 | Shub-Niggurath | The Black Goat Breeds |
| 5 | Yog-Sothoth | The Gate Opens |

An id is a passthrough label — reusing one (e.g. retrying a failed summoning) is valid.
Artifact art for all 5 ids × 4 tiers is already live on the metadata API.

---

## Part 1 — Pre-flight checklist (run before EVERY startEpoch)

- [ ] **1.1 Prior epoch resolved** (skip for epoch 1). Must print `true`:
  ```bash
  cast call 0x5D474E68c08B2aF16dFEd50377B98573e17a5be5 "currentEpochId()(uint256)" --rpc-url $RPC
  # then, with that id:
  cast call 0x5D474E68c08B2aF16dFEd50377B98573e17a5be5 \
    "getEpoch(uint256)(uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,uint256)" <epochId> --rpc-url $RPC
  # field 8 of 9 = resolved. startEpoch REVERTS if the prior epoch is unresolved.
  ```
- [ ] **1.2 Nothing paused**:
  ```bash
  cast call 0x8c7c1C76f32277EDc12B28440224fEF0f6985462 "paused()(bool)" --rpc-url $RPC   # curve
  cast call 0x5D474E68c08B2aF16dFEd50377B98573e17a5be5 "paused()(bool)" --rpc-url $RPC   # engine
  ```
- [ ] **1.3 Backend healthy**: `curl https://api.thesummoning.xyz/health` → `ok`, and
  Render logs show the 60s `[EPOCH]` tick. (`/api/health` may say `degraded` on a
  quiet chain — that heartbeat only ticks on real events and is not a blocker.)
- [ ] **1.4 Frontend live**: https://thesummoning.xyz loads and shows current chain state.
- [ ] **1.5 VRF subscription funded** (glyph claims fail-closed without it; claims are
  retryable so this is not epoch-blocking, but fix before Ritual phase):
  subscription `52852180…590203` at vrf.chain.link — keep well above the 5-LINK
  alert floor. Low-LINK watchdog alerts via backend if configured.
- [ ] **1.6 Automation upkeep funded** (auto-resolve at ritualEnd): check the
  SummoningEngine upkeep at automation.chain.link has LINK. Fallback if it lapses:
  `resolveEpoch()` is **permissionless** — anyone can call it once ritualEnd passes:
  ```bash
  cast send 0x5D474E68c08B2aF16dFEd50377B98573e17a5be5 "resolveEpoch()" --rpc-url $RPC --account <any-funded-account>
  ```
- [ ] **1.7 Announcement drafted** — post goes out the moment the Safe tx executes.

## Part 2 — Choose the parameters

### threshold (in $RITUAL, pass as wei: value × 1e18)

- **Epoch 1**: `50000e18` = `50000000000000000000000` (50k RITUAL ≈ 5.7 ETH collective;
  ~25 "full-pack" wallets of 2,000 RITUAL each).
- **Every later epoch**: read the built-in policy suggestion (1.3× after success,
  0.8× after failure):
  ```bash
  cast call 0x5D474E68c08B2aF16dFEd50377B98573e17a5be5 "nextThreshold()(uint256)" --rpc-url $RPC
  ```
  Returns wei — pass it through unchanged unless overriding. **Override cases:**
  - Prior epoch overshot massively (totalCommitted ≥ 2× threshold) → consider more than 1.3×.
  - Community shrank / engagement soft → consider holding flat instead of 1.3×.
  - Never pass 0 (reverts).

### oldOneId

- Success → advance to the next Old One in your arc (suggested order 1→5).
- Failure → **reuse the same oldOneId** at the reduced threshold ("the cult regroups").

## Part 3 — Execute startEpoch from the Safe

1. Open the Safe (`0x67c6…2baB`) → **Transaction Builder** app.
2. Target address: `0x5D474E68c08B2aF16dFEd50377B98573e17a5be5`.
3. If the ABI loads, pick `startEpoch` and fill `oldOneId` + `threshold` (wei).
   If it does not load (has happened before), toggle **Custom data** and paste hex:
   ```bash
   cast calldata "startEpoch(uint256,uint256)" <oldOneId> <thresholdWei>
   # e.g. epoch 1 (Cthulhu, 50k):
   # 0xfb8afa7f00…01…0a968163f0a57b400000   (selector 0xfb8afa7f)
   ```
   ETH value: 0.
4. **Simulate (Tenderly) before signing** — must pass. (Reminder from the wiring
   batch: the "delegate call" warning appears only for MultiSend batches; a single
   startEpoch is a plain call and should show no such warning. Ignore any stale
   Sepolia tabs — check the simulation is chainId 1.)
5. Collect 2-of-3 signatures, execute.

## Part 4 — Post-start verification (within ~10 minutes)

- [ ] `currentEpochId` incremented; `getEpoch(<new id>)` shows your threshold,
  oldOneId, `gatheringStart` = execution timestamp.
- [ ] Backend: `curl https://api.thesummoning.xyz/api/epochs/current` returns the new
  epoch with `phase: "Gathering"` (60s poll + EpochStarted watcher; allow a minute).
- [ ] Frontend: https://thesummoning.xyz header shows "Epoch N, <subtitle>", portal at
  0%, epoch card shows Gathering countdown.
- [ ] Publish the announcement.

## Part 5 — During the epoch (no owner actions required)

- T+0 → T+48h **Gathering**: minting only; sacrifices revert until ritualStart.
- T+48h → T+72h **Ritual**: `commitRitual` open (min 1 RITUAL, 30s cooldown per wallet).
  Portal % = totalCommitted / threshold, shared by all viewers.
- T+72h **ritualEnd**: Chainlink Automation calls `performUpkeep` → epoch resolves.
  - [ ] Verify an `EpochResolved` event / `resolved == true` within ~15 min of ritualEnd.
  - [ ] If not: call permissionless `resolveEpoch()` manually (see 1.6) and investigate
    the upkeep (out of LINK? paused?).
- Players self-serve after resolution — **success or failure alike**:
  - `claimGlyphs(epochId)`: one VRF batch per wallet, 1 glyph per 100 RITUAL burned,
    cap 20. Works regardless of outcome. If VRF is down the claim reverts cleanly
    and can be retried; watch backend `stuck_vrf` alerts.
  - `claimReward(epochId)`: mints the artifact (see Part 6/7).

---

## Part 6 — SUCCESS path (totalCommitted ≥ threshold)

What players get via `claimReward`:
| Contribution rank | Artifact (ERC-1155 `epochId*1000 + tier`) |
|---|---|
| Top ~1% (or sole contributor, M-01) | Harbinger (tier 1) |
| Top ~10% | Acolyte (tier 2) |
| Everyone else with any contribution | Cultist (tier 3) |

Operator checklist:
- [ ] Announce the successful summoning + claim window is open (no deadline exists,
  but prompt claiming keeps energy up).
- [ ] `nextThreshold()` now returns **1.3× the epoch's threshold** — decide next
  threshold (Part 2) and next Old One (advance the arc).
- [ ] Optional treasury sweep: `MintingCurve.withdraw(to)` from the Safe (Transaction
  Builder; selector via `cast calldata "withdraw(address)" <safe>`). Curve keeps
  working with a zero balance; sweep cadence is a policy choice, not required per epoch.
- [ ] When ready (any time — there is no forced gap), run this runbook again from Part 1.

## Part 7 — FAILURE path (totalCommitted < threshold)

What players get: glyphs as normal via `claimGlyphs`, and `claimReward` mints the
**Shattered Ritual** (tier 0) — the failure memento. **No Old One artifact exists for
a failed epoch, and contributions never carry over**; earning an artifact requires
contributing again in a later successful epoch.

Operator checklist:
- [ ] Announce honestly: summoning failed, the Old One did not come through; glyphs +
  Shattered Ritual are claimable now. (Shattered Ritual scarcity is a feature — lean in.)
- [ ] `nextThreshold()` now returns **0.8× the epoch's threshold**.
- [ ] Strongly consider **retrying the same oldOneId** at the reduced threshold —
  narrative continuity ("the veil resisted; the cult regroups").
- [ ] Diagnose before restarting: was the threshold too high for the audience, or did
  the Ritual window catch a dead 24h (weekend/timezone)? Time the next startEpoch so
  the Ritual phase (T+48h→T+72h) lands in peak hours.
- [ ] Two consecutive failures → pause and rethink sizing with the table in the
  threshold analysis (52k RITUAL ≈ full-pack × 25 wallets) rather than grinding 0.8×.

## Quick reference

```text
startEpoch selector:   0xfb8afa7f  — startEpoch(uint256 oldOneId, uint256 thresholdWei)
50k RITUAL in wei:     50000000000000000000000
Epoch timing:          gathering 48h → ritual 24h → auto-resolve
Threshold policy:      success ×1.3, failure ×0.8  (advisory via nextThreshold(); owner may override)
resolveEpoch():        permissionless after ritualEnd — manual fallback for Automation
Full-pack unit:        2,000 RITUAL/wallet = 20-glyph claim cap ≈ 0.23 ETH
Revenue rule of thumb: ≈ 0.0001136 ETH per RITUAL minted (flat until ~10M supply)
```
