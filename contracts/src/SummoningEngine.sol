// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IRitualToken.sol";
import "./interfaces/IElderArtifacts.sol";

/// @title SummoningEngine
/// @notice Core gameplay contract. Manages epoch lifecycle: Gathering → Ritual → Resolved.
///         Players burn $RITUAL via commitRitual during the Ritual phase.
///         The RitualSacrifice event triggers off-chain Glyph Engine glyph assignment.
///         After resolution, participants claim ERC-1155 artifact rewards.
contract SummoningEngine is Ownable, ReentrancyGuard {

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

    uint256 public currentEpochId;
    mapping(uint256 => Epoch) public epochs;

    /// @dev epochId => wallet => amount committed (zeroed on claim to prevent double-claim)
    mapping(uint256 => mapping(address => uint256)) public contributions;

    /// @dev epochId => contributor addresses (for reward distribution)
    mapping(uint256 => address[]) internal _contributors;

    /// @dev wallet => last sacrifice timestamp (for cooldown enforcement)
    mapping(address => uint256) public lastSacrificeTime;

    // ── Constants ────────────────────────────────────────────────────────────

    uint256 public constant GATHERING_DURATION    = 48 hours;
    uint256 public constant RITUAL_DURATION       = 24 hours;
    uint256 public constant MIN_SACRIFICE         = 100e18;   // 100 $RITUAL minimum
    uint256 public constant SACRIFICE_COOLDOWN    = 30;       // seconds between sacrifices per wallet
    uint256 public constant FAILURE_REDUCTION_BPS = 2000;    // 20% threshold reduction on failure
    uint256 public constant ESCALATION_BPS        = 13000;   // 1.3× threshold increase on success

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

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _token,
        address _artifacts,
        address _owner
    ) Ownable(_owner) {
        if (_token == address(0) || _artifacts == address(0)) revert SummoningEngine__ZeroAddress();
        ritualToken = IRitualToken(_token);
        artifacts = IElderArtifacts(_artifacts);
    }

    // ── Epoch Management (Owner) ─────────────────────────────────────────────

    /// @notice Start a new epoch. Begins the Gathering phase immediately.
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
    ///         Tokens are burned immediately on call. Emits RitualSacrifice — the trigger
    ///         for the off-chain Glyph Engine to assign a glyph to the caller.
    ///         Caller must have approved this contract for at least `amount` $RITUAL.
    /// @param amount Token amount (18 decimals) to sacrifice. Must be >= MIN_SACRIFICE.
    function commitRitual(uint256 amount) external nonReentrant {
        if (currentEpochId == 0) revert SummoningEngine__NoActiveEpoch();

        uint256 id = currentEpochId;
        Epoch storage epoch = epochs[id];

        // Must be in Ritual phase (between ritualStart and ritualEnd)
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

        // Burn tokens — caller must have approved this contract
        ritualToken.burnFrom(msg.sender, amount);

        emit RitualSacrifice(id, msg.sender, amount, epoch.totalCommitted);
    }

    /// @notice Resolve the current epoch after the ritual window closes.
    ///         Permissionless — anyone can call once ritualEnd has passed.
    ///         In production, Chainlink Automation calls this automatically.
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
    /// @param epochId The epoch to claim for.
    function claimReward(uint256 epochId) external nonReentrant {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.resolved) revert SummoningEngine__EpochNotResolved();

        uint256 contribution = contributions[epochId][msg.sender];
        if (contribution == 0) revert SummoningEngine__AlreadyClaimed();

        // Zero out before minting (checks-effects-interactions + prevents re-entrancy double-claim)
        contributions[epochId][msg.sender] = 0;

        uint256 tierId = _calculateTier(epochId, contribution, epoch.successful);
        uint256 tokenId = epochId * 1000 + tierId;

        artifacts.mint(msg.sender, tokenId, 1, "");

        emit RewardClaimed(epochId, msg.sender, tierId);
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

    /// @notice Compute the next epoch's threshold based on the current epoch's outcome.
    ///         Useful for the owner when calling startEpoch for the next round.
    function nextThreshold() external view returns (uint256) {
        if (currentEpochId == 0) return 0;
        Epoch storage epoch = epochs[currentEpochId];
        if (!epoch.resolved) return 0;

        if (epoch.successful) {
            return (epoch.threshold * ESCALATION_BPS) / 10_000;
        } else {
            return (epoch.threshold * (10_000 - FAILURE_REDUCTION_BPS)) / 10_000;
        }
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    /// @dev Determines reward tier from contribution percentile.
    ///      Failed epochs always yield tierId 0 (Shattered Ritual).
    ///      Successful epochs use average-multiple thresholds as a V1 approximation.
    ///      Production: use merkle proofs from off-chain percentile calculation.
    function _calculateTier(
        uint256 epochId,
        uint256 contribution,
        bool successful
    ) internal view returns (uint256) {
        if (!successful) return 0; // Shattered Ritual

        Epoch storage epoch = epochs[epochId];
        uint256 avgContribution = epoch.totalCommitted / epoch.participantCount;

        if (contribution >= avgContribution * 10) return 1; // Harbinger  (~top 1%)
        if (contribution >= avgContribution * 3)  return 2; // Acolyte    (~top 10%)
        return 3;                                           // Cultist    (everyone else)
    }
}
