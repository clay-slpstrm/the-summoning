# The Summoning — Phase 0 Security Review (Self-Perpetuating Epochs)

| Field | Value |
|---|---|
| **Auditor** | Claude (Anthropic), engaged in-house by clay-slpstrm |
| **Date** | 2026-08-13 |
| **Scope** | The Phase 0 diff to `SummoningEngine.sol` (demand-driven auto-open + on-chain escalation), plus an interaction-regression pass over the four unchanged deployed contracts and the redeploy wiring plan |
| **Baseline** | `AUDIT.md` (internal audit 2026-05-11, post-audit fixes C-01/C-02/H-01…H-05/M-01 applied and live on mainnet) |
| **Commit reviewed** | branch `phase-0-self-perpetuating` @ `4467be5` (+ fixes produced by this review) |
| **Compiler** | Solidity 0.8.24, optimizer 200 runs |
| **Methodology** | Line-by-line review of the diff, threat modeling / attack-scenario walkthroughs, red-green proof-of-concept tests, 246-test suite with 10,000-run fuzzing, branch-coverage analysis (100% on SummoningEngine), live-node end-to-end rehearsal (anvil). Static-analysis tooling (slither) was **not** available in the environment — stated as a limitation. |
| **Status** | 0 Critical · 1 High (FIXED) · 0 Medium · 2 Low (1 FIXED, 1 acknowledged) · 5 Informational |

---

## 1. Executive Summary

Phase 0 replaces the owner-driven epoch lifecycle with a self-perpetuating one:
`commitRitual` auto-opens the next epoch when none is active or the current one is
resolved, and the threshold and Old One escalate on-chain
(`GENESIS_THRESHOLD` 75k; win `+WIN_INCREMENT` 150k; loss `×3/4` floored at
`THRESHOLD_FLOOR` 25k; Old One advances on win looping 5→1, retries on loss).

The new attack surface is small and well-contained: `_openNextEpoch` makes **no
external calls**, executes inside the existing `nonReentrant whenNotPaused` guard,
and derives all inputs from prior on-chain state. The escalation math cannot
overflow, cannot produce a zero threshold, and cannot open two concurrent epochs.
Classical categories (reentrancy, access control, overflow, event integrity) are
clean.

The review found **one High defect** — auto-open stamped the ritual window with the
gathering offset, so any deploy with a nonzero `GATHERING_DURATION` (still possible
via the `GATHERING_DURATION_SECONDS` env override in `DeploySepolia`) would have
**silently bricked the entire self-perpetuating loop**: the opening sacrifice always
reverted against the phase check of the very epoch it created. This was demonstrated
with a failing regression test, fixed (auto-opened epochs now always stamp
`ritualStart = now`), and re-verified end-to-end on a live node. One Low hardening
(bounds-checking the owner override's `oldOneId`, which now feeds the on-chain
rotation) was also fixed. One Low liveness observation and five informational items
are documented below; none block the Sepolia rehearsal.

**Post-fix verification: 246/246 tests, 16/16 fuzz tests at 10,000 runs, 100%
line/statement/branch/function coverage on SummoningEngine, and the full
auto-open → win → loss → retry → re-advance loop passing against a live node.**

---

## 2. Scope & Trust Model

**In scope (changed, will be redeployed):**
- `contracts/src/SummoningEngine.sol` — auto-open, escalation internals, view changes, constructor relaxation, owner-override retention.
- `contracts/script/DeployMainnet.s.sol`, `DeploySepolia.s.sol` — gathering=0 defaults.

**Interaction-regression pass only (unchanged, live on mainnet — no code changes made):**
- `RitualToken.sol`, `MintingCurve.sol`, `ElderArtifacts.sol`, `EldritchGlyphs.sol`.

**Trust model:** owner is a 2-of-3 Safe; the keeper key is deliberately powerless
(`resolveEpoch` is permissionless); Chainlink VRF coordinator is trusted for glyph
randomness; there is **no owner in the gameplay loop** post-Phase 0 — the pause
switch and the neutered `startEpoch` override are the only owner powers on the engine.

---

## 3. Findings

### H-01 — Auto-open stamped `ritualStart` with the gathering offset, bricking the self-perpetuating loop on any nonzero-gathering deploy **(FIXED)**

**Location:** `SummoningEngine._openNextEpoch`

