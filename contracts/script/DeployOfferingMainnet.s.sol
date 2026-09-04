// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Offering.sol";

/// @notice Mainnet deploy of the Offering — the self-serve First Cultists claim.
///         Wired to the live RitualToken, owned by the treasury Safe. Inert until
///         the Safe funds it with 25,000 $RITUAL (250 seats × 100): the funding
///         batch is mint-via-curve + transfer, prepared as Transaction Builder JSON.
///
/// Deployer signer comes from the CLI (never an env key):
///   forge script script/DeployOfferingMainnet.s.sol:DeployOfferingMainnet \
///     --rpc-url $MAINNET_RPC_URL \
///     --account deployer --sender $DEPLOYER_ADDRESS \
///     --broadcast --verify
contract DeployOfferingMainnet is Script {
    // Live mainnet deployment (published, verified).
    address constant RITUAL_TOKEN = 0x8daA5B21136de9B5ac43fd89fDc98cDe934E7863;
    address constant SAFE         = 0x67c6f1dA08Cd99A661ec6f77A060E985d9672baB;

    function run() external {
        require(block.chainid == 1, "mainnet only");

        vm.startBroadcast();
        Offering offering = new Offering(RITUAL_TOKEN, SAFE);
        vm.stopBroadcast();

        // Sanity: wiring + the constants the marketing copy promises.
        require(address(offering.ritualToken()) == RITUAL_TOKEN, "token wiring");
        require(offering.owner() == SAFE, "owner != Safe");
        require(offering.CLAIM_AMOUNT() == 100e18, "claim amount");
        require(offering.MAX_CLAIMS() == 250, "roll size");
        require(offering.DAILY_CLAIM_CAP() == 25, "daily cap");
        require(offering.MIN_ETH_BALANCE() == 0.005 ether, "vessel floor");
        require(offering.seatsRemaining() == 0, "must be unfunded at birth");

        console.log("=== The Offering (mainnet) ===");
        console.log("Offering:", address(offering));
        console.log("Owner (Safe):", SAFE);
        console.log("");
        console.log("NEXT: Safe funding batch (mint 25k RITUAL via curve + transfer here),");
        console.log("then frontend env NEXT_PUBLIC_OFFERING_ADDRESS + rebuild.");
    }
}
