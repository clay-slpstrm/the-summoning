// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SummoningEngine.sol";
import "../src/ElderArtifacts.sol";

/// @notice Week 2 deployment: redeploy only SummoningEngine + ElderArtifacts.
///         RitualToken and MintingCurve are already live on Sepolia and kept as-is.
///
/// Required env vars:
///   DEPLOYER_PRIVATE_KEY   — deployer wallet private key (hex, no 0x prefix)
///   RITUAL_TOKEN_ADDRESS   — existing Sepolia RitualToken address
contract DeployWeek2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(deployerPrivateKey);

        address ritualToken = vm.envAddress("RITUAL_TOKEN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy full ElderArtifacts implementation
        ElderArtifacts artifacts = new ElderArtifacts(
            "https://api.thesummoning.xyz/metadata/",
            owner
        );

        // 2. Deploy full SummoningEngine implementation
        // NOTE: Requires EldritchGlyphs address. Use DeployGlyphs.s.sol for new deployments.
        address glyphs = vm.envAddress("ELDRITCH_GLYPHS_ADDRESS");
        SummoningEngine engine = new SummoningEngine(
            ritualToken,
            address(artifacts),
            glyphs,
            owner,
            48 hours,
            24 hours
        );

        // 3. Wire: authorize engine to mint artifacts
        artifacts.setEngine(address(engine));

        vm.stopBroadcast();

        console.log("=== Week 2 Deployment ===");
        console.log("ElderArtifacts:", address(artifacts));
        console.log("SummoningEngine:", address(engine));
        console.log("");
        console.log("Update frontend/.env.local:");
        console.log("NEXT_PUBLIC_SUMMONING_ENGINE_ADDRESS=", address(engine));
        console.log("NEXT_PUBLIC_ELDER_ARTIFACTS_ADDRESS=", address(artifacts));
    }
}
