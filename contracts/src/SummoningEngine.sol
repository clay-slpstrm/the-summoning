// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "./interfaces/IRitualToken.sol";
import "./interfaces/IElderArtifacts.sol";
import "./interfaces/IEldritchGlyphs.sol";

/// @title SummoningEngine
/// @notice Core gameplay contract. Self-perpetuating epoch lifecycle: the game runs itself
///         with no owner in the loop. When no epoch is active (currentEpochId == 0) or the
///         current epoch is resolved, the next commitRitual auto-opens a fresh 24h ritual
///         window (the Gathering phase is collapsed — minting is always-live via the bonding
///         curve, so tokens accumulate in the idle gap between summonings). The opening
///         sacrifice both starts the epoch and counts as its first contribution.
///         Sacrifices are pure burns: they accumulate epoch contribution and lifetime
///         contribution, but issue no VRF requests and mint no glyphs.
///         After the epoch resolves, participants call claimGlyphs(epochId) to batch-mint
///         one glyph per GLYPH_UNIT of epoch contribution (one VRF request per call, capped
///         at MAX_GLYPHS_PER_CLAIM). Separately, claimReward(epochId) mints the ERC-1155
///         artifact for the wallet's tier.
///         The threshold and Old One escalate on-chain: a win raises the threshold by a fixed
///         WIN_INCREMENT and advances the Old One (looping 5→1); a loss decays the threshold
///         ×0.75 (floored at THRESHOLD_FLOOR) and retries the same Old One.
///         Resolution is permissionless (anyone / the self-hosted keeper calls resolveEpoch);
///         the Chainlink Automation hooks remain as an alternative resolution path.
contract SummoningEngine is Ownable, ReentrancyGuard, Pausable, AutomationCompatibleInterface {

    // ── Epoch State ──────────────────────────────────────────────────────────

    enum EpochPhase { Inactive, Gathering, Ritual, Resolved }

    struct Epoch {
        uint256 oldOneId;
        uint256 threshold;          // $RITUAL needed for a successful summoning
        uint256 totalCommitted;     // $RITUAL committed (burned) so far
        uint256 gatheringStart;
        uint256 ritualStart;
        uint256 ritualEnd;
        bool successful;
        bool resolved;
        uint256 participantCount;
    }

    // ── Storage ──────────────────────────────────────────────────────────────

    IRitualToken public immutable ritualToken;
    IElderArtifacts public immutable artifacts;
    IEldritchGlyphs public immutable glyphs;

    uint256 public currentEpochId;
    mapping(uint256 => Epoch) public epochs;

    /// @dev epochId => wallet => total $RITUAL burned by this wallet for this epoch.
    ///      Persists after claims (used by claimGlyphs for qualification + bracket).
    mapping(uint256 => mapping(address => uint256)) public contributions;

    /// @dev epochId => contributor addresses (for reward distribution)
    mapping(uint256 => address[]) internal _contributors;

    /// @dev wallet => last sacrifice timestamp (for cooldown enforcement)
    mapping(address => uint256) public lastSacrificeTime;

    /// @dev wallet => total $RITUAL ever burned across all epochs (powers the Initiate cult rank)
    mapping(address => uint256) public lifetimeContribution;

    /// @dev epochId => wallet => artifact-reward double-claim guard
    mapping(uint256 => mapping(address => bool)) public rewardClaimed;

    /// @dev epochId => wallet => number of glyphs already claimed (for the 50-per-call cap)
    mapping(uint256 => mapping(address => uint256)) public glyphsClaimedCount;

    // ── Immutables (per-deploy phase durations) ──────────────────────────────
    //
    // Durations are constructor-set rather than hard-coded to (a) enable fast Sepolia
    // rehearsals without source/bytecode divergence (audit I-01) and (b) let mainnet
    // ship with 48h + 24h while keeping the same compiled bytecode. The external
    // getter signature is unchanged (auto-generated for immutables) so existing
    // callers and tests are unaffected.

    uint256 public immutable GATHERING_DURATION;
    uint256 public immutable RITUAL_DURATION;

    // ── Constants ────────────────────────────────────────────────────────────

    uint256 public constant MIN_SACRIFICE         = 1e18;     // 1 $RITUAL minimum — low-barrier participation
    uint256 public constant GLYPH_UNIT            = 100e18;   // 100 $RITUAL per glyph earned (and qualification threshold)
    uint256 public constant MAX_GLYPHS_PER_CLAIM  = 20;       // mirrors EldritchGlyphs.MAX_GLYPHS_PER_REQUEST; sized for the 2.5M VRF callback budget
    uint256 public constant SACRIFICE_COOLDOWN    = 30;       // seconds between sacrifices per wallet

    // ── Self-perpetuating escalation ─────────────────────────────────────────
    // Epoch 1 opens at GENESIS_THRESHOLD. Each success adds a FIXED WIN_INCREMENT
    // (a linear ramp off the prior threshold, not a multiplier): 75k → 225k → 375k…
    // Each failure decays the threshold ×0.75, floored at THRESHOLD_FLOOR so a
    // summoning is always reachable. Old One advances 1→OLD_ONE_COUNT on a win
    // (looping back to 1) and retries the same on a loss.
    uint256 public constant GENESIS_THRESHOLD     = 75_000e18;   // epoch 1 threshold
    uint256 public constant WIN_INCREMENT         = 150_000e18;  // +2× genesis added on each success
    uint256 public constant THRESHOLD_FLOOR       = 25_000e18;   // minimum threshold after failure decay
    uint256 public constant OLD_ONE_COUNT         = 5;           // number of Old Ones in the rotation

    // ── Events ───────────────────────────────────────────────────────────────

    event EpochStarted(uint256 indexed epochId, uint256 oldOneId, uint256 threshold, uint256 gatheringStart);
    event RitualPhaseStarted(uint256 indexed epochId, uint256 ritualStart, uint256 ritualEnd);
    event RitualSacrifice(
        uint256 indexed epochId,
        address indexed wallet,
        uint256 amount,
        uint256 totalCommitted
    );
    event EpochResolved(uint256 indexed epochId, bool successful, uint256 totalBurned);
    event RewardClaimed(uint256 indexed epochId, address indexed wallet, uint256 tierId);
    event GlyphsClaimRequested(
        uint256 indexed epochId,
        address indexed wallet,
        uint256 numGlyphs,
        uint256 cumulativeContribution
    );

    // ── Errors ───────────────────────────────────────────────────────────────

    error SummoningEngine__InvalidPhase();
    error SummoningEngine__BelowMinimum();
    error SummoningEngine__CooldownActive();
    error SummoningEngine__InsufficientBalance();
    error SummoningEngine__AlreadyClaimed();
    error SummoningEngine__EpochNotResolved();
    error SummoningEngine__ZeroAddress();
    error SummoningEngine__ZeroThreshold();
    error SummoningEngine__NoActiveEpoch();
    error SummoningEngine__NoGlyphsEarned();
    error SummoningEngine__InvalidDuration();

    // ── Constructor ──────────────────────────────────────────────────────────

    /// @param _gatheringDuration Seconds in the Gathering phase. Self-perpetuating mainnet
    ///        deploys use 0 (Gathering collapsed — the first sacrifice opens the ritual
    ///        directly). A positive value re-introduces a pre-ritual gather window.
    /// @param _ritualDuration    Seconds in the Ritual phase. Mainnet: 24 hours.
    constructor(
        address _token,
        address _artifacts,
        address _glyphs,
        address _owner,
        uint256 _gatheringDuration,
        uint256 _ritualDuration
    ) Ownable(_owner) {
        if (_token == address(0) || _artifacts == address(0) || _glyphs == address(0)) {
            revert SummoningEngine__ZeroAddress();
        }
        // The ritual window must be positive (a zero-duration ritual would brick the
        // lifecycle). Gathering may be 0 — the self-perpetuating design collapses it.
        if (_ritualDuration == 0) revert SummoningEngine__InvalidDuration();

        ritualToken = IRitualToken(_token);
        artifacts = IElderArtifacts(_artifacts);
        glyphs = IEldritchGlyphs(_glyphs);
        GATHERING_DURATION = _gatheringDuration;
        RITUAL_DURATION = _ritualDuration;
    }

    // ── Pause Controls (Owner) ───────────────────────────────────────────────

    /// @notice Pause commitRitual, claimGlyphs, and claimReward during an incident.
    ///         resolveEpoch and Chainlink Automation upkeep remain functional so epochs
    ///         can still resolve while paused.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume gameplay functions after a pause.
    function unpause() external onlyOwner {
        _unpause();
    }

    // ── Epoch Management (Owner override) ────────────────────────────────────

    /// @notice Bootstrap/emergency override: force-start an epoch with an explicit Old One and
    ///         threshold. NOT required for normal play — commitRitual auto-opens epochs on its
    ///         own (see _openNextEpoch). Retained so the owner can seed a custom genesis or
    ///         intervene after an incident. Opens the ritual window immediately (ritualStart =
    ///         now + GATHERING_DURATION, i.e. now when Gathering is collapsed). The next
    ///         auto-open derives its threshold/Old One from whatever this override sets.
    /// @param oldOneId Identifier for which Old One is being summoned (passed through to artifacts).
    /// @param threshold Minimum $RITUAL (18 decimals) required for a successful summoning.
    function startEpoch(uint256 oldOneId, uint256 threshold) external onlyOwner {
        if (threshold == 0) revert SummoningEngine__ZeroThreshold();

        // Ensure prior epoch is resolved before starting a new one (if any exists)
        if (currentEpochId > 0) {
            Epoch storage prior = epochs[currentEpochId];
            if (!prior.resolved) revert SummoningEngine__InvalidPhase();
        }

        currentEpochId++;
        uint256 id = currentEpochId;

        epochs[id] = Epoch({
            oldOneId: oldOneId,
            threshold: threshold,
            totalCommitted: 0,
            gatheringStart: block.timestamp,
            ritualStart: block.timestamp + GATHERING_DURATION,
            ritualEnd: block.timestamp + GATHERING_DURATION + RITUAL_DURATION,
            successful: false,
            resolved: false,
            participantCount: 0
        });

        emit EpochStarted(id, oldOneId, threshold, block.timestamp);
    }

    // ── Core Gameplay ────────────────────────────────────────────────────────

    /// @notice Burn $RITUAL tokens to participate in the current epoch's summoning ritual.
    ///         Tokens are burned immediately. Contribution and lifetime totals are updated.
    ///         No VRF request is issued and no glyphs are minted — glyph minting is deferred
    ///         to claimGlyphs(epochId) after the epoch resolves.
    ///         Caller must have approved this contract for at least `amount` $RITUAL.
    /// @param amount Token amount (18 decimals) to sacrifice. Must be >= MIN_SACRIFICE.
    function commitRitual(uint256 amount) external nonReentrant whenNotPaused {
        // Self-perpetuating auto-start: if no epoch has ever opened, or the current one is
        // already resolved, this sacrifice opens the next epoch (threshold + Old One derived
        // on-chain from the prior outcome) before it is counted. No owner call required.
        if (currentEpochId == 0 || epochs[currentEpochId].resolved) {
            _openNextEpoch();
        }

        uint256 id = currentEpochId;
        Epoch storage epoch = epochs[id];

        // Must be in the Ritual window (between ritualStart and ritualEnd). A just-opened
        // epoch has ritualStart == now (Gathering collapsed), so the opening sacrifice passes.
        // A closed-but-unresolved epoch reverts here until resolveEpoch runs — the next
        // sacrifice then auto-opens a fresh epoch via the branch above.
        if (block.timestamp < epoch.ritualStart || block.timestamp >= epoch.ritualEnd) {
            revert SummoningEngine__InvalidPhase();
        }
        if (amount < MIN_SACRIFICE) revert SummoningEngine__BelowMinimum();
        if (block.timestamp < lastSacrificeTime[msg.sender] + SACRIFICE_COOLDOWN) {
            revert SummoningEngine__CooldownActive();
        }
        if (ritualToken.balanceOf(msg.sender) < amount) revert SummoningEngine__InsufficientBalance();

        // Record cooldown before external call (checks-effects-interactions)
        lastSacrificeTime[msg.sender] = block.timestamp;

        // Track contribution (first-time contributors get added to list)
        if (contributions[id][msg.sender] == 0) {
            _contributors[id].push(msg.sender);
            epoch.participantCount++;
        }
        contributions[id][msg.sender] += amount;
        epoch.totalCommitted += amount;
        lifetimeContribution[msg.sender] += amount;

        // Burn tokens — caller must have approved this contract
        ritualToken.burnFrom(msg.sender, amount);

        emit RitualSacrifice(id, msg.sender, amount, epoch.totalCommitted);
    }

    /// @notice Claim glyph NFTs earned for a resolved epoch. Issues one VRF request returning
    ///         `numClaimed` random words; the EldritchGlyphs contract mints one glyph per word,
    ///         each rolled at the tier bracket selected by the wallet's cumulative contribution
    ///         to this epoch.
    ///         Eligibility: contributions[epochId][msg.sender] / GLYPH_UNIT must exceed the
    ///         number of glyphs already claimed. Below 100 RITUAL contribution → no glyphs.
    ///         Capped at MAX_GLYPHS_PER_CLAIM per call; wallets with more earned glyphs call
    ///         again (the same VRF cost applies per batch).
    /// @param epochId The resolved epoch to claim glyphs from.
    /// @return numClaimed Number of glyphs requested in this call.
    function claimGlyphs(uint256 epochId) external nonReentrant whenNotPaused returns (uint256 numClaimed) {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.resolved) revert SummoningEngine__EpochNotResolved();

        uint256 contribution = contributions[epochId][msg.sender];
        uint256 totalEarned = contribution / GLYPH_UNIT;
        uint256 alreadyClaimed = glyphsClaimedCount[epochId][msg.sender];

        if (totalEarned <= alreadyClaimed) revert SummoningEngine__NoGlyphsEarned();

        uint256 remaining = totalEarned - alreadyClaimed;
        numClaimed = remaining > MAX_GLYPHS_PER_CLAIM ? MAX_GLYPHS_PER_CLAIM : remaining;

        // State update before external call (checks-effects-interactions + reentrancy safety)
        glyphsClaimedCount[epochId][msg.sender] = alreadyClaimed + numClaimed;

        emit GlyphsClaimRequested(epochId, msg.sender, numClaimed, contribution);

        // Issues VRF request. Reverts propagate — user can retry when VRF is available again.
        glyphs.requestBatch(msg.sender, epochId, numClaimed, contribution);
    }

    /// @notice Resolve the current epoch after the ritual window closes.
    ///         Permissionless — anyone can call once ritualEnd has passed. In production the
    ///         self-hosted epoch keeper calls this automatically; the next commitRitual then
    ///         auto-opens the following epoch.
    function resolveEpoch() external {
        if (currentEpochId == 0) revert SummoningEngine__NoActiveEpoch();

        uint256 id = currentEpochId;
        Epoch storage epoch = epochs[id];

        if (block.timestamp < epoch.ritualEnd) revert SummoningEngine__InvalidPhase();
        if (epoch.resolved) revert SummoningEngine__InvalidPhase();

        epoch.resolved = true;
        epoch.successful = epoch.totalCommitted >= epoch.threshold;

        emit EpochResolved(id, epoch.successful, epoch.totalCommitted);
    }

    // ── Reward Claims ────────────────────────────────────────────────────────

    /// @notice Claim the ERC-1155 artifact reward after epoch resolution.
    ///         Token ID = epochId * 1000 + tierId.
    ///         tierId 0 = Shattered Ritual (failed epoch, everyone)
    ///         tierId 1 = Harbinger (top ~1%), tierId 2 = Acolyte (top ~10%), tierId 3 = Cultist
    ///         Contribution is preserved after claim (still readable by claimGlyphs);
    ///         double-claim is prevented by the `rewardClaimed` flag.
    /// @param epochId The epoch to claim for.
    function claimReward(uint256 epochId) external nonReentrant whenNotPaused {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.resolved) revert SummoningEngine__EpochNotResolved();

        uint256 contribution = contributions[epochId][msg.sender];
        if (contribution == 0) revert SummoningEngine__AlreadyClaimed();
        if (rewardClaimed[epochId][msg.sender]) revert SummoningEngine__AlreadyClaimed();

        rewardClaimed[epochId][msg.sender] = true;

        uint256 tierId = _calculateTier(epochId, contribution, epoch.successful);
        uint256 tokenId = epochId * 1000 + tierId;

        artifacts.mint(msg.sender, tokenId, 1, "");

        emit RewardClaimed(epochId, msg.sender, tierId);
    }

    // ── Chainlink Automation ──────────────────────────────────────────────────

    /// @notice Called off-chain by Chainlink Automation nodes to check if epoch resolution is needed.
    /// @dev Returns true when an active epoch has passed its ritualEnd and hasn't been resolved.
    /// @return upkeepNeeded True if performUpkeep should be called.
    /// @return performData ABI-encoded epoch ID to resolve.
    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        if (currentEpochId == 0) return (false, "");

        Epoch storage epoch = epochs[currentEpochId];

        if (!epoch.resolved && block.timestamp >= epoch.ritualEnd) {
            return (true, abi.encode(currentEpochId));
        }

        return (false, "");
    }

    /// @notice Called by Chainlink Automation to resolve an epoch.
    /// @dev Validates that the epoch still needs resolution (state may have changed since checkUpkeep).
    /// @param performData ABI-encoded epoch ID (from checkUpkeep).
    function performUpkeep(bytes calldata performData) external override {
        uint256 epochId = abi.decode(performData, (uint256));

        // Validate: must be the current epoch, not yet resolved, past ritualEnd
        if (epochId != currentEpochId) revert SummoningEngine__NoActiveEpoch();

        Epoch storage epoch = epochs[epochId];
        if (epoch.resolved) revert SummoningEngine__InvalidPhase();
        if (block.timestamp < epoch.ritualEnd) revert SummoningEngine__InvalidPhase();

        epoch.resolved = true;
        epoch.successful = epoch.totalCommitted >= epoch.threshold;

        emit EpochResolved(epochId, epoch.successful, epoch.totalCommitted);
    }

    // ── View Functions ───────────────────────────────────────────────────────

    /// @notice Returns the full Epoch struct for a given epoch ID.
    function getEpoch(uint256 epochId) external view returns (Epoch memory) {
        return epochs[epochId];
    }

    /// @notice Returns the current phase of the active epoch.
    function getCurrentPhase() external view returns (EpochPhase) {
        if (currentEpochId == 0) return EpochPhase.Inactive;

        Epoch storage epoch = epochs[currentEpochId];
        if (epoch.gatheringStart == 0) return EpochPhase.Inactive;
        if (epoch.resolved) return EpochPhase.Resolved;
        if (block.timestamp < epoch.ritualStart) return EpochPhase.Gathering;
        if (block.timestamp < epoch.ritualEnd) return EpochPhase.Ritual;
        return EpochPhase.Resolved; // past ritualEnd, awaiting resolveEpoch() call
    }

    /// @notice Returns a wallet's committed amount for a given epoch.
    /// @dev Returns 0 after the wallet has claimed their reward (contribution is zeroed).
    function getContribution(uint256 epochId, address wallet) external view returns (uint256) {
        return contributions[epochId][wallet];
    }

    /// @notice Returns all contributor addresses for a given epoch.
    function getContributors(uint256 epochId) external view returns (address[] memory) {
        return _contributors[epochId];
    }

    /// @notice The threshold the next auto-opened epoch will use — what the UI shows as the
    ///         "next summoning" target during the idle gap.
    /// @dev Before epoch 1 → GENESIS_THRESHOLD. While the current epoch is unresolved → 0
    ///      (the next threshold isn't determined until this one settles). After resolution →
    ///      the escalated/decayed value the next commitRitual will stamp in.
    function nextThreshold() external view returns (uint256) {
        if (currentEpochId == 0) return GENESIS_THRESHOLD;
        Epoch storage epoch = epochs[currentEpochId];
        if (!epoch.resolved) return 0;
        return _computeNextThreshold(epoch.threshold, epoch.successful);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    /// @dev Auto-open the next epoch (demand-driven, called from commitRitual). Derives the
    ///      threshold and Old One from the prior resolved epoch, or genesis defaults when no
    ///      epoch has opened yet. The ritual window opens immediately: ritualStart =
    ///      now + GATHERING_DURATION (== now when Gathering is collapsed to 0).
    function _openNextEpoch() internal {
        uint256 priorId = currentEpochId;

        uint256 newOldOneId;
        uint256 newThreshold;
        if (priorId == 0) {
            newOldOneId = 1;                       // genesis: first Old One
            newThreshold = GENESIS_THRESHOLD;
        } else {
            Epoch storage prior = epochs[priorId]; // guaranteed resolved by the caller
            newOldOneId = _computeNextOldOne(prior.oldOneId, prior.successful);
            newThreshold = _computeNextThreshold(prior.threshold, prior.successful);
        }

        uint256 id = priorId + 1;
        currentEpochId = id;

        epochs[id] = Epoch({
            oldOneId: newOldOneId,
            threshold: newThreshold,
            totalCommitted: 0,
            gatheringStart: block.timestamp,
            ritualStart: block.timestamp + GATHERING_DURATION,
            ritualEnd: block.timestamp + GATHERING_DURATION + RITUAL_DURATION,
            successful: false,
            resolved: false,
            participantCount: 0
        });

        emit EpochStarted(id, newOldOneId, newThreshold, block.timestamp);
    }

    /// @dev Next threshold from the prior outcome. WIN: prior + WIN_INCREMENT (linear ramp).
    ///      LOSS: prior ×0.75, floored at THRESHOLD_FLOOR so a summoning stays reachable.
    function _computeNextThreshold(uint256 priorThreshold, bool priorSuccess)
        internal
        pure
        returns (uint256)
    {
        if (priorSuccess) {
            return priorThreshold + WIN_INCREMENT;
        }
        uint256 decayed = (priorThreshold * 3) / 4;
        return decayed < THRESHOLD_FLOOR ? THRESHOLD_FLOOR : decayed;
    }

    /// @dev Next Old One from the prior outcome. WIN: advance, looping OLD_ONE_COUNT → 1.
    ///      LOSS: retry the same Old One ("the cult regroups").
    function _computeNextOldOne(uint256 priorOldOneId, bool priorSuccess)
        internal
        pure
        returns (uint256)
    {
        if (!priorSuccess) return priorOldOneId;
        return priorOldOneId >= OLD_ONE_COUNT ? 1 : priorOldOneId + 1;
    }

    /// @dev Determines reward tier from contribution percentile.
    ///      Failed epochs always yield tierId 0 (Shattered Ritual).
    ///      Successful epochs use average-multiple thresholds as a V1 approximation.
    ///      Sole contributors get Harbinger (M-01) — the avg-multiple formula is
    ///      otherwise unreachable for a single participant since contribution == avg.
    ///      Production: use merkle proofs from off-chain percentile calculation.
    function _calculateTier(
        uint256 epochId,
        uint256 contribution,
        bool successful
    ) internal view returns (uint256) {
        if (!successful) return 0; // Shattered Ritual

        Epoch storage epoch = epochs[epochId];
        if (epoch.participantCount == 1) return 1; // sole summoner → Harbinger (M-01)

        uint256 avgContribution = epoch.totalCommitted / epoch.participantCount;

        if (contribution >= avgContribution * 10) return 1; // Harbinger  (~top 1%)
        if (contribution >= avgContribution * 3)  return 2; // Acolyte    (~top 10%)
        return 3;                                           // Cultist    (everyone else)
    }
}
