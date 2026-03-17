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
│   │   ├── BondingCurve.sol
│   │   ├── SummoningEngine.sol
│   │   ├── ElderArtifacts.sol
│   │   └── interfaces/
│   │       ├── IRitualToken.sol
│   │       ├── IBondingCurve.sol
│   │       ├── ISummoningEngine.sol
│   │       └── IElderArtifacts.sol
│   ├── test/
│   │   ├── RitualToken.t.sol
│   │   ├── BondingCurve.t.sol
│   │   ├── SummoningEngine.t.sol
│   │   ├── ElderArtifacts.t.sol
│   │   └── Integration.t.sol
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   └── ConfigureEpoch.s.sol
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
│   │   │   ├── glyphEngine.ts   # Deterministic glyph assignment
│   │   │   ├── eventListener.ts # Chain event listener (viem)
│   │   │   ├── wsManager.ts     # WebSocket session management
│   │   │   └── leaderboard.ts   # Rank calculation & caching
│   │   ├── api/
│   │   │   ├── routes.ts
│   │   │   ├── metadata.ts      # ERC-1155 metadata endpoint
│   │   │   ├── glyphs.ts        # Glyph collection endpoints
│   │   │   └── epochs.ts        # Epoch status endpoints
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
│   │   ├── page.tsx             # Main summoning page
│   │   └── globals.css
│   ├── components/
│   │   ├── providers/
│   │   │   ├── WalletProvider.tsx
│   │   │   └── WebSocketProvider.tsx
│   │   ├── portal/
│   │   │   ├── Portal.tsx       # SVG portal visualization
│   │   │   └── PortalStages.ts  # 6-stage config data
│   │   ├── sacrifice/
│   │   │   ├── SacrificePanel.tsx
│   │   │   ├── AmountSlider.tsx
│   │   │   └── SacrificeButton.tsx
│   │   ├── glyph/
│   │   │   ├── GlyphReveal.tsx  # Full-screen gacha reveal
│   │   │   ├── GlyphCard.tsx    # Individual glyph display
│   │   │   ├── GlyphCollection.tsx
│   │   │   └── GlyphTierBadge.tsx
│   │   ├── epoch/
│   │   │   ├── EpochStatus.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── Countdown.tsx
│   │   ├── rank/
│   │   │   ├── CultRankBar.tsx
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
│   │   ├── useBondingCurve.ts   # Mint/price hooks
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
    address public minter; // BondingCurve contract

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
- No max supply. Minting is controlled by the BondingCurve.
- `ERC20Burnable` gives any holder `burn()` and `burnFrom()`.
- Minter is set once to the BondingCurve address after deployment.

---

### 3.2 BondingCurve.sol

Holds the ETH treasury. Mints $RITUAL at a price that increases with supply.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IRitualToken.sol";

