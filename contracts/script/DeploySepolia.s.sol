// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/RitualToken.sol";
import "../src/MintingCurve.sol";
import "../src/SummoningEngine.sol";
import "../src/ElderArtifacts.sol";
import "../src/EldritchGlyphs.sol";

/// @notice Full 5-contract redeploy to Sepolia, post-audit. Mirrors DeployMainnet but
///         accepts an OPTIONAL `MULTISIG_ADDRESS` env var — when unset, the deployer EOA
///         is used as owner across all contracts (faster testnet iteration; no Safe
///         steps required between deploy and exercising the contracts).
///
///         Why a full redeploy: the pre-audit Sepolia contracts lack MAX_SUPPLY,
///         Pausable, getTokensOut, claimGlyphs, lifetimeContribution, etc. We can't
///         test the new architecture against the old bytecode.
///
/// Deployer signer is supplied via CLI flag, NOT an env var (mirrors DeployMainnet):
///   --account deployer --sender <deployerAddr>   (keystore; recommended)
///   --ledger --sender <deployerAddr>             (hardware wallet)
///   --private-key <key>                          (raw; discouraged)
///
/// Required env vars:
///   VRF_COORDINATOR            — Chainlink VRF V2.5 coordinator (Sepolia: 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B)
///   VRF_SUBSCRIPTION_ID        — Sepolia VRF subscription ID (uint256)
///   VRF_KEY_HASH               — VRF key hash / gas lane
/// Optional env vars:
///   MULTISIG_ADDRESS           — Safe address to use as owner. If unset, deployer EOA is used.
///   VRF_CALLBACK_GAS_LIMIT     — default 2_500_000 (sized for 50-glyph batched fulfill)
///   METADATA_BASE_URI          — default https://api.thesummoning.xyz/metadata/glyph/
///   GATHERING_DURATION_SECONDS — default 0 (Gathering collapsed — self-perpetuating config;
///                                the first sacrifice opens the ritual directly)
///   RITUAL_DURATION_SECONDS    — default 300 (5 min) for fast Sepolia rehearsal
///
/// Usage:
///   forge script script/DeploySepolia.s.sol:DeploySepolia \
///     --rpc-url $SEPOLIA_RPC_URL \
///     --account deployer --sender $DEPLOYER_ADDRESS \
///     --broadcast --verify
contract DeploySepolia is Script {
    struct VrfConfig {
        address coordinator;
        uint256 subscriptionId;
        bytes32 keyHash;
        uint32 callbackGasLimit;
        string baseURI;
    }

    struct Deployed {
        RitualToken token;
        MintingCurve curve;
        ElderArtifacts artifacts;
        EldritchGlyphs glyphs;
        SummoningEngine engine;
    }

    function run() external {
        // Signer (and thus msg.sender) comes from the CLI flag: --account / --ledger
        // / --private-key. No raw key in the environment.
        address deployer = msg.sender;
        address owner = vm.envOr("MULTISIG_ADDRESS", deployer);
        bool usingMultisig = owner != deployer;

        VrfConfig memory vrf = _loadVrfConfig();

        vm.startBroadcast();
        Deployed memory d = _deployAll(owner, vrf);
        _wire(d, owner, usingMultisig);
        vm.stopBroadcast();

        _logSummary(deployer, owner, usingMultisig, d, vrf.subscriptionId);
    }

    function _deployAll(address owner, VrfConfig memory vrf)
        internal
        returns (Deployed memory d)
    {
        d.token = new RitualToken(owner);
        d.curve = new MintingCurve(address(d.token), owner);
        d.artifacts = new ElderArtifacts(
            "https://api.thesummoning.xyz/metadata/",
            owner
        );
        d.glyphs = _deployGlyphs(vrf, owner);

        // Self-perpetuating config: Gathering collapsed (0) by default. The first sacrifice
        // auto-opens the epoch directly into the Ritual window.
        uint256 gathering = vm.envOr("GATHERING_DURATION_SECONDS", uint256(0));
        uint256 ritual = vm.envOr("RITUAL_DURATION_SECONDS", uint256(300));

        d.engine = new SummoningEngine(
            address(d.token),
            address(d.artifacts),
            address(d.glyphs),
            owner,
            gathering,
            ritual
        );
    }

    function _wire(Deployed memory d, address owner, bool usingMultisig) internal {
        // EldritchGlyphs.setEngine — deployer is still owner per ConfirmedOwner.
        d.glyphs.setEngine(address(d.engine));

        if (!usingMultisig) {
            d.token.setMinter(address(d.curve));
            d.artifacts.setEngine(address(d.engine));
        } else {
            // 2-step transfer; multisig must call acceptOwnership.
            d.glyphs.transferOwnership(owner);
        }
    }

    function _loadVrfConfig() internal view returns (VrfConfig memory vrf) {
        vrf.coordinator = vm.envAddress("VRF_COORDINATOR");
        vrf.subscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");
        vrf.keyHash = vm.envBytes32("VRF_KEY_HASH");
        vrf.callbackGasLimit = uint32(vm.envOr("VRF_CALLBACK_GAS_LIMIT", uint256(2_500_000)));
        vrf.baseURI = vm.envOr(
            "METADATA_BASE_URI",
            string("https://api.thesummoning.xyz/metadata/glyph/")
        );
    }

    function _deployGlyphs(VrfConfig memory vrf, address royaltyReceiver)
        internal
        returns (EldritchGlyphs)
    {
        return new EldritchGlyphs(
            vrf.coordinator,
            vrf.subscriptionId,
            vrf.keyHash,
            vrf.callbackGasLimit,
            3, // requestConfirmations
            vrf.baseURI,
            royaltyReceiver
        );
    }

    function _logSummary(
        address deployer,
        address owner,
        bool usingMultisig,
        Deployed memory d,
        uint256 subscriptionId
    ) internal pure {
        console.log("=== Sepolia Deployment ===");
        console.log("Deployer:        ", deployer);
        console.log("Owner:           ", owner);
        console.log("Using multisig:  ", usingMultisig);
        console.log("");
        console.log("RitualToken:     ", address(d.token));
        console.log("MintingCurve:    ", address(d.curve));
        console.log("ElderArtifacts:  ", address(d.artifacts));
        console.log("EldritchGlyphs:  ", address(d.glyphs));
        console.log("SummoningEngine: ", address(d.engine));
        console.log("");
        console.log("=== POST-DEPLOY ===");
        console.log("A. Add EldritchGlyphs as VRF consumer at vrf.chain.link (subId %s)", subscriptionId);
        console.log("B. Run forge verify-bytecode against committed source for all 5 contracts");
        console.log("C. Update backend/.env and frontend/.env.local with new addresses");
        if (usingMultisig) {
            console.log("D. From multisig: RitualToken.setMinter(MintingCurve)");
            console.log("E. From multisig: ElderArtifacts.setEngine(SummoningEngine)");
            console.log("F. From multisig: EldritchGlyphs.acceptOwnership()");
        }
        console.log("G. (Optional) Register SummoningEngine as Chainlink Automation upkeep");
    }
}
