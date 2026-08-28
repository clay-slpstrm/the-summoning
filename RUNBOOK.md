# RUNBOOK — Operating the Self-Perpetuating Summoning

> **✅ LIVE ON MAINNET (2026-08-28).** The self-perpetuating engine is deployed
> (`0x5029…98d0`, block 25855277, Etherscan-verified + verify-bytecode full match) and the
> Safe has re-pointed both NFT contracts at it (`artifacts.setEngine` + `glyphs.setEngine`,
> executed 2-of-3). The old owner-driven engine (`0x5D47…5be5`) is retired — do not
> interact with it. Sepolia rehearsal record: AUDIT-PHASE0.md + memory. The prior
> manual-start SOP is preserved in git history.

**There is no owner in the gameplay loop.** Epochs open on demand and escalate on-chain:
the first `commitRitual` when no epoch is active or the current one is resolved auto-opens
a **24h ritual** (Gathering collapsed), threshold and Old One derive on-chain, and after
`resolveEpoch` the contract sits idle until the next sacrifice opens the next epoch. No
`startEpoch`, no per-epoch threshold choice, no per-epoch runbook. Operations are limited
to **keeping the keeper + VRF healthy, watching alerts, and emergency levers.**

## Addresses (mainnet, live)

| Contract | Address |
|---|---|
| SummoningEngine | `0x5029DDfcb2f6BA72f7C618FFd8B1237c246298d0` (self-perpetuating, deployed 2026-08-28 @ block 25855277) |
| RitualToken | `0x8daA5B21136de9B5ac43fd89fDc98cDe934E7863` |
| MintingCurve | `0x8c7c1C76f32277EDc12B28440224fEF0f6985462` |
| ElderArtifacts | `0x832436cdf21d6732fAfD22938ee2b7617D74af5A` |
| EldritchGlyphs | `0xe820607743E95a694Aa50a9BFFf628C3E202D156` |
| Safe (owner, 2-of-3) | `0x67c6f1dA08Cd99A661ec6f77A060E985d9672baB` |

`RPC` below means any mainnet RPC URL (e.g. the Alchemy endpoint in `backend/.env.mainnet`).


## Old One IDs (on-chain rotation: advance-on-win looping 5→1, retry-on-loss)

| id | Name | Subtitle |
|---|---|---|
| 1 | Cthulhu | The Dreaming One Stirs |
| 2 | Nyarlathotep | The Crawling Chaos Whispers |
| 3 | Azathoth | The Blind Idiot God Writhes |
| 4 | Shub-Niggurath | The Black Goat Breeds |
| 5 | Yog-Sothoth | The Gate Opens |

Artifact art for all 5 ids × 4 tiers is live on the metadata API.

## On-chain threshold escalation (no operator input)

- **Genesis (epoch 1):** `GENESIS_THRESHOLD` = 75k RITUAL, Old One 1 (Cthulhu).
- **Win:** next threshold = prior **+ 150k** (`WIN_INCREMENT`, a fixed additive → linear
  ramp), Old One advances (loops 5→1). First-five-wins arc: 75k → 225k → 375k → 525k → 675k.
- **Loss:** next threshold = prior **× 0.75**, floored at 25k (`THRESHOLD_FLOOR`); same Old
  One retries ("the cult regroups"). A summoning is always reachable.
- `nextThreshold()` returns exactly what the next auto-opened epoch will use (the frontend
  previews it during the idle gap). The old advisory 1.3×/0.8× view and the season-one
  ×2/×0.5 override are gone — escalation is fully on-chain.

## Launch

The First Cultists drop is the launch trigger: one of the seeded wallets sacrificing opens
epoch 1 (genesis 75k, Cthulhu). No Safe transaction starts the game. Have the announcement
ready — the 24h ritual clock starts the instant the first sacrifice lands.

## Standing health checks (not per-epoch — just keep these green)

- [ ] **Keeper armed:** Render boot logs show `[KEEPER] Epoch keeper started (wallet 0x…)`
  (not the "disabled" warning); `KEEPER_PRIVATE_KEY` set.
- [ ] **Keeper gas:** wallet holds ≥ 0.005 ETH — `cast balance <keeper-wallet> --rpc-url $RPC`.
  `low_keeper_eth` alerts below the floor.
- [ ] **Alerts wired:** `ALERT_WEBHOOK_URL` / Telegram set so `keeper_error`,
  `epoch_resolution_overdue`, `low_keeper_eth`, `stuck_vrf`, `low_link` actually reach you.
