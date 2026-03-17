// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IRitualToken.sol";

/// @title BondingCurve
/// @notice Holds the ETH treasury and mints $RITUAL at a linearly increasing price.
/// @dev Price formula: BASE_PRICE * (1 + totalSupplyInTokens / SCALE_FACTOR)
///      Supply is normalized from wei to whole tokens before applying SCALE_FACTOR.
///      Protocol fee (12%) is deducted from ETH in; remainder determines token output.
contract BondingCurve is Ownable, ReentrancyGuard {
    IRitualToken public immutable ritualToken;

    uint256 public constant BASE_PRICE = 0.0001 ether; // price per token at zero supply
    uint256 public constant SCALE_FACTOR = 100_000_000; // 100M tokens = 1x price increase
    uint256 public constant PROTOCOL_FEE_BPS = 1200; // 12%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Accumulated protocol fees withdrawable by owner.
    uint256 public protocolFees;

    error BondingCurve__InsufficientPayment();
    error BondingCurve__SlippageExceeded();
    error BondingCurve__WithdrawFailed();
    error BondingCurve__ZeroAddress();

    event TokensMinted(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 fee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _token, address _owner) Ownable(_owner) {
        if (_token == address(0)) revert BondingCurve__ZeroAddress();
        ritualToken = IRitualToken(_token);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    /// @notice Current spot price per token based on total supply.
    /// @dev price = BASE_PRICE + (BASE_PRICE * supplyInTokens / SCALE_FACTOR)
    ///      Supply is divided by 1e18 to convert from wei to whole-token units.
    function getCurrentPrice() public view returns (uint256) {
        uint256 supply = ritualToken.totalSupply() / 1e18;
        return BASE_PRICE + (BASE_PRICE * supply / SCALE_FACTOR);
    }

    /// @notice Estimate ETH cost (including fee) to mint a given token amount.
    /// @dev Uses average of start and end price across the mint range (trapezoidal approximation).
    /// @param tokenAmount Tokens to mint (18 decimals).
    /// @return Total ETH required including protocol fee.
    function getEstimatedCost(uint256 tokenAmount) public view returns (uint256) {
        uint256 supply = ritualToken.totalSupply() / 1e18;
        uint256 tokenAmountWhole = tokenAmount / 1e18;
        uint256 startPrice = BASE_PRICE + (BASE_PRICE * supply / SCALE_FACTOR);
        uint256 endPrice = BASE_PRICE + (BASE_PRICE * (supply + tokenAmountWhole) / SCALE_FACTOR);
        uint256 avgPrice = (startPrice + endPrice) / 2;
        uint256 grossCost = avgPrice * tokenAmount / 1e18;
        // Gross up for protocol fee: total * (1 - fee%) = gross → total = gross / (1 - fee%)
        return grossCost * BPS_DENOMINATOR / (BPS_DENOMINATOR - PROTOCOL_FEE_BPS);
    }

    // ── Mutative ───────────────────────────────────────────────────────────

    /// @notice Mint $RITUAL tokens by sending ETH. Slippage protected via minTokens.
    /// @param minTokens Minimum tokens to receive; reverts if actual output is less.
    function mint(uint256 minTokens) external payable nonReentrant {
        if (msg.value == 0) revert BondingCurve__InsufficientPayment();

        uint256 fee = msg.value * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;
        uint256 netEth = msg.value - fee;
        protocolFees += fee;

        // Spot-price approximation: tokens = netEth / currentPrice
        uint256 supply = ritualToken.totalSupply() / 1e18;
        uint256 price = BASE_PRICE + (BASE_PRICE * supply / SCALE_FACTOR);
        uint256 tokensOut = netEth * 1e18 / price;

        if (tokensOut < minTokens) revert BondingCurve__SlippageExceeded();

        ritualToken.mint(msg.sender, tokensOut);
        emit TokensMinted(msg.sender, msg.value, tokensOut, fee);
    }

    /// @notice Owner withdraws accumulated protocol fees.
    /// @param to Recipient address.
    function withdrawFees(address to) external onlyOwner {
        if (to == address(0)) revert BondingCurve__ZeroAddress();
        uint256 amount = protocolFees;
        protocolFees = 0;
        (bool ok,) = to.call{ value: amount }("");
        if (!ok) revert BondingCurve__WithdrawFailed();
        emit FeesWithdrawn(to, amount);
    }
}
