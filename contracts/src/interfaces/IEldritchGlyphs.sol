// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IEldritchGlyphs — Interface for the on-chain glyph NFT contract
/// @notice Tradeable ERC-1155 glyph NFTs minted via Chainlink VRF on each sacrifice
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

    event GlyphRequested(uint256 indexed requestId, address indexed recipient, uint256 epochId);
    event GlyphMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        uint8 tier,
        uint8 runeIndex,
        uint8 loreIndex,
        uint256 epochId
    );
    event EngineSet(address indexed engine);
    event BaseURISet(string uri);

    // ── Errors ──

    error EldritchGlyphs__OnlyEngine();
    error EldritchGlyphs__ZeroAddress();
    error EldritchGlyphs__RequestNotFound();

    // ── Functions ──

    /// @notice Request a glyph mint via Chainlink VRF. Called by SummoningEngine after sacrifice.
    /// @param amount Sacrifice amount in wei — determines the tier weight bracket.
    function requestGlyph(address recipient, uint256 epochId, uint256 amount) external returns (uint256 requestId);

    /// @notice Get on-chain glyph metadata for a token.
    function getGlyphData(uint256 tokenId) external view returns (GlyphData memory);

    /// @notice Total glyphs currently held by a wallet (updates on transfer).
    function glyphCount(address wallet) external view returns (uint256);

    /// @notice Total glyphs minted so far.
    function totalMinted() external view returns (uint256);
}