contract BondingCurve is Ownable, ReentrancyGuard {
    IRitualToken public immutable ritualToken;

    uint256 public constant BASE_PRICE = 0.0001 ether;  // per token (in wei)
    uint256 public constant SCALE_FACTOR = 100_000_000;  // 100M
    uint256 public constant PROTOCOL_FEE_BPS = 1200;     // 12% in basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    uint256 public protocolFees;  // accumulated fees withdrawable by owner

    event TokensMinted(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 fee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    error InsufficientPayment();
    error SlippageExceeded();
    error WithdrawFailed();

    constructor(address _token, address _owner) Ownable(_owner) {
        ritualToken = IRitualToken(_token);
    }

    /// @notice Calculate the current price per token based on total supply
    /// @dev price = BASE_PRICE * (1 + totalSupplyInTokens / SCALE_FACTOR)
    ///      Supply is divided by 1e18 to convert from wei to whole-token units,
    ///      so price doubles when 100M whole tokens have been minted.
    function getCurrentPrice() public view returns (uint256) {
        uint256 supply = ritualToken.totalSupply() / 1e18;
        // price = BASE_PRICE + (BASE_PRICE * supplyInTokens / SCALE_FACTOR)
        return BASE_PRICE + (BASE_PRICE * supply / SCALE_FACTOR);
    }

    /// @notice Estimate cost to mint a given number of tokens at current price
    /// @dev Uses average price across the mint range for accuracy
    function getEstimatedCost(uint256 tokenAmount) public view returns (uint256) {
        uint256 supply = ritualToken.totalSupply() / 1e18;
        uint256 tokenAmountWhole = tokenAmount / 1e18;
        uint256 startPrice = BASE_PRICE + (BASE_PRICE * supply / SCALE_FACTOR);
        uint256 endPrice = BASE_PRICE + (BASE_PRICE * (supply + tokenAmountWhole) / SCALE_FACTOR);
        uint256 avgPrice = (startPrice + endPrice) / 2;
        uint256 grossCost = avgPrice * tokenAmount / 1e18;
        return grossCost * BPS_DENOMINATOR / (BPS_DENOMINATOR - PROTOCOL_FEE_BPS);
    }

    /// @notice Mint $RITUAL tokens by sending ETH. Slippage protection via minTokens.
    /// @param minTokens Minimum tokens to receive, reverts if output is less
    function mint(uint256 minTokens) external payable nonReentrant {
        if (msg.value == 0) revert InsufficientPayment();

        uint256 fee = msg.value * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;
        uint256 netEth = msg.value - fee;
        protocolFees += fee;

        // Calculate tokens: tokens = netEth / currentPrice (simplified spot price)
        // Supply normalized to whole tokens to match SCALE_FACTOR unit (100M tokens)
        uint256 supply = ritualToken.totalSupply() / 1e18;
        uint256 price = BASE_PRICE + (BASE_PRICE * supply / SCALE_FACTOR);
        uint256 tokensOut = netEth * 1e18 / price;

        if (tokensOut < minTokens) revert SlippageExceeded();

        ritualToken.mint(msg.sender, tokensOut);
        emit TokensMinted(msg.sender, msg.value, tokensOut, fee);
    }

    /// @notice Owner withdraws accumulated protocol fees
    function withdrawFees(address to) external onlyOwner {
        uint256 amount = protocolFees;
        protocolFees = 0;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit FeesWithdrawn(to, amount);
    }

    receive() external payable {}
}
```

**Key decisions**:
- Price is a linear function of supply: `BASE_PRICE * (1 + supply / 100M)`.
- Protocol fee (12%) is deducted from ETH in, remainder buys tokens.
- `minTokens` parameter provides slippage protection.
- `ReentrancyGuard` on mint to prevent reentrancy via fallback.
- `getEstimatedCost` is a view for frontend price preview.

**NOTE**: The simplified `mint()` uses spot price. For production, implement trapezoidal integration over the supply range to get accurate token output across larger mints. This prevents price manipulation on large orders.

---

### 3.3 SummoningEngine.sol

Core gameplay contract. Manages epoch lifecycle and burns tokens.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IRitualToken.sol";
import "./interfaces/IElderArtifacts.sol";

contract SummoningEngine is Ownable, ReentrancyGuard {

    // ── Epoch State ──
    enum EpochPhase { Inactive, Gathering, Ritual, Resolved }

    struct Epoch {
        uint256 oldOneId;
        uint256 threshold;           // $RITUAL needed for success
        uint256 totalCommitted;      // $RITUAL committed so far
        uint256 gatheringStart;
        uint256 ritualStart;
        uint256 ritualEnd;
        bool successful;
        bool resolved;
        uint256 participantCount;
    }

    // ── Storage ──
    IRitualToken public immutable ritualToken;
    IElderArtifacts public immutable artifacts;

    uint256 public currentEpochId;
    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    // epochId => contributor addresses (for reward distribution)
    mapping(uint256 => address[]) internal _contributors;

    uint256 public constant GATHERING_DURATION = 48 hours;
    uint256 public constant RITUAL_DURATION = 24 hours;
    uint256 public constant MIN_SACRIFICE = 100e18;      // 100 $RITUAL minimum
    uint256 public constant SACRIFICE_COOLDOWN = 30;      // 30 seconds between sacrifices
    uint256 public constant FAILURE_REDUCTION_BPS = 2000; // 20% threshold reduction on failure
    uint256 public constant ESCALATION_BPS = 13000;       // 1.3x threshold increase on success

    mapping(address => uint256) public lastSacrificeTime;

    // ── Events ──
    event EpochStarted(uint256 indexed epochId, uint256 oldOneId, uint256 threshold, uint256 gatheringStart);
    event RitualPhaseStarted(uint256 indexed epochId, uint256 ritualStart, uint256 ritualEnd);
    event RitualSacrifice(
        uint256 indexed epochId,
        address indexed wallet,
        uint256 amount,
        uint256 totalCommitted
    );
    event EpochResolved(uint256 indexed epochId, bool successful, uint256 totalBurned);
    event RewardClaimed(uint256 indexed epochId, address indexed wallet, uint256 tierId);

    // ── Errors ──
    error InvalidPhase();
    error BelowMinimum();
    error CooldownActive();
    error InsufficientBalance();
    error AlreadyClaimed();
    error EpochNotResolved();
    error TransferFailed();

    constructor(
        address _token,
        address _artifacts,
        address _owner
    ) Ownable(_owner) {
        ritualToken = IRitualToken(_token);
        artifacts = IElderArtifacts(_artifacts);
    }

    // ── Epoch Management (Owner) ──

    function startEpoch(uint256 oldOneId, uint256 threshold) external onlyOwner {
        currentEpochId++;
        uint256 id = currentEpochId;

        epochs[id] = Epoch({
            oldOneId: oldOneId,
            threshold: threshold,
            totalCommitted: 0,
            gatheringStart: block.timestamp,
            ritualStart: block.timestamp + GATHERING_DURATION,
            ritualEnd: block.timestamp + GATHERING_DURATION + RITUAL_DURATION,
            successful: false,
            resolved: false,
            participantCount: 0
        });

        emit EpochStarted(id, oldOneId, threshold, block.timestamp);
    }

    // ── Core Gameplay ──

    /// @notice Commit $RITUAL to the current epoch's summoning ritual.
    ///         Tokens are burned immediately. Emits event consumed by Glyph Engine.
    function commitRitual(uint256 amount) external nonReentrant {
        uint256 id = currentEpochId;
        Epoch storage epoch = epochs[id];

        // Must be in Ritual phase
        if (block.timestamp < epoch.ritualStart || block.timestamp >= epoch.ritualEnd) {
            revert InvalidPhase();
        }
        if (amount < MIN_SACRIFICE) revert BelowMinimum();
        if (block.timestamp < lastSacrificeTime[msg.sender] + SACRIFICE_COOLDOWN) {
            revert CooldownActive();
        }
        if (ritualToken.balanceOf(msg.sender) < amount) revert InsufficientBalance();

        // Record cooldown
        lastSacrificeTime[msg.sender] = block.timestamp;

        // Track contribution
        if (contributions[id][msg.sender] == 0) {
            _contributors[id].push(msg.sender);
            epoch.participantCount++;
        }
        contributions[id][msg.sender] += amount;
        epoch.totalCommitted += amount;

        // Burn tokens
        ritualToken.burnFrom(msg.sender, amount);

        emit RitualSacrifice(id, msg.sender, amount, epoch.totalCommitted);
    }

    /// @notice Resolve the current epoch after ritual phase ends.
    ///         Called by Chainlink Automation or manually by owner.
    function resolveEpoch() external {
        uint256 id = currentEpochId;
        Epoch storage epoch = epochs[id];

        if (block.timestamp < epoch.ritualEnd) revert InvalidPhase();
        if (epoch.resolved) revert InvalidPhase();

        epoch.resolved = true;
        epoch.successful = epoch.totalCommitted >= epoch.threshold;

        emit EpochResolved(id, epoch.successful, epoch.totalCommitted);
    }

    // ── Reward Claims ──

    /// @notice Claim ERC-1155 reward artifact after epoch resolution.
    function claimReward(uint256 epochId) external nonReentrant {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.resolved) revert EpochNotResolved();
        if (contributions[epochId][msg.sender] == 0) revert InsufficientBalance();

        uint256 contribution = contributions[epochId][msg.sender];

        // Determine tier based on contribution percentile
        uint256 tierId = _calculateTier(epochId, contribution, epoch.successful);

        // Mint artifact: tokenId = epochId * 1000 + tierId
        uint256 tokenId = epochId * 1000 + tierId;
        artifacts.mint(msg.sender, tokenId, 1, "");

        // Prevent double claim
        contributions[epochId][msg.sender] = 0;

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
        // Simplified version below uses threshold-based tiers.
        Epoch storage epoch = epochs[epochId];
        uint256 avgContribution = epoch.totalCommitted / epoch.participantCount;

        if (contribution >= avgContribution * 10) return 1;  // Harbinger (top ~1%)
        if (contribution >= avgContribution * 3) return 2;   // Acolyte (top ~10%)
        return 3;                                            // Cultist (everyone else)
    }

    // ── View Functions ──

    function getEpoch(uint256 epochId) external view returns (Epoch memory) {
        return epochs[epochId];
    }

    function getCurrentPhase() external view returns (EpochPhase) {
        Epoch storage epoch = epochs[currentEpochId];
        if (epoch.gatheringStart == 0) return EpochPhase.Inactive;
        if (epoch.resolved) return EpochPhase.Resolved;
        if (block.timestamp < epoch.ritualStart) return EpochPhase.Gathering;
        if (block.timestamp < epoch.ritualEnd) return EpochPhase.Ritual;
        return EpochPhase.Resolved; // past end, awaiting resolution
    }

    function getContribution(uint256 epochId, address wallet) external view returns (uint256) {
        return contributions[epochId][wallet];
    }
}
```

**Key decisions**:
- `commitRitual` burns tokens via `burnFrom` (requires user to `approve` SummoningEngine first).
- `RitualSacrifice` event is the trigger for the Glyph Engine backend.
- 30-second cooldown per wallet prevents glyph farming via rapid small burns.
- Tier calculation is simplified for V1. Production should use merkle proofs from off-chain percentile calculation.
- `resolveEpoch` is permissionless — anyone can call it after the ritual window closes. Chainlink Automation calls it automatically.

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

### 3.5 Contract Deployment Order

Deployment must follow this exact sequence:

```
1. Deploy RitualToken(ownerMultisig)
2. Deploy BondingCurve(ritualTokenAddress, ownerMultisig)
3. Deploy ElderArtifacts(metadataBaseUri, ownerMultisig)
4. Deploy SummoningEngine(ritualTokenAddress, elderArtifactsAddress, ownerMultisig)
5. Call RitualToken.setMinter(bondingCurveAddress)
6. Call ElderArtifacts.setEngine(summoningEngineAddress)
7. Users must call RitualToken.approve(summoningEngineAddress, MAX_UINT) before committing
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
  id          String   @id @default(cuid())
  walletAddr  String   @db.VarChar(42)
  epochId     Int
  txHash      String   @db.VarChar(66) @unique
  tierName    String   // Whisper, Echo, Tremor, Rupture, Breach
  tierIndex   Int      // 0-4
  rune        String   // The unicode rune symbol
  lore        String   // Lore message text
  amount      String   // $RITUAL burned (stored as string for BigInt)
  blockNumber Int
  createdAt   DateTime @default(now())

  @@index([walletAddr])
  @@index([epochId])
  @@index([tierIndex])
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

### 4.2 Glyph Engine

The core service that assigns glyphs deterministically from burn transactions.

```typescript
// backend/src/utils/glyphRoll.ts

import { keccak256, toHex } from 'viem';

// Tier definitions — MUST match frontend constants
export const GLYPH_TIERS = [
  { name: 'Whisper',  index: 0, chance: 0.50, color: '#8B8B8B' },
  { name: 'Echo',     index: 1, chance: 0.28, color: '#4A9EFF' },
  { name: 'Tremor',   index: 2, chance: 0.15, color: '#A855F7' },
  { name: 'Rupture',  index: 3, chance: 0.06, color: '#F59E0B' },
  { name: 'Breach',   index: 4, chance: 0.01, color: '#EF4444' },
] as const;

export const RUNE_SHAPES = [
  '◈','◇','⬡','△','▽','⬢','◆','⬠','☍','⚝',
  '✧','⊛','⊕','⊗','⊘','⊙','⊚','⊜','⊡','⊞',
  '᛭','ᚦ','ᚠ','ᚢ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᛃ',
];

export const LORE_MESSAGES = [
  'The void stirs...',
  'Something ancient takes notice.',
  'The veil grows thin.',
  'Whispers from beyond the stars.',
  'The geometry of space bends.',
  'Dead dreams ripple outward.',
  'The sleeping one shifts.',
  'Reality fractures, just slightly.',
  'The darkness between stars pulses.',
  'An eye opens in the deep.',
];

/**
 * Deterministic glyph assignment from a transaction hash.
 * Anyone can independently verify this by running the same function
 * on the same txHash — the result is always the same.
 */
export function rollGlyphFromTxHash(txHash: string) {
  // Use keccak256 of txHash as seed for tier selection
  const seed = keccak256(txHash as `0x${string}`);
  const seedNum = BigInt(seed);

  // Tier roll: use first 8 bytes as a fraction of max uint64
  const tierRoll = Number(seedNum % 10000n) / 10000; // 0.0000 - 0.9999
  let tier = GLYPH_TIERS[0];
  let cumulative = 0;
  for (const t of GLYPH_TIERS) {
    cumulative += t.chance;
    if (tierRoll < cumulative) {
      tier = t;
      break;
    }
  }

  // Rune selection: use next 8 bytes
  const runeIndex = Number((seedNum >> 64n) % BigInt(RUNE_SHAPES.length));
  const rune = RUNE_SHAPES[runeIndex];

  // Lore selection: use next 8 bytes
  const loreIndex = Number((seedNum >> 128n) % BigInt(LORE_MESSAGES.length));
  const lore = LORE_MESSAGES[loreIndex];

  return {
    tierName: tier.name,
    tierIndex: tier.index,
    color: tier.color,
    rune,
    lore,
  };
}
```

```typescript
// backend/src/services/glyphEngine.ts

import { PrismaClient } from '@prisma/client';
import { rollGlyphFromTxHash } from '../utils/glyphRoll';
import { wsManager } from './wsManager';
import { updateCultRank } from './leaderboard';

const prisma = new PrismaClient();

interface RitualSacrificeEvent {
  epochId: number;
  wallet: string;
  amount: bigint;
  txHash: string;
  blockNumber: number;
}

export async function processRitualSacrifice(event: RitualSacrificeEvent) {
  // 1. Check for duplicate (idempotency via unique txHash)
  const existing = await prisma.glyph.findUnique({
    where: { txHash: event.txHash },
  });
  if (existing) return existing;

  // 2. Roll glyph deterministically
  const roll = rollGlyphFromTxHash(event.txHash);

  // 3. Persist to database
  const glyph = await prisma.glyph.create({
    data: {
      walletAddr: event.wallet.toLowerCase(),
      epochId: event.epochId,
      txHash: event.txHash,
      tierName: roll.tierName,
      tierIndex: roll.tierIndex,
      rune: roll.rune,
      lore: roll.lore,
      amount: event.amount.toString(),
      blockNumber: event.blockNumber,
    },
  });

  // 4. Update cult rank
  await updateCultRank(event.wallet.toLowerCase());

  // 5. Push to user via WebSocket
  wsManager.sendToWallet(event.wallet.toLowerCase(), {
    type: 'glyph_reveal',
    data: {
      ...roll,
      txHash: event.txHash,
      amount: event.amount.toString(),
      epochId: event.epochId,
    },
  });

  return glyph;
}
```

---

### 4.3 Event Listener

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

### 4.4 WebSocket Manager

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

### 4.5 REST API Endpoints

```
GET  /api/metadata/:tokenId        → ERC-1155 JSON metadata
GET  /api/glyphs/:wallet           → Glyph collection for a wallet
GET  /api/glyphs/:wallet/summary   → Tier counts + rank for a wallet
GET  /api/epochs/current           → Current epoch state + progress
GET  /api/epochs/:epochId          → Historical epoch data
GET  /api/leaderboard              → Top contributors + rank holders
GET  /api/leaderboard/glyphs       → Top glyph collectors
GET  /health                       → Health check
```

**Metadata endpoint response format (ERC-1155 standard)**:

```json
{
  "name": "Fragment of Cthulhu — Harbinger",
  "description": "A shard of the Dreaming One, pulled from beyond the veil by a Harbinger of Epoch I.",
  "image": "https://api.thesummoning.xyz/images/1001.png",
  "attributes": [
    { "trait_type": "Epoch", "value": 1 },
    { "trait_type": "Old One", "value": "Cthulhu" },
    { "trait_type": "Tier", "value": "Harbinger" },
    { "trait_type": "Tier ID", "value": 1 },
    { "trait_type": "Total Minted", "value": 23 }
  ]
}
```

---

### 4.6 Cult Rank Calculation

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
| Server/chain state | wagmi + @tanstack/react-query | Token balance, epoch data, contract reads |
| WebSocket events | zustand (glyphStore) | Incoming glyph reveals, collection |
| UI state | zustand (uiStore) | Active tab, reveal modal open, animation phase |
| Form state | React useState | Sacrifice amount slider value |

### 5.2 Key Component Specifications

#### Portal.tsx
- SVG-based, renders in a 220x220 viewBox
- Reads `progress` (0-100) from epoch data
- 6 visual stages based on progress thresholds (see Section 5.4 of project spec)
- Animated: rotating rune circles (CSS `animateTransform`), pulsing glow, tentacle emergence
- Portal shakes on sacrifice (CSS keyframe, triggered by state)

#### GlyphReveal.tsx
- Full-screen overlay (fixed positioning, backdrop blur)
- 4-phase animation sequence controlled by `setTimeout` chain:
  - Phase 0 (0ms): Modal appears, scale(0.5), opacity 0
  - Phase 1 (100ms): Scale to 1, opacity 1 — spinning channeling symbol
  - Phase 2 (600ms): Glyph materializes — rune + color reveal tier
  - Phase 3 (1200ms): Tier name, lore text, "tap to continue" fade in
- Framer Motion `AnimatePresence` for enter/exit
- Tier-specific effects: Tremor+ get expanded glow radius, Rupture/Breach get screen shake

#### SacrificePanel.tsx
- Amount slider (range input, 100 to min(balance, 25000))
- Quick-select buttons: 1K, 5K, 10K, 25K
- Sacrifice button triggers: `approve()` (if needed) → `commitRitual()` → listen for WS glyph
- Button states: idle, approving, channeling, disabled (insufficient balance / cooldown)

#### GlyphCollection.tsx
- CSS Grid: `repeat(auto-fill, minmax(52px, 1fr))`
- Each cell shows the rune symbol with tier-colored glow
- Hover/tap shows tooltip with tier name + lore
- Newest glyph animates in (scale from 0.8 to 1, opacity fade)

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

### 5.4 WebSocket Client

```typescript
// frontend/hooks/useGlyphs.ts

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useGlyphStore } from '../stores/glyphStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.thesummoning.xyz/ws';

