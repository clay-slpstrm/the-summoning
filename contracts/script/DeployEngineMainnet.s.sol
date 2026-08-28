// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SummoningEngine.sol";

/// @notice ENGINE-ONLY mainnet redeploy for the Phase 0 self-perpetuating design.
///         The other four contracts (RitualToken, MintingCurve, ElderArtifacts,
///         EldritchGlyphs) remain the live, Safe-owned mainnet deployments — this
///         script deploys ONLY the new SummoningEngine wired to them.
///
///         Config is hard-coded to the audited mainnet values:
///           GATHERING_DURATION = 0   (Gathering collapsed — first sacrifice opens the ritual)
///           RITUAL_DURATION    = 24h
///           owner              = the 2-of-3 Safe
///
///         AFTER this deploys, the engine is inert until the Safe executes BOTH:
///           1. ElderArtifacts.setEngine(newEngine)   (0x8324...af5A)
///           2. EldritchGlyphs.setEngine(newEngine)   (0xe820...D156)
///         Batch them in one Transaction Builder tx (audit AUDIT-PHASE0.md I-05).
///         The old engine (0x5D47...5be5) loses mint authority in the same act;
///         treat it as retired. VRF subscription is unaffected.
///
/// Deployer signer comes from the CLI (never an env key):
///   --account deployer --sender <deployerAddr>
///
/// Env (contracts/.env.mainnet): MAINNET_RPC_URL, ETHERSCAN_API_KEY (verify).
/// The live contract addresses are hard-coded below — they are published,
/// verified mainnet contracts; hard-coding removes env-mistake risk.
///
/// Usage:
///   forge script script/DeployEngineMainnet.s.sol:DeployEngineMainnet \
///     --rpc-url $MAINNET_RPC_URL \
///     --account deployer --sender $DEPLOYER_ADDRESS \
///     --broadcast --verify
contract DeployEngineMainnet is Script {
    // ── Live mainnet deployment (2026-07-01, block 25439683) ─────────────────
    address constant RITUAL_TOKEN    = 0x8daA5B21136de9B5ac43fd89fDc98cDe934E7863;
    address constant ELDER_ARTIFACTS = 0x832436cdf21d6732fAfD22938ee2b7617D74af5A;
    address constant ELDRITCH_GLYPHS = 0xe820607743E95a694Aa50a9BFFf628C3E202D156;
    address constant SAFE            = 0x67c6f1dA08Cd99A661ec6f77A060E985d9672baB;
    address constant OLD_ENGINE      = 0x5D474E68c08B2aF16dFEd50377B98573e17a5be5;

    function run() external {
        require(block.chainid == 1, "mainnet only");

        vm.startBroadcast();
        SummoningEngine engine = new SummoningEngine(
            RITUAL_TOKEN,
            ELDER_ARTIFACTS,
            ELDRITCH_GLYPHS,
            SAFE,
            0,        // Gathering collapsed — self-perpetuating
            24 hours  // ritual window
        );
        vm.stopBroadcast();

        // Sanity: constructor wiring + self-perpetuating constants.
        require(address(engine.ritualToken()) == RITUAL_TOKEN, "token wiring");
        require(address(engine.artifacts()) == ELDER_ARTIFACTS, "artifacts wiring");
        require(address(engine.glyphs()) == ELDRITCH_GLYPHS, "glyphs wiring");
        require(engine.owner() == SAFE, "owner != Safe");
        require(engine.GATHERING_DURATION() == 0, "gathering != 0");
        require(engine.RITUAL_DURATION() == 24 hours, "ritual != 24h");
        require(engine.GENESIS_THRESHOLD() == 75_000e18, "genesis");
        require(engine.nextThreshold() == 75_000e18, "idle preview");

        console.log("=== Engine-only mainnet redeploy ===");
        console.log("NEW SummoningEngine:", address(engine));
        console.log("Owner (Safe):       ", SAFE);
        console.log("Old engine (retire):", OLD_ENGINE);
        console.log("");
        console.log("=== NEXT: Safe batch (2-of-3, one Transaction Builder tx) ===");
        console.log("1. ElderArtifacts.setEngine(newEngine) ->", ELDER_ARTIFACTS);
        console.log("2. EldritchGlyphs.setEngine(newEngine) ->", ELDRITCH_GLYPHS);
        console.log("Then: verify-bytecode, backend/frontend cutover, DB wipe.");
        console.log("Launch trigger: first First-Cultist sacrifice opens epoch 1 (Cthulhu, 75k).");
    }
}
