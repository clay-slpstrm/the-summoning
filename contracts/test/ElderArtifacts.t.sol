// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ElderArtifacts.sol";

contract ElderArtifactsTest is Test {
    ElderArtifacts artifacts;

    address owner   = makeAddr("owner");
    address engine  = makeAddr("engine");
    address alice   = makeAddr("alice");
    address bob     = makeAddr("bob");
    address stranger = makeAddr("stranger");

    string constant BASE_URI = "https://api.thesummoning.xyz/metadata/";

    function setUp() public {
        vm.prank(owner);
        artifacts = new ElderArtifacts(BASE_URI, owner);

        vm.prank(owner);
        artifacts.setEngine(engine);
    }

    // ── Deployment ───────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(artifacts.name(), "Elder Artifacts");
        assertEq(artifacts.symbol(), "ELDER");
        assertEq(artifacts.owner(), owner);
        assertEq(artifacts.summoningEngine(), engine);
        assertEq(artifacts.baseURI(), BASE_URI);
    }

    function test_Constructor_SetsBaseURI() public view {
        assertEq(artifacts.baseURI(), BASE_URI);
    }

    // ── setEngine ────────────────────────────────────────────────────────────

    function test_SetEngine_UpdatesEngine() public {
        address newEngine = makeAddr("newEngine");
        vm.prank(owner);
        artifacts.setEngine(newEngine);
        assertEq(artifacts.summoningEngine(), newEngine);
    }

    function test_SetEngine_EmitsEvent() public {
        address newEngine = makeAddr("newEngine");
        vm.expectEmit(true, false, false, false);
        emit ElderArtifacts.EngineSet(newEngine);
        vm.prank(owner);
        artifacts.setEngine(newEngine);
    }

    function test_SetEngine_Reverts_NonOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        artifacts.setEngine(makeAddr("newEngine"));
    }

    function test_SetEngine_Reverts_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(ElderArtifacts.ElderArtifacts__ZeroAddress.selector);
        artifacts.setEngine(address(0));
    }

    function test_SetEngine_CanBeUpdated() public {
        address engine2 = makeAddr("engine2");
        vm.prank(owner);
        artifacts.setEngine(engine2);
        assertEq(artifacts.summoningEngine(), engine2);

        address engine3 = makeAddr("engine3");
        vm.prank(owner);
        artifacts.setEngine(engine3);
        assertEq(artifacts.summoningEngine(), engine3);
    }

    // ── setBaseURI ───────────────────────────────────────────────────────────

    function test_SetBaseURI_Updates() public {
        string memory newURI = "https://sepolia.thesummoning.xyz/metadata/";
        vm.prank(owner);
        artifacts.setBaseURI(newURI);
        assertEq(artifacts.baseURI(), newURI);
    }

    function test_SetBaseURI_EmitsEvent() public {
        string memory newURI = "https://sepolia.thesummoning.xyz/metadata/";
        vm.expectEmit(false, false, false, true);
        emit ElderArtifacts.BaseURISet(newURI);
        vm.prank(owner);
        artifacts.setBaseURI(newURI);
    }

    function test_SetBaseURI_Reverts_NonOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        artifacts.setBaseURI("https://evil.example.com/");
    }

    // ── mint ─────────────────────────────────────────────────────────────────

    function test_Mint_CreditsBalance() public {
        uint256 tokenId = 1001; // epoch 1, Harbinger
        vm.prank(engine);
        artifacts.mint(alice, tokenId, 1, "");
        assertEq(artifacts.balanceOf(alice, tokenId), 1);
    }

    function test_Mint_TracksTotalMinted() public {
        uint256 tokenId = 1003;
        vm.prank(engine);
        artifacts.mint(alice, tokenId, 1, "");
        assertEq(artifacts.totalMinted(tokenId), 1);
    }

    function test_Mint_AccumulatesTotalMinted() public {
        uint256 tokenId = 1003;
        vm.prank(engine);
        artifacts.mint(alice, tokenId, 1, "");
        vm.prank(engine);
        artifacts.mint(bob, tokenId, 1, "");
        assertEq(artifacts.totalMinted(tokenId), 2);
    }

    function test_Mint_AmountGreaterThanOne() public {
        uint256 tokenId = 1000;
        vm.prank(engine);
        artifacts.mint(alice, tokenId, 5, "");
        assertEq(artifacts.balanceOf(alice, tokenId), 5);
        assertEq(artifacts.totalMinted(tokenId), 5);
    }

    function test_Mint_Reverts_OnlyEngine() public {
        vm.prank(stranger);
        vm.expectRevert(ElderArtifacts.ElderArtifacts__OnlyEngine.selector);
        artifacts.mint(alice, 1001, 1, "");
    }

    function test_Mint_Reverts_OwnerNotEngine() public {
        vm.prank(owner);
        vm.expectRevert(ElderArtifacts.ElderArtifacts__OnlyEngine.selector);
        artifacts.mint(alice, 1001, 1, "");
    }

    function test_Mint_MultipleTokenIds() public {
        vm.prank(engine);
        artifacts.mint(alice, 1000, 1, ""); // Shattered Ritual
        vm.prank(engine);
        artifacts.mint(alice, 1001, 1, ""); // Harbinger
        vm.prank(engine);
        artifacts.mint(alice, 1002, 1, ""); // Acolyte
        vm.prank(engine);
        artifacts.mint(alice, 1003, 1, ""); // Cultist

        assertEq(artifacts.balanceOf(alice, 1000), 1);
        assertEq(artifacts.balanceOf(alice, 1001), 1);
        assertEq(artifacts.balanceOf(alice, 1002), 1);
        assertEq(artifacts.balanceOf(alice, 1003), 1);
    }

    // ── mintBatch ────────────────────────────────────────────────────────────

    function test_MintBatch_CreditsBalances() public {
        uint256[] memory ids     = new uint256[](3);
        uint256[] memory amounts = new uint256[](3);
        ids[0] = 1001; ids[1] = 1002; ids[2] = 1003;
        amounts[0] = 1; amounts[1] = 1; amounts[2] = 1;

        vm.prank(engine);
        artifacts.mintBatch(alice, ids, amounts, "");

        assertEq(artifacts.balanceOf(alice, 1001), 1);
        assertEq(artifacts.balanceOf(alice, 1002), 1);
        assertEq(artifacts.balanceOf(alice, 1003), 1);
    }

    function test_MintBatch_TracksTotalMinted() public {
        uint256[] memory ids     = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        ids[0] = 2001; ids[1] = 2003;
        amounts[0] = 3; amounts[1] = 7;

        vm.prank(engine);
        artifacts.mintBatch(alice, ids, amounts, "");

        assertEq(artifacts.totalMinted(2001), 3);
        assertEq(artifacts.totalMinted(2003), 7);
    }

    function test_MintBatch_Reverts_OnlyEngine() public {
        uint256[] memory ids     = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = 1001; amounts[0] = 1;

        vm.prank(stranger);
        vm.expectRevert(ElderArtifacts.ElderArtifacts__OnlyEngine.selector);
        artifacts.mintBatch(alice, ids, amounts, "");
    }

    function test_MintBatch_Reverts_ArrayLengthMismatch() public {
        uint256[] memory ids     = new uint256[](2);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = 1001; ids[1] = 1002;
        amounts[0] = 1;

        vm.prank(engine);
        vm.expectRevert(ElderArtifacts.ElderArtifacts__ArrayLengthMismatch.selector);
        artifacts.mintBatch(alice, ids, amounts, "");
    }

    function test_MintBatch_EmptyArrays() public {
        uint256[] memory ids     = new uint256[](0);
        uint256[] memory amounts = new uint256[](0);

        vm.prank(engine);
        artifacts.mintBatch(alice, ids, amounts, ""); // should not revert
    }

    // ── uri ──────────────────────────────────────────────────────────────────

    function test_URI_FormatEpoch1Harbinger() public view {
        assertEq(artifacts.uri(1001), "https://api.thesummoning.xyz/metadata/1001");
    }

    function test_URI_FormatEpoch1ShatteredRitual() public view {
        assertEq(artifacts.uri(1000), "https://api.thesummoning.xyz/metadata/1000");
    }

    function test_URI_FormatEpoch2Acolyte() public view {
        assertEq(artifacts.uri(2002), "https://api.thesummoning.xyz/metadata/2002");
    }

    function test_URI_FormatTokenIdZero() public view {
        assertEq(artifacts.uri(0), "https://api.thesummoning.xyz/metadata/0");
    }

    function test_URI_UpdatesAfterSetBaseURI() public {
        vm.prank(owner);
        artifacts.setBaseURI("https://sepolia.thesummoning.xyz/metadata/");
        assertEq(artifacts.uri(1001), "https://sepolia.thesummoning.xyz/metadata/1001");
    }

    function test_URI_LargeTokenId() public view {
        // epoch 9999, tierId 3 → tokenId = 9999003
        assertEq(artifacts.uri(9_999_003), "https://api.thesummoning.xyz/metadata/9999003");
    }

    // ── Token ID encoding ────────────────────────────────────────────────────

    function test_TokenIdEncoding_Epoch1() public pure {
        assertEq(uint256(1 * 1000 + 0), uint256(1000)); // Shattered Ritual
        assertEq(uint256(1 * 1000 + 1), uint256(1001)); // Harbinger
        assertEq(uint256(1 * 1000 + 2), uint256(1002)); // Acolyte
        assertEq(uint256(1 * 1000 + 3), uint256(1003)); // Cultist
    }

    function test_TokenIdDecoding() public pure {
        uint256 tokenId = 5002; // epoch 5, Acolyte
        assertEq(tokenId / 1000, uint256(5)); // epochId
        assertEq(tokenId % 1000, uint256(2)); // tierId
    }

    // ── ERC-1155 Standard Behaviour ──────────────────────────────────────────

    function test_Transfer_WorksAfterMint() public {
        vm.prank(engine);
        artifacts.mint(alice, 1001, 1, "");

        vm.prank(alice);
        artifacts.safeTransferFrom(alice, bob, 1001, 1, "");

        assertEq(artifacts.balanceOf(alice, 1001), 0);
        assertEq(artifacts.balanceOf(bob, 1001), 1);
    }

    function test_Approval_AllowsOperatorTransfer() public {
        vm.prank(engine);
        artifacts.mint(alice, 1001, 1, "");

        vm.prank(alice);
        artifacts.setApprovalForAll(bob, true);

        vm.prank(bob);
        artifacts.safeTransferFrom(alice, bob, 1001, 1, "");

        assertEq(artifacts.balanceOf(alice, 1001), 0);
        assertEq(artifacts.balanceOf(bob, 1001), 1);
    }

    function test_BalanceOfBatch() public {
        vm.prank(engine);
        artifacts.mint(alice, 1001, 2, "");
        vm.prank(engine);
        artifacts.mint(alice, 1003, 5, "");

        address[] memory accounts = new address[](2);
        uint256[] memory ids      = new uint256[](2);
        accounts[0] = alice; accounts[1] = alice;
        ids[0] = 1001; ids[1] = 1003;

        uint256[] memory balances = artifacts.balanceOfBatch(accounts, ids);
        assertEq(balances[0], 2);
        assertEq(balances[1], 5);
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_Mint_AnyTokenId(uint256 tokenId, uint256 amount) public {
        amount = bound(amount, 1, 1_000_000);
        vm.prank(engine);
        artifacts.mint(alice, tokenId, amount, "");
        assertEq(artifacts.balanceOf(alice, tokenId), amount);
        assertEq(artifacts.totalMinted(tokenId), amount);
    }

    function testFuzz_URI_ContainsTokenId(uint256 tokenId) public view {
        string memory result = artifacts.uri(tokenId);
        // Result must start with baseURI
        bytes memory resultBytes = bytes(result);
        bytes memory baseBytes   = bytes(BASE_URI);
        for (uint256 i = 0; i < baseBytes.length; i++) {
            assertEq(resultBytes[i], baseBytes[i]);
        }
        // Result must be longer than baseURI (tokenId appended)
        assertGt(resultBytes.length, baseBytes.length);
    }

    function testFuzz_TokenIdEncoding(uint256 epochId, uint256 tierId) public pure {
        epochId = bound(epochId, 1, 10_000);
        tierId  = bound(tierId, 0, 3);
        uint256 tokenId = epochId * 1000 + tierId;
        assertEq(tokenId / 1000, epochId);
        assertEq(tokenId % 1000, tierId);
    }
}