export function useGlyphWebSocket() {
  const { address } = useAccount();
  const addGlyph = useGlyphStore((s) => s.addGlyph);
  const setRevealGlyph = useGlyphStore((s) => s.setRevealGlyph);

  useEffect(() => {
    if (!address) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', wallet: address }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'glyph_reveal') {
        // Trigger the reveal animation
        setRevealGlyph(msg.data);
      }
      if (msg.type === 'epoch_update') {
        // Update epoch progress in real-time
        // Handled by epoch store
      }
    };

    ws.onclose = () => {
      // Reconnect after 3 seconds
      setTimeout(() => {}, 3000);
    };

    return () => ws.close();
  }, [address]);
}
```

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

---

## 6. Integration Flows

### 6.1 Sacrifice → Glyph Reveal (End-to-End)

```
User clicks "Perform Sacrifice"
   │
   ├─→ Frontend: Check approval (wagmi readContract)
   │     └─ If not approved: prompt approve() tx first
   │
   ├─→ Frontend: Call commitRitual(amount) via wagmi writeContract
   │     └─ UI state: "Channeling..."
   │
   ├─→ Ethereum: Transaction included in block
   │     ├─ RitualToken.burnFrom() executes
   │     └─ SummoningEngine emits RitualSacrifice event
   │
   ├─→ Backend: Event Listener (viem watchEvent) picks up log
   │     └─ Calls glyphEngine.processRitualSacrifice()
   │         ├─ rollGlyphFromTxHash(txHash) → deterministic tier + rune
   │         ├─ Prisma: Insert glyph record
   │         ├─ updateCultRank(wallet)
   │         └─ wsManager.sendToWallet(wallet, glyphData)
   │
   ├─→ Frontend: WebSocket receives 'glyph_reveal' message
   │     └─ zustand: setRevealGlyph(data)
   │         └─ GlyphReveal component mounts → 4-phase animation plays
   │
   └─→ User taps to dismiss
         └─ Glyph added to collection grid
         └─ Cult rank bar updates
