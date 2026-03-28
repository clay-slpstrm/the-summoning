// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/EldritchGlyphs.sol";
import "../src/SummoningEngine.sol";
import "../src/ElderArtifacts.sol";

/// @notice Deploy EldritchGlyphs + redeploy SummoningEngine with VRF glyph support.
///         RitualToken, MintingCurve, and ElderArtifacts remain at existing addresses.
///
/// Required env vars:
///   DEPLOYER_PRIVATE_KEY       — deployer wallet private key
///   RITUAL_TOKEN_ADDRESS       — existing RitualToken address
///   ELDER_ARTIFACTS_ADDRESS    — existing ElderArtifacts address
///   VRF_COORDINATOR            — Chainlink VRF V2.5 coordinator
///   VRF_SUBSCRIPTION_ID        — VRF subscription ID (uint256)
///   VRF_KEY_HASH               — VRF key hash (gas lane)
///   VRF_CALLBACK_GAS_LIMIT     — gas limit for VRF callback (default: 300000)
///   ROYALTY_RECEIVER            — address for EIP-2981 royalties
///   METADATA_BASE_URI          — base URI for glyph metadata
contract DeployGlyphs is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(deployerPrivateKey);

        // Existing contracts
        address ritualToken = vm.envAddress("RITUAL_TOKEN_ADDRESS");
        address elderArtifacts = vm.envAddress("ELDER_ARTIFACTS_ADDRESS");

        // VRF config
        address vrfCoordinator = vm.envAddress("VRF_COORDINATOR");
        uint256 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");
        bytes32 keyHash = vm.envBytes32("VRF_KEY_HASH");
        uint32 callbackGasLimit = uint32(vm.envOr("VRF_CALLBACK_GAS_LIMIT", uint256(300_000)));

        // Glyph config
        address royaltyReceiver = vm.envAddress("ROYALTY_RECEIVER");
        string memory baseURI = vm.envOr("METADATA_BASE_URI", string("https://api.thesummoning.xyz/metadata/glyph/"));

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy EldritchGlyphs
        EldritchGlyphs glyphs = new EldritchGlyphs(
            vrfCoordinator,
            subscriptionId,
            keyHash,
            callbackGasLimit,
            3, // requestConfirmations
            baseURI,
            royaltyReceiver
        );

        // 2. Redeploy SummoningEngine with glyphs reference
        SummoningEngine engine = new SummoningEngine(
            ritualToken,
            elderArtifacts,
            address(glyphs),
            owner
        );

        // 3. Wire: authorize engine on both artifact contracts
        ElderArtifacts(elderArtifacts).setEngine(address(engine));
        glyphs.setEngine(address(engine));

        vm.stopBroadcast();

        console.log("=== Glyph NFT Deployment ===");
        console.log("EldritchGlyphs:", address(glyphs));
        console.log("SummoningEngine (new):", address(engine));
        console.log("");
        console.log("Post-deploy steps:");
        console.log("1. Add EldritchGlyphs as VRF consumer on subscription", subscriptionId);
        console.log("2. Update frontend/.env.local with new addresses");
        console.log("3. Update backend/.env with ELDRITCH_GLYPHS_ADDRESS");
    }
}
