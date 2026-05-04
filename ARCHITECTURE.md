# The Summoning — Technical Architecture Document

> **Purpose**: This document is the implementation reference for building The Summoning. It defines every contract interface, database schema, API endpoint, component structure, and integration flow. When building with Claude Code, reference this document for all architectural decisions.
>
> **Version**: 1.0 | March 2026
> **Target**: Ethereum Mainnet (Sepolia for testnet)

---

## Table of Contents

1. [Tech Stack & Versions](#1-tech-stack--versions)
2. [Repository Structure](#2-repository-structure)
3. [Smart Contracts](#3-smart-contracts)
4. [Backend Services](#4-backend-services)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Integration Flows](#6-integration-flows)
7. [Testing Strategy](#7-testing-strategy)
8. [Deployment & DevOps](#8-deployment--devops)
9. [Environment Configuration](#9-environment-configuration)
10. [Build Order](#10-build-order)

---

## 1. Tech Stack & Versions

### Smart Contracts
| Tool | Version | Purpose |
|------|---------|---------|
| Solidity | 0.8.24+ | Contract language |
| Foundry (forge, cast, anvil) | Latest | Build, test, deploy, local node |
| OpenZeppelin Contracts | 5.x | ERC-20, ERC-1155, AccessControl, ReentrancyGuard |
| Chainlink VRF | V2.5 | Verifiable randomness for epoch resolution |
| Chainlink Automation | V2 | Automated epoch phase transitions |

### Backend
| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20 LTS | Runtime |
| TypeScript | 5.x | Language |
| Express | 4.x | REST API server |
| ws | 8.x | WebSocket server for glyph delivery |
| PostgreSQL | 16 | Glyph persistence, leaderboards, cult ranks |
| Prisma | 5.x | Database ORM |
| viem | 2.x | Ethereum client for event listening |
| The Graph | Subgraph Studio | Event indexing (subgraph) |

### Frontend
| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 14 (App Router) | Framework |
| TypeScript | 5.x | Language |
| wagmi | 2.x | Wallet connection & contract interaction |
| viem | 2.x | Ethereum primitives (used by wagmi) |
| Tailwind CSS | 3.x | Styling |
| Framer Motion | 11.x | Glyph reveal animations, portal effects |
| @tanstack/react-query | 5.x | Server state management (used by wagmi) |
| zustand | 4.x | Client state (glyph collection, UI state) |

---

## 2. Repository Structure

```
the-summoning/
├── ARCHITECTURE.md              # This file
├── README.md
├── .env.example
│
├── contracts/                   # Foundry project
│   ├── foundry.toml
│   ├── src/
│   │   ├── RitualToken.sol
│   │   ├── MintingCurve.sol
│   │   ├── SummoningEngine.sol   # + Chainlink Automation (auto-resolve)
│   │   ├── ElderArtifacts.sol
│   │   ├── EldritchGlyphs.sol    # On-chain glyph NFTs (ERC-1155 + VRF + EIP-2981)
│   │   └── interfaces/
│   │       ├── IRitualToken.sol
│   │       ├── IMintingCurve.sol
│   │       ├── ISummoningEngine.sol
│   │       ├── IElderArtifacts.sol
│   │       └── IEldritchGlyphs.sol
│   ├── test/
│   │   ├── RitualToken.t.sol
│   │   ├── MintingCurve.t.sol
│   │   ├── SummoningEngine.t.sol  # 71 tests (incl. Automation)
│   │   ├── ElderArtifacts.t.sol
│   │   └── EldritchGlyphs.t.sol   # 32 tests (VRF, tiers, royalties)
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   ├── DeployWeek2.s.sol
│   │   └── DeployGlyphs.s.sol     # Deploys EldritchGlyphs + rewires engine
│   └── lib/                     # forge install dependencies
│
├── backend/                     # Node.js services
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── index.ts             # Express + WS server entry
│   │   ├── config.ts            # Environment config
│   │   ├── services/
│   │   │   ├── glyphMintHandler.ts # Indexes on-chain VRF glyph events
│   │   │   ├── glyphEngine.ts     # Legacy deterministic assignment (disabled)
│   │   │   ├── eventListener.ts   # Chain event listener (viem) — engine + glyphs
│   │   │   ├── epochSync.ts       # Epoch cache hydration + event watching
│   │   │   ├── wsManager.ts       # WebSocket session management
│   │   │   └── leaderboard.ts     # Rank calculation & caching
│   │   ├── api/
│   │   │   └── routes.ts          # All REST endpoints
│   │   ├── db/
│   │   │   └── queries.ts       # Prisma query helpers
│   │   └── utils/
│   │       ├── glyphRoll.ts     # Deterministic RNG from tx hash
│   │       └── constants.ts     # Tier definitions, rank thresholds
│   └── test/
│       ├── glyphEngine.test.ts
│       └── glyphRoll.test.ts
│
├── frontend/                    # Next.js app
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── app/
│   │   ├── layout.tsx           # Root layout with providers
│   │   ├── page.tsx             # Main summoning page (hero, mint, portal, sacrifice, collection)
│   │   ├── about/
│   │   │   └── page.tsx         # About/explainer page with smooth-scroll sections
│   │   └── globals.css
│   ├── components/
│   │   ├── providers/
│   │   │   ├── WalletProvider.tsx    # RainbowKit theme + GlyphAvatar
│   │   │   └── WebSocketProvider.tsx
│   │   ├── portal/
│   │   │   ├── Portal.tsx       # SVG portal visualization
│   │   │   └── PortalStages.ts  # 6-stage config data
│   │   ├── sacrifice/
│   │   │   ├── SacrificePanel.tsx
│   │   │   ├── AmountSlider.tsx
│   │   │   └── SacrificeButton.tsx
│   │   ├── claim/
│   │   │   └── ClaimArtifact.tsx     # Post-resolution artifact claim card
│   │   ├── glyph/
│   │   │   ├── GlyphReveal.tsx       # Full-screen gacha reveal (auto, on mint)
│   │   │   ├── GlyphDetailModal.tsx  # Click-to-open detail modal (user-initiated)
│   │   │   ├── ChannelingOverlay.tsx # VRF wait animation
│   │   │   ├── GlyphCollection.tsx
│   │   │   ├── GlyphCard.tsx
│   │   │   └── GlyphTierBadge.tsx
│   │   ├── epoch/
│   │   │   ├── EpochStatus.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── Countdown.tsx
│   │   ├── rank/
│   │   │   ├── CultRankBar.tsx
│   │   │   ├── Leaderboard.tsx
│   │   │   └── RankBadge.tsx
│   │   ├── mint/
│   │   │   ├── MintInterface.tsx
│   │   │   └── PricePreview.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── TabNav.tsx
│   │       └── LoreMessage.tsx
│   ├── hooks/
│   │   ├── useRitualToken.ts    # wagmi hooks for $RITUAL
│   │   ├── useMintingCurve.ts   # Mint/price hooks
│   │   ├── useSummoning.ts      # commitRitual, epoch state
│   │   ├── useGlyphs.ts        # WebSocket glyph subscription
│   │   ├── useEpochProgress.ts  # Real-time progress
│   │   └── useCultRank.ts       # Rank calculation
│   ├── stores/
│   │   ├── glyphStore.ts        # zustand: glyph collection state
│   │   └── uiStore.ts           # zustand: reveal modal, tabs, etc
│   ├── lib/
│   │   ├── contracts.ts         # ABI imports + contract addresses
│   │   ├── chains.ts            # Chain config (mainnet + sepolia)
│   │   └── constants.ts         # Glyph tiers, ranks, lore
│   └── public/
│       └── fonts/
│
└── subgraph/                    # The Graph subgraph
    ├── subgraph.yaml
    ├── schema.graphql
    ├── src/
    │   ├── ritual-token.ts
    │   ├── summoning-engine.ts
    │   └── elder-artifacts.ts
    └── abis/
```

---

## 3. Smart Contracts

### 3.1 RitualToken.sol

Standard ERC-20 with restricted minting and public burn.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RitualToken is ERC20, ERC20Burnable, Ownable {
    address public minter; // MintingCurve contract

    error OnlyMinter();

    modifier onlyMinter() {
        if (msg.sender != minter) revert OnlyMinter();
        _;
    }

    constructor(address _owner) ERC20("Ritual", "RITUAL") Ownable(_owner) {}

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}
```

**Key decisions**:
- No max supply. Minting is controlled by the MintingCurve.
- `ERC20Burnable` gives any holder `burn()` and `burnFrom()`.
- Minter is set once to the MintingCurve address after deployment.

---

### 3.2 MintingCurve.sol

Dynamic minting curve — mints $RITUAL at a linearly increasing price. All ETH (12% fee + 88% treasury) is withdrawable by the owner (multisig). There is no sell-back/redeem mechanism.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IRitualToken.sol";

contract MintingCurve is Ownable, ReentrancyGuard {
    IRitualToken public immutable ritualToken;

    uint256 public constant BASE_PRICE = 0.0001 ether;  // per token (in wei)
    uint256 public constant SCALE_FACTOR = 100_000_000;  // 100M
    uint256 public constant PROTOCOL_FEE_BPS = 1200;     // 12% in basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    event TokensMinted(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 fee);
    event Withdrawn(address indexed to, uint256 amount);

    error MintingCurve__InsufficientPayment();
    error MintingCurve__SlippageExceeded();
    error MintingCurve__WithdrawFailed();
    error MintingCurve__ZeroAddress();
    error MintingCurve__NothingToWithdraw();

    constructor(address _token, address _owner) Ownable(_owner) {
        if (_token == address(0)) revert MintingCurve__ZeroAddress();
        ritualToken = IRitualToken(_token);
    }

    function getCurrentPrice() public view returns (uint256) {
        uint256 supply = ritualToken.totalSupply() / 1e18;
        return BASE_PRICE + (BASE_PRICE * supply / SCALE_FACTOR);
    }

    function getEstimatedCost(uint256 tokenAmount) public view returns (uint256) {
        uint256 supply = ritualToken.totalSupply() / 1e18;
        uint256 tokenAmountWhole = tokenAmount / 1e18;
        uint256 startPrice = BASE_PRICE + (BASE_PRICE * supply / SCALE_FACTOR);
        uint256 endPrice = BASE_PRICE + (BASE_PRICE * (supply + tokenAmountWhole) / SCALE_FACTOR);
        uint256 avgPrice = (startPrice + endPrice) / 2;
        uint256 grossCost = avgPrice * tokenAmount / 1e18;
        return grossCost * BPS_DENOMINATOR / (BPS_DENOMINATOR - PROTOCOL_FEE_BPS);
    }

    /// @dev Uses integral pricing (quadratic formula) for fair token output.
    function mint(uint256 minTokens) external payable nonReentrant {
        if (msg.value == 0) revert MintingCurve__InsufficientPayment();
        uint256 fee = msg.value * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;
        uint256 netEth = msg.value - fee;
        uint256 tokensOut = _calcTokensOut(netEth);
        if (tokensOut < minTokens) revert MintingCurve__SlippageExceeded();
        ritualToken.mint(msg.sender, tokensOut);
        emit TokensMinted(msg.sender, msg.value, tokensOut, fee);
    }

    /// @notice Owner withdraws entire ETH balance (fees + treasury).
    function withdraw(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert MintingCurve__ZeroAddress();
        uint256 amount = address(this).balance;
        if (amount == 0) revert MintingCurve__NothingToWithdraw();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert MintingCurve__WithdrawFailed();
        emit Withdrawn(to, amount);
    }

    function _calcTokensOut(uint256 netEth) internal view returns (uint256);
    function _sqrt(uint256 x) internal pure returns (uint256);
}
```

**Key decisions**:
- Price is a linear function of supply: `BASE_PRICE * (1 + supply / 100M)`.
- `mint()` uses **integral pricing** (quadratic formula) — tokens are priced at the cumulative cost across the supply range, not a spot price. This prevents large mints from underpaying.
- Protocol fee (12%) is deducted from ETH in, remainder determines token output. The fee still affects pricing but is not tracked separately.
- No sell-back mechanism — this is a minting curve, not a bonding curve. All ETH is withdrawable by the multisig via `withdraw()`.
- `minTokens` parameter provides slippage protection.
- `ReentrancyGuard` on both `mint` and `withdraw`.
- `getEstimatedCost` uses trapezoidal approximation (slightly less precise than integral, but close enough for frontend preview).

---

### 3.3 SummoningEngine.sol

Core gameplay contract. Manages epoch lifecycle, burns tokens, triggers VRF glyph minting,
and supports Chainlink Automation for auto-resolution.

**Inherits**: `Ownable`, `ReentrancyGuard`, `AutomationCompatibleInterface`

**Key changes from original spec**:
- Constructor takes 4 params: `(token, artifacts, glyphs, owner)` — `glyphs` is the `IEldritchGlyphs` reference
- `commitRitual()` wraps `glyphs.requestGlyph()` in try/catch so VRF outage doesn't halt sacrifices — emits `GlyphRequestFailed` on failure
- Implements `checkUpkeep()` / `performUpkeep()` for Chainlink Automation auto-resolution
- 71 tests (58 original + 13 Automation)

```solidity
contract SummoningEngine is Ownable, ReentrancyGuard, AutomationCompatibleInterface {

    IRitualToken public immutable ritualToken;
    IElderArtifacts public immutable artifacts;
    IEldritchGlyphs public immutable glyphs;  // On-chain glyph NFT contract

    // ... (epoch state unchanged from original spec) ...

    constructor(address _token, address _artifacts, address _glyphs, address _owner) Ownable(_owner) { ... }

    event GlyphRequestFailed(uint256 indexed epochId, address indexed wallet, bytes reason);

    function commitRitual(uint256 amount) external nonReentrant {
        // ... burns tokens, records contribution ...
        emit RitualSacrifice(id, msg.sender, amount, epoch.totalCommitted);

        // Non-blocking VRF request — sacrifice succeeds even if VRF is down.
        // Amount is passed so the glyph contract can select the tier-weight bracket.
        try glyphs.requestGlyph(msg.sender, id, amount) {} catch (bytes memory reason) {
            emit GlyphRequestFailed(id, msg.sender, reason);
        }
    }

    // ── Chainlink Automation ──
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        // Returns true when active epoch past ritualEnd and not yet resolved
    }

    function performUpkeep(bytes calldata performData) external {
        // Resolves the epoch (validates epochId, not resolved, past ritualEnd)
    }

    function resolveEpoch() external {
        // Original permissionless resolution — still works alongside Automation
        epoch.successful = epoch.totalCommitted >= epoch.threshold;

        emit EpochResolved(id, epoch.successful, epoch.totalCommitted);
    }

    // ── Reward Claims ──

    /// @notice Claim ERC-1155 reward artifact after epoch resolution.
    ///         Contribution is zeroed on claim (prevents double-claim, CEI pattern).
    function claimReward(uint256 epochId) external nonReentrant {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.resolved) revert SummoningEngine__EpochNotResolved();

        uint256 contribution = contributions[epochId][msg.sender];
        if (contribution == 0) revert SummoningEngine__AlreadyClaimed();

        // Zero out before minting (checks-effects-interactions)
        contributions[epochId][msg.sender] = 0;

        uint256 tierId = _calculateTier(epochId, contribution, epoch.successful);
        uint256 tokenId = epochId * 1000 + tierId;
        artifacts.mint(msg.sender, tokenId, 1, "");

        emit RewardClaimed(epochId, msg.sender, tierId);
    }

    // ── Internal ──

    function _calculateTier(
        uint256 epochId,
        uint256 contribution,
        bool successful
    ) internal view returns (uint256) {
        if (!successful) return 0; // Shattered Ritual

        // NOTE: For production, percentile calculation requires sorted
        // contributions or off-chain computation with merkle proof verification.
        // Simplified version below uses average-multiple thresholds.
        Epoch storage epoch = epochs[epochId];
        uint256 avgContribution = epoch.totalCommitted / epoch.participantCount;

        if (contribution >= avgContribution * 10) return 1; // Harbinger (~top 1%)
        if (contribution >= avgContribution * 3)  return 2; // Acolyte   (~top 10%)
        return 3;                                           // Cultist   (everyone else)
    }

    // ── View Functions ──

    function getEpoch(uint256 epochId) external view returns (Epoch memory) {
        return epochs[epochId];
    }

    function getCurrentPhase() external view returns (EpochPhase) {
        if (currentEpochId == 0) return EpochPhase.Inactive;
        Epoch storage epoch = epochs[currentEpochId];
        if (epoch.resolved) return EpochPhase.Resolved;
        if (block.timestamp < epoch.ritualStart) return EpochPhase.Gathering;
        if (block.timestamp < epoch.ritualEnd) return EpochPhase.Ritual;
        return EpochPhase.Resolved; // past ritualEnd, awaiting resolveEpoch() call
    }

    function getContribution(uint256 epochId, address wallet) external view returns (uint256) {
        return contributions[epochId][wallet];
    }

    /// @notice All contributor addresses for a given epoch.
    function getContributors(uint256 epochId) external view returns (address[] memory) {
        return _contributors[epochId];
    }

    /// @notice Compute the suggested threshold for the next epoch based on current outcome.
    ///         Returns 0 if no epoch exists or the current epoch is unresolved.
    function nextThreshold() external view returns (uint256) {
        if (currentEpochId == 0 || !epochs[currentEpochId].resolved) return 0;
        Epoch storage epoch = epochs[currentEpochId];
        if (epoch.successful) {
            return (epoch.threshold * ESCALATION_BPS) / 10_000;
        } else {
            return (epoch.threshold * (10_000 - FAILURE_REDUCTION_BPS)) / 10_000;
        }
    }
}
```

**Key decisions**:
- `commitRitual` burns tokens via `burnFrom` (requires user to `approve` SummoningEngine first).
- `RitualSacrifice` event is the trigger for the Glyph Engine backend.
- 30-second cooldown per wallet prevents glyph farming via rapid small burns.
- Tier calculation is simplified for V1. Production should use merkle proofs from off-chain percentile calculation.
- `resolveEpoch` is permissionless — anyone can call it after the ritual window closes. Chainlink Automation calls it automatically.
- All custom errors are prefixed with `SummoningEngine__` for clarity in multi-contract traces.
- `startEpoch` guards against starting a new epoch before the prior one is resolved.
- `claimReward` zeros contribution before minting (checks-effects-interactions) and uses `AlreadyClaimed` for zero-contribution rejections.
- `getContributors(epochId)` returns the full contributor address list for off-chain use.
- `nextThreshold()` surfaces the escalation/reduction math so the owner doesn't need to compute it manually.

---

### 3.4 ElderArtifacts.sol

ERC-1155 multi-token for all epoch rewards.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ElderArtifacts is ERC1155, Ownable {
    address public summoningEngine;

    string public name = "Elder Artifacts";
    string public symbol = "ELDER";

    // tokenId => total minted
    mapping(uint256 => uint256) public totalMinted;

    error OnlyEngine();

    modifier onlyEngine() {
        if (msg.sender != summoningEngine) revert OnlyEngine();
        _;
    }

    constructor(
        string memory _uri,
        address _owner
    ) ERC1155(_uri) Ownable(_owner) {}

    function setEngine(address _engine) external onlyOwner {
        summoningEngine = _engine;
    }

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data
    ) external onlyEngine {
        totalMinted[tokenId] += amount;
        _mint(to, tokenId, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external onlyEngine {
        for (uint256 i = 0; i < ids.length; i++) {
            totalMinted[ids[i]] += amounts[i];
        }
        _mintBatch(to, ids, amounts, data);
    }

    /// @notice Dynamic metadata URI. Points to backend API.
    /// @dev Override to serve per-token metadata from the API.
    function uri(uint256 tokenId) public pure override returns (string memory) {
        // Returns: https://api.thesummoning.xyz/metadata/{tokenId}
        // The backend generates JSON dynamically based on epoch + tier
        return string(
            abi.encodePacked(
                "https://api.thesummoning.xyz/metadata/",
                _toString(tokenId)
            )
        );
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
```

**Token ID encoding**: `epochId * 1000 + tierId`
- `1000` = Epoch 1, Shattered Ritual (failed)
- `1001` = Epoch 1, Harbinger
- `1002` = Epoch 1, Acolyte
- `1003` = Epoch 1, Cultist
- `2001` = Epoch 2, Harbinger (etc.)

---

### 3.5 EldritchGlyphs.sol

On-chain tradeable glyph NFTs. Each sacrifice mints a unique ERC-1155 glyph via Chainlink VRF.

**Inherits**: `ERC1155`, `VRFConsumerBaseV2Plus`, `ERC2981`

**Key design decisions**:
- **Tradeable, not soulbound** — enables secondary market and late-joiner participation
- **EIP-2981 royalties** — 5% on secondary sales to treasury
- **VRF for fairness** — provably random tier assignment with sacrifice-amount-weighted brackets (see PRD §5.1 for the table)
- **Tier weight bracketing** — `_bracket(amount)` selects one of 5 weight rows (1/10/100/1000/10000 RITUAL boundaries); larger sacrifices weight toward rarer tiers without locking small players out of any tier
- **Amount stored with the request** — VRF callback is async, so `pendingGlyphs[requestId].amount` is captured at request time and read back in `fulfillRandomWords` to pick the bracket
- **Double-fulfill guard** — `fulfillRandomWords` checks `pending.fulfilled` flag before minting, preventing duplicate glyphs from VRF coordinator bugs
- **glyphCount tracking** — `_update()` override tracks per-wallet count on mint/transfer/burn, so cult rank reflects current ownership
- **Separate from SummoningEngine** — clean separation of concerns; engine calls `requestGlyph()`, VRF callback mints

```solidity
contract EldritchGlyphs is ERC1155, VRFConsumerBaseV2Plus, ERC2981 {
    function requestGlyph(address recipient, uint256 epochId, uint256 amount) external onlyEngine returns (uint256 requestId);
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        // Reads pending.amount → _bracket(amount) → _tierWeights → cumulative roll
    }
    function _bracket(uint256 amount) internal pure returns (uint8);
    function _tierWeights(uint8 bracket) internal pure returns (uint16[5] memory);
    function _deriveTier(uint64 bits, uint256 amount) internal pure returns (uint8);
    function getGlyphData(uint256 tokenId) external view returns (GlyphData memory);
    function glyphCount(address wallet) external view returns (uint256);
    function totalMinted() external view returns (uint256);
}
```

**37 tests** covering: VRF fulfillment, double-fulfill revert, tier derivation boundaries, per-bracket fuzz distributions (1,000 samples × 5 brackets, ±5% tolerance), royalty info, glyphCount tracking on transfers, supportsInterface (ERC1155 + ERC2981).

### 3.6 Contract Deployment Order

Deployment must follow this exact sequence:

```
1. Deploy RitualToken(ownerMultisig)
2. Deploy MintingCurve(ritualTokenAddress, ownerMultisig)
3. Deploy ElderArtifacts(metadataBaseUri, ownerMultisig)
4. Deploy EldritchGlyphs(vrfCoordinator, subscriptionId, keyHash, callbackGasLimit, confirmations, baseURI, royaltyReceiver)
5. Deploy SummoningEngine(ritualTokenAddress, elderArtifactsAddress, eldritchGlyphsAddress, ownerMultisig)
6. Call RitualToken.setMinter(mintingCurveAddress)
7. Call ElderArtifacts.setEngine(summoningEngineAddress)
8. Call EldritchGlyphs.setEngine(summoningEngineAddress)
9. Add EldritchGlyphs as VRF consumer on Chainlink subscription
10. Register SummoningEngine as Chainlink Automation upkeep (for auto-resolution)
11. Users must call RitualToken.approve(summoningEngineAddress, MAX_UINT) before committing
```

---

## 4. Backend Services

### 4.1 Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Glyph {
  id              String   @id @default(cuid())
  walletAddr      String   @db.VarChar(42)
  epochId         Int
  txHash          String   @db.VarChar(66) @unique // VRF fulfillment tx hash
  sacrificeTxHash String?  @db.VarChar(66)          // Original sacrifice tx hash
  tokenId         Int?     @unique                  // On-chain ERC-1155 token ID
  requestId       String?  @db.VarChar(78)          // VRF request ID
  status          String   @default("confirmed")    // "pending" | "confirmed"
  tierName        String   // Whisper, Echo, Tremor, Rupture, Breach
  tierIndex       Int      // 0-4
  runeIndex       Int      @default(0) // 0-29, index into RUNE_SHAPES
  loreIndex       Int      @default(0) // 0-9, index into LORE_MESSAGES
  rune            String   // Unicode rune symbol (derived from runeIndex)
  lore            String   // Lore message text (derived from loreIndex)
  amount          String   // $RITUAL burned (stored as string for BigInt)
  blockNumber     Int
  createdAt       DateTime @default(now())

  @@index([walletAddr])
  @@index([epochId])
  @@index([tierIndex])
  @@index([status])
}

model CultRank {
  walletAddr  String   @id @db.VarChar(42)
  glyphCount  Int      @default(0)
  rankName    String   @default("Uninitiated")
  rankIndex   Int      @default(0)
  updatedAt   DateTime @updatedAt

  @@index([glyphCount(sort: Desc)])
}

model EpochCache {
  epochId         Int      @id
  oldOneId        Int
  threshold       String
  totalCommitted  String
  phase           String   // Gathering, Ritual, Resolved
  successful      Boolean  @default(false)
  participantCount Int     @default(0)
  updatedAt       DateTime @updatedAt
}
```

---

### 4.2 Glyph Mint Handler (Event-Driven VRF Indexer)

Glyphs are now **minted on-chain** by the EldritchGlyphs contract via Chainlink VRF.
The backend is an event indexer and real-time delivery layer — it no longer assigns tiers.

**Flow**: `commitRitual()` → SummoningEngine calls `glyphs.requestGlyph()` → Chainlink VRF
callback mints ERC-1155 → backend indexes `GlyphMinted` event → persists + pushes via WebSocket.

```typescript
// backend/src/services/glyphMintHandler.ts

type GlyphRequestedEvent = {
  requestId: bigint;
  recipient: string;
  epochId: number;
};

type GlyphMintedEvent = {
  tokenId: number;
  recipient: string;
  tier: number;       // 0-4, from VRF
  runeIndex: number;  // 0-29, from VRF
  loreIndex: number;  // 0-9, from VRF
  epochId: number;
  txHash: string;
  blockNumber: number;
};

// GlyphRequested → push "glyph_pending" (channeling UX during VRF wait)
async function handleGlyphRequested(event: GlyphRequestedEvent): Promise<void> {
  wsManager.sendToWallet(wallet, {
    type: "glyph_pending",
    data: { requestId, epochId, timestamp: Date.now() },
  });
}

// GlyphMinted → persist to DB, update cult rank, push "glyph_reveal"
async function handleGlyphMinted(event: GlyphMintedEvent): Promise<void> {
  // Idempotency check by tokenId
  // Upsert: if pending record exists (by requestId), update it; otherwise create new
  // Tier/rune/lore resolved from on-chain indices via shared constants
  // Calls updateCultRank(wallet) after persist
  // Pushes glyph_reveal via wsManager
}
```

**Legacy**: `glyphRoll.ts` and `glyphEngine.ts` still exist for reference but are no longer
called in the active pipeline. The `RitualSacrifice` event listener now only broadcasts
`epoch_update` progress via WebSocket — it does not create glyphs.

---

### 4.3 Epoch Sync Service

Keeps the `EpochCache` database table in sync with on-chain state. Without this, `/api/epochs/current` would always return null because nothing writes to the table.

```typescript
// backend/src/services/epochSync.ts

import { createPublicClient, http, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();
const client = createPublicClient({ chain: sepolia, transport: http(config.RPC_URL) });

async function syncCurrentEpoch() {
  // Read currentEpochId + getEpoch() from chain, upsert EpochCache
}

export function startEpochSync(intervalMs = 60_000): void {
  syncCurrentEpoch();                                          // immediate sync on startup
  client.watchEvent({ event: parseAbiItem('event EpochStarted(...)'), onLogs: ... });
  client.watchEvent({ event: parseAbiItem('event EpochResolved(...)'), onLogs: ... });
  setInterval(syncCurrentEpoch, intervalMs);                   // poll every 60s as backstop
}
```

**Key decisions**:
- Runs on startup to hydrate the DB from current chain state before the first API request.
- `watchEvent` handles real-time updates; the 60s poll is a backstop for any missed events.
- Called alongside `startEventListener()` in `index.ts`.

---

### 4.4 Event Listener

Listens for on-chain `RitualSacrifice` events and feeds them to the Glyph Engine.

```typescript
// backend/src/services/eventListener.ts

import { createPublicClient, http, parseAbiItem } from 'viem';
import { mainnet } from 'viem/chains';
import { processRitualSacrifice } from './glyphEngine';
import { config } from '../config';

const client = createPublicClient({
  chain: mainnet,
  transport: http(config.RPC_URL),
});

const SUMMONING_ENGINE_ADDRESS = config.SUMMONING_ENGINE_ADDRESS as `0x${string}`;

const ritualSacrificeEvent = parseAbiItem(
  'event RitualSacrifice(uint256 indexed epochId, address indexed wallet, uint256 amount, uint256 totalCommitted)'
);

export function startEventListener() {
  console.log('Starting event listener for RitualSacrifice events...');

  client.watchEvent({
    address: SUMMONING_ENGINE_ADDRESS,
    event: ritualSacrificeEvent,
    onLogs: async (logs) => {
      for (const log of logs) {
        const { epochId, wallet, amount } = log.args as {
          epochId: bigint;
          wallet: string;
          amount: bigint;
        };

        await processRitualSacrifice({
          epochId: Number(epochId),
          wallet,
          amount,
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
        });
      }
    },
  });
}
```

---

### 4.5 WebSocket Manager

Manages per-wallet WebSocket connections for real-time glyph delivery.

```typescript
// backend/src/services/wsManager.ts

import { WebSocketServer, WebSocket } from 'ws';

class WSManager {
  private connections = new Map<string, Set<WebSocket>>();

  attach(wss: WebSocketServer) {
    wss.on('connection', (ws, req) => {
      // Client sends wallet address on connect
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'auth' && msg.wallet) {
            const wallet = msg.wallet.toLowerCase();
            if (!this.connections.has(wallet)) {
              this.connections.set(wallet, new Set());
            }
            this.connections.get(wallet)!.add(ws);

            ws.on('close', () => {
              this.connections.get(wallet)?.delete(ws);
              if (this.connections.get(wallet)?.size === 0) {
                this.connections.delete(wallet);
              }
            });
          }
        } catch {}
      });
    });
  }

  sendToWallet(wallet: string, payload: object) {
    const sockets = this.connections.get(wallet.toLowerCase());
    if (!sockets) return;

    const msg = JSON.stringify(payload);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  broadcast(payload: object) {
    const msg = JSON.stringify(payload);
    for (const sockets of this.connections.values()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg);
      }
    }
  }
}

export const wsManager = new WSManager();
```

---

### 4.6 REST API Endpoints

```
GET  /api/glyphs/:wallet           → Confirmed glyph collection for a wallet (status: "confirmed" only)
GET  /api/glyphs/:wallet/pending   → Pending VRF glyph requests (status: "pending")
GET  /api/glyphs/:wallet/summary   → Tier counts + rank for a wallet
GET  /api/metadata/artifact/:tokenId → ERC-1155 metadata for ElderArtifacts (epoch rewards)
GET  /api/metadata/glyph/:tokenId  → ERC-1155 metadata for EldritchGlyphs (on-chain glyphs)
GET  /api/metadata/:tokenId        → Legacy alias for /api/metadata/artifact/:tokenId
GET  /api/epochs/current           → Current epoch state + progress
GET  /api/epochs/:epochId          → Historical epoch data
GET  /api/leaderboard              → Top contributors + rank holders
GET  /api/leaderboard/glyphs       → Top glyph collectors
GET  /health                       → Health check
```

**Artifact metadata endpoint** (`/api/metadata/artifact/:tokenId`):
- Token ID decoded as `epochId * 1000 + tierId`
- Old One name resolved dynamically from `EpochCache.oldOneId` → `OLD_ONES` constant
  (defined in `backend/src/utils/constants.ts`), with fallback to Cthulhu
- Response format (ERC-1155 standard):

```json
{
  "name": "Fragment of Cthulhu — Harbinger",
  "description": "A shard of the Dreaming One, pulled from beyond the veil during Epoch 1.",
  "image": "https://api.thesummoning.xyz/images/1001.png",
  "attributes": [
    { "trait_type": "Epoch", "value": 1 },
    { "trait_type": "Old One", "value": "Cthulhu" },
    { "trait_type": "Tier", "value": "Harbinger" },
    { "trait_type": "Tier ID", "value": 1 }
  ]
}
```

**Glyph metadata endpoint** (`/api/metadata/glyph/:tokenId`):
- Looks up glyph record by `tokenId` in Prisma
- Returns tier, rune, lore resolved from on-chain indices via shared constants
- Used by OpenSea and other marketplaces for EldritchGlyphs NFT display

```json
{
  "name": "Eldritch Glyph #42 — Tremor",
  "description": "The geometry of space bends.",
  "image": "https://api.thesummoning.xyz/images/glyphs/42.png",
  "attributes": [
    { "trait_type": "Tier", "value": "Tremor" },
    { "trait_type": "Rune", "value": "ᚦ" },
    { "trait_type": "Epoch", "value": 1 }
  ]
}
```

---

### 4.7 Cult Rank Calculation

```typescript
// backend/src/services/leaderboard.ts

const CULT_RANKS = [
  { name: 'Uninitiated',         minGlyphs: 0,  index: 0 },
  { name: 'Whisperer',           minGlyphs: 3,  index: 1 },
  { name: 'Echo Walker',         minGlyphs: 8,  index: 2 },
  { name: 'Void Touched',        minGlyphs: 15, index: 3 },
  { name: 'Rift Keeper',         minGlyphs: 25, index: 4 },
  { name: 'Herald of the Breach', minGlyphs: 40, index: 5 },
];

export async function updateCultRank(wallet: string) {
  const count = await prisma.glyph.count({
    where: { walletAddr: wallet },
  });

  let rank = CULT_RANKS[0];
  for (const r of CULT_RANKS) {
    if (count >= r.minGlyphs) rank = r;
  }

  await prisma.cultRank.upsert({
    where: { walletAddr: wallet },
    update: {
      glyphCount: count,
      rankName: rank.name,
      rankIndex: rank.index,
    },
    create: {
      walletAddr: wallet,
      glyphCount: count,
      rankName: rank.name,
      rankIndex: rank.index,
    },
  });

  return rank;
}
```

---

## 5. Frontend Architecture

### 5.1 State Management Strategy

| State Type | Tool | Examples |
|-----------|------|---------|
| Server/chain state | wagmi + @tanstack/react-query | Token balance, epoch data, contract reads, on-chain glyphCount |
| WebSocket events | zustand (glyphStore) | Incoming glyph reveals, collection, pending VRF requests |
| UI state | zustand (uiStore) | Active tab, reveal modal open, animation phase, portal shake |
| Form state | React useState | Sacrifice amount input value |

### 5.2 Key Component Specifications

#### Portal.tsx
- SVG-based, renders in a 220x220 viewBox
- Reads `progress` (0-100) from epoch data
- 6 visual stages based on progress thresholds (see Section 5.4 of project spec)
- Animated: rotating rune circles (CSS `animateTransform`), pulsing glow, tentacle emergence
- Portal shakes on sacrifice (CSS keyframe, triggered by state)

#### GlyphReveal.tsx
- Full-screen overlay (fixed positioning, backdrop blur)
- 4-phase animation sequence controlled by `setTimeout` chain with **rarity-scaled timing**:
  - Phase 0 (0ms): Modal appears, scale(0.5), opacity 0
  - Phase 1 (100ms): Scale to 1, opacity 1 — spinning channeling symbol (faster + tier-colored for rare+)
  - Phase 2 (variable): Glyph materializes — rune + color reveal tier. ~1000ms common, ~1720ms Tremor, ~2200ms Rupture/Breach
  - Phase 3 (variable): Tier name, lore text, "tap to continue" fade in. ~2000ms common, ~3440ms Tremor, ~4400ms Rupture/Breach
- `suspenseMultiplier`: 1.0x for common, 2.2x for Tremor, 3.0x for Rupture/Breach
- Framer Motion `AnimatePresence` for enter/exit
- Tier-specific effects: Tremor+ get expanded glow radius, faster spinner with tier glow. Rupture/Breach get screen shake

#### SacrificePanel.tsx
- Amount input field with quick-select buttons: 100, 500, 1000 $RITUAL (uses `btn-quick-active`/`btn-quick-inactive` classes)
- Checks allowance → prompts `approve()` if needed → calls `commitRitual(amount)`
- Button states: "APPROVE & SACRIFICE" / "CONFIRM IN WALLET..." / "SACRIFICING..." / "SACRIFICE ACCEPTED" / "WAIT Xs" (cooldown)
- Reads `lastSacrificeTime(wallet)` from SummoningEngine to preempt the on-chain `SACRIFICE_COOLDOWN` (30s). When the wallet is inside the cooldown window, the button is disabled and shows a live countdown derived from a 1s-tick `setInterval`. Prevents users from signing a tx that will revert.
- Only visible during Ritual phase. During Gathering phase, `page.tsx` shows guidance text ("Sacrifice opens soon"); during Resolved phase it's replaced by `ClaimArtifact`.
- After success, shows a glowing container: "The void accepts your offering" + "VRF requested — channeling your glyph..." while ChannelingOverlay activates

#### ClaimArtifact.tsx
- Renders only when `epoch.phase === "Resolved"` and the connected wallet has a non-zero `getContribution(epochId, wallet)` from SummoningEngine.
- Mirrors the contract's `_calculateTier` formula client-side to predict the tier the user will receive: `avg = totalCommitted / participantCount`; `contribution >= avg * 10` → Harbinger (1), `>= avg * 3` → Acolyte (2), else Cultist (3); failed epochs always → Shattered Ritual (0).
- Calls `useClaimReward(epochId)` from `useSummoning.ts`. Progresses through "Confirm in wallet..." → "Claiming..." → success state.
- Success state is sticky for the session: shows tier name, flavor copy, ERC-1155 token ID (`epochId * 1000 + tierId`). On reload, the on-chain contribution reads as 0 (zeroed by the contract on claim) and the card hides naturally.
- Tier coloring: Shattered #6B7280, Harbinger #F59E0B, Acolyte #A855F7, Cultist #4A9EFF — matched to in-game palette. Card border, glow, and CTA gradient all derive from tier color.
- Mounted in `page.tsx` in the same column slot as `SacrificePanel`, switched by `epoch.phase`.

#### GlyphCollection.tsx
- CSS Grid: `repeat(auto-fill, minmax(44px, 1fr))`
- Each cell is a `<button>` that calls `setSelectedGlyph(glyph)` from the glyphStore — opens the `GlyphDetailModal`.
- Hover scales the cell (1.10x) and brightens it (1.25x) to signal clickability; title attribute shows tier name + rune + "click for details" hint
- Newest glyph gets `animate-glyph-enter` (scale 0.5→1, cubic-bezier bounce), a "NEW" badge in tier color, and double-intensity glow

#### GlyphDetailModal.tsx
- Reads `selectedGlyph` from glyphStore. Mounted globally in `app/page.tsx` alongside `GlyphReveal` and `ChannelingOverlay`.
- AnimatePresence-driven entrance/exit. Dismissed via Escape key, backdrop click, or × button.
- Layout: large rune render (128–144px) with tier gradient bg + tier-color glow ring, tier heading in tier color, rarity label ("Common" / "Uncommon" / "Rare" / "Legendary" / "Mythic") + baseline drop rate, full lore quote in serif italic, stats grid (rune index, epoch + Old One, token ID), and external link buttons to OpenSea + Etherscan.
- Marketplace links built from `ELDRITCH_GLYPHS_ADDRESS` and `isMainnet` flag — Sepolia uses `testnets.opensea.io` / `sepolia.etherscan.io`, mainnet uses primary domains.
- Distinct from `GlyphReveal` — that fires on a fresh mint (gacha animation), this fires on user click (collection inspection).

#### EpochStatus.tsx
- Reads epoch data directly from SummoningEngine contract via `useEpochProgress` hook
- Shows: Old One name/subtitle, phase badge (color-coded), live countdown
- Includes `ProgressBar.tsx` — purple→red gradient bar with `COLLECTIVE PROGRESS` label
- Includes `Countdown.tsx` — updates every second, formats as `Xd Xh Xm` or `HH:MM:SS`
- Phase-dependent display: Gathering shows "Ritual begins in", Ritual shows "Ritual ends in", Resolved shows success/failure badge
- Shows portal stage name and participant count

#### ChannelingOverlay.tsx
- Compact floating card in the bottom-right corner, shown while waiting for Chainlink VRF callback (~30-60s)
- Displays spinning channeling symbol + rotating lore messages in a horizontal layout with frosted glass background
- Does NOT block the viewport — users can continue interacting with the app (previously was a full-screen dark overlay that made the app appear frozen)
- Visibility controlled by `useGlyphStore().pendingGlyphs` — shows when array is non-empty
- Dismissed automatically when `glyph_reveal` WebSocket message arrives

#### CultRankBar.tsx
- Uses `useCultRank` hook — reads `glyphCount(address)` from EldritchGlyphs contract on-chain
- Falls back to glyphStore count if contract not configured
- On-chain count includes purchased/transferred glyphs, not just earned ones
- Segmented progress bar — one segment per rank tier, filled proportionally
- Color-coded rank name, "X glyphs to [Next Rank]" label

#### Header.tsx
- Title "THE SUMMONING" with double-layer purple text-shadow glow
- Dynamic subtitle from `useEpochProgress()`: "Epoch {id} — {subtitle}", fallback "The veil grows thin..."
- "About" nav link (inline on desktop via `hidden sm:block`, separate row on mobile via `sm:hidden`)
- $RITUAL balance display + RainbowKit ConnectButton

#### page.tsx (Home)
- Hero/onboarding section for disconnected users: pitch text with colored keywords + "How it works" link to `/about`
- During Gathering phase with wallet connected: shows guidance card ("Sacrifice opens soon") instead of hidden SacrificePanel
- MintInterface success state auto-resets after 4s with glowing feedback container and green button

#### about/page.tsx
- Mythos-flavored explainer with 6 smooth-scroll sections using Framer Motion `whileInView` reveals
- Sections: Hero, Pitch ("Ethereum used to be fun"), 4-step ritual walkthrough, interactive glyph tier grid (from `GLYPH_TIERS` constant), cult rank table (from `CULT_RANKS` constant), "Why" philosophy, fully on-chain feature grid, "Enter the Ritual" CTA
- Same design system: dark background, Crimson Text headings, ritual purple accents
- Back navigation: "← Back to the Ritual" link

#### Leaderboard.tsx
- Fetches from `/api/leaderboard` on mount
- Shows position, truncated wallet address, cult rank name (color-coded), glyph count
- Highlights the connected wallet's row with a subtle border + background tint
- Empty state: "No sacrifices yet. Be the first."

### 5.3 Wallet Integration Flow

```
1. User clicks "Connect Wallet"
2. wagmi connector modal (MetaMask, WalletConnect, Coinbase)
3. On connect: read $RITUAL balance, read current epoch, check approval
4. If no approval for SummoningEngine: show "Approve $RITUAL" button first
5. On approval: enable sacrifice interface
6. On sacrifice tx submitted: show "Channeling..." state
7. On tx confirmed: WebSocket delivers glyph → trigger GlyphReveal overlay
```

**RainbowKit theming (`WalletProvider.tsx`)**: The default RainbowKit chrome is overridden with a custom theme matching The Summoning palette. Built on `darkTheme()` with `accentColor: #7c3aed`, `fontStack: "system"`, and the full color object overridden — modal background `#0d0d15`, modal border `#1e1e2e`, modal text `#e2e8f0`, profile action hover `#2d1b4e` (ritual-dark), connection indicator `#7c3aed`. Modal font is set to Crimson Text for visual continuity with the app.

**Custom avatar (`GlyphAvatar`)**: Replaces RainbowKit's default emoji avatar with a deterministic glyph sigil derived from the wallet address — first hex byte selects tier color (Whisper / Echo / Tremor / Rupture / Breach from `GLYPH_TIERS`), second byte selects rune from `RUNE_SHAPES`. Rendered as a circular cell with the tier's gradient background, border, glow, and dropshadow — visually consistent with in-app glyph cells. Falls through to ENS avatar image when one is set.

### 5.4 WebSocket Client + Glyph Hydration

The real-time glyph pipeline is split into two pieces:

**`WebSocketProvider.tsx`** (context provider, mounted in `layout.tsx`):
- Manages the WS connection lifecycle per wallet address.
- On `onopen`: sends `{ type: 'auth', wallet }`, fetches `/api/glyphs/:wallet` via REST to catch missed glyphs, and fetches `/api/glyphs/:wallet/pending` to restore channeling state.
- On `glyph_pending` message: adds to `pendingGlyphs` in glyphStore (triggers ChannelingOverlay).
- On `glyph_reveal` message: removes from `pendingGlyphs`, calls `setRevealGlyph(msg.data)` to trigger reveal modal.
- Auto-reconnects after 3 seconds on close.
- Closes connection on wallet disconnect.

**`useGlyphs.ts`** (hook, called in `page.tsx`):
- Watches the connected wallet address; fetches `/api/glyphs/:wallet` on connect/change.
- Calls `setGlyphs(data.glyphs)` to populate the store for initial page load.
- Returns `{ glyphs, isLoading, error }` for UI feedback.

```
Reconnect flow:
  WS disconnects → 3s delay → reconnect → onopen:
    1. Send auth
    2. Fetch REST /api/glyphs/:wallet → setGlyphs (catches any missed glyphs)
    3. Backend resumes sending new glyph_reveal messages
```

**Environment variables**:
- `NEXT_PUBLIC_WS_URL` — WebSocket URL (default: `ws://localhost:3001/ws`)
- `NEXT_PUBLIC_API_URL` — REST API base URL (default: `http://localhost:3001`)

### 5.5 Contract Hook Pattern

```typescript
// frontend/hooks/useSummoning.ts

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { SUMMONING_ENGINE_ABI, SUMMONING_ENGINE_ADDRESS } from '../lib/contracts';

export function useCommitRitual() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const commitRitual = (amount: bigint) => {
    writeContract({
      address: SUMMONING_ENGINE_ADDRESS,
      abi: SUMMONING_ENGINE_ABI,
      functionName: 'commitRitual',
      args: [amount],
    });
  };

  return {
    commitRitual,
    isPending,      // tx submitted, waiting for wallet
    isConfirming,   // tx in mempool, waiting for block
    isSuccess,      // tx confirmed — glyph incoming via WS
  };
}
```

### 5.6 Epoch Progress Hook

`useEpochProgress` reads epoch state **directly from the SummoningEngine contract** via
wagmi's `useReadContract`, not from the backend REST API. This is a deliberate design choice:

- **Why not REST?** The backend's `/api/epochs/current` is useful for the metadata API and
  external consumers, but the frontend benefits from reading the authoritative on-chain state
  directly. This eliminates a dependency on the backend for the core gameplay UI.
- **Polling**: `currentEpochId` polls every 30s, `getEpoch` and `getCurrentPhase` poll every 15s.
- **Chain pinning**: All reads use `chainId: sepolia.id` so they work even before wallet connect.
- **Returns**: `{ epoch: EpochData | null, isLoading, error }` — EpochData includes progress
  (0-100), timing for countdowns, Old One identity, and current portal stage.

---

## 6. Integration Flows

### 6.1 Sacrifice → Glyph Reveal (End-to-End)

```
User clicks "SACRIFICE" in SacrificePanel
   │
   ├─→ Frontend: Check allowance (wagmi readContract)
   │     └─ If not approved: prompt approve() tx first
   │
   ├─→ Frontend: Call commitRitual(amount) via wagmi writeContract
   │     └─ UI state: "SACRIFICING..."
   │
   ├─→ Ethereum: Transaction included in block
   │     ├─ RitualToken.burnFrom() executes
   │     ├─ SummoningEngine emits RitualSacrifice event
   │     └─ SummoningEngine calls glyphs.requestGlyph(wallet, epochId)
   │         └─ EldritchGlyphs requests Chainlink VRF → emits GlyphRequested
   │
   ├─→ Backend: Event Listener picks up GlyphRequested
   │     └─ Pushes "glyph_pending" via WebSocket
   │         └─ Frontend: ChannelingOverlay appears ("AWAITING VRF CALLBACK...")
   │
   ├─→ Chainlink VRF: Off-chain node generates random word, calls fulfillRandomWords()
   │     └─ EldritchGlyphs: Mints ERC-1155 glyph NFT → emits GlyphMinted
   │
   ├─→ Backend: Event Listener picks up GlyphMinted
   │     ├─ Upserts glyph record in Prisma (status: "confirmed")
   │     ├─ updateCultRank(wallet)
   │     └─ Pushes "glyph_reveal" via WebSocket
   │
   ├─→ Frontend: WebSocket receives 'glyph_reveal' message
   │     ├─ Removes from pendingGlyphs → ChannelingOverlay dismissed
   │     └─ zustand: setRevealGlyph(data) → GlyphReveal 4-phase animation
   │
   └─→ User taps to dismiss
         └─ Glyph added to collection grid (now an on-chain NFT)
         └─ Cult rank bar updates (reads on-chain glyphCount)
```

**Target latency**: Block confirmation (~12s) + VRF callback (~30-60s) + event indexing (~1s) + WebSocket push (~0.1s) = **~45-75 seconds** from button click to glyph reveal start. The ChannelingOverlay fills this VRF wait with thematic lore text and animations.

### 6.2 Epoch Lifecycle Flow

```
Owner calls startEpoch(oldOneId, threshold)
   │
   ├─→ Gathering Phase (48h)
   │     ├─ Frontend: Shows countdown to Ritual phase
   │     ├─ Users: Mint $RITUAL via MintingCurve
   │     └─ Portal: Dormant state, ambient rotation only
   │
   ├─→ Ritual Phase (24h)  [block.timestamp >= ritualStart]
   │     ├─ Frontend: Sacrifice interface becomes active
   │     ├─ Users: Call commitRitual() → get glyphs
   │     ├─ Portal: Evolves through stages based on totalCommitted/threshold
   │     └─ Backend: Broadcasts epoch_update via WebSocket on each sacrifice
   │
   ├─→ Resolution  [block.timestamp >= ritualEnd]
   │     ├─ Chainlink Automation calls performUpkeep() automatically
   │     │   (checkUpkeep returns true when ritualEnd passed + not resolved)
   │     │   Falls back to permissionless resolveEpoch() if Automation fails
   │     ├─ Contract: Compares totalCommitted vs threshold
   │     │   ├─ Success: epoch.successful = true
   │     │   └─ Failure: epoch.successful = false
   │     └─ Frontend: Shows result screen (breach animation or failure)
   │
   └─→ Claim Phase
         ├─ Users call claimReward(epochId)
         │   └─ ERC-1155 artifact minted based on contribution tier
         └─ Owner starts next epoch (threshold adjusted by 1.3x or 0.8x)
```

---

## 7. Testing Strategy

### 7.1 Smart Contract Tests (Foundry)

```
contracts/test/
├── RitualToken.t.sol        # Mint, burn, access control
├── MintingCurve.t.sol       # Price curve math, withdrawal, slippage
├── SummoningEngine.t.sol    # Full epoch lifecycle, contributions, rewards, Automation (71 tests)
├── ElderArtifacts.t.sol     # Minting, token IDs, URI generation (36 tests)
├── EldritchGlyphs.t.sol     # VRF flow, tier distribution, royalties, transfers (85 tests)
└── Integration.t.sol        # Full flow: mint → sacrifice → resolve → claim
```

**Total: 183 tests across 5 suites** (as of Step 32). All pass with 10,000 fuzz runs.

**Coverage targets**:
- 100% branch coverage on MintingCurve (holds treasury)
- 100% branch coverage on SummoningEngine (core gameplay + Automation)
- 100% branch coverage on EldritchGlyphs (VRF + minting + royalties)
- Fuzz testing on MintingCurve.mint() for edge cases in math
- Fuzz testing on EldritchGlyphs: 10,000 random VRF seeds → tier distribution within ±2% of 50/28/15/6/1
- Invariant: `contract.balance == total ETH received - total withdrawn`
- Invariant: `totalBurned <= totalMinted` for RitualToken

**Key test scenarios**:
- Mint at various supply levels, verify price increases correctly
- Sacrifice below minimum reverts
- Sacrifice during wrong phase reverts
- Cooldown enforcement (two sacrifices within 30s)
- Epoch resolution after threshold met → successful
- Epoch resolution below threshold → failure, next threshold reduced
- Claim reward → correct tier assignment and ERC-1155 token ID
- Double claim reverts
- Fee withdrawal by owner → correct ETH amount
- Chainlink Automation: checkUpkeep returns correct states for each phase, performUpkeep resolves epoch
- EldritchGlyphs: VRF request → callback → mint, only engine can request, royaltyInfo returns 5%
- EldritchGlyphs: transfer updates glyphCount for both sender and receiver

### 7.2 Backend Tests

```
backend/test/
├── glyphRoll.test.ts        # Deterministic: same txHash → same glyph always
├── glyphEngine.test.ts      # Idempotency: processing same event twice
└── leaderboard.test.ts      # Rank transitions at threshold boundaries
```

**Critical test**: `rollGlyphFromTxHash` must be deterministic. Test with 10,000 random hashes, verify distribution approximately matches target rates (50/28/15/6/1 ± 2%).

### 7.3 Frontend Tests

- Component rendering: Portal renders at each stage (0%, 25%, 50%, 75%, 95%)
- GlyphReveal: Phase transitions fire at correct timing
- Wallet connection: Mock wagmi, verify approval flow
- E2E: Use Anvil (local Foundry node) + test frontend against local contracts

---

## 8. Deployment & DevOps

### 8.1 Smart Contracts

```bash
# Local development
anvil                                          # Start local node
forge script script/Deploy.s.sol --fork-url http://localhost:8545 --broadcast

# Testnet (Sepolia)
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_KEY \
  --broadcast --verify \
  --etherscan-api-key $ETHERSCAN_KEY

# Mainnet (use hardware wallet / multisig)
forge script script/Deploy.s.sol \
  --rpc-url $MAINNET_RPC_URL \
  --ledger \
  --broadcast --verify \
  --etherscan-api-key $ETHERSCAN_KEY
```

### 8.2 Backend

- **Hosting**: Railway or Render (Node.js + PostgreSQL managed)
- **Process**: Single process runs Express HTTP + WebSocket + event listener
- **Database**: Railway managed PostgreSQL (auto-backups)
- **Monitoring**: Health check endpoint polled by uptime monitor
- **Scaling**: Single instance is sufficient for V1 (<10K concurrent WS connections)

### 8.3 Frontend

- **Hosting**: Vercel (Next.js native)
- **Domain**: thesummoning.xyz → Vercel, thesummoning.eth → ENS content hash
- **CDN**: Vercel Edge Network (automatic)
- **IPFS fallback**: Pin static export to IPFS for censorship resistance

---

## 9. Environment Configuration

### .env.example

```bash
# ── Shared ──
CHAIN_ID=1                                    # 1 = mainnet, 11155111 = sepolia
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
WS_RPC_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# ── Contract Addresses (populated after deployment) ──
RITUAL_TOKEN_ADDRESS=0x...
MINTING_CURVE_ADDRESS=0x...
SUMMONING_ENGINE_ADDRESS=0x...
ELDER_ARTIFACTS_ADDRESS=0x...

# ── Backend ──
DATABASE_URL=postgresql://user:pass@host:5432/summoning
PORT=3001
WS_PORT=3002

# ── Frontend (NEXT_PUBLIC_ prefix for client-side access) ──
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_WS_URL=wss://api.thesummoning.xyz/ws
NEXT_PUBLIC_API_URL=https://api.thesummoning.xyz
NEXT_PUBLIC_RITUAL_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_MINTING_CURVE_ADDRESS=0x...
NEXT_PUBLIC_SUMMONING_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_ELDER_ARTIFACTS_ADDRESS=0x...

# ── Deployment ──
DEPLOYER_PRIVATE_KEY=          # NEVER commit this. Use hardware wallet for mainnet.
ETHERSCAN_API_KEY=
ALCHEMY_API_KEY=

# ── Chainlink ──
VRF_COORDINATOR=0x...
VRF_KEY_HASH=0x...
VRF_SUBSCRIPTION_ID=
AUTOMATION_REGISTRY=0x...
```

---

## 10. Build Order

Follow this sequence. Each step should be fully tested before proceeding.

### Week 1: Foundation ✅ COMPLETE

```
Step 1:  Initialize Foundry project (forge init)                          ✅
Step 2:  Install OpenZeppelin (forge install OpenZeppelin/openzeppelin-contracts) ✅
Step 3:  Implement RitualToken.sol + tests                                ✅
Step 4:  Implement MintingCurve.sol + tests (heavy fuzz testing on math)  ✅
Step 5:  Write Deploy.s.sol, deploy to Anvil, verify end-to-end mint      ✅
Step 6:  Deploy to Sepolia testnet                                        ✅
Step 7:  Initialize Next.js frontend with wagmi                           ✅
Step 8:  Build MintInterface component — connect wallet, deposit ETH, receive $RITUAL ✅
Step 9:  Verify: User can connect wallet, mint $RITUAL on Sepolia, see balance ✅
```

### Week 2: Core Game + Glyphs ✅ COMPLETE

```
Step 10: Implement SummoningEngine.sol + 57 tests (full epoch lifecycle)  ✅
         Extras vs spec: getContributors(), nextThreshold(), ZeroAddress/ZeroThreshold
         errors, prior-epoch guard on startEpoch. All pass forge test.
Step 11: Implement ElderArtifacts.sol + 36 tests                          ✅
         Includes: name/symbol, totalMinted mapping, uri() override, setBaseURI().
Step 12: Deploy SummoningEngine + ElderArtifacts to Sepolia (targeted     ✅
         redeploy preserving existing RitualToken + MintingCurve balances)
         via script/DeployWeek2.s.sol. Verified on Sepolia Etherscan.
Step 13: Backend: glyphRoll.ts + glyphEngine.ts + eventListener.ts        ✅
         + wsManager.ts + epochSync.ts + REST routes + Prisma schema.
         epochSync.ts hydrates EpochCache on startup and watches
         EpochStarted/EpochResolved events to keep /api/epochs/current live.
Step 14: Frontend glyph UI: GlyphReveal.tsx + GlyphCollection.tsx wired   ✅
         into page.tsx. useGlyphs.ts handles REST hydration on wallet
         connect. WebSocketProvider handles WS lifecycle + reconnect
         + REST fetch on reconnect. Mounts in layout.tsx.
Step 15: Verify: sacrifice flow → glyph_reveal WS message → GlyphReveal   ✅
         animation → dismiss → GlyphCollection grid updates.
```

### Week 3: Polish & Integration (Steps 21–24 ✅ COMPLETE)

```
Step 21: Portal.tsx — 6-stage SVG visualization. PortalStages.ts config   ✅
         with getStageForProgress(). SVG uses viewBox 220x220,
         width/height="100%" with explicit container sizing.
Step 22: EpochStatus.tsx + Countdown.tsx + ProgressBar.tsx.               ✅
         useEpochProgress hook reads directly from SummoningEngine
         contract (not REST API) with chainId pinned to Sepolia.
         Polls every 15s. Shows Old One name, phase badge, live
         countdown, purple→red progress bar, participant count.
Step 23: Metadata API — /api/metadata/:tokenId now dynamically           ✅
         resolves Old One name from EpochCache.oldOneId → OLD_ONES
         constant. Added OLD_ONES to backend/src/utils/constants.ts.
Step 24: Leaderboard.tsx — fetches /api/leaderboard, shows rank          ✅
         position, wallet, cult rank (color-coded), glyph count.
         Highlights connected wallet row. CultRankBar wired into
         page.tsx below GlyphCollection.
Step 25: Mobile responsive pass — all components use sm:/md: breakpoints   ✅
Step 26: On-chain glyphs via Chainlink VRF — EldritchGlyphs.sol contract   ✅
         + ERC-1155 + EIP-2981 royalties (5%) + glyphMintHandler backend
         + ChannelingOverlay + SacrificePanel + useCultRank on-chain hook
         + 85 EldritchGlyphs tests (incl. 10K-seed fuzz). Deployed to Sepolia.
Step 27: Chainlink Automation — checkUpkeep/performUpkeep on               ✅
         SummoningEngine for auto epoch resolution. 13 Automation tests.
         178 total tests across 5 suites. Deployed to Sepolia.
Step 28: Deploy subgraph to The Graph Studio                   (skipped — not needed for V1, backend event indexer covers it)
Step 29: Full integration test on Sepolia                              ✅
         Complete epoch lifecycle verified: start epoch → sacrifice
         → VRF callback mints glyph #1 (Whisper, ◈) → resolve
         → claim Shattered Ritual artifact (token 2000). All on-chain.
```

### Week 4: Security & Launch Prep

```
Step 30: Internal security review — found and fixed 6 must-fix issues  ✅
         CRITICAL: MintingCurve integral pricing (was spot price)
         MEDIUM: VRF try/catch, double-fulfill guard, setMinter
         zero-address, withdraw nonReentrant
Step 31: Slither static analysis — clean, 1 minor fix (string.concat) ✅
Step 32: forge test 10,000 fuzz runs — 183 tests, 0 failures          ✅
Step 33: Competitive audit                                     (deferred — revisit post-revenue)
Step 34: Deploy to mainnet staging (with low threshold test epoch)
Step 35: Set up domain, ENS name, SSL
Step 36: Set up monitoring + alerting on backend
Step 37: Begin teaser campaign on Twitter/X
```

### Week 5–6: Launch

```
Step 38: Apply audit fixes (if any)
Step 39: Final mainnet deployment with production parameters
Step 40: Configure first epoch: Cthulhu, threshold calibrated to expected participation
Step 41: Announce first epoch, open minting
Step 42: Host launch event (Twitter Space during final ritual hour)
Step 43: Monitor, respond to issues, celebrate
```

---

## Appendix: Constants Reference

These values MUST be consistent across contracts, backend, and frontend.

```typescript
// Shared constants — keep in sync across all layers

// Glyph Tiers
export const GLYPH_TIERS = [
  { name: 'Whisper',  chance: 0.50, color: '#8B8B8B', symbol: '𐌀' },
  { name: 'Echo',     chance: 0.28, color: '#4A9EFF', symbol: '𐌁' },
  { name: 'Tremor',   chance: 0.15, color: '#A855F7', symbol: '𐌂' },
  { name: 'Rupture',  chance: 0.06, color: '#F59E0B', symbol: '𐌃' },
  { name: 'Breach',   chance: 0.01, color: '#EF4444', symbol: '𐌄' },
];

// Cult Ranks
export const CULT_RANKS = [
  { name: 'Uninitiated',          minGlyphs: 0  },
  { name: 'Whisperer',            minGlyphs: 3  },
  { name: 'Echo Walker',          minGlyphs: 8  },
  { name: 'Void Touched',         minGlyphs: 15 },
  { name: 'Rift Keeper',          minGlyphs: 25 },
  { name: 'Herald of the Breach', minGlyphs: 40 },
];

// ERC-1155 Tier IDs
export const TIER_IDS = {
  SHATTERED_RITUAL: 0,
  HARBINGER: 1,
  ACOLYTE: 2,
  CULTIST: 3,
};

// Contract Parameters
export const CONTRACT_PARAMS = {
  BASE_PRICE: 0.0001,           // ETH per token
  SCALE_FACTOR: 100_000_000,
  PROTOCOL_FEE_BPS: 1200,       // 12%
  GATHERING_DURATION: 48 * 3600, // 48 hours in seconds
  RITUAL_DURATION: 24 * 3600,    // 24 hours in seconds
  MIN_SACRIFICE: 1,              // $RITUAL tokens — tier odds scale with amount, not gated by floor
  SACRIFICE_COOLDOWN: 30,        // seconds
};
```
