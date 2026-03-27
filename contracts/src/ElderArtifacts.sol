// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IElderArtifacts.sol";

/// @title ElderArtifacts
/// @notice ERC-1155 multi-token for all epoch rewards.
///         Token ID encoding: epochId * 1000 + tierId
///           tierId 0 = Shattered Ritual (failed epoch)
///           tierId 1 = Harbinger  (~top 1%)
///           tierId 2 = Acolyte    (~top 10%)
///           tierId 3 = Cultist    (everyone else)
///         Metadata served dynamically by the backend API.
contract ElderArtifacts is ERC1155, Ownable, IElderArtifacts {

    // ── Metadata ─────────────────────────────────────────────────────────────

    string public name   = "Elder Artifacts";
    string public symbol = "ELDER";

    /// @notice Base URI for the metadata API (e.g. "https://api.thesummoning.xyz/metadata/").
    ///         Stored so it can be updated for testnet vs mainnet deployments.
    string public baseURI;

    // ── Engine ───────────────────────────────────────────────────────────────

    address public summoningEngine;

    // ── Supply Tracking ──────────────────────────────────────────────────────

    /// @notice Total number of tokens minted per tokenId.
    mapping(uint256 => uint256) public totalMinted;

    // ── Events ───────────────────────────────────────────────────────────────

    event EngineSet(address indexed engine);
    event BaseURISet(string uri);

    // ── Errors ───────────────────────────────────────────────────────────────

    error ElderArtifacts__OnlyEngine();
    error ElderArtifacts__ZeroAddress();
    error ElderArtifacts__ArrayLengthMismatch();

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyEngine() {
        if (msg.sender != summoningEngine) revert ElderArtifacts__OnlyEngine();
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    /// @param _baseURI Base URL for metadata API, e.g. "https://api.thesummoning.xyz/metadata/"
    /// @param _owner   Owner / multisig address.
    constructor(string memory _baseURI, address _owner) ERC1155("") Ownable(_owner) {
        baseURI = _baseURI;
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    /// @notice Set the SummoningEngine address. Only callable by owner.
    ///         Can be updated to point at a new engine if the contract is upgraded.
    function setEngine(address _engine) external onlyOwner {
        if (_engine == address(0)) revert ElderArtifacts__ZeroAddress();
        summoningEngine = _engine;
        emit EngineSet(_engine);
    }

    /// @notice Update the metadata base URI. Only callable by owner.
    ///         Useful when switching between testnet and mainnet backends.
    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseURI = _baseURI;
        emit BaseURISet(_baseURI);
    }

    // ── Engine-Only Minting ──────────────────────────────────────────────────

    /// @notice Mint a single artifact. Only callable by SummoningEngine.
    /// @param to       Recipient address.
    /// @param tokenId  epochId * 1000 + tierId.
    /// @param amount   Number of tokens to mint (always 1 in normal gameplay).
    /// @param data     Forwarded to ERC1155 receiver hook.
    function mint(
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data
    ) external onlyEngine {
        totalMinted[tokenId] += amount;
        _mint(to, tokenId, amount, data);
    }

    /// @notice Mint a batch of artifacts. Only callable by SummoningEngine.
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external onlyEngine {
        if (ids.length != amounts.length) revert ElderArtifacts__ArrayLengthMismatch();
        for (uint256 i = 0; i < ids.length; i++) {
            totalMinted[ids[i]] += amounts[i];
        }
        _mintBatch(to, ids, amounts, data);
    }

    // ── Metadata ─────────────────────────────────────────────────────────────

    /// @notice Returns the metadata URI for a given token ID.
    ///         Format: {baseURI}{tokenId}
    ///         Example: https://api.thesummoning.xyz/metadata/1001
    ///         The backend returns JSON dynamically based on epochId + tierId.
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string.concat(baseURI, Strings.toString(tokenId));
    }
}
