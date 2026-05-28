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
/// @notice Glyphs are claimed in batches after epoch resolution. SummoningEngine.claimGlyphs
///         issues ONE VRF request per wallet per epoch, returning N random words; this
///         contract mints one glyph per word. Tier weights are selected by the wallet's
///         cumulative contribution to the epoch (the same bracket applies to every glyph
///         in the batch), making split vs. concentrated sacrifices economically equivalent.
///         5% royalty on secondary sales (EIP-2981).
///
///         Tier distribution by cumulative-contribution bracket
///         (basis points out of 10,000 — each row sums to 10,000):
///
///           Bracket 0  (1–9 RITUAL):       50% / 28% / 15% /  6% /  1%
///           Bracket 1  (10–99):            42% / 30% / 18% /  8% /  2%
///           Bracket 2  (100–999):          30% / 30% / 24% / 12% /  4%
///           Bracket 3  (1,000–9,999):      20% / 27% / 28% / 17% /  8%
///           Bracket 4  (≥ 10,000):         12% / 22% / 30% / 22% / 14%
contract EldritchGlyphs is ERC1155, VRFConsumerBaseV2Plus, ERC2981, IEldritchGlyphs {
    using Strings for uint256;

    // ── Constants ──

    uint8 internal constant NUM_RUNES = 30;
    uint8 internal constant NUM_LORE = 10;
    uint16 internal constant BPS_TOTAL = 10_000;

    /// @notice Maximum glyphs mintable per VRF request. Sized so a worst-case
    ///         fulfillRandomWords call fits comfortably within the 2.5M Chainlink
    ///         V2.5 callback gas ceiling.
    ///
    ///         Measured (forge --gas-report): ~100k gas per glyph (cold storage
    ///         writes for GlyphData + ERC1155 balance map + glyphCount), plus ~80k
    ///         fixed overhead. 20 × 100k + 80k ≈ 2.08M, ~17% margin under 2.5M.
    ///         Whales with > 20 earned glyphs claim in multiple batches; the
    ///         engine's MAX_GLYPHS_PER_CLAIM mirrors this value.
    ///
    ///         History: original audit recommendation was 50, set without
    ///         measurement; reduced to 20 after Sepolia rehearsal #1 caught a
    ///         live OOG in the 50-glyph callback (lost LINK, stuck batch).
    uint256 public constant MAX_GLYPHS_PER_REQUEST = 20;

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

    /// @notice VRF request → pending batch metadata
    struct PendingGlyph {
        address recipient;
        uint256 epochId;
        uint256 cumulativeContribution; // selects tier bracket on fulfillment (epoch-cumulative)
        uint256 numGlyphs;              // how many glyphs to mint on fulfillment
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

    /// @notice Request a batch of glyph mints via a single VRF call. Called by SummoningEngine
    ///         from claimGlyphs after epoch resolution. The wallet's cumulative contribution
    ///         to the epoch determines the tier bracket; the same bracket applies to every
    ///         glyph in the batch (splitting vs. concentrating cannot change the odds row).
    /// @param recipient The wallet that will receive the glyph NFTs.
    /// @param epochId The epoch the glyphs are being claimed for.
    /// @param numGlyphs The number of glyphs to mint (1..MAX_GLYPHS_PER_REQUEST).
    /// @param cumulativeContribution Wallet's total contribution to epochId in wei.
    /// @return requestId The Chainlink VRF request ID.
    function requestBatch(
        address recipient,
        uint256 epochId,
        uint256 numGlyphs,
        uint256 cumulativeContribution
    ) external onlyEngine returns (uint256 requestId) {
        if (numGlyphs == 0 || numGlyphs > MAX_GLYPHS_PER_REQUEST) {
            revert EldritchGlyphs__InvalidBatchSize();
        }

        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: uint32(numGlyphs),
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: false })
                )
            })
        );

        pendingGlyphs[requestId] = PendingGlyph({
            recipient: recipient,
            epochId: epochId,
            cumulativeContribution: cumulativeContribution,
            numGlyphs: numGlyphs,
            fulfilled: false
        });

        emit GlyphsBatchRequested(requestId, recipient, epochId, numGlyphs, cumulativeContribution);
    }

    // ── Core: VRF Callback ──

    /// @notice Chainlink VRF callback. Mints `numGlyphs` glyph NFTs in a single batch,
    ///         each rolled independently from its random word against the bracket selected
    ///         by the wallet's cumulative contribution.
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        PendingGlyph storage pending = pendingGlyphs[requestId];
        if (pending.recipient == address(0)) revert EldritchGlyphs__RequestNotFound();
        if (pending.fulfilled) revert EldritchGlyphs__RequestNotFound(); // already fulfilled

        pending.fulfilled = true;

        address recipient = pending.recipient;
        uint256 epochId = pending.epochId;
        uint8 bracket = _bracket(pending.cumulativeContribution);
        uint256 numGlyphs = randomWords.length;

        uint256[] memory ids = new uint256[](numGlyphs);
        uint256[] memory values = new uint256[](numGlyphs);

        for (uint256 i = 0; i < numGlyphs; i++) {
            ids[i] = _recordGlyph(recipient, epochId, bracket, randomWords[i]);
            values[i] = 1;
        }

        // Batch mint: one ERC-1155 TransferBatch event and one _update call.
        _mintBatch(recipient, ids, values, "");
        emit GlyphsBatchMinted(requestId, recipient, epochId, numGlyphs);
    }

    /// @dev Derive tier/rune/lore from one random word, persist GlyphData, emit GlyphMinted.
    ///      Factored out of fulfillRandomWords to avoid stack-too-deep with the loop.
    function _recordGlyph(
        address recipient,
        uint256 epochId,
        uint8 bracket,
        uint256 seed
    ) internal returns (uint256 tokenId) {
        uint8 tier = _deriveTierFromBracket(uint64(seed), bracket);
        uint8 runeIndex = uint8((seed >> 64) % NUM_RUNES);
        uint8 loreIndex = uint8((seed >> 128) % NUM_LORE);

        tokenId = nextTokenId++;
        glyphData[tokenId] = GlyphData({
            tier: tier,
            runeIndex: runeIndex,
            loreIndex: loreIndex,
            epochId: epochId,
            originalRecipient: recipient
        });

        emit GlyphMinted(tokenId, recipient, tier, runeIndex, loreIndex, epochId);
    }

    // ── Tier Derivation ──

    /// @dev Bucket sacrifice amount into a 5-row tier-weight table.
    ///      Boundaries are 10, 100, 1000, 10000 RITUAL (each 18 decimals).
    function _bracket(uint256 amount) internal pure returns (uint8) {
        if (amount < 10e18) return 0;
        if (amount < 100e18) return 1;
        if (amount < 1000e18) return 2;
        if (amount < 10_000e18) return 3;
        return 4;
    }

    /// @dev Tier weights per bracket (basis points). Each row sums to 10,000.
    ///      Returned by index for gas efficiency vs. a 2D constant array.
    function _tierWeights(uint8 bracket) internal pure returns (uint16[5] memory w) {
        if (bracket == 0) {
            return [uint16(5000), 2800, 1500, 600, 100];
        } else if (bracket == 1) {
            return [uint16(4200), 3000, 1800, 800, 200];
        } else if (bracket == 2) {
            return [uint16(3000), 3000, 2400, 1200, 400];
        } else if (bracket == 3) {
            return [uint16(2000), 2700, 2800, 1700, 800];
        } else {
            return [uint16(1200), 2200, 3000, 2200, 1400];
        }
    }

    /// @dev Pick a tier 0-4 from random bits at a pre-computed bracket.
    function _deriveTierFromBracket(uint64 bits, uint8 bracket) internal pure returns (uint8) {
        uint16[5] memory w = _tierWeights(bracket);
        uint16 roll = uint16(bits % BPS_TOTAL);
        uint16 cumulative;
        for (uint8 i = 0; i < 5; i++) {
            cumulative += w[i];
            if (roll < cumulative) return i;
        }
        return 4; // unreachable: weights sum to BPS_TOTAL
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