**Defect.** `_openNextEpoch` set
`ritualStart = block.timestamp + GATHERING_DURATION` and
`ritualEnd = block.timestamp + GATHERING_DURATION + RITUAL_DURATION`. Immediately
after auto-opening, `commitRitual` applies its own phase check
(`block.timestamp < epoch.ritualStart → revert InvalidPhase`). With any
`GATHERING_DURATION > 0`, the opening sacrifice therefore **always reverted against
the window it had just created**, rolling back the epoch creation with it. Auto-open
could never succeed; the game silently degraded to owner-driven `startEpoch` — the
exact failure mode Phase 0 exists to eliminate.

**Reachability.** Mainnet/Sepolia scripts default gathering to 0, but
`DeploySepolia` accepts a `GATHERING_DURATION_SECONDS` env override, and the
constructor deliberately accepts any value. One stray env var in a future deploy
would have shipped the brick. No funds were ever at risk (the revert is atomic);
severity is High because the protocol's core loop is disabled by a plausible,
silent misconfiguration.

**Proof.** `test_AutoOpen_WorksWithPositiveGatheringDuration` was written first and
failed with `SummoningEngine__InvalidPhase()` against the pre-fix code (red), then
passed post-fix (green).

**Fix.** Auto-opened epochs now always stamp `ritualStart = block.timestamp`,
`ritualEnd = block.timestamp + RITUAL_DURATION`, ignoring `GATHERING_DURATION` by
design — a gather window only applies to owner-forced `startEpoch`. This also
matches what ARCHITECTURE.md already documented (“stamps ritualStart = now”); the
code now agrees with the spec.

---

### L-01 — Owner override accepted out-of-range `oldOneId`, corrupting the on-chain rotation **(FIXED)**

**Location:** `SummoningEngine.startEpoch`

Pre-Phase 0, `oldOneId` was a passthrough label (“reusing one is valid”). Post-Phase 0
it feeds `_computeNextOldOne`, so an owner override with `oldOneId = 0` or `> 5`
would poison every subsequent auto-opened epoch: id 0 on a loss retries id 0
(no artifact art, frontend renders “Unknown”); id 7 on a win snaps to 1 but on a
loss persists 7. Owner-only and Safe-gated, hence Low — but it is a one-line
invariant guard.

**Fix.** `startEpoch` now reverts `SummoningEngine__InvalidOldOne` unless
`1 ≤ oldOneId ≤ OLD_ONE_COUNT`. Boundary tests added (ids 1 and 5 accepted; 0 and 6
rejected).

---

### L-02 — Liveness gap between `ritualEnd` and resolution: sacrifices revert until someone resolves **(acknowledged, no change)**

Once `block.timestamp ≥ ritualEnd`, `commitRitual` reverts (`InvalidPhase`) — the
epoch is closed but not yet `resolved`, so the auto-open branch does not trigger
either. The game stalls until `resolveEpoch` lands.

**Mitigations already in place:** `resolveEpoch` is permissionless; the self-hosted
keeper polls every 60s; an `epoch_resolution_overdue` alert fires at 30 minutes;
`resolveEpoch` is deliberately not pausable. Worst case (keeper dead, nobody calls)
the stall persists but is recoverable by any EOA at ~100k gas.

**Option considered and not taken:** folding resolution into `commitRitual` (if past
`ritualEnd` and unresolved → resolve, then auto-open, in one tx). This would remove
the keeper dependency entirely but changes the locked design (a sacrifice would
both settle epoch N and open N+1, complicating event semantics and the opening-
sacrifice UX). Recommend revisiting only if keeper reliability proves a problem in
practice. Not a launch blocker.

---

### I-01 — Epoch-opening griefing and threshold-decay economics **(informational, accepted design)**

Anyone holding ≥1 RITUAL (~0.0001136 ETH via the curve) can open an epoch at an
adversarial time (e.g., dead weekend hours), making a loss likely and consuming a
24h cycle. Consequences analyzed:

- **Decay farming:** driving the threshold from 75k to the 25k floor takes 4
  consecutive losses ≥ 4 days (75k → 56.25k → 42.19k → 31.64k → 25k). A “cheap”
  floor win then requires burning 25k RITUAL — ~2.84 ETH of minted value paid *into
  the treasury*. The attacker is a paying customer; artifacts carry no
  protocol-funded payout to extract. The +150k win increment immediately restores
  the difficulty ramp.
- **Timing grief:** opening at a bad hour wastes one 24h cycle per 1 RITUAL burned.
  The loss decay is the designed response (the game gets easier until the community
  wins one).
- **Front-running the open:** two racing sacrifices compose safely — the first
  opens, the second lands as a normal contribution in the same epoch; neither
  reverts, no gas grief.

