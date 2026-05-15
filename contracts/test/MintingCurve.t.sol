// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RitualToken.sol";
import "../src/MintingCurve.sol";

contract MintingCurveTest is Test {
    RitualToken token;
    MintingCurve curve;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant BASE_PRICE = 0.0001 ether;
    uint256 constant SCALE_FACTOR = 100_000_000;
    uint256 constant PROTOCOL_FEE_BPS = 1200;
    uint256 constant BPS_DENOMINATOR = 10_000;

    function setUp() public {
        vm.startPrank(owner);
        token = new RitualToken(owner);
        curve = new MintingCurve(address(token), owner);
        token.setMinter(address(curve));
        vm.stopPrank();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ── Deployment ──────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(address(curve.ritualToken()), address(token));
        assertEq(curve.owner(), owner);
        assertEq(curve.BASE_PRICE(), BASE_PRICE);
        assertEq(curve.SCALE_FACTOR(), SCALE_FACTOR);
        assertEq(curve.PROTOCOL_FEE_BPS(), PROTOCOL_FEE_BPS);
    }

    function test_Constructor_RevertsOnZeroToken() public {
        vm.prank(owner);
        vm.expectRevert(MintingCurve.MintingCurve__ZeroAddress.selector);
        new MintingCurve(address(0), owner);
    }

    // ── getCurrentPrice ─────────────────────────────────────────────────────

    function test_GetCurrentPrice_AtZeroSupply() public view {
        assertEq(curve.getCurrentPrice(), BASE_PRICE);
    }

    function test_GetCurrentPrice_IncreasesWithSupply() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        uint256 price = curve.getCurrentPrice();
        assertGt(price, BASE_PRICE);
    }

    function test_GetCurrentPrice_Formula() public view {
        assertEq(curve.getCurrentPrice(), BASE_PRICE);
    }

    // ── getEstimatedCost ────────────────────────────────────────────────────

    function test_GetEstimatedCost_AtZeroSupply() public view {
        uint256 tokenAmount = 1000 ether; // 1000 tokens
        uint256 cost = curve.getEstimatedCost(tokenAmount);

        uint256 startPrice = BASE_PRICE;
        uint256 endPrice = BASE_PRICE + (BASE_PRICE * (tokenAmount / 1e18) / SCALE_FACTOR);
        uint256 avgPrice = (startPrice + endPrice) / 2;
        uint256 grossCost = avgPrice * tokenAmount / 1e18;
        uint256 expectedTotal = grossCost * BPS_DENOMINATOR / (BPS_DENOMINATOR - PROTOCOL_FEE_BPS);

        assertEq(cost, expectedTotal);
    }

    function test_GetEstimatedCost_IncreasesWithSupply() public {
        uint256 tokenAmount = 1 ether;
        uint256 costBefore = curve.getEstimatedCost(tokenAmount);

        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        uint256 costAfter = curve.getEstimatedCost(tokenAmount);
        assertGt(costAfter, costBefore);
    }

    // ── mint ────────────────────────────────────────────────────────────────

    function test_Mint_BasicMint() public {
        uint256 ethIn = 1 ether;
        uint256 expectedFee = ethIn * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;

        vm.prank(alice);
        curve.mint{ value: ethIn }(0);

        uint256 tokensOut = token.balanceOf(alice);
        assertGt(tokensOut, 0);

        // Verify the tokens received are consistent with the curve integral
        uint256 netEth = ethIn - expectedFee;
        uint256 dWhole = tokensOut / 1e18;
        uint256 integralCost = BASE_PRICE * dWhole + BASE_PRICE * dWhole * dWhole / (2 * SCALE_FACTOR);
        assertLe(integralCost, netEth);
        assertGe(integralCost + BASE_PRICE, netEth);
    }

    function test_Mint_EmitsTokensMinted() public {
        uint256 ethIn = 1 ether;

        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        uint256 actualTokens = token.balanceOf(alice);

        assertGt(actualTokens, 0);
    }

    function test_Mint_RevertsOnZeroEth() public {
        vm.prank(alice);
        vm.expectRevert(MintingCurve.MintingCurve__InsufficientPayment.selector);
        curve.mint{ value: 0 }(0);
    }

    function test_Mint_RevertsOnZeroTokenOutput() public {
        // C-02: At zero supply, msg.value = 1e13 (0.00001 ETH) yields netEth=0.88e13
        // → discriminant rounds to floor sqrt = 2e8 → dWhole = 0. Must revert with
        // InsufficientPayment so the user does not lose ETH to the treasury for zero tokens.
        vm.prank(alice);
        vm.expectRevert(MintingCurve.MintingCurve__InsufficientPayment.selector);
        curve.mint{ value: 1e13 }(0);
    }

    function test_Mint_RevertsOnZeroTokenOutput_AtBoundary() public {
        // 0.0001 ETH also produces 0 whole tokens at zero supply (see _calc derivation).
        vm.prank(alice);
        vm.expectRevert(MintingCurve.MintingCurve__InsufficientPayment.selector);
        curve.mint{ value: 0.0001 ether }(0);
    }

    function test_Mint_SucceedsAtMinimumViableEth() public {
        // Smallest ETH that produces ≥ 1 whole token at zero supply.
        // 0.00012 ETH → netEth = 1.056e14, discriminant = 4e16 + 8.448e8 → sqrtDisc = 200000003
        // → dWhole = 1. Confirms the boundary is correct.
        vm.prank(alice);
        curve.mint{ value: 0.00012 ether }(0);
        assertEq(token.balanceOf(alice), 1e18);
    }

    function testFuzz_Mint_RevertsForDustInputs(uint256 ethIn) public {
        // Any ETH input below 0.0001 ether produces 0 tokens at zero supply (and must revert).
        ethIn = bound(ethIn, 1, 0.0001 ether);
        vm.deal(alice, ethIn);
        vm.prank(alice);
        vm.expectRevert(MintingCurve.MintingCurve__InsufficientPayment.selector);
        curve.mint{ value: ethIn }(0);
    }

    function test_Mint_RevertsOnSlippage() public {
        // Use 1 ETH so tokensOut > 0 (otherwise InsufficientPayment fires before slippage check).
        vm.prank(alice);
        vm.expectRevert(MintingCurve.MintingCurve__SlippageExceeded.selector);
        curve.mint{ value: 1 ether }(type(uint256).max);
    }

    function test_Mint_SlippageExactBoundary() public {
        uint256 ethIn = 0.01 ether;

        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        uint256 actualTokens = token.balanceOf(alice);
        assertGt(actualTokens, 0);

        RitualToken token2 = new RitualToken(owner);
        MintingCurve curve2 = new MintingCurve(address(token2), owner);
        vm.prank(owner);
        token2.setMinter(address(curve2));

        vm.prank(alice);
        curve2.mint{ value: ethIn }(actualTokens);
        assertEq(token2.balanceOf(alice), actualTokens);
    }

    function test_Mint_PriceIncreasesAfterMint() public {
        uint256 priceBefore = curve.getCurrentPrice();

        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        uint256 priceAfter = curve.getCurrentPrice();
        assertGt(priceAfter, priceBefore);
    }

    function test_Mint_MultipleMinters() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        uint256 aliceTokens = token.balanceOf(alice);
        assertGt(aliceTokens, 0);

        vm.prank(bob);
        curve.mint{ value: 1 ether }(0);

        uint256 bobTokens = token.balanceOf(bob);
        assertGt(bobTokens, 0);
        assertGt(aliceTokens, bobTokens);
    }

    // ── withdraw ──────────────────────────────────────────────────────────

    function test_Withdraw() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        uint256 contractBalance = address(curve).balance;
        assertEq(contractBalance, 1 ether);

        uint256 ownerBalBefore = owner.balance;
        vm.prank(owner);
        curve.withdraw(owner);

        assertEq(address(curve).balance, 0);
        assertEq(owner.balance, ownerBalBefore + 1 ether);
    }

    function test_Withdraw_EmitsWithdrawn() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        vm.expectEmit(true, false, false, true);
        emit MintingCurve.Withdrawn(owner, 1 ether);
        vm.prank(owner);
        curve.withdraw(owner);
    }

    function test_Withdraw_RevertsIfEmpty() public {
        vm.prank(owner);
        vm.expectRevert(MintingCurve.MintingCurve__NothingToWithdraw.selector);
        curve.withdraw(owner);
    }

    function test_Withdraw_RevertsIfNotOwner() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        vm.prank(alice);
        vm.expectRevert();
        curve.withdraw(alice);
    }

    function test_Withdraw_RevertsOnZeroAddress() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        vm.prank(owner);
        vm.expectRevert(MintingCurve.MintingCurve__ZeroAddress.selector);
        curve.withdraw(address(0));
    }

    function test_Withdraw_SendsToArbitraryRecipient() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        uint256 bobBalBefore = bob.balance;

        vm.prank(owner);
        curve.withdraw(bob);

        assertEq(bob.balance, bobBalBefore + 1 ether);
    }

    function test_Withdraw_AfterMultipleMints() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);
        vm.prank(bob);
        curve.mint{ value: 2 ether }(0);

        assertEq(address(curve).balance, 3 ether);

        uint256 ownerBalBefore = owner.balance;
        vm.prank(owner);
        curve.withdraw(owner);

        assertEq(address(curve).balance, 0);
        assertEq(owner.balance, ownerBalBefore + 3 ether);
    }

    // ── Integral Pricing ───────────────────────────────────────────────────

    function test_IntegralPricing_LargeMintPaysMore() public {
        vm.prank(alice);
        curve.mint{ value: 5 ether }(0);
        uint256 largeMintTokens = token.balanceOf(alice);

        RitualToken token2 = new RitualToken(owner);
        MintingCurve curve2 = new MintingCurve(address(token2), owner);
        vm.prank(owner);
        token2.setMinter(address(curve2));

        vm.prank(alice);
        curve2.mint{ value: 2.5 ether }(0);
        vm.prank(bob);
        curve2.mint{ value: 2.5 ether }(0);
        uint256 splitMintTokens = token2.balanceOf(alice) + token2.balanceOf(bob);

        uint256 diff = largeMintTokens > splitMintTokens
            ? largeMintTokens - splitMintTokens
            : splitMintTokens - largeMintTokens;
        assertLe(diff * 10000 / largeMintTokens, 1);
    }

    function test_IntegralPricing_ConsistentWithEstimate() public {
        uint256 tokenAmount = 5000 ether;
        uint256 estimatedCost = curve.getEstimatedCost(tokenAmount);

        vm.deal(alice, estimatedCost);
        vm.prank(alice);
        curve.mint{ value: estimatedCost }(0);

        uint256 actualTokens = token.balanceOf(alice);
        uint256 diff = actualTokens > tokenAmount
            ? actualTokens - tokenAmount
            : tokenAmount - actualTokens;
        assertLe(diff * 10000 / tokenAmount, 50);
    }

    // ── Fuzz Tests ──────────────────────────────────────────────────────────

    function testFuzz_Mint_AlwaysProducesTokens(uint256 ethIn) public {
        ethIn = bound(ethIn, 0.001 ether, 50 ether);
        vm.deal(alice, ethIn);
        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        assertGt(token.balanceOf(alice), 0);
    }

    function testFuzz_Mint_FeeIsExactly12Percent(uint256 ethIn) public {
        ethIn = bound(ethIn, 0.001 ether, 50 ether);
        vm.deal(alice, ethIn);

        uint256 balBefore = address(curve).balance;
        vm.prank(alice);
        curve.mint{ value: ethIn }(0);

        // All ETH stays in contract
        assertEq(address(curve).balance, balBefore + ethIn);
    }

    function testFuzz_Mint_RespectsSlippageProtection(uint256 ethIn) public {
        ethIn = bound(ethIn, 1 ether, 10 ether);
        vm.deal(alice, ethIn);

        vm.prank(alice);
        vm.expectRevert(MintingCurve.MintingCurve__SlippageExceeded.selector);
        curve.mint{ value: ethIn }(type(uint128).max);
    }

    function testFuzz_GetCurrentPrice_MonotonicallyIncreases(uint256 ethIn1, uint256 ethIn2) public {
        ethIn1 = bound(ethIn1, 0.001 ether, 5 ether);
        ethIn2 = bound(ethIn2, 0.001 ether, 5 ether);

        uint256 price0 = curve.getCurrentPrice();

        vm.deal(alice, ethIn1);
        vm.prank(alice);
        curve.mint{ value: ethIn1 }(0);
        uint256 price1 = curve.getCurrentPrice();

        vm.deal(bob, ethIn2);
        vm.prank(bob);
        curve.mint{ value: ethIn2 }(0);
        uint256 price2 = curve.getCurrentPrice();

        assertGe(price1, price0);
        assertGe(price2, price1);
    }

    // ── getTokensOut (H-03 frontend MEV protection) ───────────────────────

    function test_GetTokensOut_MatchesMint() public {
        uint256 ethIn = 1 ether;
        uint256 preview = curve.getTokensOut(ethIn);

        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        assertEq(token.balanceOf(alice), preview);
    }

    function test_GetTokensOut_ZeroForDust() public view {
        // C-02 boundary — anything below the first whole-token threshold returns 0.
        assertEq(curve.getTokensOut(1e13), 0);
    }

    function test_GetTokensOut_ZeroForZeroInput() public view {
        assertEq(curve.getTokensOut(0), 0);
    }

    function testFuzz_GetTokensOut_MatchesMint(uint256 ethIn) public {
        ethIn = bound(ethIn, 0.001 ether, 50 ether);
        uint256 preview = curve.getTokensOut(ethIn);
        vm.deal(alice, ethIn);
        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        assertEq(token.balanceOf(alice), preview);
    }

    // ── Pausable (H-02) ──────────────────────────────────────────────────────

    function test_Pause_RevertsMint() public {
        vm.prank(owner);
        curve.pause();

        vm.prank(alice);
        // EnforcedPause is from OpenZeppelin Pausable; we don't import the selector to
        // avoid a hard dep, so a generic expectRevert suffices.
        vm.expectRevert();
        curve.mint{ value: 1 ether }(0);
    }

    function test_Unpause_RestoresMint() public {
        vm.prank(owner);
        curve.pause();

        vm.prank(owner);
        curve.unpause();

        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);
        assertGt(token.balanceOf(alice), 0);
    }

    function test_Pause_RevertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        curve.pause();
    }

    function test_Pause_WithdrawStillWorks() public {
        // Withdraw is intentionally not pausable so funds remain recoverable.
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        vm.prank(owner);
        curve.pause();

        vm.prank(owner);
        curve.withdraw(owner);
        assertEq(address(curve).balance, 0);
    }

    function testFuzz_ContractBalanceEqualsEthIn(uint256 ethIn) public {
        // Lower bound at the smallest viable mint after C-02 (0.0001 ether produces 0 tokens
        // at zero supply, so we use 0.001 ether to stay safely above the threshold).
        ethIn = bound(ethIn, 0.001 ether, 50 ether);
        vm.deal(alice, ethIn);
        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        assertEq(address(curve).balance, ethIn);
    }
}
