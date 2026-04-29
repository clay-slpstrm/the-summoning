// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/RitualToken.sol";
import "../src/MintingCurve.sol";
import "../src/SummoningEngine.sol";
import "../src/ElderArtifacts.sol";
import "../src/EldritchGlyphs.sol";

/// @notice Full mainnet deployment of all 5 contracts.
///         Uses a multisig as owner for all contracts (not the deployer EOA).
///
/// Required env vars:
///   DEPLOYER_PRIVATE_KEY       — deployer EOA private key (pays gas, NOT the owner)
///   MULTISIG_ADDRESS           — Safe multisig address (becomes owner of all contracts)
///   VRF_COORDINATOR            — Chainlink VRF V2.5 coordinator (mainnet)
///   VRF_SUBSCRIPTION_ID        — VRF subscription ID (uint256)
///   VRF_KEY_HASH               — VRF key hash / gas lane
///   VRF_CALLBACK_GAS_LIMIT     — gas limit for VRF callback (default: 300000)
///   METADATA_BASE_URI          — base URI for glyph metadata (default: https://api.thesummoning.xyz/metadata/glyph/)
contract DeployMainnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address multisig = vm.envAddress("MULTISIG_ADDRESS");

        // VRF config
        address vrfCoordinator = vm.envAddress("VRF_COORDINATOR");
        uint256 subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");
        bytes32 keyHash = vm.envBytes32("VRF_KEY_HASH");
        uint32 callbackGasLimit = uint32(vm.envOr("VRF_CALLBACK_GAS_LIMIT", uint256(300_000)));
        string memory baseURI = vm.envOr(
            "METADATA_BASE_URI",
            string("https://api.thesummoning.xyz/metadata/glyph/")
        );

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy RitualToken — multisig is owner
        RitualToken token = new RitualToken(multisig);

        // 2. Deploy MintingCurve — multisig is owner (receives withdraw() funds)
        MintingCurve curve = new MintingCurve(address(token), multisig);

        // 3. Deploy ElderArtifacts — multisig is owner
        ElderArtifacts artifacts = new ElderArtifacts(
            "https://api.thesummoning.xyz/metadata/",
            multisig
        );

        // 4. Deploy EldritchGlyphs — royalty receiver is multisig
        //    NOTE: Owner starts as deployer (VRFConsumerBaseV2Plus / ConfirmedOwner).
        //    Ownership is transferred to multisig below.
        EldritchGlyphs glyphs = new EldritchGlyphs(
            vrfCoordinator,
            subscriptionId,
            keyHash,
            callbackGasLimit,
            3, // requestConfirmations
            baseURI,
            multisig // royalty receiver
        );

        // 5. Deploy SummoningEngine — multisig is owner
        SummoningEngine engine = new SummoningEngine(
            address(token),
            address(artifacts),
            address(glyphs),
            multisig
        );

        // 6. Wire contracts — these calls require current owner permissions
        //    RitualToken.setMinter — owner is multisig, so deployer can't call it.
        //    ElderArtifacts.setEngine — owner is multisig, so deployer can't call it.
        //    EldritchGlyphs.setEngine — deployer IS still the owner (ConfirmedOwner).
        glyphs.setEngine(address(engine));

        // 7. Transfer EldritchGlyphs ownership to multisig (2-step: propose here, accept via Safe)
        glyphs.transferOwnership(multisig);

        vm.stopBroadcast();

        console.log("=== Mainnet Deployment ===");
        console.log("Multisig (owner):", multisig);
        console.log("");
        console.log("RitualToken:", address(token));
        console.log("MintingCurve:", address(curve));
        console.log("ElderArtifacts:", address(artifacts));
        console.log("EldritchGlyphs:", address(glyphs));
        console.log("SummoningEngine:", address(engine));
        console.log("");
        console.log("=== POST-DEPLOY (execute via Safe multisig) ===");
        console.log("1. Add EldritchGlyphs as VRF consumer on subscription", subscriptionId);
        console.log("2. Call EldritchGlyphs.acceptOwnership() from multisig");
        console.log("3. Call RitualToken.setMinter(MintingCurve) from multisig");
        console.log("4. Call ElderArtifacts.setEngine(SummoningEngine) from multisig");
        console.log("5. Verify all 5 contracts on Etherscan");
        console.log("6. Update frontend/.env with new addresses");
        console.log("7. Update backend/.env with new addresses");
    }
}
