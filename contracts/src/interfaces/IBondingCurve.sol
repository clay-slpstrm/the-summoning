// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBondingCurve {
    function getCurrentPrice() external view returns (uint256);
    function getEstimatedCost(uint256 tokenAmount) external view returns (uint256);
    function mint(uint256 minTokens) external payable;
    function withdrawFees(address to) external;
}
