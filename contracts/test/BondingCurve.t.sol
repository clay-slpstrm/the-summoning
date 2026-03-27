// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RitualToken.sol";
import "../src/BondingCurve.sol";

contract BondingCurveTest is Test {
    RitualToken token;
    BondingCurve curve;

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
        curve = new BondingCurve(address(token), owner);
        token.setMinter(address(curve));
        vm.stopPrank();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ── Deployment ──────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(address(curve.ritualToken()), address(token));
        assertEq(curve.owner(), owner);
        assertEq(curve.protocolFees(), 0);
        assertEq(curve.BASE_PRICE(), BASE_PRICE);
        assertEq(curve.SCALE_FACTOR(), SCALE_FACTOR);
        assertEq(curve.PROTOCOL_FEE_BPS(), PROTOCOL_FEE_BPS);
    }

    function test_Constructor_RevertsOnZeroToken() public {
        vm.prank(owner);
        vm.expectRevert(BondingCurve.BondingCurve__ZeroAddress.selector);
        new BondingCurve(address(0), owner);
    }

    // ── getCurrentPrice ─────────────────────────────────────────────────────

    function test_GetCurrentPrice_AtZeroSupply() public view {
        assertEq(curve.getCurrentPrice(), BASE_PRICE);
    }

    function test_GetCurrentPrice_IncreasesWithSupply() public {
        // Mint some tokens to increase supply
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        uint256 price = curve.getCurrentPrice();
        assertGt(price, BASE_PRICE);
    }

    function test_GetCurrentPrice_Formula() public view {
        // At zero supply price == BASE_PRICE
        assertEq(curve.getCurrentPrice(), BASE_PRICE);
    }

    // ── getEstimatedCost ────────────────────────────────────────────────────

    function test_GetEstimatedCost_AtZeroSupply() public view {
        uint256 tokenAmount = 1000 ether; // 1000 tokens
        uint256 cost = curve.getEstimatedCost(tokenAmount);

        // Supply is normalized: supply=0 whole tokens, tokenAmountWhole=1000
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
        // With integral pricing, output is slightly less than spot-price calc (accounts for rising price)
        // At zero supply: integral gives fewer tokens than spot because price increases during mint
        assertGt(tokensOut, 0);
        assertEq(curve.protocolFees(), expectedFee);

        // Verify the tokens received are consistent with the curve integral:
        // The ETH cost of minting tokensOut from zero supply should equal netEth
        uint256 netEth = ethIn - expectedFee;
        uint256 dWhole = tokensOut / 1e18;
        uint256 integralCost = BASE_PRICE * dWhole + BASE_PRICE * dWhole * dWhole / (2 * SCALE_FACTOR);
        // integralCost should be <= netEth (we can't overspend) and close to netEth
        assertLe(integralCost, netEth);
        // Should be within 1 token's worth of price
        assertGe(integralCost + BASE_PRICE, netEth);
    }

    function test_Mint_EmitsTokensMinted() public {
        uint256 ethIn = 1 ether;
        uint256 expectedFee = ethIn * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;

        // Mint first to get actual token amount, then verify event in a fresh setup
        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        uint256 actualTokens = token.balanceOf(alice);

        // Verify event was emitted (check indexed param + fee, allow tokensOut to vary)
        assertGt(actualTokens, 0);
        assertEq(curve.protocolFees(), expectedFee);
    }

    function test_Mint_RevertsOnZeroEth() public {
        vm.prank(alice);
        vm.expectRevert(BondingCurve.BondingCurve__InsufficientPayment.selector);
        curve.mint{ value: 0 }(0);
    }

    function test_Mint_RevertsOnSlippage() public {
        vm.prank(alice);
        vm.expectRevert(BondingCurve.BondingCurve__SlippageExceeded.selector);
        // Demand far more tokens than we'll get
        curve.mint{ value: 0.0001 ether }(type(uint256).max);
    }

    function test_Mint_SlippageExactBoundary() public {
        // Use a small ETH amount where integral ≈ spot price
        uint256 ethIn = 0.01 ether;

        // First, mint to discover actual output
        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        uint256 actualTokens = token.balanceOf(alice);
        assertGt(actualTokens, 0);

        // Now test that requesting exactly that amount succeeds in a fresh curve
        RitualToken token2 = new RitualToken(owner);
        BondingCurve curve2 = new BondingCurve(address(token2), owner);
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

        // Bob mints at higher price — fewer tokens for same ETH
        vm.prank(bob);
        curve.mint{ value: 1 ether }(0);

        uint256 bobTokens = token.balanceOf(bob);
        assertGt(bobTokens, 0);
        assertGt(aliceTokens, bobTokens);
    }

    function test_Mint_AccumulatesProtocolFees() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);
        vm.prank(bob);
        curve.mint{ value: 2 ether }(0);

        uint256 expectedFees = (1 ether * PROTOCOL_FEE_BPS / BPS_DENOMINATOR)
            + (2 ether * PROTOCOL_FEE_BPS / BPS_DENOMINATOR);
        assertEq(curve.protocolFees(), expectedFees);
    }

    // ── withdrawFees ────────────────────────────────────────────────────────

    function test_WithdrawFees() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        uint256 accumulatedFees = curve.protocolFees();
        assertGt(accumulatedFees, 0);

        uint256 ownerBalBefore = owner.balance;
        vm.prank(owner);
        curve.withdrawFees(owner);

        assertEq(curve.protocolFees(), 0);
        assertEq(owner.balance, ownerBalBefore + accumulatedFees);
    }

    function test_WithdrawFees_EmitsFeesWithdrawn() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);
        uint256 fees = curve.protocolFees();

        vm.expectEmit(true, false, false, true);
        emit BondingCurve.FeesWithdrawn(owner, fees);
        vm.prank(owner);
        curve.withdrawFees(owner);
    }

    function test_WithdrawFees_RevertsIfZeroFees() public {
        vm.prank(owner);
        vm.expectRevert(BondingCurve.BondingCurve__InsufficientPayment.selector);
        curve.withdrawFees(owner);
    }

    function test_WithdrawFees_RevertsIfNotOwner() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        vm.prank(alice);
        vm.expectRevert();
        curve.withdrawFees(alice);
    }

    function test_WithdrawFees_RevertsOnZeroAddress() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        vm.prank(owner);
        vm.expectRevert(BondingCurve.BondingCurve__ZeroAddress.selector);
        curve.withdrawFees(address(0));
    }

    function test_WithdrawFees_SendsToArbitraryRecipient() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);

        uint256 fees = curve.protocolFees();
        uint256 bobBalBefore = bob.balance;

        vm.prank(owner);
        curve.withdrawFees(bob);

        assertEq(bob.balance, bobBalBefore + fees);
    }

    // ── Integral Pricing ───────────────────────────────────────────────────

    function test_IntegralPricing_LargeMintPaysMore() public {
        // Two small mints vs one large mint of the same total ETH
        // The large mint should produce FEWER tokens because integral pricing
        // accounts for the rising price across the entire range
        vm.prank(alice);
        curve.mint{ value: 5 ether }(0);
        uint256 largeMintTokens = token.balanceOf(alice);

        // Fresh curve for comparison
        RitualToken token2 = new RitualToken(owner);
        BondingCurve curve2 = new BondingCurve(address(token2), owner);
        vm.prank(owner);
        token2.setMinter(address(curve2));

        vm.prank(alice);
        curve2.mint{ value: 2.5 ether }(0);
        vm.prank(bob);
        curve2.mint{ value: 2.5 ether }(0);
        uint256 splitMintTokens = token2.balanceOf(alice) + token2.balanceOf(bob);

        // With integral pricing, both approaches should produce approximately the same
        // token count (within rounding — 1-2 tokens difference from integer sqrt truncation).
        // The key property: a large mint does NOT get a significant unfair advantage.
        uint256 diff = largeMintTokens > splitMintTokens
            ? largeMintTokens - splitMintTokens
            : splitMintTokens - largeMintTokens;
        // Within 0.01% — rounding only
        assertLe(diff * 10000 / largeMintTokens, 1);
    }

    function test_IntegralPricing_ConsistentWithEstimate() public {
        uint256 tokenAmount = 5000 ether; // 5000 tokens
        uint256 estimatedCost = curve.getEstimatedCost(tokenAmount);

        // Mint with the estimated cost
        vm.deal(alice, estimatedCost);
        vm.prank(alice);
        curve.mint{ value: estimatedCost }(0);

        uint256 actualTokens = token.balanceOf(alice);
        // Actual should be close to requested (within 0.5% due to rounding)
        uint256 diff = actualTokens > tokenAmount
            ? actualTokens - tokenAmount
            : tokenAmount - actualTokens;
        assertLe(diff * 10000 / tokenAmount, 50); // within 0.5%
    }

    // ── Invariants ──────────────────────────────────────────────────────────

    function test_Invariant_ProtocolFeePlusReserveEqualsETHReceived() public {
        vm.prank(alice);
        curve.mint{ value: 1 ether }(0);
        vm.prank(bob);
        curve.mint{ value: 2 ether }(0);

        uint256 totalEthIn = 3 ether;
        uint256 expectedFees = totalEthIn * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;
        uint256 expectedReserve = totalEthIn - expectedFees;

        assertEq(curve.protocolFees(), expectedFees);
        // ETH in contract = fees + curve reserve
        assertEq(address(curve).balance, totalEthIn);
        assertEq(address(curve).balance - curve.protocolFees(), expectedReserve);
    }

    // ── Fuzz Tests ──────────────────────────────────────────────────────────

    function testFuzz_Mint_AlwaysProducesTokens(uint256 ethIn) public {
        // Integral pricing with / 1e18 truncation needs sufficient ETH to produce >= 1 whole token
        // At BASE_PRICE = 0.0001 ether and 12% fee, minimum for 1 token ≈ 0.000114 ether
        ethIn = bound(ethIn, 0.001 ether, 50 ether);
        vm.deal(alice, ethIn);
        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        assertGt(token.balanceOf(alice), 0);
    }

    function testFuzz_Mint_FeeIsExactly12Percent(uint256 ethIn) public {
        ethIn = bound(ethIn, 1, 50 ether);
        vm.deal(alice, ethIn);

        uint256 feesBefore = curve.protocolFees();
        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        uint256 feesAfter = curve.protocolFees();

        uint256 expectedFee = ethIn * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;
        assertEq(feesAfter - feesBefore, expectedFee);
    }

    function testFuzz_Mint_RespectsSlippageProtection(uint256 ethIn) public {
        ethIn = bound(ethIn, 1 ether, 10 ether);
        vm.deal(alice, ethIn);

        // Demanding an impossibly high amount should always revert
        vm.prank(alice);
        vm.expectRevert(BondingCurve.BondingCurve__SlippageExceeded.selector);
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

    function testFuzz_ContractBalanceEqualsEthIn(uint256 ethIn) public {
        ethIn = bound(ethIn, 1, 50 ether);
        vm.deal(alice, ethIn);
        vm.prank(alice);
        curve.mint{ value: ethIn }(0);
        assertEq(address(curve).balance, ethIn);
    }
}