```

**Target latency**: Block confirmation (~12s) + event indexing (~1s) + WebSocket push (~0.1s) = **~13 seconds** from button click to glyph reveal start. The "Channeling..." animation fills this gap.

### 6.2 Epoch Lifecycle Flow

```
Owner calls startEpoch(oldOneId, threshold)
   │
   ├─→ Gathering Phase (48h)
   │     ├─ Frontend: Shows countdown to Ritual phase
   │     ├─ Users: Mint $RITUAL via BondingCurve
   │     └─ Portal: Dormant state, ambient rotation only
   │
   ├─→ Ritual Phase (24h)  [block.timestamp >= ritualStart]
   │     ├─ Frontend: Sacrifice interface becomes active
   │     ├─ Users: Call commitRitual() → get glyphs
   │     ├─ Portal: Evolves through stages based on totalCommitted/threshold
   │     └─ Backend: Broadcasts epoch_update via WebSocket on each sacrifice
   │
   ├─→ Resolution  [block.timestamp >= ritualEnd]
   │     ├─ Chainlink Automation (or owner) calls resolveEpoch()
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
├── BondingCurve.t.sol       # Price curve math, fee extraction, slippage
├── SummoningEngine.t.sol    # Full epoch lifecycle, contributions, rewards
├── ElderArtifacts.t.sol     # Minting, token IDs, URI generation
└── Integration.t.sol        # Full flow: mint → sacrifice → resolve → claim
```

**Coverage targets**:
- 100% branch coverage on BondingCurve (holds treasury)
- 100% branch coverage on SummoningEngine (core gameplay)
- Fuzz testing on BondingCurve.mint() for edge cases in math
- Invariant: `protocolFees + curveReserve == total ETH received`
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
BONDING_CURVE_ADDRESS=0x...
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
NEXT_PUBLIC_BONDING_CURVE_ADDRESS=0x...
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

### Week 1: Foundation

```
Step 1:  Initialize Foundry project (forge init)
Step 2:  Install OpenZeppelin (forge install OpenZeppelin/openzeppelin-contracts)
Step 3:  Implement RitualToken.sol + tests
Step 4:  Implement BondingCurve.sol + tests (heavy fuzz testing on math)
Step 5:  Write Deploy.s.sol, deploy to Anvil, verify end-to-end mint
Step 6:  Deploy to Sepolia testnet
Step 7:  Initialize Next.js frontend with wagmi
Step 8:  Build MintInterface component — connect wallet, deposit ETH, receive $RITUAL
Step 9:  Verify: User can connect wallet, mint $RITUAL on Sepolia, see balance
```

### Week 2: Core Game + Glyphs

```
Step 10: Implement SummoningEngine.sol + tests (epoch lifecycle)
Step 11: Implement ElderArtifacts.sol + tests
Step 12: Deploy all 4 contracts to Sepolia, run wiring script
Step 13: Initialize backend (Express + Prisma + PostgreSQL)
Step 14: Implement glyphRoll.ts + determinism tests
Step 15: Implement glyphEngine.ts + eventListener.ts
Step 16: Implement wsManager.ts
Step 17: Build SacrificePanel + GlyphReveal components
Step 18: Build GlyphCollection + CultRankBar components
Step 19: Wire frontend WebSocket to backend
Step 20: Verify: User sacrifices $RITUAL → glyph reveal animation → collection updates
```

### Week 3: Polish & Integration

```
Step 21: Build Portal.tsx (6-stage SVG visualization)
Step 22: Build EpochStatus + Countdown components
Step 23: Implement metadata API endpoint for ERC-1155
Step 24: Build leaderboard API + frontend component
Step 25: Mobile responsive pass on all components
Step 26: Implement Chainlink VRF integration in SummoningEngine
Step 27: Implement Chainlink Automation for auto-resolution
Step 28: Deploy subgraph to The Graph Studio
Step 29: Full integration test on Sepolia: complete epoch lifecycle
```

### Week 4: Security & Launch Prep

```
Step 30: Internal security review — check all access controls, reentrancy
Step 31: Run Slither static analysis on all contracts
Step 32: Run forge test with high fuzz runs (10,000+)
Step 33: Submit to Code4rena or Sherlock competitive audit
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
  MIN_SACRIFICE: 100,            // $RITUAL tokens
  SACRIFICE_COOLDOWN: 30,        // seconds
};
```
