# The Summoning — Internal Security Audit Report

| Field | Value |
|---|---|
| **Auditor** | Claude (Anthropic Opus 4.7), engaged in-house by clay-slpstrm |
| **Date** | 2026-05-11 |
| **Scope** | 5 Solidity contracts under `contracts/src/` |
| **Commit** | `7d70da2` (master at audit time) |
| **Compiler** | Solidity 0.8.24, optimizer enabled (200 runs), via_ir false |
| **Frameworks** | OpenZeppelin Contracts v5.x, Chainlink Contracts (VRF V2.5, Automation V2.1) |
| **Methodology** | Line-by-line review, threat modeling, attack-scenario walkthroughs, cross-reference of deployed Sepolia bytecode against committed source |
| **Status** | 2 Critical, 5 High, 5 Medium, 3 Low, 3 Informational |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope](#2-scope)
3. [Methodology & Limitations](#3-methodology--limitations)
4. [Severity Definitions](#4-severity-definitions)
5. [Findings Summary](#5-findings-summary)
6. [Critical Findings](#6-critical-findings)
7. [High Findings](#7-high-findings)
8. [Medium Findings](#8-medium-findings)
9. [Low Findings](#9-low-findings)
10. [Informational](#10-informational)
11. [Remediation Roadmap](#11-remediation-roadmap)
12. [Out of Scope](#12-out-of-scope)
13. [Disclaimer](#13-disclaimer)

---

## 1. Executive Summary

The Summoning's contract suite is small (5 contracts, ~895 LOC) and follows OpenZeppelin patterns conservatively. It is **clean on classical vulnerability categories**: no reentrancy, signature-replay, access-control bypass, or storage-collision issues were identified. The integer math in `MintingCurve` is well-formulated as the integral of a linear curve and resists overflow at realistic supply levels.

The protocol is **not safe to launch** in its current state due to two critical economic findings:

- **C-01** combines a recently-lowered `MIN_SACRIFICE` (1 RITUAL) with per-sacrifice VRF cost (~$3.75 on mainnet). Each sacrifice causes a net protocol loss of ~$3.71 in LINK while collecting only ~$0.04 in mint fees. An attacker can deplete a 5-LINK subscription in ~10 minutes for ~$40 of personal cost.
- **C-02** allows users to send ETH below the per-token price resolution and receive zero tokens with no refund. The frontend's default `minTokens=0` disables slippage protection.

Beyond these, the bracketed tier-weight design (H-01) inverts the intended whale incentive: splitting a large sacrifice into 1-RITUAL chunks strictly dominates concentrating for every measurable metric (more glyphs, more rare-tier expected value). This combines with C-01 to make the LINK-drain attack the rational optimal play even for legitimate users.

The remaining HIGH findings (no emergency pause, MEV exposure, no supply cap) are standard hardening gaps that should be closed before launch.

**Chosen remediation (confirmed by project owner during audit review):** A single architecture change — **decouple sacrifice from glyph minting** — closes C-01, H-01, and H-04 together:

- `commitRitual(amount)` burns RITUAL, contributes to the epoch threshold, and updates lifetime contribution. **No VRF request fires.** Minimum sacrifice stays at 1 RITUAL, preserving low-barrier participation in the collective summoning.
- After the epoch resolves, `claimGlyphs(epochId)` issues **one** VRF request returning `contributions[epochId][wallet] / 100e18` random words. Each random word mints one glyph at the tier bracket determined by the wallet's cumulative contribution to that epoch (per-epoch — does not carry over to future epochs).
- 100 RITUAL is both the glyph-qualification threshold and the glyph-count divisor. Below 100, no glyphs are minted; the wallet still earns the new **Initiate** cult rank for lifetime participation.

VRF cost becomes one fixed payment per wallet per epoch, regardless of how the wallet split its sacrifices. Splitting and concentrating produce identical glyph counts and identical odds. Protocol is net-positive at every valid claim path (~+$0.45 per glyph minted at the threshold, scaling up with higher brackets).

**Recommendation:** Implement the batched-claim redesign for C-01/H-01/H-04, the one-line zero-output revert for C-02, plus Phase 2 hardening (Pausable, MEV protection, max supply, solo-Harbinger). Estimated effort: 2–3 days of focused contract work plus a Sepolia rehearsal.

---

## 2. Scope

In scope (audited):

| Contract | Lines | Purpose |
|---|---|---|
| `RitualToken.sol` | 42 | ERC-20 with restricted minting + public burn |
| `MintingCurve.sol` | 127 | Integral-priced mint, 12% protocol fee, owner-withdrawable |
| `SummoningEngine.sol` | 331 | Epoch lifecycle, sacrifice, resolution, claim |
| `ElderArtifacts.sol` | 120 | ERC-1155 rewards (Harbinger/Acolyte/Cultist/Shattered) |
| `EldritchGlyphs.sol` | 274 | ERC-1155 glyphs via Chainlink VRF + EIP-2981 royalties |

Interface files (`src/interfaces/*.sol`) were reviewed as part of the consuming contracts.

Tests under `contracts/test/` were reviewed for coverage adequacy but not audited as production code.

---

## 3. Methodology & Limitations

### Process

1. Read every line of each contract sequentially.
2. Built a threat model identifying attacker classes (user-attacker, MEV searcher, sybil farmer, malicious owner, compromised multisig, malicious receiver contract) and assets at risk (ETH in `MintingCurve`, LINK in VRF subscription and Automation upkeep, RITUAL supply, glyph and artifact ERC-1155 collections).
3. Walked each external/public function through the threat model.
4. Traced cross-contract interactions (`SummoningEngine ↔ EldritchGlyphs`, `SummoningEngine → ElderArtifacts`, `SummoningEngine → RitualToken`, `MintingCurve → RitualToken`).
5. Cross-referenced the deployed Sepolia bytecode behavior with committed source; observed divergences (durations, Automation interface) are flagged in I-01.
6. Reviewed the test suite (186 passing tests across 5 files) for coverage gaps relative to identified findings.

### Limitations

This audit was performed by an LLM-based auditor. Strengths and weaknesses to set expectations:

- **Strong:** economic logic analysis, integer math edge cases, access-control coverage, common-vulnerability patterns (reentrancy, oracle manipulation, signature replay, integer over/underflow), cross-contract interaction modeling.
- **Weaker:** novel cryptographic attacks, gas-pricing edge cases against specific L1 conditions, RPC-provider-specific behaviors, supply-chain attacks on dependencies, MEV strategies that depend on real-time block-builder behavior.
- **Did not perform:** formal verification, symbolic execution, fuzzing beyond what already exists in the test suite, network-level MEV simulation.

This audit should be treated as a **complement** to, not a replacement for:
1. A professional third-party audit (Cantina, Spearbit, Trail of Bits, OpenZeppelin) if launch funds permit.
2. An automated formal-verification pass (Halmos, Certora) on the math-heavy `MintingCurve` and `_deriveTier`.
3. A bug bounty program post-launch (Immunefi or Code4rena).

---

## 4. Severity Definitions

| Severity | Definition |
|---|---|
| **Critical** | Direct loss or freezing of user/protocol funds, OR a vulnerability that makes the protocol economically unviable. Must be fixed before launch. |
| **High** | Significant risk to funds under specific scenarios, OR a design flaw that severely impairs intended mechanics. Should be fixed before launch. |
| **Medium** | Limited financial risk OR meaningful operational/UX impact. Recommended to fix before launch; acceptable to ship with documented acknowledgment. |
| **Low** | Minor risk, code quality, or surface-area concern with no direct exploit path. |
| **Informational** | Notes, observations, and process recommendations with no security implication. |

---

## 5. Findings Summary

| ID | Title | Severity | Status |
|---|---|---|---|
| C-01 | VRF subscription drain via cheap sacrifice spam | Critical | Open — fix design locked (batched claim + 100-RITUAL qualification) |
| C-02 | Free-mint extraction at small ETH inputs | Critical | Open — fix design locked (one-line revert on zero output) |
| H-01 | Whale incentive inversion in tier brackets | High | Open — resolved by C-01 fix (cumulative bracketing) |
| H-02 | No emergency pause mechanism | High | Open |
| H-03 | MEV exposure via frontend default `minTokens=0` | High | Open |
| H-04 | Sybil wallets bypass per-wallet sacrifice cooldown | High | Open — largely resolved by C-01 fix (per-wallet-per-epoch VRF) |
| H-05 | No max supply on RITUAL; treasury unbounded | High | Open |
| M-01 | Solo contributor cannot reach Harbinger tier | Medium | Open |
| M-02 | `withdraw` has no timelock | Medium | Open |
| M-03 | `AlreadyClaimed` error misleading for non-contributors | Medium | Open |
| M-04 | Owner can set royalty to extreme values | Medium | Open |
| M-05 | Receiver-hook gas grief on VRF callback | Medium | Open |
| L-01 | `ElderArtifacts.mintBatch` is unused dead code | Low | Open |
| L-02 | `setBaseURI` allows metadata rug-pull | Low | Open |
| L-03 | `RitualToken.setMinter` is one-shot | Low | Open |
| I-01 | Deployed Sepolia bytecode diverges from source (observed twice) | Informational | Open |
| I-02 | `getCurrentPhase` returns Resolved before `resolveEpoch` is called | Informational | Mitigated (UI) |
| I-03 | VRF reorg risk acceptable with 3-block confirmation | Informational | Acknowledged |

---

## 6. Critical Findings

---

### C-01 — VRF Subscription Drain via Cheap Sacrifice Spam

**Severity:** Critical
**Status:** Open
**Location:** `SummoningEngine.commitRitual` (lines 143–180) ↔ `EldritchGlyphs.requestGlyph` (lines 126–152)
**Configuration:** `MIN_SACRIFICE = 1e18` (1 RITUAL), `SACRIFICE_COOLDOWN = 30s`

#### Description

Every successful `commitRitual()` call invokes `glyphs.requestGlyph()`, which submits a Chainlink VRF V2.5 randomness request. The protocol pays for VRF requests from its LINK subscription. The protocol's revenue source is the 12% fee on the original mint of RITUAL (via `MintingCurve.mint()`), not on the sacrifice itself.

At the current `MIN_SACRIFICE = 1 RITUAL`, the cost balance is inverted:

| Item | Value (at $3500/ETH, $15/LINK, 0.0001 ETH base price) |
|---|---|
| User mints 1 RITUAL | 0.000114 ETH gross (~$0.40) |
| Protocol fee (12% of mint) | 0.0000137 ETH (~$0.048) |
| Protocol pays for 1 VRF request | ~0.25 LINK (~$3.75) |
| **Net protocol cost per sacrifice** | **~$3.70 loss** |

#### Attack Scenario

```
1. Attacker mints 100 RITUAL via MintingCurve.mint() — costs ~0.011 ETH (~$40)
   • Protocol collects 12% × $40 = ~$4.80 in mint fees
2. Attacker calls commitRitual(1e18) 100 times across multiple wallets
   (or sequentially over ~50 minutes from one wallet, respecting cooldown)
3. Each call triggers requestGlyph() → VRF request → ~$3.75 LINK cost
4. Protocol spends 100 × $3.75 = $375 of LINK
5. Net protocol loss: $375 - $4.80 = $370.20

To drain a 5-LINK subscription (~$75 of LINK) in worst case:
   ~20 sacrifices × $3.75 = $75
   Attacker cost: ~$8 of RITUAL mint + ~$5 gas = $13
   Drain ratio: ~$75 lost for ~$13 spent (5.8× efficiency)
```

Sybil wallets defeat the 30s per-wallet cooldown entirely — with 20 wallets, 20 sacrifices fit in a single block.

#### Impact

- Direct draining of protocol LINK reserves at a >5× cost-to-attacker advantage.
- Denial of service against the glyph minting system: once LINK depletes, VRF stops fulfilling, no glyphs mint, and the gameplay loop dies until an out-of-band refill.
- Reputational damage if observed publicly during launch.
- Indirect Automation impact: if a single LINK funding pool is shared (it is not in current design — separate subscriptions for VRF vs Automation), Automation upkeeps could also stall, leaving epochs unresolved.

#### Recommendation — Chosen Design

After discussion with the project owner, the chosen remediation is a **batched-claim redesign with a cumulative qualification threshold**, which closes both C-01 and H-01 simultaneously with a single architecture change. The model preserves the 1-RITUAL entry point (so small participants can join the summoning ritual) while making glyphs a true status item that requires meaningful commitment.

**Design parameters:**

```solidity
uint256 public constant MIN_SACRIFICE = 1e18;     // 1 RITUAL — anyone can participate
uint256 public constant GLYPH_UNIT    = 100e18;   // 100 RITUAL per glyph earned
                                                  // (doubles as qualification threshold)
```

**Mechanism:**

1. **Sacrifice phase (during the Ritual window) — no VRF:**
   - `commitRitual(amount)` burns the RITUAL, updates `contributions[epochId][wallet]` and `lifetimeContribution[wallet]`, and contributes to the epoch threshold.
   - **No VRF request is issued.** No glyph is minted yet.
   - All sacrifices count toward the collective summoning regardless of size.

2. **Claim phase (after `epoch.resolved == true`) — one VRF per wallet per epoch:**
   - `claimGlyphs(epochId)` reads the wallet's cumulative contribution to *this* epoch only:
     ```solidity
     uint256 contribution = contributions[epochId][msg.sender];
     uint256 glyphsEarned = contribution / GLYPH_UNIT;  // integer division
     ```
   - If `glyphsEarned == 0` (contribution below 100 RITUAL): revert with `NoGlyphsEarned`. The wallet still gets credit for participation in the collective ritual + lifetime contribution, but no NFT.
   - Otherwise issue **one** VRF request with `numWords: glyphsEarned`, capped at 50 per claim (callback-gas safety). Whales with > 50 glyphs earned call `claimGlyphs` in multiple batches.
   - In `fulfillRandomWords`, derive each glyph's tier independently from its own `randomWords[i]`, all rolled against the bracket selected from cumulative contribution at claim time.

3. **Per-epoch scoping (critical, confirmed by owner):**
   - The qualification threshold and the bracket are both computed from `contributions[epochId][wallet]`, which is keyed by epoch and resets to zero each new epoch. A wallet that contributed 50 RITUAL to epoch 1 and 50 RITUAL to epoch 2 earns **zero glyphs** from either — they never crossed 100 in any single epoch. No cross-epoch carry-over.
   - `lifetimeContribution[wallet]` accumulates separately and powers the new Initiate cult rank (see Remediation Roadmap).

**Economic outcomes:**

| Cumulative this epoch | Glyphs earned | Bracket | VRF requests | Protocol net (mint fee minus VRF) |
|---|---|---|---|---|
| 1–99 RITUAL | 0 | n/a | 0 | +mint fee, no VRF cost |
| 100 RITUAL | 1 | 2 | 1 | +$4.20 - $3.75 = **+$0.45** |
| 999 RITUAL | 9 | 2 | 1 | +$42 - ~$3.83 = **+$38** |
| 1,000 RITUAL | 10 | 3 | 1 | **+$38+** |
| 5,000 RITUAL | 50 | 3 | 1 | **+$206+** |
| 10,000 RITUAL | 100 | 4 | 2 (two batches of 50) | **+$413+** |

Protocol is net-positive at every valid claim path. Splitting and concentrating produce identical outcomes (same glyph count and same bracket), eliminating H-01's incentive inversion. Sybils still cost gas + minimum-RITUAL-to-qualify per wallet (~$40), bounding H-04.

**Why this is preferable to the simpler "raise MIN to 100" fix:**

- Preserves the low-barrier participation explicitly chosen in commit `0c6fa2d`.
- Glyphs become a *commitment marker* rather than a participation receipt — better gacha psychology, scarcity reinforces value.
- VRF cost is fixed per claim regardless of split, so cost is fully predictable for treasury planning.
- The Initiate rank gives minnows progression without diluting glyph status.

#### Tests Required

Contracts:
- `test_Sacrifice_Burns_NoVRF_Below100` — sub-100 sacrifice burns tokens, contributes, fires no VRF request
- `test_ClaimGlyphs_Reverts_BelowThreshold` — claim with cumulative < 100 reverts `NoGlyphsEarned`
- `test_ClaimGlyphs_Mints_100RITUAL_OneGlyph` — exactly 1 glyph at 100 RITUAL cumulative
- `test_ClaimGlyphs_Mints_550RITUAL_FiveGlyphs` — 5 glyphs at 550 (integer division)
- `test_ClaimGlyphs_BracketFromCumulative` — confirm bracket = `_bracket(cumulative)`, not `_bracket(per_call)`
- `test_ClaimGlyphs_CapsAt50_PerCall` — claim with > 50 earned reverts with overflow guidance or splits cleanly
- `test_PerEpochReset` — wallet contributes 50 to epoch 1, 60 to epoch 2; both claims revert (no carry-over)
- `test_OneVRFRequestRegardlessOfSplit` — 1 sacrifice of 1000 RITUAL and 1000 sacrifices of 1 RITUAL both produce exactly one VRF request when claimed
- Fuzz: per-bracket distribution at each cumulative threshold matches expected weights (10k seeds per bracket)

Backend:
- Backfill handler updates for the new event shape (one `GlyphsBatchMinted` event vs many `GlyphMinted`).

Frontend:
- New `ClaimGlyphsPanel` rendering when `epoch.resolved && cumulativeContribution > 0`
- Pack-opening reveal animation for batched glyphs
- "Pending glyphs: N" indicator during the Ritual window

#### Postmortem (2026-05-23): Cap lowered from 50 → 20

The original "cap at 50 per claim" recommendation in this section was set without a gas
measurement and turned out to be too aggressive. Sepolia rehearsal #1 exercised a 50-glyph
claim and exposed a live VRF callback OOG:

- `fulfillRandomWords` for 50 glyphs requires ~6M gas (measured: 5-glyph fulfill =
  593k → ~100k marginal/glyph + ~80k fixed overhead, extrapolated linear).
- `callbackGasLimit` was set to 2.5M (the Chainlink V2.5 ceiling on Sepolia/mainnet
  for the standard 30/100 gwei lanes).
- The callback ran out of gas mid-loop → the entire mint reverted → 0 glyphs minted,
  LINK paid for the request was lost, AND the engine's `glyphsClaimedCount` had
  already been incremented to 50, so the user could not retry.

Fixed by lowering both `MAX_GLYPHS_PER_REQUEST` (EldritchGlyphs) and `MAX_GLYPHS_PER_CLAIM`
(SummoningEngine) to 20. Measured 20-glyph fulfill = 2.04M gas (~17% margin under 2.5M).
Added `test_Fulfill_MintsBatch_MaxBatchFitsCallbackGas` which hard-asserts the worst-case
batch stays under 2.4M, so future changes can't silently regress.

Lesson for future contract changes: any code path with a deterministic loop bound MUST
have a measured gas test before the bound is fixed.

---

### C-02 — Free-Mint Extraction at Small ETH Inputs

**Severity:** Critical
**Status:** Open
**Location:** `MintingCurve._calcTokensOut` (lines 104–115), `MintingCurve.mint` (lines 69–81)

#### Description

The `_calcTokensOut` function computes the integer square root of the discriminant in the quadratic-formula solution for the curve integral, then returns `dWhole * 1e18` where `dWhole` is the number of whole tokens out. For sufficiently small `netEth`, the math produces `dWhole = 0`, meaning **the user receives zero tokens for non-zero ETH**.

The slippage check `if (tokensOut < minTokens) revert` only triggers if the user explicitly sets `minTokens > 0`. The frontend (`useMintingCurve.ts`) passes `0n` by default, so users get no protection from this case.

#### Reproduction

```solidity
// Call: mint{value: 1e13}(0)  // 0.00001 ETH, no slippage protection

// Inside MintingCurve.mint:
fee = 1e13 * 1200 / 10000 = 1.2e12
netEth = 1e13 - 1.2e12 = 8.8e12

// Inside _calcTokensOut(8.8e12):
s0 = 0
b = 2 * 1e8 + 2*0 = 2e8
c = 2 * 1e8 * 8.8e12 / 1e14 = 17_600_000
discriminant = b² + 4c = 4e16 + 70_400_000 ≈ 4e16
sqrtDisc = floor(sqrt(4e16 + 70_400_000)) = 200_000_000  // the 4c term doesn't move past an integer boundary
dWhole = (200_000_000 - 200_000_000) / 2 = 0

Return: 0 * 1e18 = 0 tokens

// Back in mint():
tokensOut = 0
if (0 < 0) revert  // false, passes
ritualToken.mint(msg.sender, 0)  // no-op
emit TokensMinted(msg.sender, 1e13, 0, 1.2e12)
```

The user's 0.00001 ETH is now held by the `MintingCurve` contract with no token mint. It will be claimed by the multisig on the next `withdraw()` call.

#### Impact

- Direct fund loss for any user submitting `mint()` with insufficient ETH for at least one whole token at the current curve price.
- The frontend's quick-select buttons (0.001 / 0.01 / 0.1 ETH) are well above the threshold, but users who type a custom amount, mistype, or submit via a script will lose funds silently.
- At higher supplies (curve price increases), the threshold ETH amount grows — at 10M tokens minted, the per-token price is ~10× base, so the dust loss zone is ~10× larger in ETH terms.
- The dust accumulates as protocol revenue. While not theft in the traditional sense, it is **funds taken from users without consent or notification**, which is a regulatory and reputational liability.

#### Recommendation

Add a single line to `mint()`:

```solidity
function mint(uint256 minTokens) external payable nonReentrant {
    if (msg.value == 0) revert MintingCurve__InsufficientPayment();

    uint256 fee = msg.value * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;
    uint256 netEth = msg.value - fee;

    uint256 tokensOut = _calcTokensOut(netEth);

+   if (tokensOut == 0) revert MintingCurve__InsufficientPayment();
    if (tokensOut < minTokens) revert MintingCurve__SlippageExceeded();

    ritualToken.mint(msg.sender, tokensOut);
    emit TokensMinted(msg.sender, msg.value, tokensOut, fee);
}
```

This reverts the transaction (returning ETH) when the input is insufficient for any token output. Consistent with existing error semantics.

Alternative: refund excess ETH and mint partial tokens. More complex and creates dust-handling questions. Not recommended.

#### Tests Required

- `test_Mint_Reverts_OnZeroTokenOutput` — submit small ETH amount, expect `MintingCurve__InsufficientPayment`
- `test_Mint_Succeeds_AtMinimumViableETH` — find the smallest ETH that produces ≥1 token, confirm success
- Fuzz: random ETH amounts < threshold should always revert

---

## 7. High Findings

---

### H-01 — Whale Incentive Inversion in Tier Brackets

**Severity:** High
**Status:** Open
**Location:** `EldritchGlyphs._deriveTier` + `_bracket` (lines 191–225), `SummoningEngine.commitRitual` (lines 143–180)

#### Description

The bracketed tier-weight system in `EldritchGlyphs._deriveTier(bits, amount)` is intended to reward larger sacrifices with better odds for rare tiers. Per glyph, this works as designed (Bracket 4 has 14% Breach vs Bracket 0's 1%). However, because `commitRitual` mints exactly one glyph regardless of `amount`, players maximize expected rare glyphs by **splitting** rather than concentrating.

#### Math

For 100 RITUAL of sacrifice budget:

| Strategy | Bracket | Glyphs Minted | Whisper | Echo | Tremor | Rupture | Breach | E[Breach] |
|---|---|---|---|---|---|---|---|---|
| 1× 100 RITUAL | 2 | 1 | 30% | 30% | 24% | 12% | 4% | 0.04 |
| 100× 1 RITUAL | 0 | 100 | 50% | 28% | 15% | 6% | 1% | **1.00** |

**Splitting yields 25× more expected Breaches and 100× more total glyphs** for the same RITUAL spend. The 30s per-wallet cooldown limits rate but not totals: 120 splits fit in a 1-hour Ritual window from a single wallet. Sybil wallets defeat even the cooldown.

#### Impact

- The intended whale-favoring mechanic is inverted: rational players always split.
- Rare-glyph supply inflates uncontrollably. The advertised "Breach 1%" becomes the floor rather than the expected average.
- Cult-rank progression (which counts glyphs held) is trivially attainable via spam.
- Combined with **C-01**, the LINK-drain attack is the *rational maximum-EV strategy* for any sufficiently-determined player, not just a malicious one.
- Marketplace value of rare glyphs collapses if their effective supply rate exceeds the advertised rarity.

#### Recommendation

**Resolved by the C-01 chosen design.** The batched-claim model with cumulative bracketing closes H-01 as a side effect:

- Glyph count = `contribution / GLYPH_UNIT`, computed at claim time from epoch-scoped cumulative contribution. Splitting 1000 RITUAL into 1000 × 1-RITUAL sacrifices and concentrating 1000 RITUAL into a single sacrifice both produce the same `cumulativeContribution = 1000` and therefore the same 10 glyphs.
- Bracket = `_bracket(cumulativeContribution)`, so the odds row is determined by total spend regardless of split.

The incentive inversion is fully eliminated: splitting and concentrating are mathematically equivalent under the new design. Larger spend genuinely produces higher-tier odds via the cumulative bracket, restoring the whale-favoring mechanic the original tier table was designed for.

See C-01 "Tests Required" — the per-epoch reset and one-VRF-regardless-of-split tests cover both findings.

---

### H-02 — No Emergency Pause Mechanism

**Severity:** High
**Status:** Open
**Location:** All contracts; none inherit `Pausable`

#### Description

If a critical vulnerability is discovered post-launch (for example, if C-02 had not been caught in this audit), there is no mechanism to halt minting, sacrificing, or glyph requests. The only remediation available is for the multisig to call `MintingCurve.withdraw()` to remove ETH, but:

- New mint transactions still succeed.
- Sacrifices still execute against the broken state.
- VRF requests continue draining LINK.
- Users may continue to lose funds while the team works on remediation.

#### Impact

- Inability to triage an active incident.
- Standard practice for any token protocol holding user funds.

#### Recommendation

Add OpenZeppelin's `Pausable` at minimum to:
- `MintingCurve.mint()` (blocks new ETH entry)
- `SummoningEngine.commitRitual()` (blocks sacrifice → glyph chain)
- `SummoningEngine.claimReward()` (allow blocking distribution if reward math is found broken)

Multisig holds the pauser role. Pausing should be revocable (i.e., `unpause()` is available).

```solidity
contract MintingCurve is Ownable, ReentrancyGuard, Pausable {
    function mint(uint256 minTokens) external payable nonReentrant whenNotPaused {
        // ...
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

Cost: one storage slot per contract + modifier gas (~2,500 gas per call). Benefit: response capability during incidents.

#### Tests Required

- `test_PausedMintReverts`
- `test_PausedSacrificeReverts`
- `test_UnpauseRestoresFunctionality`
- `test_OnlyOwnerCanPause`

---

### H-03 — MEV Exposure via Frontend Default `minTokens=0`

**Severity:** High
**Status:** Open
**Location:** `frontend/hooks/useMintingCurve.ts` (the `mint` hook), `MintingCurve.mint` slippage check (line 77)

#### Description

The MintingCurve contract has slippage protection (`if (tokensOut < minTokens) revert`), but the frontend disables it by passing `0n` as `minTokens`. A miner/sequencer/bundler can sandwich a mint transaction:

1. Observe the user's pending mint in the mempool.
2. Front-run with a small mint of their own (raising the supply, increasing price).
3. User's mint executes at the new, worse price.
4. (No back-run possible because the curve has no sell mechanism — the attacker just holds their tokens, but the user has been priced out of expected output.)

While there is no profitable sandwich-and-dump cycle, the attacker gains an unfair allocation of cheap tokens and the user receives less than the quoted output.

#### Impact

- Users receive fewer tokens than the on-screen quote indicates, especially during periods of high volume or for larger mints.
- Trust erosion when users notice the discrepancy.
- Direct value extraction by MEV searchers.

#### Recommendation

In `frontend/hooks/useMintingCurve.ts`, compute `minTokens` from the previewed quote with ~1% slippage tolerance:

```typescript
const expectedTokens = /* computed from getEstimatedCost preview */;
const minTokens = (expectedTokens * 99n) / 100n;  // accept up to 1% slippage

writeContract({
  address: MINTING_CURVE_ADDRESS,
  abi: MINTING_CURVE_ABI,
  functionName: "mint",
  args: [minTokens],
  value: ethWei,
});
```

Consider exposing a slippage tolerance setting in the UI for advanced users (default 1%, options 0.5/1/3%).

#### Tests Required

- Frontend integration test: mint with simulated front-run reverts cleanly.
- Snapshot of `minTokens` in the wagmi config to prevent regression.

---

### H-04 — Sybil Wallets Bypass Per-Wallet Sacrifice Cooldown

**Severity:** High
**Status:** Open
**Location:** `SummoningEngine.commitRitual` (lines 154–156), `lastSacrificeTime` mapping

#### Description

The 30-second `SACRIFICE_COOLDOWN` is enforced per-`msg.sender` via the `lastSacrificeTime[msg.sender]` mapping. A single attacker controlling N wallets bypasses this entirely — N sacrifices can fit in a single block.

#### Impact

- Compounds **C-01** (LINK drain) and **H-01** (glyph farming).
- The cooldown's intended purpose (rate-limit individual abuse) does not bind a determined attacker.

#### Recommendation

**Largely resolved by the C-01 chosen design.** Under the batched-claim model:

- VRF cost is fixed per wallet per epoch (one request regardless of sacrifice count). Sybils still cost LINK once per wallet to claim, but no longer multiply VRF cost per sacrifice.
- Each sybil wallet must independently cross the 100-RITUAL qualification threshold to earn any glyph at all. Splitting 1000 RITUAL across 10 sybils of 100 RITUAL each yields the same outcome as one wallet at 1000 RITUAL — but the sybil path costs ~10× the gas (10 wallet deployments + 10 RITUAL mints + 10 claim txs).
- Each new sybil starts at zero cumulative contribution and rolls at Bracket 0 unless funded above each higher-bracket threshold, so sybils gain no rarity advantage over a single concentrated wallet.

The remaining residual risk is throwaway-wallet farming at a small economic premium. Acceptable given the cost asymmetry. No additional mitigation required for launch.

#### Tests Required

- `test_NewWalletStartsAtCumulativeZero` — confirm per-wallet `contributions[epochId][wallet]` is independent
- Integration: 10 sybils × 100 RITUAL each vs 1 wallet × 1000 RITUAL — confirm same total glyph supply but sybils pay more gas

---

### H-05 — No Max Supply on RITUAL; Treasury Unbounded

**Severity:** High
**Status:** Open
**Location:** `RitualToken` (no supply cap), `MintingCurve` (no mint limit)

#### Description

The mint curve has no supply ceiling. As supply grows linearly with each mint, price grows linearly. At a supply of 1 trillion tokens (`1e30` wei), the spot price would be ~10,000× base = 1 ETH per RITUAL. The contract treasury similarly has no cap on accumulated ETH.

This is not exploitable in the classical sense, but creates three concerns:

1. **No defined endgame.** A bonding-curve token without a cap can drift indefinitely.
2. **Multisig compromise risk amplifies.** If the multisig is compromised at a moment when the treasury holds (say) 10,000 ETH, attacker drains all of it. A cap or per-withdrawal limit would bound the worst-case loss.
3. **Tax and accounting** become harder with unbounded supply.

#### Impact

- Worst-case loss in a multisig compromise scales with treasury size, which has no ceiling.
- Long-term tokenomics ambiguity.

#### Recommendation

Add a maximum supply to `RitualToken`:

```solidity
contract RitualToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000e18;  // 1 billion

    function mint(address to, uint256 amount) external onlyMinter {
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        _mint(to, amount);
    }
}
```

1 billion tokens at the implied terminal price of ~10× base = 1e9 RITUAL × 0.001 ETH = 1M ETH lifetime treasury maximum. Picks a number; revisit at launch based on calibrated economics.

Pair with M-02 (timelock on withdraw) for defense in depth.

#### Tests Required

- `test_Mint_RevertsAtMaxSupply`
- `test_Mint_Succeeds_OneBelowMax`
- `test_MaxSupplyIsImmutable` (no setter)

---

## 8. Medium Findings

---

### M-01 — Solo Contributor Cannot Reach Harbinger Tier

**Severity:** Medium
**Status:** Open (documented in PRD)
**Location:** `SummoningEngine._calculateTier` (lines 317–330)

#### Description

The tier formula computes `avgContribution = totalCommitted / participantCount`. For a single contributor, their contribution equals the average. The Harbinger threshold `contribution >= avgContribution * 10` is therefore unreachable. The lone summoner caps at Cultist (tier 3) on success, regardless of sacrifice size.

#### Impact

- Disincentivizes solo participation in low-activity epochs, especially early-launch and less-popular Old Ones.
- A user single-handedly clearing the threshold gets the worst-quality artifact.
- Documented in PRD §4.9 but not addressed in code.

#### Recommendation

Special-case `participantCount == 1`:

```solidity
function _calculateTier(uint256 epochId, uint256 contribution, bool successful) internal view returns (uint256) {
    if (!successful) return 0;
    Epoch storage epoch = epochs[epochId];
    if (epoch.participantCount == 1) return 1;  // sole summoner gets Harbinger
    uint256 avgContribution = epoch.totalCommitted / epoch.participantCount;
    if (contribution >= avgContribution * 10) return 1;
    if (contribution >= avgContribution * 3)  return 2;
    return 3;
}
```

Alternative: rewrite to rank-percentile via off-chain merkle proof submitted by the owner after resolution. More complex; defer to v2.

---

### M-02 — `withdraw` Has No Timelock

**Severity:** Medium
**Status:** Open
**Location:** `MintingCurve.withdraw` (lines 85–92)

#### Description

The owner (multisig) can call `withdraw(to)` to send the entire ETH balance anywhere in a single transaction with no delay. If the multisig is socially-engineered, has a key compromise, or experiences an internal-actor attack, funds are gone instantly with no user opportunity to exit.

#### Impact

- Single point of failure for the entire treasury.
- Standard treasury risk.

#### Recommendation

Either:
1. **OpenZeppelin TimelockController** wrapping the multisig — adds a 24–48h delay between proposal and execution.
2. **Per-withdraw cap** — `withdraw(to, amount)` with `amount <= MAX_WITHDRAW_PER_DAY`, plus a daily counter.

Option 1 is industry standard. Option 2 is simpler but less flexible.

---

### M-03 — `AlreadyClaimed` Error Misleading for Non-Contributors

**Severity:** Medium
**Status:** Open
**Location:** `SummoningEngine.claimReward` (lines 211–212)

#### Description

The check `if (contribution == 0) revert SummoningEngine__AlreadyClaimed()` fires for both cases:
- The user already claimed (contribution was set to 0 by a prior claim).
- The user never contributed (contribution was always 0).

The error message is incorrect for the second case.

#### Impact

- UX confusion. Support burden.
- Not a security issue.

#### Recommendation

Split into two errors:

```solidity
error SummoningEngine__AlreadyClaimed();
error SummoningEngine__NoContribution();

// Track claim status separately if needed:
mapping(uint256 => mapping(address => bool)) public claimed;

function claimReward(uint256 epochId) external nonReentrant {
    if (!epochs[epochId].resolved) revert SummoningEngine__EpochNotResolved();
    if (contributions[epochId][msg.sender] == 0 && !claimed[epochId][msg.sender]) {
        revert SummoningEngine__NoContribution();
    }
    if (claimed[epochId][msg.sender]) revert SummoningEngine__AlreadyClaimed();
    // ...
    claimed[epochId][msg.sender] = true;
    contributions[epochId][msg.sender] = 0;
    // ...
}
```

Alternative (cheaper): keep the single-error pattern but rename the error to `NotClaimable`. Less ideal but no storage cost.

---

### M-04 — Owner Can Set Royalty to Extreme Values

**Severity:** Medium
**Status:** Open
**Location:** `EldritchGlyphs.setRoyalty` (lines 115–117)

#### Description

`_setDefaultRoyalty(receiver, feeBps)` accepts any `uint96` for `feeBps`. The owner could set 50% royalty (5000 BPS), breaking marketplace economics, or 0% to remove protocol revenue. OpenSea enforces a 10% cap off-chain, but on-chain there is no limit.

#### Impact

- Owner trust issue. Misconfiguration risk.
- A compromised multisig could redirect royalty payments to an attacker address.

#### Recommendation

```solidity
function setRoyalty(address receiver, uint96 feeBps) external onlyOwner {
    if (feeBps > 1000) revert EldritchGlyphs__RoyaltyTooHigh();  // max 10%
    _setDefaultRoyalty(receiver, feeBps);
}
```

---

### M-05 — Receiver-Hook Gas Grief on VRF Callback

**Severity:** Medium
**Status:** Open
**Location:** `EldritchGlyphs.fulfillRandomWords` → `_mint` → `onERC1155Received` (line 182)

#### Description

`_mint` in OpenZeppelin's ERC1155 calls `onERC1155Received` on contract recipients. If a recipient is a malicious contract with an expensive `onERC1155Received` hook, the entire VRF callback can run out of gas. The VRF coordinator may or may not retry. Either way, LINK is consumed for the failed callback.

#### Impact

- Per-failure LINK loss with no glyph mint.
- Self-grief primarily (attacker grief themselves), but combined with C-01, this could be used to maximize LINK drain per RITUAL spent (each failed callback also costs LINK).

#### Recommendation

Wrap the mint in try/catch within `fulfillRandomWords`, OR use a "pull" pattern where the recipient must call `claimGlyph(requestId)` after fulfillment:

```solidity
function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
    // ... existing logic ...

    try this.externalMint(pending.recipient, tokenId) {
        emit GlyphMinted(...);
    } catch {
        emit GlyphMintFailed(tokenId, pending.recipient);
        // Glyph data still stored, can be claimed later via a separate function
    }
}
```

Alternative: detect EOA via `recipient.code.length == 0` and skip the receiver-hook path for known EOAs. More brittle.

---

## 9. Low Findings

---

### L-01 — `ElderArtifacts.mintBatch` is Unused Dead Code

**Severity:** Low
**Status:** Open
**Location:** `ElderArtifacts.mintBatch` (lines 98–109)

`SummoningEngine` does not call `mintBatch`. Dead surface area increases audit cost and may invite future misuse.

**Recommendation:** Remove unless there is a near-term use case.

---

### L-02 — `setBaseURI` Allows Metadata Rug-Pull

**Severity:** Low
**Status:** Open
**Location:** `EldritchGlyphs.setBaseURI`, `ElderArtifacts.setBaseURI`

The owner can redirect metadata at any time. A compromised or malicious multisig could redirect to offensive content, devaluing the collection's reputation.

**Recommendation:** Either freeze `baseURI` after launch (one-way setter) or move to IPFS-pinned per-token URIs that cannot be overridden.

---

### L-03 — `RitualToken.setMinter` is One-Shot

**Severity:** Low
**Status:** Open
**Location:** `RitualToken.setMinter` (lines 29–34)

Once `minter` is set, it cannot be changed. If `MintingCurve` is later found to have a critical bug, you cannot redeploy a fixed version pointing at the existing `RitualToken`.

**Recommendation:** Either allow re-set by owner (with timelock/multisig protection) or accept this as a deliberate immutability tradeoff.

---

## 10. Informational

---

### I-01 — Deployed Sepolia Bytecode Diverges from Source (Observed Twice)

During the Sepolia lifecycle test, two divergences were observed between deployed bytecode and committed source:

1. `GATHERING_DURATION` and `RITUAL_DURATION` constants were modified locally for testing convenience (2 min / 1 hour) and deployed without committing the change. Source remains 48h / 24h.
2. `AutomationCompatibleInterface` inheritance appears missing or non-functional in the deployed bytecode — `cast call checkUpkeep(bytes)` reverts on the deployed contract despite source declaring the function.

**Recommendation (mandatory for mainnet):** After deploy, execute `forge verify-bytecode` against the committed-source compilation output for **all 5 contracts**. Abort the launch if any contract diverges. This is captured in ARCHITECTURE §10 Step 35.

---

### I-02 — `getCurrentPhase` Returns `Resolved` Before `resolveEpoch` is Called

**Location:** `SummoningEngine.getCurrentPhase` (lines 275–284)

The function returns `EpochPhase.Resolved` when `block.timestamp >= ritualEnd`, even if `epoch.resolved` is still `false` on-chain. This caused a UI bug where claim attempts would revert with `EpochNotResolved`. The frontend has been patched to distinguish (`isPendingResolution = phase==="Resolved" && !epoch.resolved`).

**Status:** Mitigated at UI layer. No contract change required, but worth a code comment to prevent future misinterpretation:

```solidity
function getCurrentPhase() external view returns (EpochPhase) {
    // NOTE: Returns Resolved when time has elapsed past ritualEnd, regardless
    // of whether resolveEpoch() has been called. Callers must check
    // `epoch.resolved` separately to distinguish "awaiting upkeep" from "resolved".
    // ...
}
```

---

### I-03 — VRF Reorg Risk Acceptable with 3-Block Confirmation

`EldritchGlyphs` is deployed with `requestConfirmations = 3`. Standard VRF reorg attacks require the attacker to reorg deeper than the confirmation count, which is economically infeasible on Ethereum mainnet for the gas pool sizes involved here.

**Status:** Acknowledged. No action required. Document in operational runbook.

---

## 11. Remediation Roadmap

### Phase 1 — Launch-Blocking Architecture Change (2–3 days)

The C-01 / H-01 / H-04 fix is a single coordinated change: the **batched-claim redesign with cumulative qualification threshold**. See C-01 "Recommendation — Chosen Design" for full spec.

| ID | Fix | Files Touched |
|---|---|---|
| C-01 + H-01 + H-04 | Decouple sacrifice from glyph minting. `commitRitual` burns tokens + accumulates contribution; no VRF. Add `claimGlyphs(epochId)` that issues one VRF request for `contributions[epochId][wallet] / GLYPH_UNIT` glyphs (capped at 50 per batch), with tier bracket from cumulative contribution. Add `lifetimeContribution[wallet]` to power the Initiate cult rank. `MIN_SACRIFICE` stays at 1e18, new `GLYPH_UNIT = 100e18`. Per-epoch reset is automatic (contributions mapping is keyed by epochId). | `SummoningEngine.sol` (new state, new claim function, no VRF in commitRitual), `EldritchGlyphs.sol` (`requestBatch` replaces `requestGlyph`, fulfill loop), interfaces, tests (new suite for batched claim + per-epoch reset + bracket-from-cumulative), frontend `SacrificePanel` (remove reveal expectation), new `ClaimGlyphsPanel`, pack-opening reveal animation, "Pending glyphs: N" indicator, cult rank reads `lifetimeContribution`, PRD §4.3 / §4.7 (new Initiate rank) / §5, ARCHITECTURE §3.3 / §3.5 / §5.2 |
| C-02 | Add `if (tokensOut == 0) revert MintingCurve__InsufficientPayment` in `MintingCurve.mint` between fee calculation and slippage check | `MintingCurve.sol`, tests |

### Phase 2 — Pre-Launch Hardening (1 day)

| ID | Fix |
|---|---|
| H-02 | Add `Pausable` to `MintingCurve.mint`, `SummoningEngine.commitRitual`, `SummoningEngine.claimGlyphs`, `SummoningEngine.claimReward` |
| H-03 | Frontend `useMintingCurve.ts` computes `minTokens = quote * 99 / 100` |
| H-05 | Add `MAX_SUPPLY` to `RitualToken` with mint-time check |
| M-01 | Special-case `participantCount == 1` in `_calculateTier` → return Harbinger |

### Phase 3 — Soft Hardening (defer if needed)

| ID | Fix |
|---|---|
| M-02 | Add TimelockController to withdraw |
| M-03 | Split `AlreadyClaimed` / `NoContribution` errors |
| M-04 | Cap royalty at 10% in `setRoyalty` |
| M-05 | Wrap mint in try/catch within `fulfillRandomWords` |
| L-01 | Remove unused `mintBatch` |
| L-02 | Freeze `baseURI` after launch or move to IPFS |
| L-03 | Allow re-setting minter with appropriate access controls |

### Phase 4 — Process

| ID | Fix |
|---|---|
| I-01 | `forge verify-bytecode` against committed source for all 5 contracts in mainnet deploy script (mandatory) |
| I-02 | Add NOTE comment to `getCurrentPhase` |
| I-03 | Document VRF reorg risk in operational runbook |

### Post-Remediation Validation

- `forge test` clean (current: 186 passing).
- New tests for C-02 (zero-output revert), H-01 (cumulative bracketing distribution), H-02 (pause works on all 3 functions), H-05 (max supply enforced), M-01 (solo summoner gets Harbinger).
- `forge test --fuzz-runs 10000` for tier distribution at all brackets.
- Slither clean.
- Re-deploy to Sepolia and re-run full lifecycle test.
- `forge verify-bytecode` matches source for all 5 contracts on Sepolia (this audit caught two divergences; the next deploy MUST match).

---

## 12. Out of Scope

The following were not audited:

- **Backend code** (Node/TypeScript event indexer). It can lose data via missed events (mitigated by the backfill service at `backend/src/services/backfill.ts`), and database race conditions could exist, but no funds are at risk in the backend layer.
- **Frontend code** beyond H-03. Phishing-UI / wallet-drainer concerns are outside this scope.
- **Dependency supply chain**: OpenZeppelin v5.x and Chainlink contracts assumed safe at the versions installed. Hashes were not verified.
- **VRF coordinator implementation** — trusted third-party assumption.
- **Multisig wallet** itself — assumed configured correctly (2-of-3 with hardware wallets per project memory).
- **Subgraph code** (not used in current deployment per ARCHITECTURE).
- **Operational security** (deploy key handling, CI/CD pipelines).

---

## 13. Disclaimer

This audit was performed by an LLM-based auditor (Claude Opus 4.7) at the request of the project owner. While every effort was made to identify vulnerabilities, **this report does not guarantee the absence of bugs, vulnerabilities, or exploits.** Security is a continuous process, not a one-time event.

This report is a **complement** to other security practices, not a replacement for:

1. A professional third-party audit by an established firm (Cantina, Spearbit, Trail of Bits, OpenZeppelin) if launch funds permit.
2. Automated formal verification (Halmos, Certora) for math-heavy contracts.
3. A post-launch bug bounty program (Immunefi, Code4rena).
4. Active monitoring and incident response capability (which is what H-02 enables).

The findings and recommendations in this report represent the auditor's analysis at the time of review against the specified commit. Code changes after `7d70da2` are not covered. The protocol owner is responsible for implementing fixes correctly and validating them with appropriate tests.

This audit does not constitute legal, financial, or investment advice.

---

**End of Report**
