// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Offering.sol";
import "../src/RitualToken.sol";

contract OfferingTest is Test {
    Offering offering;
    RitualToken token;

    address owner = makeAddr("safe");
    address alice = makeAddr("alice");

    uint256 constant FUNDING = 25_000e18; // 250 × 100

    function setUp() public {
        // Realistic block time (same rationale as SummoningEngine.t.sol).
        vm.warp(1_720_000_000);

        vm.startPrank(owner);
        token = new RitualToken(owner);
        offering = new Offering(address(token), owner);
        token.setMinter(owner);
        vm.stopPrank();

        deal(address(token), address(offering), FUNDING, true);

        // Vessels need gas money to pass MIN_ETH_BALANCE.
        vm.deal(alice, 1 ether);
    }

    /// Fresh funded wallet at a unique address.
    function _vessel(uint256 i) internal returns (address v) {
        v = makeAddr(string.concat("vessel", vm.toString(i)));
        vm.deal(v, 0.01 ether);
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    function test_Constructor_RevertsOnZeroToken() public {
        vm.expectRevert(Offering.Offering__ZeroAddress.selector);
        new Offering(address(0), owner);
    }

    function test_Constructor_State() public view {
        assertEq(address(offering.ritualToken()), address(token));
        assertEq(offering.owner(), owner);
        assertEq(offering.totalClaims(), 0);
        assertEq(offering.seatsRemaining(), 250);
        assertEq(offering.seatsRemainingToday(), 25);
    }

    // ── Claim happy path ─────────────────────────────────────────────────────

    function test_Claim_TransfersAndRecords() public {
        vm.prank(alice);
        offering.claim();

        assertEq(token.balanceOf(alice), 100e18);
        assertTrue(offering.claimed(alice));
        assertEq(offering.totalClaims(), 1);
        assertEq(offering.seatsRemaining(), 249);
        assertEq(offering.seatsRemainingToday(), 24);
    }

    function test_Claim_EmitsEventWithOrdinal() public {
        vm.expectEmit(true, false, false, true);
        emit Offering.OfferingClaimed(alice, 100e18, 1);
        vm.prank(alice);
        offering.claim();
    }

    // ── Claim guards ─────────────────────────────────────────────────────────

    function test_Claim_Reverts_SecondClaimSameWallet() public {
        vm.prank(alice);
        offering.claim();
        vm.prank(alice);
        vm.expectRevert(Offering.Offering__AlreadyClaimed.selector);
        offering.claim();
    }

    function test_Claim_Reverts_PoorVessel() public {
        address broke = makeAddr("broke");
        vm.deal(broke, 0.004 ether); // below the 0.005 floor
        vm.prank(broke);
        vm.expectRevert(Offering.Offering__UnworthyVessel.selector);
        offering.claim();
    }

    function test_Claim_ExactBalanceFloor_Succeeds() public {
        address exact = makeAddr("exact");
        vm.deal(exact, 0.005 ether);
        vm.prank(exact);
        offering.claim();
        assertEq(token.balanceOf(exact), 100e18);
    }

    function test_Claim_Reverts_Unfunded() public {
        vm.prank(owner);
        offering.sweep(owner); // empty it
        vm.prank(alice);
        vm.expectRevert(Offering.Offering__Exhausted.selector);
        offering.claim();
    }

    // ── Daily cap ────────────────────────────────────────────────────────────

    function test_DailyCap_25thSucceeds_26thReverts_ResetsNextDay() public {
        for (uint256 i = 0; i < 25; i++) {
            vm.prank(_vessel(i));
            offering.claim();
        }
        assertEq(offering.seatsRemainingToday(), 0);

        address late = _vessel(999);
        vm.prank(late);
        vm.expectRevert(Offering.Offering__DailyCapReached.selector);
        offering.claim();

        // Next UTC day: cap resets, the same latecomer succeeds.
        vm.warp(block.timestamp + 1 days);
        assertEq(offering.seatsRemainingToday(), 25);
        vm.prank(late);
        offering.claim();
        assertEq(offering.totalClaims(), 26);
    }

    // ── Roll exhaustion ──────────────────────────────────────────────────────

    function test_AllSeatsClaimable_Then251stReverts() public {
        // 250 claims across 10 days at the daily cap.
        for (uint256 i = 0; i < 250; i++) {
            if (i > 0 && i % 25 == 0) vm.warp(block.timestamp + 1 days);
            vm.prank(_vessel(i));
            offering.claim();
        }
        assertEq(offering.totalClaims(), 250);
        assertEq(offering.seatsRemaining(), 0);
        assertEq(token.balanceOf(address(offering)), 0); // funding exactly consumed

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        vm.expectRevert(Offering.Offering__Exhausted.selector);
        offering.claim();
    }

    // ── Sweep ────────────────────────────────────────────────────────────────

    function test_Sweep_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        offering.sweep(alice);
    }

    function test_Sweep_RecoversBalance_AndClaimsResumeOnRefund() public {
        vm.prank(owner);
        offering.sweep(owner);
        assertEq(token.balanceOf(owner), FUNDING);
        assertEq(offering.seatsRemaining(), 0); // funding-bound

        // Re-fund a partial amount: offering re-opens with counters intact.
        vm.prank(owner);
        token.transfer(address(offering), 500e18);
        assertEq(offering.seatsRemaining(), 5);
        vm.prank(alice);
        offering.claim();
        assertEq(offering.totalClaims(), 1);
    }

    function test_Sweep_Reverts_WhenEmpty() public {
        vm.startPrank(owner);
        offering.sweep(owner);
        vm.expectRevert(Offering.Offering__NothingToSweep.selector);
        offering.sweep(owner);
        vm.stopPrank();
    }

    function test_Sweep_Reverts_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Offering.Offering__ZeroAddress.selector);
        offering.sweep(address(0));
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_Claim_NeverExceedsCapsOrDoublePays(uint8 n) public {
        uint256 count = bound(n, 1, 40);
        for (uint256 i = 0; i < count; i++) {
            address v = _vessel(i);
            vm.prank(v);
            if (i >= 25) {
                vm.expectRevert(Offering.Offering__DailyCapReached.selector);
                offering.claim();
            } else {
                offering.claim();
                assertEq(token.balanceOf(v), 100e18);
            }
        }
        assertLe(offering.totalClaims(), 25);
        assertLe(offering.claimsToday(), 25);
    }
}