- [ ] **VRF funded:** subscription `52852180…590203` at vrf.chain.link kept above the 5-LINK
  floor (glyph claims fail-closed but are retryable; not gameplay-blocking).
- [ ] **Backend + frontend up:** `curl https://api.thesummoning.xyz/health` → `ok`;
  https://thesummoning.xyz loads and shows current chain state. (`/api/health` may say
  `degraded` on a quiet chain — that heartbeat only ticks on real events; not a blocker.)
- [ ] **Database quota (Neon):** the always-on backend keeps compute awake 24/7
  (~182 CU-hrs/month at the 0.25 CU floor) — the free tier's 100 CU-hrs dies mid-month
  **silently** (learned 2026-08: DB was down ~9 days unnoticed pre-launch; whole API
  502s and every DB-touching request crash-loops the service). Stay on a paid plan
  (Launch, ~$19/mo at current shape) and glance at the console usage meter monthly.
  Cost-reduction option (post-launch project): Neon pooled connection string +
  slower periodic DB jobs → compute can scale to zero → ~$2-4/mo.
- [ ] **External uptime monitor on `/health` is MANDATORY, not optional** — it is the
  only alarm that still works when the DB or the whole service is down (all other
  alerts route through the backend itself). 5-min interval, alert-on-non-200.

## Resolution (automatic; manual fallback)

At `ritualEnd` the self-hosted keeper (`backend/src/services/epochKeeper.ts`, polls every
60s) simulates and sends the **permissionless** `resolveEpoch()`. It emits an
`epoch_resolved` alert carrying the outcome and the on-chain `nextThreshold()` (info only —
no action needed; the next epoch auto-opens on the next sacrifice).

- [ ] Expect `resolved == true` within ~15 min of ritualEnd.
- [ ] If not, an `epoch_resolution_overdue` alert fires at 30 min. Resolve manually — anyone
  can, once ritualEnd passes:
  ```bash
  cast send 0x5029DDfcb2f6BA72f7C618FFd8B1237c246298d0 "resolveEpoch()" --rpc-url $RPC --account <any-funded-account>
  ```
  Then check Render `[KEEPER]` logs for the root cause (out of gas ETH? RPC failing?).

Players self-serve after resolution, success or failure alike:
- `claimGlyphs(epochId)` — one VRF batch per wallet, 1 glyph per 100 RITUAL burned, cap 20.
  Retryable if VRF is down; watch `stuck_vrf` alerts.
- `claimReward(epochId)` — mints the artifact: Harbinger (tier 1, top ~1% / sole contributor
  M-01), Acolyte (tier 2, top ~10%), Cultist (tier 3, any contribution), or **Shattered
  Ritual** (tier 0) on a failed epoch. Contributions never carry across epochs.

## Emergency levers (owner / Safe)

- **Pause:** `SummoningEngine.pause()` halts `commitRitual` / `claimGlyphs` / `claimReward`
  during an incident. `resolveEpoch` stays live so in-flight epochs still settle. `unpause()`
  to resume. Same for `MintingCurve.pause()`.
- **Owner override:** `startEpoch(oldOneId, threshold)` survives as an `onlyOwner`
  bootstrap/emergency path (e.g. to seed a custom genesis or intervene after an incident). It
  is never required for normal play; the next auto-open derives from whatever it sets.
- **Treasury sweep:** `MintingCurve.withdraw(to)` from the Safe (Transaction Builder;
  `cast calldata "withdraw(address)" <safe>`). Cadence is a policy choice, not per-epoch.

## Quick reference

```text
Lifecycle:       idle → first sacrifice auto-opens 24h ritual → resolveEpoch → idle → repeat
Genesis:         75k RITUAL, Cthulhu (id 1); opened by the first sacrifice, no Safe tx
Threshold:       WIN += 150k (linear); LOSS ×0.75, floor 25k — all on-chain (nextThreshold())
Old One:         advance-on-win (loop 5→1), retry-on-loss
First-5-wins:    75k → 225k → 375k → 525k → 675k
resolveEpoch():  permissionless after ritualEnd — manual fallback for the keeper
Epoch keeper:    backend/src/services/epochKeeper.ts, KEEPER_PRIVATE_KEY on Render (resolve-only)
Owner override:  startEpoch(oldOneId, thresholdWei) — emergency bootstrap only
Revenue rule:    ≈ 0.0001136 ETH per RITUAL minted (flat until ~10M supply)
```
