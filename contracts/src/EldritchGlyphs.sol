// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { VRFConsumerBaseV2Plus } from
    "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import { VRFV2PlusClient } from
    "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import { IEldritchGlyphs } from "./interfaces/IEldritchGlyphs.sol";

/// @title EldritchGlyphs — Tradeable on-chain glyph NFTs with Chainlink VRF
/// @notice Each sacrifice in SummoningEngine mints one glyph NFT via VRF.
///         Tiers are provably fair. 5% royalty on secondary sales (EIP-2981).
///
///         Tier distribution (cumulative out of 10,000):
///           Whisper  50%  → [0, 5000)
///           Echo     28%  → [5000, 7800)
///           Tremor   15%  → [7800, 9300)
///           Rupture   6%  → [9300, 9900)
///           Breach    1%  → [9900, 10000)
contract EldritchGlyphs is ERC1155, VRFConsumerBaseV2Plus, ERC2981, IEldritchGlyphs {
    using Strings for uint256;

    // ── Constants ──

    uint16 internal constant TIER_WHISPER = 5000;
    uint16 internal constant TIER_ECHO = 7800;
    uint16 internal constant TIER_TREMOR = 9300;
    uint16 internal constant TIER_RUPTURE = 9900;
    uint16 internal constant TIER_BREACH = 10_000;
    uint8 internal constant NUM_RUNES = 30;
    uint8 internal constant NUM_LORE = 10;

    // ── VRF Config (immutable) ──

    bytes32 public immutable keyHash;
    uint256 public immutable subscriptionId;
    uint16 public immutable requestConfirmations;
    uint32 public immutable callbackGasLimit;

    // ── State ──

    string public name = "Eldritch Glyphs";
    string public symbol = "GLYPH";
    string public baseURI;

    address public summoningEngine;
    uint256 public nextTokenId = 1;

    /// @notice VRF request → pending glyph data
    struct PendingGlyph {
        address recipient;
        uint256 epochId;
        bool fulfilled;
    }

    mapping(uint256 requestId => PendingGlyph) public pendingGlyphs;
    mapping(uint256 tokenId => GlyphData) public glyphData;
    mapping(address wallet => uint256 count) public glyphCount;

    // ── Constructor ──

    /// @param _vrfCoordinator Chainlink VRF V2.5 coordinator address
    /// @param _subscriptionId VRF subscription ID
    /// @param _keyHash VRF key hash (gas lane)
    /// @param _callbackGasLimit Gas limit for VRF callback
    /// @param _requestConfirmations Block confirmations before VRF response
    /// @param _baseURI Base URI for token metadata
    /// @param _royaltyReceiver Address that receives EIP-2981 royalties
    constructor(
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations,
        string memory _baseURI,
        address _royaltyReceiver
    ) ERC1155("") VRFConsumerBaseV2Plus(_vrfCoordinator) {
        if (_royaltyReceiver == address(0)) revert EldritchGlyphs__ZeroAddress();

        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
        baseURI = _baseURI;

        // 5% royalty (500 basis points)
        _setDefaultRoyalty(_royaltyReceiver, 500);
    }

    // ── Modifiers ──

    modifier onlyEngine() {
        if (msg.sender != summoningEngine) revert EldritchGlyphs__OnlyEngine();
        _;
    }

    // ── Admin (ConfirmedOwner from VRFConsumerBaseV2Plus) ──

    /// @notice Set the SummoningEngine address that can request glyphs.
    function setEngine(address _engine) external onlyOwner {
        if (_engine == address(0)) revert EldritchGlyphs__ZeroAddress();
        summoningEngine = _engine;
        emit EngineSet(_engine);
    }

    /// @notice Update the base URI for metadata.
    function setBaseURI(string calldata _baseURI) external onlyOwner {
        baseURI = _baseURI;
        emit BaseURISet(_baseURI);
    }

    /// @notice Update the default royalty receiver and fee.
    function setRoyalty(address receiver, uint96 feeBps) external onlyOwner {
        _setDefaultRoyalty(receiver, feeBps);
    }

    // ── Core: VRF Request ──

    /// @notice Request a glyph mint. Called by SummoningEngine after each sacrifice.
    /// @param recipient The wallet that will receive the glyph NFT.
    /// @param epochId The current epoch ID.
    /// @return requestId The Chainlink VRF request ID.
    function requestGlyph(address recipient, uint256 epochId)
        external
        onlyEngine
        returns (uint256 requestId)
    {
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: false })
                )
            })
        );

        pendingGlyphs[requestId] = PendingGlyph({
            recipient: recipient,
            epochId: epochId,
            fulfilled: false
        });

        emit GlyphRequested(requestId, recipient, epochId);
    }

    // ── Core: VRF Callback ──

    /// @notice Chainlink VRF callback. Mints the glyph NFT with derived tier/rune/lore.
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        PendingGlyph storage pending = pendingGlyphs[requestId];
        if (pending.recipient == address(0)) revert EldritchGlyphs__RequestNotFound();

        pending.fulfilled = true;
        uint256 seed = randomWords[0];

        // Derive tier from bits 0-63
        uint8 tier = _deriveTier(uint64(seed));
        // Derive rune from bits 64-127
        uint8 runeIndex = uint8((seed >> 64) % NUM_RUNES);
        // Derive lore from bits 128-191
        uint8 loreIndex = uint8((seed >> 128) % NUM_LORE);

        uint256 tokenId = nextTokenId++;
        glyphData[tokenId] = GlyphData({
            tier: tier,
            runeIndex: runeIndex,
            loreIndex: loreIndex,
            epochId: pending.epochId,
            originalRecipient: pending.recipient
        });

        // Mint (updates glyphCount via _update override)
        _mint(pending.recipient, tokenId, 1, "");

        emit GlyphMinted(tokenId, pending.recipient, tier, runeIndex, loreIndex, pending.epochId);
    }

    // ── Tier Derivation ──

    /// @dev Same cumulative probability as backend: 50/28/15/6/1
    function _deriveTier(uint64 bits) internal pure returns (uint8) {
        uint16 roll = uint16(bits % 10_000);
        if (roll < TIER_WHISPER) return 0; // Whisper 50%
        if (roll < TIER_ECHO) return 1; // Echo    28%
        if (roll < TIER_TREMOR) return 2; // Tremor  15%
        if (roll < TIER_RUPTURE) return 3; // Rupture  6%
        return 4; // Breach   1%
    }

    // ── Glyph Count Tracking ──

    /// @dev Override ERC1155 _update to track glyphCount per wallet on mint/transfer/burn.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        super._update(from, to, ids, values);

        for (uint256 i = 0; i < ids.length; i++) {
            if (from != address(0)) {
                glyphCount[from] -= values[i];
            }
            if (to != address(0)) {
                glyphCount[to] += values[i];
            }
        }
    }

    // ── View Functions ──

    /// @notice Get on-chain glyph metadata.
    function getGlyphData(uint256 tokenId) external view returns (GlyphData memory) {
        return glyphData[tokenId];
    }

    /// @notice Total glyphs minted.
    function totalMinted() external view returns (uint256) {
        return nextTokenId - 1;
    }

    /// @notice Token metadata URI for marketplaces.
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string.concat(baseURI, tokenId.toString());
    }

    // ── Interface Support ──

    /// @dev Resolve ERC1155 + ERC2981 diamond (both inherit ERC165).
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, ERC2981)
        returns (bool)
    {
        return ERC1155.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }
}
