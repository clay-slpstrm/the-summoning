// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IElderArtifacts {
    function mint(address to, uint256 tokenId, uint256 amount, bytes memory data) external;
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external;
}
