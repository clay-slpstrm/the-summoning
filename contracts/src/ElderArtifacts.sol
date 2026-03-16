// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// TODO: Week 2 — full implementation per ARCHITECTURE.md §3.4
// Placeholder to allow Deploy.s.sol to compile during Week 1.

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IElderArtifacts.sol";

contract ElderArtifacts is ERC1155, Ownable, IElderArtifacts {
    address public summoningEngine;

    error OnlyEngine();

    modifier onlyEngine() {
        if (msg.sender != summoningEngine) revert OnlyEngine();
        _;
    }

    constructor(string memory _uri, address _owner) ERC1155(_uri) Ownable(_owner) {}

    function setEngine(address _engine) external onlyOwner {
        summoningEngine = _engine;
    }

    function mint(address to, uint256 tokenId, uint256 amount, bytes memory data) external onlyEngine {
        _mint(to, tokenId, amount, data);
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        external
        onlyEngine
    {
        _mintBatch(to, ids, amounts, data);
    }
}