The 25k floor and additive win increment were explicit design decisions
(2026-08-09); the floor guarantees reachability at the cost of cheap-summoning
narrative risk. No change recommended at the contract level; marketing cadence
should assume epochs can open at any time (the announcement flow already does).

---

### I-02 — Opening sacrifice bears the auto-open gas overhead **(informational)**

The first `commitRitual` of each epoch pays for the epoch-struct SSTOREs and
`EpochStarted` emission (~120k extra gas vs. a normal sacrifice, ~$0.01 at 0.03
gwei). Negligible on today's gas regime; worth a frontend tooltip only if gas
spikes. No change.

---

### I-03 — Dead `Inactive` branch removed from `getCurrentPhase` **(informational, cleaned)**

`if (epoch.gatheringStart == 0) return EpochPhase.Inactive` was unreachable: both
epoch writers stamp `gatheringStart = block.timestamp`, and `currentEpochId == 0` is
handled one line above. Removed to keep the engine's 100%-branch-coverage
requirement honest rather than carrying a permanently untestable branch.

---

### I-04 — Pre-existing sub-100% branches in unchanged deployed contracts **(informational, documented only)**

Coverage on the four live contracts (not modified by this review; listed for the
record):

- `EldritchGlyphs.fulfillRandomWords` request-not-found / double-fulfill guards —
  unreachable without a misbehaving VRF coordinator (trusted).
- `EldritchGlyphs._deriveTierFromBracket` terminal `return 4` — unreachable
  (weights sum to exactly 10,000); documented as such in-source.
- `MintingCurve.withdraw` `WithdrawFailed` branch — requires a reverting recipient;
  owner-controlled destination (Safe).
- `MintingCurve._sqrt(0)` guard — unreachable via `mint` (zero-value reverts
  earlier).

All are defensive guards around trusted or impossible states. No action.

---

### I-05 — Redeploy wiring order **(operational)**

After the new engine deploys, `claimReward`/`claimGlyphs` on it revert with
`OnlyEngine` until the Safe executes `ElderArtifacts.setEngine(newEngine)` and
`EldritchGlyphs.setEngine(newEngine)`. Both are single-slot authorities, so the old
engine **loses** mint rights in the same transactions — no dual-authority window in
the other direction. Sequence for cutover:

1. Deploy new engine (`DeployMainnet` — gathering hard-coded 0, ritual 24h).
2. Safe (2-of-3): `artifacts.setEngine(new)` + `glyphs.setEngine(new)` — batch both.
3. `forge verify` + `verify-bytecode`; backend/frontend env cutover.
4. Only then announce. First claims occur ≥24h after the first sacrifice, so the
   window is generous, but wiring before announcement removes it entirely.
5. The Safe must never call `startEpoch` on the **old** engine post-cutover (it
   would mint artifacts from a contract the NFTs no longer authorize — harmless but
   confusing). Recommend treating the old engine address as retired.

`RitualToken` needs no change (the engine burns via allowance; only the curve
mints). The VRF subscription is unaffected (glyphs contract unchanged).

---

## 4. Areas Reviewed and Found Clean

- **Reentrancy.** `_openNextEpoch` makes no external calls. `commitRitual` follows
  CEI (cooldown + contribution accounting before `burnFrom`); `RitualToken` is
  hook-free OZ ERC-20. `claimReward`'s ERC-1155 receiver callback cannot re-enter
  any guarded function (shared `nonReentrant` state), and re-entering unguarded
  `resolveEpoch` is benign (idempotence enforced by `resolved` check).
- **Escalation math.** `+150k` per win cannot realistically overflow uint256;
  `(prior × 3) / 4` multiplies before dividing with no overflow below 2²⁵⁴;
  threshold can never reach 0 (genesis 75k, win adds, loss floors at 25k, override
  rejects 0). A threshold escalated beyond mintable supply (1B cap) self-corrects
  via loss decay.
- **Epoch-state invariants.** Exactly one epoch can be open (both writers require
  the prior epoch resolved); auto-opened epochs always have ≥1 participant;
  contributions are keyed by epochId with no carry-over; `lastSacrificeTime`
  cooldown composes correctly across epoch boundaries.
- **Event integrity.** The opening sacrifice emits `EpochStarted` then
  `RitualSacrifice` in one tx, both with correct values (verified by
  `expectEmit` ordering test); indexers were updated for this in the Phase 0
  backend work.
