// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { EldritchGlyphs } from "../src/EldritchGlyphs.sol";
import { IEldritchGlyphs } from "../src/interfaces/IEldritchGlyphs.sol";
import { VRFCoordinatorV2_5Mock } from
    "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";

contract EldritchGlyphsTest is Test {
    EldritchGlyphs glyphs;
    VRFCoordinatorV2_5Mock vrfCoordinator;

    address owner = address(this); // deployer is owner (ConfirmedOwner)
    address engine = makeAddr("engine");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address treasury = makeAddr("treasury");

    uint256 subId;
    bytes32 constant KEY_HASH = keccak256("test-key-hash");
    uint32 constant CALLBACK_GAS_LIMIT = 300_000;
    uint16 constant REQUEST_CONFIRMATIONS = 3;
    string constant BASE_URI = "https://api.thesummoning.xyz/metadata/glyph/";

    function setUp() public {
        // Deploy VRF mock: baseFee=0.1 LINK, gasPrice=1e9, weiPerUnitLink=4e15
        vrfCoordinator = new VRFCoordinatorV2_5Mock(0.1 ether, 1e9, 4e15);

        // Create and fund subscription
        subId = vrfCoordinator.createSubscription();
        vrfCoordinator.fundSubscription(subId, 100_000 ether);

        // Deploy EldritchGlyphs
        glyphs = new EldritchGlyphs(
            address(vrfCoordinator),
            subId,
            KEY_HASH,
            CALLBACK_GAS_LIMIT,
            REQUEST_CONFIRMATIONS,
            BASE_URI,
            treasury
        );

        // Add as VRF consumer
        vrfCoordinator.addConsumer(subId, address(glyphs));

        // Set engine
        glyphs.setEngine(engine);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// Request a glyph from the engine and fulfill VRF with specific random words.
    function _requestAndFulfill(address recipient, uint256 epochId, uint256 randomWord)
        internal
        returns (uint256 tokenId)
    {
        vm.prank(engine);
        uint256 requestId = glyphs.requestGlyph(recipient, epochId);

        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        vrfCoordinator.fulfillRandomWordsWithOverride(requestId, address(glyphs), words);

        tokenId = glyphs.nextTokenId() - 1;
    }

    /// Request and fulfill with auto-generated random words.
    function _requestAndFulfillAuto(address recipient, uint256 epochId)
        internal
        returns (uint256 requestId)
    {
        vm.prank(engine);
        requestId = glyphs.requestGlyph(recipient, epochId);
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));
    }

    // ── Deployment ───────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(glyphs.name(), "Eldritch Glyphs");
        assertEq(glyphs.symbol(), "GLYPH");
        assertEq(glyphs.baseURI(), BASE_URI);
        assertEq(glyphs.summoningEngine(), engine);
        assertEq(glyphs.nextTokenId(), 1);
        assertEq(glyphs.keyHash(), KEY_HASH);
        assertEq(glyphs.subscriptionId(), subId);
    }

    function test_Constructor_RevertsZeroRoyaltyReceiver() public {
        vm.expectRevert(IEldritchGlyphs.EldritchGlyphs__ZeroAddress.selector);
        new EldritchGlyphs(
            address(vrfCoordinator), subId, KEY_HASH,
            CALLBACK_GAS_LIMIT, REQUEST_CONFIRMATIONS, BASE_URI, address(0)
        );
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function test_SetEngine_Works() public {
        address newEngine = makeAddr("newEngine");
        glyphs.setEngine(newEngine);
        assertEq(glyphs.summoningEngine(), newEngine);
    }

    function test_SetEngine_RevertsZeroAddress() public {
        vm.expectRevert(IEldritchGlyphs.EldritchGlyphs__ZeroAddress.selector);
        glyphs.setEngine(address(0));
    }

    function test_SetEngine_RevertsNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        glyphs.setEngine(alice);
    }

    function test_SetBaseURI() public {
        glyphs.setBaseURI("https://new.uri/");
        assertEq(glyphs.baseURI(), "https://new.uri/");
    }

    function test_SetRoyalty() public {
        glyphs.setRoyalty(alice, 1000); // 10%
        // Mint a glyph first to test royalty on it
        _requestAndFulfillAuto(alice, 1);
        (address receiver, uint256 amount) = glyphs.royaltyInfo(1, 1 ether);
        assertEq(receiver, alice);
        assertEq(amount, 0.1 ether);
    }

    // ── Request Glyph ────────────────────────────────────────────────────────

    function test_RequestGlyph_OnlyEngine() public {
        vm.prank(alice);
        vm.expectRevert(IEldritchGlyphs.EldritchGlyphs__OnlyEngine.selector);
        glyphs.requestGlyph(alice, 1);
    }

    function test_RequestGlyph_StoresPending() public {
        vm.prank(engine);
        uint256 requestId = glyphs.requestGlyph(alice, 1);

        (address recipient, uint256 epochId, bool fulfilled) = glyphs.pendingGlyphs(requestId);
        assertEq(recipient, alice);
        assertEq(epochId, 1);
        assertFalse(fulfilled);
    }

    function test_RequestGlyph_EmitsEvent() public {
        vm.prank(engine);
        vm.expectEmit(true, true, false, true);
        emit IEldritchGlyphs.GlyphRequested(1, alice, 1);
        glyphs.requestGlyph(alice, 1);
    }

    // ── Fulfill (VRF Callback) ───────────────────────────────────────────────

    function test_Fulfill_MintsToken() public {
        uint256 tokenId = _requestAndFulfill(alice, 1, 12345);

        assertEq(tokenId, 1);
        assertEq(glyphs.balanceOf(alice, 1), 1);
    }

    function test_Fulfill_StoresGlyphData() public {
        // Use a seed that produces Whisper (tier 0): 12345 % 10000 = 2345 < 5000
        uint256 tokenId = _requestAndFulfill(alice, 1, 12345);

        IEldritchGlyphs.GlyphData memory data = glyphs.getGlyphData(tokenId);
        assertEq(data.tier, 0); // Whisper
        assertEq(data.runeIndex, uint8((12345 >> 64) % 30));
        assertEq(data.loreIndex, uint8((12345 >> 128) % 10));
        assertEq(data.epochId, 1);
        assertEq(data.originalRecipient, alice);
    }

    function test_Fulfill_IncrementsTokenId() public {
        _requestAndFulfillAuto(alice, 1);
        _requestAndFulfillAuto(bob, 1);

        assertEq(glyphs.nextTokenId(), 3);
        assertEq(glyphs.balanceOf(alice, 1), 1);
        assertEq(glyphs.balanceOf(bob, 2), 1);
    }

    function test_Fulfill_MarksFulfilled() public {
        vm.prank(engine);
        uint256 requestId = glyphs.requestGlyph(alice, 1);
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));

        (, , bool fulfilled) = glyphs.pendingGlyphs(requestId);
        assertTrue(fulfilled);
    }

    function test_Fulfill_RevertsOnDoubleFulfill() public {
        vm.prank(engine);
        uint256 requestId = glyphs.requestGlyph(alice, 1);
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));

        // Second fulfillment should revert (fulfilled flag is checked)
        vm.expectRevert();
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));
    }

    function test_Fulfill_EmitsGlyphMinted() public {
        vm.prank(engine);
        uint256 requestId = glyphs.requestGlyph(alice, 1);

        // Use specific word so we can predict the event args
        uint256[] memory words = new uint256[](1);
        words[0] = 42;
        uint8 expectedTier = uint8(uint16(uint64(42) % 10_000) < 5000 ? 0 : 1);
        uint8 expectedRune = uint8((42 >> 64) % 30);
        uint8 expectedLore = uint8((42 >> 128) % 10);

        vm.expectEmit(true, true, false, true);
        emit IEldritchGlyphs.GlyphMinted(1, alice, expectedTier, expectedRune, expectedLore, 1);
        vrfCoordinator.fulfillRandomWordsWithOverride(requestId, address(glyphs), words);
    }

    // ── Glyph Count Tracking ─────────────────────────────────────────────────

    function test_GlyphCount_IncreasesOnMint() public {
        _requestAndFulfillAuto(alice, 1);
        assertEq(glyphs.glyphCount(alice), 1);

        _requestAndFulfillAuto(alice, 1);
        assertEq(glyphs.glyphCount(alice), 2);
    }

    function test_GlyphCount_UpdatesOnTransfer() public {
        _requestAndFulfillAuto(alice, 1);
        assertEq(glyphs.glyphCount(alice), 1);
        assertEq(glyphs.glyphCount(bob), 0);

        // Transfer from alice to bob
        vm.prank(alice);
        glyphs.safeTransferFrom(alice, bob, 1, 1, "");

        assertEq(glyphs.glyphCount(alice), 0);
        assertEq(glyphs.glyphCount(bob), 1);
    }

    function test_GlyphCount_MultipleTransfers() public {
        // Mint 3 glyphs to alice
        _requestAndFulfillAuto(alice, 1);
        _requestAndFulfillAuto(alice, 1);
        _requestAndFulfillAuto(alice, 1);
        assertEq(glyphs.glyphCount(alice), 3);

        // Transfer 2 to bob via batch
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.prank(alice);
        glyphs.safeBatchTransferFrom(alice, bob, ids, amounts, "");

        assertEq(glyphs.glyphCount(alice), 1);
        assertEq(glyphs.glyphCount(bob), 2);
    }

    // ── Tier Derivation ──────────────────────────────────────────────────────

    function test_Tier_Whisper() public {
        // seed % 10000 = 0 → Whisper (< 5000)
        uint256 tokenId = _requestAndFulfill(alice, 1, 0);
        assertEq(glyphs.getGlyphData(tokenId).tier, 0);
    }

    function test_Tier_Echo() public {
        // seed % 10000 = 5000 → Echo ([5000, 7800))
        uint256 tokenId = _requestAndFulfill(alice, 1, 5000);
        assertEq(glyphs.getGlyphData(tokenId).tier, 1);
    }

    function test_Tier_Tremor() public {
        // seed % 10000 = 7800 → Tremor ([7800, 9300))
        uint256 tokenId = _requestAndFulfill(alice, 1, 7800);
        assertEq(glyphs.getGlyphData(tokenId).tier, 2);
    }

    function test_Tier_Rupture() public {
        // seed % 10000 = 9300 → Rupture ([9300, 9900))
        uint256 tokenId = _requestAndFulfill(alice, 1, 9300);
        assertEq(glyphs.getGlyphData(tokenId).tier, 3);
    }

    function test_Tier_Breach() public {
        // seed % 10000 = 9900 → Breach ([9900, 10000))
        uint256 tokenId = _requestAndFulfill(alice, 1, 9900);
        assertEq(glyphs.getGlyphData(tokenId).tier, 4);
    }

    // ── Fuzz: Tier Distribution ──────────────────────────────────────────────

    function test_FuzzTierDistribution() public {
        // 1,000 samples — still statistically valid, feasible on-chain.
        // Expected: 500/280/150/60/10 (±5% = ±50)
        uint256 total = 1_000;
        uint256[5] memory counts;

        for (uint256 i = 0; i < total; i++) {
            uint256 seed = uint256(keccak256(abi.encode("fuzz", i)));
            uint256 tokenId = _requestAndFulfill(alice, 1, seed);
            uint8 tier = glyphs.getGlyphData(tokenId).tier;
            counts[tier]++;
        }

        assertApproxEqAbs(counts[0], 500, 50, "Whisper distribution off");
        assertApproxEqAbs(counts[1], 280, 50, "Echo distribution off");
        assertApproxEqAbs(counts[2], 150, 50, "Tremor distribution off");
        assertApproxEqAbs(counts[3], 60, 50, "Rupture distribution off");
        assertApproxEqAbs(counts[4], 10, 50, "Breach distribution off");
    }

    // ── Royalties (EIP-2981) ─────────────────────────────────────────────────

    function test_Royalty_DefaultIs5Percent() public {
        _requestAndFulfillAuto(alice, 1);
        (address receiver, uint256 amount) = glyphs.royaltyInfo(1, 1 ether);
        assertEq(receiver, treasury);
        assertEq(amount, 0.05 ether); // 5% of 1 ETH
    }

    function test_Royalty_ScalesWithPrice() public {
        _requestAndFulfillAuto(alice, 1);
        (address receiver, uint256 amount) = glyphs.royaltyInfo(1, 10 ether);
        assertEq(receiver, treasury);
        assertEq(amount, 0.5 ether); // 5% of 10 ETH
    }

    // ── Metadata URI ─────────────────────────────────────────────────────────

    function test_Uri_ReturnsCorrectPath() public {
        _requestAndFulfillAuto(alice, 1);
        assertEq(glyphs.uri(1), string.concat(BASE_URI, "1"));
        _requestAndFulfillAuto(alice, 1);
        assertEq(glyphs.uri(2), string.concat(BASE_URI, "2"));
    }

    // ── Interface Support ────────────────────────────────────────────────────

    function test_SupportsInterface_ERC1155() public view {
        assertTrue(glyphs.supportsInterface(0xd9b67a26)); // ERC1155
    }

    function test_SupportsInterface_ERC2981() public view {
        assertTrue(glyphs.supportsInterface(0x2a55205a)); // ERC2981
    }

    function test_SupportsInterface_ERC165() public view {
        assertTrue(glyphs.supportsInterface(0x01ffc9a7)); // ERC165
    }

    // ── TotalMinted ──────────────────────────────────────────────────────────

    function test_TotalMinted() public {
        assertEq(glyphs.totalMinted(), 0);
        _requestAndFulfillAuto(alice, 1);
        assertEq(glyphs.totalMinted(), 1);
        _requestAndFulfillAuto(bob, 2);
        assertEq(glyphs.totalMinted(), 2);
    }

    // ── Full Lifecycle ───────────────────────────────────────────────────────

    function test_FullLifecycle() public {
        // 1. Engine requests glyph for alice
        vm.prank(engine);
        uint256 requestId = glyphs.requestGlyph(alice, 1);

        // 2. Pending state exists
        (address recipient, , bool fulfilled) = glyphs.pendingGlyphs(requestId);
        assertEq(recipient, alice);
        assertFalse(fulfilled);
        assertEq(glyphs.glyphCount(alice), 0);

        // 3. VRF callback fulfills
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));

        // 4. Glyph is minted
        assertEq(glyphs.balanceOf(alice, 1), 1);
        assertEq(glyphs.glyphCount(alice), 1);
        (, , fulfilled) = glyphs.pendingGlyphs(requestId);
        assertTrue(fulfilled);

        // 5. Glyph data is stored
        IEldritchGlyphs.GlyphData memory data = glyphs.getGlyphData(1);
        assertEq(data.epochId, 1);
        assertEq(data.originalRecipient, alice);
        assertTrue(data.tier <= 4);
        assertTrue(data.runeIndex < 30);
        assertTrue(data.loreIndex < 10);

        // 6. Alice can transfer to bob
        vm.prank(alice);
        glyphs.safeTransferFrom(alice, bob, 1, 1, "");
        assertEq(glyphs.glyphCount(alice), 0);
        assertEq(glyphs.glyphCount(bob), 1);

        // 7. Original recipient is preserved
        data = glyphs.getGlyphData(1);
        assertEq(data.originalRecipient, alice);

        // 8. Royalty info is correct
        (address royaltyReceiver, uint256 royaltyAmount) = glyphs.royaltyInfo(1, 1 ether);
        assertEq(royaltyReceiver, treasury);
        assertEq(royaltyAmount, 0.05 ether);
    }
}
