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
    // Large enough to fulfill 50-glyph batches under the mock coordinator.
    uint32 constant CALLBACK_GAS_LIMIT = 2_500_000;
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

    /// Request a single-glyph batch and fulfill VRF with a specific random word.
    /// @param cumulativeContribution Wallet's epoch-cumulative contribution — selects bracket.
    function _requestAndFulfill(address recipient, uint256 epochId, uint256 cumulativeContribution, uint256 randomWord)
        internal
        returns (uint256 tokenId)
    {
        vm.prank(engine);
        uint256 requestId = glyphs.requestBatch(recipient, epochId, 1, cumulativeContribution);

        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        vrfCoordinator.fulfillRandomWordsWithOverride(requestId, address(glyphs), words);

        tokenId = glyphs.nextTokenId() - 1;
    }

    /// Backward-compat overload: bracket-0 (1 RITUAL cumulative).
    function _requestAndFulfill(address recipient, uint256 epochId, uint256 randomWord)
        internal
        returns (uint256 tokenId)
    {
        return _requestAndFulfill(recipient, epochId, 1e18, randomWord);
    }

    /// Request and fulfill with auto-generated random words at bracket 0.
    function _requestAndFulfillAuto(address recipient, uint256 epochId)
        internal
        returns (uint256 requestId)
    {
        vm.prank(engine);
        requestId = glyphs.requestBatch(recipient, epochId, 1, 1e18);
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));
    }

    /// Request a multi-glyph batch and fulfill VRF with provided random words.
    function _requestAndFulfillBatch(
        address recipient,
        uint256 epochId,
        uint256 cumulativeContribution,
        uint256[] memory words
    ) internal returns (uint256 requestId) {
        vm.prank(engine);
        requestId = glyphs.requestBatch(recipient, epochId, words.length, cumulativeContribution);
        vrfCoordinator.fulfillRandomWordsWithOverride(requestId, address(glyphs), words);
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

    // ── Request Batch ────────────────────────────────────────────────────────

    function test_RequestBatch_OnlyEngine() public {
        vm.prank(alice);
        vm.expectRevert(IEldritchGlyphs.EldritchGlyphs__OnlyEngine.selector);
        glyphs.requestBatch(alice, 1, 1, 1e18);
    }

    function test_RequestBatch_StoresPending() public {
        vm.prank(engine);
        uint256 requestId = glyphs.requestBatch(alice, 1, 3, 500e18);

        (
            address recipient,
            uint256 epochId,
            uint256 cumulativeContribution,
            uint256 numGlyphs,
            bool fulfilled
        ) = glyphs.pendingGlyphs(requestId);
        assertEq(recipient, alice);
        assertEq(epochId, 1);
        assertEq(cumulativeContribution, 500e18);
        assertEq(numGlyphs, 3);
        assertFalse(fulfilled);
    }

    function test_RequestBatch_EmitsEvent() public {
        vm.prank(engine);
        vm.expectEmit(true, true, false, true);
        emit IEldritchGlyphs.GlyphsBatchRequested(1, alice, 1, 2, 200e18);
        glyphs.requestBatch(alice, 1, 2, 200e18);
    }

    function test_RequestBatch_RevertsOnZero() public {
        vm.prank(engine);
        vm.expectRevert(IEldritchGlyphs.EldritchGlyphs__InvalidBatchSize.selector);
        glyphs.requestBatch(alice, 1, 0, 100e18);
    }

    function test_RequestBatch_RevertsAboveCap() public {
        vm.prank(engine);
        vm.expectRevert(IEldritchGlyphs.EldritchGlyphs__InvalidBatchSize.selector);
        glyphs.requestBatch(alice, 1, 51, 100e18);
    }

    function test_RequestBatch_AcceptsCapExactly() public {
        vm.prank(engine);
        uint256 requestId = glyphs.requestBatch(alice, 1, 50, 5_000e18);
        (, , , uint256 numGlyphs, ) = glyphs.pendingGlyphs(requestId);
        assertEq(numGlyphs, 50);
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
        uint256 requestId = glyphs.requestBatch(alice, 1, 1, 1e18);
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));

        (, , , , bool fulfilled) = glyphs.pendingGlyphs(requestId);
        assertTrue(fulfilled);
    }

    function test_Fulfill_RevertsOnDoubleFulfill() public {
        vm.prank(engine);
        uint256 requestId = glyphs.requestBatch(alice, 1, 1, 1e18);
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));

        // Second fulfillment should revert (fulfilled flag is checked)
        vm.expectRevert();
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));
    }

    function test_Fulfill_EmitsGlyphMinted() public {
        vm.prank(engine);
        uint256 requestId = glyphs.requestBatch(alice, 1, 1, 1e18);

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

    function test_Fulfill_MintsBatch_FiveGlyphs() public {
        uint256[] memory words = new uint256[](5);
        words[0] = 1;
        words[1] = 5001;
        words[2] = 7801;
        words[3] = 9301;
        words[4] = 9901;
        // bracket 0 (1 RITUAL): boundaries 5000/7800/9300/9900 → tiers 0/1/2/3/4
        uint256 requestId = _requestAndFulfillBatch(alice, 1, 1e18, words);

        assertEq(glyphs.nextTokenId(), 6);
        // All five tokens minted to alice
        for (uint256 i = 1; i <= 5; i++) {
            assertEq(glyphs.balanceOf(alice, i), 1);
        }
        assertEq(glyphs.glyphCount(alice), 5);

        // GlyphData stored for each
        assertEq(glyphs.getGlyphData(1).tier, 0);
        assertEq(glyphs.getGlyphData(2).tier, 1);
        assertEq(glyphs.getGlyphData(3).tier, 2);
        assertEq(glyphs.getGlyphData(4).tier, 3);
        assertEq(glyphs.getGlyphData(5).tier, 4);

        // BatchMinted event emitted on the batch
        (, , , , bool fulfilled) = glyphs.pendingGlyphs(requestId);
        assertTrue(fulfilled);
    }

    function test_Fulfill_MintsBatch_EmitsGlyphsBatchMinted() public {
        vm.prank(engine);
        uint256 requestId = glyphs.requestBatch(alice, 1, 3, 300e18);

        uint256[] memory words = new uint256[](3);
        words[0] = 1; words[1] = 2; words[2] = 3;

        vm.expectEmit(true, true, false, true);
        emit IEldritchGlyphs.GlyphsBatchMinted(requestId, alice, 1, 3);
        vrfCoordinator.fulfillRandomWordsWithOverride(requestId, address(glyphs), words);
    }

    function test_Fulfill_MintsBatch_BracketFromCumulative() public {
        // Cumulative = 1000e18 → bracket 3 (20/27/28/17/8).
        // Two glyphs, both with seed % 10000 = 9999 → tier 4 (Breach) in bracket 3 only if
        // weights cross at 9200 (20+27+28+17 = 92%, so 9999 > 9200 → tier 4). In bracket 0
        // the same seed would also be tier 4. Use a seed that diverges:
        //   roll = 9000 → bracket 0: cumulative crosses at 5000/7800/9300 → tier 3 (Rupture)
        //   roll = 9000 → bracket 3: cumulative crosses at 2000/4700/7500/9200 → tier 3
        // Try roll = 6000:
        //   bracket 0: 6000 > 5000, 6000 < 7800 → tier 1 (Echo)
        //   bracket 3: 6000 > 4700, 6000 < 7500 → tier 2 (Tremor)
        uint256[] memory words = new uint256[](2);
        words[0] = 6000;
        words[1] = 6000;
        _requestAndFulfillBatch(alice, 1, 1000e18, words);
        // Both should be Tremor (tier 2) in bracket 3, not Echo (tier 1) as bracket 0 would give.
        assertEq(glyphs.getGlyphData(1).tier, 2);
        assertEq(glyphs.getGlyphData(2).tier, 2);
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

    // ── Fuzz: Tier Distribution per bracket ──────────────────────────────────

    /// Helper: run N samples at a given amount, assert tier distribution within tolerance.
    function _assertBracketDistribution(
        uint256 amount,
        uint256[5] memory expected,
        uint256 tolerance,
        string memory bracketLabel
    ) internal {
        uint256 total = 1_000;
        uint256[5] memory counts;

        for (uint256 i = 0; i < total; i++) {
            uint256 seed = uint256(keccak256(abi.encode(bracketLabel, i)));
            uint256 tokenId = _requestAndFulfill(alice, 1, amount, seed);
            uint8 tier = glyphs.getGlyphData(tokenId).tier;
            counts[tier]++;
        }

        assertApproxEqAbs(counts[0], expected[0], tolerance, string.concat(bracketLabel, " Whisper off"));
        assertApproxEqAbs(counts[1], expected[1], tolerance, string.concat(bracketLabel, " Echo off"));
        assertApproxEqAbs(counts[2], expected[2], tolerance, string.concat(bracketLabel, " Tremor off"));
        assertApproxEqAbs(counts[3], expected[3], tolerance, string.concat(bracketLabel, " Rupture off"));
        assertApproxEqAbs(counts[4], expected[4], tolerance, string.concat(bracketLabel, " Breach off"));
    }

    function test_FuzzTierDistribution_Bracket0() public {
        // 1 RITUAL → bracket 0: 50/28/15/6/1
        _assertBracketDistribution(1e18, [uint256(500), 280, 150, 60, 10], 50, "B0");
    }

    function test_FuzzTierDistribution_Bracket1() public {
        // 10 RITUAL → bracket 1: 42/30/18/8/2
        _assertBracketDistribution(10e18, [uint256(420), 300, 180, 80, 20], 50, "B1");
    }

    function test_FuzzTierDistribution_Bracket2() public {
        // 100 RITUAL → bracket 2: 30/30/24/12/4
        _assertBracketDistribution(100e18, [uint256(300), 300, 240, 120, 40], 50, "B2");
    }

    function test_FuzzTierDistribution_Bracket3() public {
        // 1,000 RITUAL → bracket 3: 20/27/28/17/8
        _assertBracketDistribution(1_000e18, [uint256(200), 270, 280, 170, 80], 50, "B3");
    }

    function test_FuzzTierDistribution_Bracket4() public {
        // 10,000 RITUAL → bracket 4: 12/22/30/22/14
        _assertBracketDistribution(10_000e18, [uint256(120), 220, 300, 220, 140], 50, "B4");
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
        // 1. Engine requests a single-glyph batch for alice
        vm.prank(engine);
        uint256 requestId = glyphs.requestBatch(alice, 1, 1, 1e18);

        // 2. Pending state exists
        (address recipient, , , , bool fulfilled) = glyphs.pendingGlyphs(requestId);
        assertEq(recipient, alice);
        assertFalse(fulfilled);
        assertEq(glyphs.glyphCount(alice), 0);

        // 3. VRF callback fulfills
        vrfCoordinator.fulfillRandomWords(requestId, address(glyphs));

        // 4. Glyph is minted
        assertEq(glyphs.balanceOf(alice, 1), 1);
        assertEq(glyphs.glyphCount(alice), 1);
        (, , , , fulfilled) = glyphs.pendingGlyphs(requestId);
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
