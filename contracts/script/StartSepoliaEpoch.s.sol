// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SummoningEngine.sol";

/// @notice Starts a new epoch on the deployed Sepolia SummoningEngine.
///         Owner-only — uses the deployer key that owns the contract.
///
/// Required env vars:
///   DEPLOYER_PRIVATE_KEY       — owner of the deployed SummoningEngine
///   SUMMONING_ENGINE_ADDRESS   — Sepolia SummoningEngine address
/// Optional env vars:
///   OLD_ONE_ID                 — which Old One (1..5). Default 2 (Nyarlathotep).
///   THRESHOLD                  — sacrifice threshold in wei (18 decimals). Default 100e18.
contract StartSepoliaEpoch is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address engineAddr = vm.envAddress("SUMMONING_ENGINE_ADDRESS");
        uint256 oldOneId = vm.envOr("OLD_ONE_ID", uint256(2));
        uint256 threshold = vm.envOr("THRESHOLD", uint256(100e18));

        SummoningEngine engine = SummoningEngine(engineAddr);

        vm.startBroadcast(deployerPrivateKey);
        engine.startEpoch(oldOneId, threshold);
        vm.stopBroadcast();

        SummoningEngine.Epoch memory ep = engine.getEpoch(engine.currentEpochId());

        console.log("=== Epoch Started ===");
        console.log("Engine:         ", engineAddr);
        console.log("Epoch ID:       ", engine.currentEpochId());
        console.log("Old One ID:     ", oldOneId);
        console.log("Threshold (wei):", threshold);
        console.log("Gathering start:", ep.gatheringStart);
        console.log("Ritual start:   ", ep.ritualStart);
        console.log("Ritual end:     ", ep.ritualEnd);
    }
}
