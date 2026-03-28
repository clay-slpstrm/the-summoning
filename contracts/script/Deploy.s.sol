// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/RitualToken.sol";
import "../src/MintingCurve.sol";
import "../src/SummoningEngine.sol";
import "../src/ElderArtifacts.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy RitualToken
        RitualToken token = new RitualToken(owner);

        // 2. Deploy MintingCurve
        MintingCurve curve = new MintingCurve(address(token), owner);

        // 3. Deploy ElderArtifacts
        ElderArtifacts artifacts = new ElderArtifacts(
            "https://api.thesummoning.xyz/metadata/",
            owner
        );

        // 4. Deploy SummoningEngine
        // NOTE: Requires EldritchGlyphs address. Use DeployGlyphs.s.sol for new deployments.
        address glyphs = vm.envAddress("ELDRITCH_GLYPHS_ADDRESS");
        SummoningEngine engine = new SummoningEngine(
            address(token),
            address(artifacts),
            glyphs,
            owner
        );

        // 5. Wire contracts together
        token.setMinter(address(curve));
        artifacts.setEngine(address(engine));

        vm.stopBroadcast();

        // Log deployed addresses
        console.log("RitualToken:", address(token));
        console.log("MintingCurve:", address(curve));
        console.log("ElderArtifacts:", address(artifacts));
        console.log("SummoningEngine:", address(engine));
    }
}
