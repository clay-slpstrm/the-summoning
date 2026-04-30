// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SummoningEngine.sol";

/// @notice Manually resolves the current epoch after ritualEnd.
///         Fallback for when Chainlink Automation isn't registered or hasn't fired yet.
///         resolveEpoch() is public — any wallet can call it.
///
/// Required env vars:
///   SUMMONING_ENGINE_ADDRESS   — Sepolia SummoningEngine address
///
/// Usage with encrypted keystore:
///   forge script script/ResolveSepoliaEpoch.s.sol:ResolveSepoliaEpoch \
///     --account deployer --sender 0x... --rpc-url $SEPOLIA_RPC_URL --broadcast
contract ResolveSepoliaEpoch is Script {
    function run() external {
        address engineAddr = vm.envAddress("SUMMONING_ENGINE_ADDRESS");

        SummoningEngine engine = SummoningEngine(engineAddr);
        uint256 id = engine.currentEpochId();
        SummoningEngine.Epoch memory ep = engine.getEpoch(id);

        require(!ep.resolved, "Epoch already resolved");
        require(block.timestamp >= ep.ritualEnd, "Ritual phase not over");

        vm.startBroadcast();
        engine.resolveEpoch();
        vm.stopBroadcast();

        ep = engine.getEpoch(id);
        console.log("=== Epoch Resolved ===");
        console.log("Epoch ID:       ", id);
        console.log("Successful:     ", ep.successful);
        console.log("Total committed:", ep.totalCommitted);
        console.log("Threshold:      ", ep.threshold);
    }
}
