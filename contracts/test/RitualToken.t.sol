// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RitualToken.sol";

contract RitualTokenTest is Test {
    RitualToken token;
    address owner = makeAddr("owner");
    address minter = makeAddr("minter");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.prank(owner);
        token = new RitualToken(owner);
    }

    // ── Deployment ──────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(token.name(), "Ritual");
        assertEq(token.symbol(), "RITUAL");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
        assertEq(token.minter(), address(0));
        assertEq(token.owner(), owner);
    }

    // ── setMinter ───────────────────────────────────────────────────────────

    function test_SetMinter() public {
        vm.prank(owner);
        token.setMinter(minter);
        assertEq(token.minter(), minter);
    }

    function test_SetMinter_EmitsMinterSet() public {
        vm.expectEmit(true, false, false, false);
        emit RitualToken.MinterSet(minter);
        vm.prank(owner);
        token.setMinter(minter);
    }

    function test_SetMinter_RevertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        token.setMinter(minter);
    }

    function test_SetMinter_RevertsIfZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(RitualToken.ZeroAddress.selector);
        token.setMinter(address(0));
    }

    function test_SetMinter_RevertsIfAlreadySet() public {
        vm.startPrank(owner);
        token.setMinter(minter);
        vm.expectRevert(RitualToken.MinterAlreadySet.selector);
        token.setMinter(alice);
        vm.stopPrank();
    }

    // ── mint ────────────────────────────────────────────────────────────────

    function test_Mint() public {
        vm.prank(owner);
        token.setMinter(minter);

        vm.prank(minter);
        token.mint(alice, 100 ether);

        assertEq(token.balanceOf(alice), 100 ether);
        assertEq(token.totalSupply(), 100 ether);
    }

    function test_Mint_RevertsIfNotMinter() public {
        vm.prank(owner);
        token.setMinter(minter);

        vm.prank(alice);
        vm.expectRevert(RitualToken.OnlyMinter.selector);
        token.mint(alice, 100 ether);
    }

    function test_Mint_RevertsIfMinterNotSet() public {
        vm.prank(alice);
        vm.expectRevert(RitualToken.OnlyMinter.selector);
        token.mint(alice, 100 ether);
    }

    // ── burn ────────────────────────────────────────────────────────────────

    function test_Burn() public {
        vm.prank(owner);
        token.setMinter(minter);
        vm.prank(minter);
        token.mint(alice, 100 ether);

        vm.prank(alice);
        token.burn(40 ether);

        assertEq(token.balanceOf(alice), 60 ether);
        assertEq(token.totalSupply(), 60 ether);
    }

    function test_Burn_RevertsIfInsufficientBalance() public {
        vm.prank(owner);
        token.setMinter(minter);
        vm.prank(minter);
        token.mint(alice, 10 ether);

        vm.prank(alice);
        vm.expectRevert();
        token.burn(20 ether);
    }

    function test_BurnFrom() public {
        vm.prank(owner);
        token.setMinter(minter);
        vm.prank(minter);
        token.mint(alice, 100 ether);

        vm.prank(alice);
        token.approve(bob, 50 ether);

        vm.prank(bob);
        token.burnFrom(alice, 50 ether);

        assertEq(token.balanceOf(alice), 50 ether);
        assertEq(token.totalSupply(), 50 ether);
        assertEq(token.allowance(alice, bob), 0);
    }

    function test_BurnFrom_RevertsIfInsufficientAllowance() public {
        vm.prank(owner);
        token.setMinter(minter);
        vm.prank(minter);
        token.mint(alice, 100 ether);

        vm.prank(alice);
        token.approve(bob, 10 ether);

        vm.prank(bob);
        vm.expectRevert();
        token.burnFrom(alice, 50 ether);
    }

    // ── Invariant: totalBurned <= totalMinted ───────────────────────────────

    function testFuzz_TotalSupplyNeverExceedsTotalMinted(uint256 mintAmount, uint256 burnAmount) public {
        // Bounded by MAX_SUPPLY (H-05). The invariant under test is unrelated to the cap.
        mintAmount = bound(mintAmount, 1, token.MAX_SUPPLY());
        burnAmount = bound(burnAmount, 0, mintAmount);

        vm.prank(owner);
        token.setMinter(minter);
        vm.prank(minter);
        token.mint(alice, mintAmount);

        vm.prank(alice);
        token.burn(burnAmount);

        assertLe(token.totalSupply(), mintAmount);
    }

    // ── MAX_SUPPLY (H-05) ───────────────────────────────────────────────────

    function test_MaxSupply_IsOneBillion() public view {
        assertEq(token.MAX_SUPPLY(), 1_000_000_000e18);
    }

    function test_Mint_RevertsAtMaxSupply() public {
        uint256 cap = token.MAX_SUPPLY();
        vm.prank(owner);
        token.setMinter(minter);

        vm.prank(minter);
        token.mint(alice, cap);

        vm.prank(minter);
        vm.expectRevert(RitualToken.MaxSupplyExceeded.selector);
        token.mint(alice, 1);
    }

    function test_Mint_Succeeds_OneBelowMax() public {
        uint256 cap = token.MAX_SUPPLY();
        vm.prank(owner);
        token.setMinter(minter);

        vm.prank(minter);
        token.mint(alice, cap - 1);
        assertEq(token.totalSupply(), cap - 1);

        vm.prank(minter);
        token.mint(alice, 1);
        assertEq(token.totalSupply(), cap);
    }

    function test_Mint_RevertsOnOverflow_AboveMax() public {
        uint256 half = token.MAX_SUPPLY() / 2;
        vm.prank(owner);
        token.setMinter(minter);

        // First mint half-supply, then attempt a mint that would push past the cap.
        vm.prank(minter);
        token.mint(alice, half);

        vm.prank(minter);
        vm.expectRevert(RitualToken.MaxSupplyExceeded.selector);
        token.mint(alice, half + 2);
    }
}
