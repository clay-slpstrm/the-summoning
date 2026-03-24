// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISummoningEngine {

    enum EpochPhase { Inactive, Gathering, Ritual, Resolved }

    struct Epoch {
        uint256 oldOneId;
        uint256 threshold;
        uint256 totalCommitted;
        uint256 gatheringStart;
        uint256 ritualStart;
        uint256 ritualEnd;
        bool successful;
        bool resolved;
        uint256 participantCount;
    }

    // ── Owner ──

    function startEpoch(uint256 oldOneId, uint256 threshold) external;

    // ── Core gameplay ──

    function commitRitual(uint256 amount) external;
    function resolveEpoch() external;
    function claimReward(uint256 epochId) external;

    // ── Automation ──

    function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata performData) external;

    // ── Views ──

    function getEpoch(uint256 epochId) external view returns (Epoch memory);
    function getCurrentPhase() external view returns (EpochPhase);
    function getContribution(uint256 epochId, address wallet) external view returns (uint256);
    function getContributors(uint256 epochId) external view returns (address[] memory);
    function nextThreshold() external view returns (uint256);

    // ── Events ──

    event EpochStarted(uint256 indexed epochId, uint256 oldOneId, uint256 threshold, uint256 gatheringStart);
    event RitualPhaseStarted(uint256 indexed epochId, uint256 ritualStart, uint256 ritualEnd);
    event RitualSacrifice(uint256 indexed epochId, address indexed wallet, uint256 amount, uint256 totalCommitted);
    event EpochResolved(uint256 indexed epochId, bool successful, uint256 totalBurned);
    event RewardClaimed(uint256 indexed epochId, address indexed wallet, uint256 tierId);
}
