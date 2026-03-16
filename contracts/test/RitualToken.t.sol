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
        mintAmount = bound(mintAmount, 1, 1e30);
        burnAmount = bound(burnAmount, 0, mintAmount);

        vm.prank(owner);
        token.setMinter(minter);
        vm.prank(minter);
        token.mint(alice, mintAmount);

        vm.prank(alice);
        token.burn(burnAmount);

        assertLe(token.totalSupply(), mintAmount);
    }
}