- **Automation surface.** `performUpkeep` still validates epoch id, resolution
  state, and timing independently of `checkUpkeep`; both remain permissionless-safe
  post-Chainlink-sunset.
- **Pause semantics.** `pause` blocks `commitRitual` (and therefore auto-open),
  `claimGlyphs`, `claimReward`; `resolveEpoch` stays live so an in-flight epoch
  settles during an incident.
- **Timestamp manipulation.** ±15s of miner drift is immaterial against a 24h
  window and a 30s cooldown.
- **Interface drift.** `ISummoningEngine.sol` has no on-chain consumers and all its
  declared signatures remain accurate; frontend/backend ABIs (`lib/contracts.ts`,
  service ABIs) require no changes for this diff.

---

## 5. Verification Evidence

| Check | Result |
|---|---|
| Full test suite | **246/246 pass** (5 suites; 108 on SummoningEngine) |
| Fuzzing | 16/16 fuzz tests at **10,000 runs**, incl. escalation math (win increment, loss decay + floor) |
| Glyph tier distribution | 5 bracket distribution tests (10,000 seeds each) pass, ±2% tolerance |
| Coverage — SummoningEngine | **100% lines / 100% statements / 100% branches / 100% functions** |
| H-01 red-green | Regression test fails pre-fix (`InvalidPhase`), passes post-fix |
| Live-node rehearsal | `script/rehearse_selfperpetuating.sh` on anvil: idle genesis preview → auto-open → win (+150k, advance) → loss (×0.75, retry) → win from decayed → re-advance — all assertions pass post-fix |

## 6. Remediation Summary

| ID | Severity | Status | Change |
|---|---|---|---|
| H-01 | High | **Fixed** | `_openNextEpoch` stamps `ritualStart = now` / `ritualEnd = now + RITUAL_DURATION`, ignoring `GATHERING_DURATION`; regression test added |
| L-01 | Low | **Fixed** | `startEpoch` bounds-checks `oldOneId ∈ [1, OLD_ONE_COUNT]` (`SummoningEngine__InvalidOldOne`); boundary tests added |
| L-02 | Low | Acknowledged | Liveness gap pre-resolution; mitigated by permissionless resolve + keeper + overdue alert |
| I-01…I-05 | Info | Documented | No code changes (I-03's dead branch removed for coverage integrity) |

## 7. Disclaimer

Internal review by an AI auditor, not a substitute for an independent third-party
audit. Findings reflect the reviewed commit only; economic observations (I-01)
assume the current bonding-curve pricing and no external market for RITUAL.

---

## Addendum (2026-09-03): `Offering.sol` — self-serve First Cultists claim

Small new mainnet contract (~70 lines) replacing the hand-curated drop. Reviewed
with the same lens as the Phase 0 diff; no findings above Informational.

**Design-level security argument.** $RITUAL has no sell path (no curve buyback,
no pool), so the classic airdrop-sybil profit motive is absent: farming yields
tokens usable only for playing. Residual risk is seat-hoarding, bounded by
MIN_ETH_BALANCE (0.005 ETH per claiming wallet) and DAILY_CLAIM_CAP (25/day →
the 250-seat roll drains over ≥10 days). Deliberately no `tx.origin` gate: it
would exclude AA smart-account users and the damage ceiling does not justify it.

**Checked and clean:** CEI ordering (claimed/counters set before transfer) +
`nonReentrant`; no ETH held; owner (Safe) limited to `sweep` — cannot alter
caps, amounts, or claims; day arithmetic uses integer UTC-day buckets (no
midnight-straddle double-cap); `seatsRemaining` binds on min(cap, funding);
underfunded state reverts `Exhausted` before any state change; re-funding after
sweep re-opens with counters intact (cannot resurrect consumed seats).

**Informational:** the two `Offering__TransferFailed` branches are unreachable
with RitualToken (OZ ERC-20 reverts, never returns false) — defensive guards of
the same class as I-04; accepted uncovered. `msg.sender.balance` check reads
the balance at claim time — trivially satisfiable by moving the same 0.005 ETH
between sybil wallets sequentially, which the daily cap already rate-limits;
the filter's job is stopping zero-effort swarms, not determined humans.

**Verification:** 15 tests (happy path, double-claim, balance floor incl. exact
boundary, daily cap 25th/26th + UTC rollover, full 250-seat exhaustion, sweep
authority/recovery/re-fund, 1000-run fuzz on cap invariants). 100% line / 100%
function coverage; 261/261 repo-wide.
