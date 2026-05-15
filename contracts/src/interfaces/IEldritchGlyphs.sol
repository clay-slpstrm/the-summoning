// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IEldritchGlyphs — Interface for the on-chain glyph NFT contract
/// @notice Tradeable ERC-1155 glyph NFTs. Minted in batches at claim time via Chainlink VRF.
interface IEldritchGlyphs {
    // ── Structs ──

    struct GlyphData {
        uint8 tier; // 0=Whisper, 1=Echo, 2=Tremor, 3=Rupture, 4=Breach
        uint8 runeIndex; // 0-29
        uint8 loreIndex; // 0-9
        uint256 epochId;
        address originalRecipient;
    }

    // ── Events ──

    event GlyphsBatchRequested(
        uint256 indexed requestId,
        address indexed recipient,
        uint256 epochId,
        uint256 numGlyphs,
        uint256 cumulativeContribution
    );
    event GlyphMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        uint8 tier,
        uint8 runeIndex,
        uint8 loreIndex,
        uint256 epochId
    );
    event GlyphsBatchMinted(
        uint256 indexed requestId,
        address indexed recipient,
        uint256 epochId,
        uint256 numGlyphs
    );
    event EngineSet(address indexed engine);
    event BaseURISet(string uri);

    // ── Errors ──

    error EldritchGlyphs__OnlyEngine();
    error EldritchGlyphs__ZeroAddress();
    error EldritchGlyphs__RequestNotFound();
    error EldritchGlyphs__InvalidBatchSize();

    // ── Functions ──

    /// @notice Request a batch of glyph mints via a single Chainlink VRF call.
    ///         Called by SummoningEngine.claimGlyphs after epoch resolution.
    /// @param recipient    Wallet that will receive the glyphs.
    /// @param epochId      Epoch the glyphs are being claimed for.
    /// @param numGlyphs    Number of glyphs to mint (1..MAX_GLYPHS_PER_REQUEST).
    /// @param cumulativeContribution Wallet's total contribution to this epoch in wei —
    ///        determines the tier-weight bracket applied to every glyph in this batch.
    /// @return requestId   The Chainlink VRF request ID.
    function requestBatch(
        address recipient,
        uint256 epochId,
        uint256 numGlyphs,
        uint256 cumulativeContribution
    ) external returns (uint256 requestId);

    /// @notice Get on-chain glyph metadata for a token.
    function getGlyphData(uint256 tokenId) external view returns (GlyphData memory);

    /// @notice Total glyphs currently held by a wallet (updates on transfer).
    function glyphCount(address wallet) external view returns (uint256);

    /// @notice Total glyphs minted so far.
    function totalMinted() external view returns (uint256);
}
