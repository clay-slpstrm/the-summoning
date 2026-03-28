// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMintingCurve {
    function getCurrentPrice() external view returns (uint256);
    function getEstimatedCost(uint256 tokenAmount) external view returns (uint256);
    function mint(uint256 minTokens) external payable;
    function withdraw(address to) external;
}
