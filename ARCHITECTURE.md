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
| Chainlink VRF | V2.5 | Verifiable randomness for glyph tiers |
| Self-hosted epoch keeper | backend (epochKeeper.ts) | Auto-calls permissionless resolveEpoch() at ritualEnd. Replaced Chainlink Automation 2026-07-08 (v2.1 sunset 2026-07-31 closed new registrations; successor CRE rejected as launch risk). The contract retains AutomationCompatibleInterface (checkUpkeep/performUpkeep) — any keeper network can still drive it later. |

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

Core gameplay contract. Manages epoch lifecycle, burns tokens, accumulates contribution +
lifetime totals, batched-claims glyphs after resolution, distributes artifact rewards, and
supports Chainlink Automation for auto-resolution.

**Inherits**: `Ownable`, `ReentrancyGuard`, `Pausable`, `AutomationCompatibleInterface`

**Post-audit (C-01) architecture**:
- `commitRitual` is a pure burn — NO VRF request, NO glyph mint at sacrifice time.
- New `claimGlyphs(epochId)` issues a single batched VRF request after resolution.
- `lifetimeContribution[wallet]` powers the Initiate cult rank.
- `rewardClaimed[epochId][wallet]` replaces the old "zero-out contribution on claim" pattern so `claimGlyphs` can still read the original contribution.
- `glyphsClaimedCount[epochId][wallet]` tracks the running total claimed across multiple `claimGlyphs` calls (whales > 50 earned).
- Pausable (H-02) — owner can pause `commitRitual`, `claimGlyphs`, and `claimReward`. `resolveEpoch` stays live so epochs settle even when paused.
- Sole-summoner Harbinger fix (M-01) in `_calculateTier`.

```solidity
contract SummoningEngine is Ownable, ReentrancyGuard, Pausable, AutomationCompatibleInterface {

    IRitualToken public immutable ritualToken;
    IElderArtifacts public immutable artifacts;
    IEldritchGlyphs public immutable glyphs;

    // Constants
    uint256 public constant MIN_SACRIFICE        = 1e18;      // 1 RITUAL — low-barrier entry
    uint256 public constant GLYPH_UNIT           = 100e18;    // 100 RITUAL per glyph (qualification + divisor)
    uint256 public constant MAX_GLYPHS_PER_CLAIM = 20;        // mirrors EldritchGlyphs.MAX_GLYPHS_PER_REQUEST; sized for Chainlink V2.5's 2.5M ceiling
    uint256 public constant SACRIFICE_COOLDOWN   = 30;
    // Self-perpetuating escalation (replaces the old advisory FAILURE_REDUCTION_BPS/ESCALATION_BPS):
    uint256 public constant GENESIS_THRESHOLD    = 75_000e18;   // epoch 1 target
    uint256 public constant WIN_INCREMENT        = 150_000e18;  // +2× genesis per win (linear ramp)
    uint256 public constant THRESHOLD_FLOOR      = 25_000e18;   // loss decay floor
    uint256 public constant OLD_ONE_COUNT        = 5;           // rotation length (advance-on-win, loop 5→1)
    // GATHERING_DURATION (immutable, 0 on mainnet — collapsed) and RITUAL_DURATION (24h) are constructor-set.

    // Epoch state
    mapping(uint256 => mapping(address => uint256)) public contributions;          // epochId => wallet => burn
    mapping(address => uint256)                     public lifetimeContribution;   // wallet => sum across all epochs
    mapping(uint256 => mapping(address => bool))    public rewardClaimed;          // artifact double-claim guard
    mapping(uint256 => mapping(address => uint256)) public glyphsClaimedCount;     // glyph batch progress

    event GlyphsClaimRequested(
        uint256 indexed epochId,
        address indexed wallet,
        uint256 numGlyphs,
        uint256 cumulativeContribution
    );
    error SummoningEngine__NoGlyphsEarned();

    constructor(address _token, address _artifacts, address _glyphs, address _owner,
                uint256 _gatheringDuration, uint256 _ritualDuration) Ownable(_owner) { ... }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function commitRitual(uint256 amount) external nonReentrant whenNotPaused {
        // Self-perpetuating auto-start: open the next epoch if none is active or the
        // current one is resolved (threshold + Old One derived on-chain), then count this burn.
        if (currentEpochId == 0 || epochs[currentEpochId].resolved) _openNextEpoch();
        // ... phase/min/cooldown/balance checks ...
        if (contributions[id][msg.sender] == 0) {
            _contributors[id].push(msg.sender);
            epoch.participantCount++;
        }
        contributions[id][msg.sender] += amount;
        epoch.totalCommitted          += amount;
        lifetimeContribution[msg.sender] += amount;

        ritualToken.burnFrom(msg.sender, amount);
        emit RitualSacrifice(id, msg.sender, amount, epoch.totalCommitted);
        // No VRF call here — glyphs are batched at claim time.
    }

    /// @notice Batched glyph claim after epoch resolution. One VRF request per call.
    function claimGlyphs(uint256 epochId)
        external nonReentrant whenNotPaused
        returns (uint256 numClaimed)
    {
        if (!epochs[epochId].resolved) revert SummoningEngine__EpochNotResolved();

        uint256 contribution   = contributions[epochId][msg.sender];
        uint256 totalEarned    = contribution / GLYPH_UNIT;       // qualification + divisor
        uint256 alreadyClaimed = glyphsClaimedCount[epochId][msg.sender];

        if (totalEarned <= alreadyClaimed) revert SummoningEngine__NoGlyphsEarned();

        uint256 remaining = totalEarned - alreadyClaimed;
        numClaimed = remaining > MAX_GLYPHS_PER_CLAIM ? MAX_GLYPHS_PER_CLAIM : remaining;

        // Effects before external call (CEI + reentrancy safety).
        glyphsClaimedCount[epochId][msg.sender] = alreadyClaimed + numClaimed;

        emit GlyphsClaimRequested(epochId, msg.sender, numClaimed, contribution);
        glyphs.requestBatch(msg.sender, epochId, numClaimed, contribution);
        // Revert propagates if VRF is unavailable — user retries.
    }

    function claimReward(uint256 epochId) external nonReentrant whenNotPaused {
        Epoch storage epoch = epochs[epochId];
        if (!epoch.resolved) revert SummoningEngine__EpochNotResolved();

        uint256 contribution = contributions[epochId][msg.sender];
        if (contribution == 0)                       revert SummoningEngine__AlreadyClaimed();
        if (rewardClaimed[epochId][msg.sender])      revert SummoningEngine__AlreadyClaimed();

        rewardClaimed[epochId][msg.sender] = true;   // contribution stays for claimGlyphs

        uint256 tierId  = _calculateTier(epochId, contribution, epoch.successful);
        uint256 tokenId = epochId * 1000 + tierId;
        artifacts.mint(msg.sender, tokenId, 1, "");
        emit RewardClaimed(epochId, msg.sender, tierId);
    }

    // ── Chainlink Automation (unchanged from original spec) ──

    function _calculateTier(
        uint256 epochId,
        uint256 contribution,
        bool successful
    ) internal view returns (uint256) {
        if (!successful) return 0;                                       // Shattered Ritual
        Epoch storage epoch = epochs[epochId];
        if (epoch.participantCount == 1) return 1;                       // M-01: sole summoner → Harbinger

        uint256 avg = epoch.totalCommitted / epoch.participantCount;
        if (contribution >= avg * 10) return 1;                          // Harbinger
        if (contribution >= avg * 3)  return 2;                          // Acolyte
        return 3;                                                        // Cultist
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

    /// @notice The threshold the next auto-opened epoch will use (what the UI previews while idle).
    ///         GENESIS_THRESHOLD before epoch 1; 0 while the current epoch is unresolved; else the
    ///         escalated/decayed value _openNextEpoch will stamp in.
    function nextThreshold() external view returns (uint256) {
        if (currentEpochId == 0) return GENESIS_THRESHOLD;
        Epoch storage epoch = epochs[currentEpochId];
        if (!epoch.resolved) return 0;
        return _computeNextThreshold(epoch.threshold, epoch.successful);
    }

    // ── Self-perpetuating internals ──
    // _openNextEpoch(): increments currentEpochId, derives threshold via _computeNextThreshold
    //   and Old One via _computeNextOldOne (genesis defaults for epoch 1), stamps
    //   ritualStart = now, ritualEnd = now + RITUAL_DURATION, emits EpochStarted.
    // _computeNextThreshold(prior, success): success → prior + WIN_INCREMENT;
    //   loss → max(prior * 3/4, THRESHOLD_FLOOR).
    // _computeNextOldOne(priorId, success): success → priorId >= OLD_ONE_COUNT ? 1 : priorId + 1;
    //   loss → priorId (retry).
    // startEpoch(oldOneId, threshold) is retained as an onlyOwner bootstrap/emergency override.
}
```

**Key decisions**:
- `commitRitual` burns tokens via `burnFrom` (requires user to `approve` SummoningEngine first) and issues NO VRF request — glyphs are claimed in batch after resolution (C-01).
- `RitualSacrifice` event is the trigger for the Glyph Engine backend to refresh contribution leaderboards.
- 30-second cooldown per wallet bounds spam, but is no longer the primary anti-sybil mechanism — that role is now played by the 100-RITUAL per-epoch glyph threshold (H-04).
- `claimGlyphs` issues exactly one VRF request regardless of how many sacrifices the wallet made — splitting and concentrating produce identical glyph counts and identical odds (closes H-01).
- Per-epoch reset is automatic: `contributions` is keyed by epochId, so 50 RITUAL in epoch 1 + 60 RITUAL in epoch 2 yields zero glyphs from either.
- Tier calculation is simplified for V1, with the M-01 sole-summoner fix added. Production should use merkle proofs from off-chain percentile calculation.
- `resolveEpoch` is permissionless and NOT pausable — epochs always settle so claims can flow.
- All custom errors are prefixed with `SummoningEngine__` for clarity in multi-contract traces.
- `claimReward` no longer zeros contribution (claimGlyphs needs it). Double-claim guarded by `rewardClaimed[epochId][wallet]` instead.
- `getContributors(epochId)` returns the full contributor address list for off-chain use.
- Self-perpetuating: `commitRitual` auto-opens the next epoch (demand-driven, no owner call); threshold + Old One escalate on-chain via `_computeNextThreshold` (+150k win / ×0.75 loss floored at 25k) and `_computeNextOldOne` (advance-on-win looping, retry-on-loss). `nextThreshold()` previews the next target; `startEpoch` remains an `onlyOwner` override only.

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
        // Returns: https://api.thesummoning.xyz/api/metadata/artifact/{tokenId}
        // The backend generates JSON dynamically based on epoch + tier
        return string(
            abi.encodePacked(
                "https://api.thesummoning.xyz/api/metadata/artifact/",
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

On-chain tradeable glyph NFTs. Glyphs are minted in batches after epoch resolution via a single Chainlink VRF request per claim.

**Inherits**: `ERC1155`, `VRFConsumerBaseV2Plus`, `ERC2981`

**Key design decisions**:
- **Tradeable, not soulbound** — enables secondary market and late-joiner participation.
- **EIP-2981 royalties** — 5% on secondary sales to treasury.
- **Batched VRF** (C-01): `requestBatch(recipient, epochId, numGlyphs, cumulativeContribution)` issues ONE VRF request with `numWords = numGlyphs` (capped at `MAX_GLYPHS_PER_REQUEST = 20`, sized so the worst-case fulfillRandomWords callback measured ~2.04M gas — under Chainlink V2.5's 2.5M ceiling with ~17% margin). All glyphs in a batch share the same tier bracket — derived from `cumulativeContribution`, not any single sacrifice amount.
- **Single ERC-1155 `_mintBatch`** in the callback — one TransferBatch event, one storage update — keeps callback gas linear in `numGlyphs`. Per-glyph `GlyphMinted` events are emitted so backend indexing and per-glyph reveal animations still work.
- **Tier weight bracketing** — `_bracket(cumulativeContribution)` selects one of 5 weight rows (10/100/1000/10000 RITUAL boundaries). Splitting and concentrating yield identical brackets (closes H-01 incentive inversion).
- **PendingGlyph captured at request time** — VRF callback is async, so `pendingGlyphs[requestId]` records recipient, epochId, cumulativeContribution, and numGlyphs.
- **Double-fulfill guard** — `fulfillRandomWords` checks `pending.fulfilled` flag before minting.
- **glyphCount tracking** — `_update()` override tracks per-wallet count on mint/transfer/burn so cult rank reflects current ownership.
- **Separate from SummoningEngine** — engine calls `requestBatch()` from `claimGlyphs`; VRF callback mints.
- **InvalidBatchSize** error — defense-in-depth: rejects `numGlyphs == 0` or `> 50` even if the engine misbehaves.

```solidity
contract EldritchGlyphs is ERC1155, VRFConsumerBaseV2Plus, ERC2981 {
    uint256 public constant MAX_GLYPHS_PER_REQUEST = 20;

    struct PendingGlyph {
        address recipient;
        uint256 epochId;
        uint256 cumulativeContribution; // selects tier bracket on fulfillment
        uint256 numGlyphs;
        bool    fulfilled;
    }

    event GlyphsBatchRequested(
        uint256 indexed requestId,
        address indexed recipient,
        uint256 epochId,
        uint256 numGlyphs,
        uint256 cumulativeContribution
    );
    event GlyphMinted(uint256 indexed tokenId, address indexed recipient, uint8 tier, uint8 runeIndex, uint8 loreIndex, uint256 epochId);
    event GlyphsBatchMinted(uint256 indexed requestId, address indexed recipient, uint256 epochId, uint256 numGlyphs);

    function requestBatch(
        address recipient,
        uint256 epochId,
        uint256 numGlyphs,
        uint256 cumulativeContribution
    ) external onlyEngine returns (uint256 requestId);

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        // 1. Mark fulfilled.
        // 2. bracket = _bracket(pending.cumulativeContribution); apply to every word.
        // 3. For each word: derive tier/rune/lore, allocate tokenId, store GlyphData, emit GlyphMinted.
        // 4. _mintBatch(recipient, ids, values, "")
        // 5. emit GlyphsBatchMinted
    }

    function _bracket(uint256 cumulativeContribution) internal pure returns (uint8);
    function _tierWeights(uint8 bracket) internal pure returns (uint16[5] memory);
    function _deriveTierFromBracket(uint64 bits, uint8 bracket) internal pure returns (uint8);
    function getGlyphData(uint256 tokenId) external view returns (GlyphData memory);
    function glyphCount(address wallet) external view returns (uint256);
    function totalMinted() external view returns (uint256);
}
```

**Note on `callbackGasLimit`**: the constructor takes it as immutable. For a 20-glyph batch the measured callback cost is ~2.04M gas (`test_Fulfill_MintsBatch_MaxBatchFitsCallbackGas`). Deploy with `callbackGasLimit = 2_500_000` — the standard Chainlink V2.5 ceiling on Sepolia + mainnet for typical gas lanes. **History**: the original 50-glyph cap from the audit recommendation was set without a gas measurement; the first Sepolia rehearsal exposed a live OOG in the 50-batch callback (LINK lost, batch stuck). The forge test now hard-asserts the worst-case batch fits under 2.4M (100k margin) so regressions can't reintroduce the bug.

**Tests** cover: batched VRF fulfillment (single + multi-glyph), double-fulfill revert, `InvalidBatchSize` boundaries (0 and 51), tier derivation boundaries, bracket-from-cumulative enforcement, per-bracket fuzz distributions (1,000 samples × 5 brackets), royalty info, glyphCount tracking on transfers, supportsInterface (ERC1155 + ERC2981).

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
10. Arm the backend epoch keeper: set KEEPER_PRIVATE_KEY (fresh gas-only wallet,
    ~0.005 ETH) + ALERT_WEBHOOK_URL on the backend host. The keeper auto-calls the
    permissionless resolveEpoch() at ritualEnd (epochKeeper.ts; replaced the
    Chainlink Automation upkeep after the 2026-07-31 product sunset).
11. Users must call RitualToken.approve(summoningEngineAddress, MAX_UINT) before committing.
    Note: glyphs are now claimed AFTER epoch resolution via `claimGlyphs(epochId)` — no
    VRF cost is incurred at sacrifice time. Each `claimGlyphs` call issues one VRF
    request returning up to 20 random words (MAX_GLYPHS_PER_CLAIM, sized for the
    2.5M VRF callback gas ceiling). Whales with >20 earned glyphs call again.
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

### 4.3 Glyph Backfill (Startup)

Public RPCs garbage-collect long-lived event filters and the backend itself can be down during a VRF callback. Either case can drop a `GlyphMinted` event from the live watcher, leaving an on-chain glyph that's invisible to the UI (frontend reads from the DB; the DB has no record).

The backfill service (`backend/src/services/backfill.ts`) runs once on every backend startup, **before** the live watchers are attached:

1. Fetches the current head block from the configured RPC.
2. Scans `head - 5000 → head` for `GlyphMinted` events on `EldritchGlyphs`, chunked into 1,000-block windows (public RPCs cap `getLogs` ranges).
3. Pipes each event through the existing `handleGlyphMinted` handler — idempotent thanks to its `findFirst` check on `tokenId`. Already-indexed glyphs are no-ops; previously-missed ones get persisted.

Mounted from `index.ts` as a `Promise.then(startGlyphEventListener)` chain so the live listener doesn't start until backfill completes.

**Limitations**:
- WebSocket pushes during backfill (`glyph_pending`, `glyph_reveal`) go to no recipient — the user's WS hasn't connected yet — so the gacha reveal animation is *not* replayed on backfill. The user sees the glyph in their collection on next REST hydrate, but without animation. Acceptable trade-off; replaying old reveals would feel weirder than missing them.
- The 5,000-block window covers ~16 hours on Ethereum. Longer downtime requires either a manual run with a wider range or a `last_indexed_block` checkpoint (deferred until needed).

---

### 4.4 Epoch Sync Service

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

### 4.5 Event Listener

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

**Polling cadence and onError handling** (lessons from Sepolia test):

- All `watchEvent` calls pass `pollingInterval: 4000` (default is ~1s). Five active watchers × 1s polling overwhelmed rate-limited public RPCs and starved the HTTP server's event loop. 4s is the sweet spot — slow enough to coexist with public-node limits, fast enough that event latency stays under 5s.
- `onError` handlers **log only** — they do not recursively restart the parent listener function. viem auto-reconnects the filter on the next polling tick, so a recursive `setTimeout(() => startEventListener(), 5000)` would spawn a parallel watcher on top of the existing one. Each subsequent error spawns another, and the process collapses under accumulated polls within a minute. Trust viem's internal retry; just log the error message.
- For mainnet, switch the transport to a dedicated RPC's WebSocket endpoint (`wss://...`) — events arrive as push notifications, no polling, no filter expirations.

---

### 4.6 WebSocket Manager

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

### 4.7 REST API Endpoints

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

### 4.8 Cult Rank Calculation

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

#### GlyphReveal.tsx (booster-pack flow)
- Full-screen overlay (fixed positioning, backdrop blur). Reads `glyphStore.revealQueue` and animates `revealQueue[0]`.
- **Batch indicator** when the queue's max observed size > 1: a "Glyph X of N" pill at top center, where X = `batchTotal - revealQueue.length + 1`. `batchTotal` is captured as a high-watermark via `setBatchTotal((prev) => Math.max(prev, revealQueue.length))` and resets when the queue hits empty.
- **Stacked-card depth**: when `phase >= 2` and `remaining > 0`, render 1–2 faded card silhouettes behind the active card (`scale: 0.95 - depth*0.03`, `translateY: depth*10`, `opacity: 0.35 - depth*0.12`).
- 4-phase animation per glyph, rarity-scaled timing (unchanged from pre-audit spec):
  - Phase 0 (0ms): Modal appears, scale(0.5), opacity 0
  - Phase 1 (100ms): Scale to 1, opacity 1 — spinning channeling symbol (faster + tier-colored for rare+)
  - Phase 2 (variable): Glyph materializes. ~1000ms common, ~1720ms Tremor, ~2200ms Rupture/Breach
  - Phase 3 (variable): Tier name, lore, footer text fade in. ~2000ms common, ~3440ms Tremor, ~4400ms Rupture/Breach
- `suspenseMultiplier`: 1.0x common, 2.2x Tremor, 3.0x Rupture/Breach.
- Footer reads "TAP FOR NEXT" while `remaining > 0`, otherwise "TAP TO CONTINUE". Tap → `addGlyph` + `dequeueReveal`.
- Tier-specific effects: Tremor+ get expanded glow radius, faster spinner with tier glow. Rupture/Breach add screen shake.

#### SacrificePanel.tsx
- Amount input field with quick-select buttons: 100, 500, 1000 $RITUAL (uses `btn-quick-active`/`btn-quick-inactive` classes).
- Checks allowance → prompts `approve()` if needed → calls `commitRitual(amount)`.
- Button states: "APPROVE & SACRIFICE" / "CONFIRM IN WALLET..." / "SACRIFICING..." / "SACRIFICE ACCEPTED" / "WAIT Xs" (cooldown).
- Reads `lastSacrificeTime(wallet)` from SummoningEngine to preempt the on-chain `SACRIFICE_COOLDOWN` (30s). 1s-tick `setInterval` drives the countdown.
- Only visible during Ritual phase. `page.tsx` switches the slot by phase: Gathering → "Sacrifice opens soon" guidance; Resolved-but-not-yet-on-chain-resolved → "Awaiting Resolution" pending card; Resolved (on-chain) → `ClaimArtifact` + `ClaimGlyphsPanel` rendered together.
- **No post-sacrifice channeling/reveal expectation** (C-01). Success state reads "The void accepts your offering" + "Glyphs claimable after the ritual resolves".
- **Pending-glyphs indicator** (always visible during Ritual): reads `getContribution(epochId, wallet)` and shows "Pending glyphs: N", "Until next glyph: M $RITUAL", and a live delta preview based on the typed sacrifice amount.

#### ClaimGlyphsPanel.tsx (new — C-01 batched claim)
- Renders only when **`epoch.resolved === true`** AND `getContribution(epochId, wallet) > 0`. Mounted alongside `ClaimArtifact` in the Resolved-phase slot.
- Reads `contributions[epochId][wallet]` and `glyphsClaimedCount[epochId][wallet]` from SummoningEngine. Computes:
  - `totalEarned = contribution / 100e18` (integer division — GLYPH_UNIT)
  - `remaining = totalEarned - claimedCount`
  - `claimableNow = min(remaining, MAX_GLYPHS_PER_CLAIM=20)`
  - `remainingAfter = max(remaining - 50, 0)`
- Three states:
  - `0 < contribution < 100 RITUAL` → "No glyphs earned" hint; shows shortfall and the Initiate-rank note.
  - `remaining > 0` → "Claim N Glyph[s]" button. Calls `useClaimGlyphs()` from `useSummoning.ts`. Shows the "X after" tail and the "Capped at 20 per claim — call again for the rest." footer when relevant.
  - `remaining == 0` → sticky "Glyphs Claimed" done state.
- On success: refetch `getContribution` + `glyphsClaimedCount` so the UI advances. The actual glyph data arrives via VRF callback → backend `glyph_reveal` WS pushes → `enqueueReveal` into `glyphStore.revealQueue` → `GlyphReveal` animates the batch booster-pack-style.

#### ClaimArtifact.tsx (updated)
- Renders only when **`epoch.resolved === true`** AND `getContribution(epochId, wallet) > 0` AND `rewardClaimed[epochId][wallet] === false`. Reward double-claim is now gated by the new `rewardClaimed` mapping; contribution is preserved on-chain so `ClaimGlyphsPanel` can still read it.
- Mirrors the contract's `_calculateTier` formula client-side. **M-01 sole-summoner Harbinger fix**: when `participantCount == 1`, tier is Harbinger (1) regardless of the avg-multiple thresholds.
- Calls `useClaimReward(epochId)` from `useSummoning.ts`. "Confirm in wallet..." → "Claiming..." → sticky success state (token ID `epochId * 1000 + tierId`).
- Tier coloring unchanged: Shattered #6B7280, Harbinger #F59E0B, Acolyte #A855F7, Cultist #4A9EFF.

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
- Phase-dependent display: Gathering shows "Ritual begins in", Ritual shows "Ritual ends in", Resolved (on-chain) shows ✦ SUMMONED / ✕ FAILED
- **Pending Resolution state**: derived as `isPendingResolution = phase==="Resolved" && !epoch.resolved`. The contract's `getCurrentPhase()` returns Resolved as soon as `block.timestamp >= ritualEnd`, even before `resolveEpoch()` has been called on-chain. In that window, the badge is replaced with an amber "PENDING RESOLUTION" pill and the success/failure outcome is suppressed. The phase badge background and text colors switch to the warning palette (`#F59E0B` border / `#FCD34D` text). Resolves automatically once the upkeep fires and `epoch.resolved` flips to `true`.
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
- When idle (no active summoning) with wallet connected: shows the BeginSummoning panel — the first sacrifice auto-opens the next epoch (previews next Old One + nextThreshold())
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
3. On connect: read $RITUAL balance, current epoch, approval, contribution, lifetimeContribution
4. If no approval for SummoningEngine: show "Approve $RITUAL" button first
5. On approval: enable sacrifice interface
6. During Ritual phase:
   a. User submits commitRitual(amount) — pure burn, no VRF
   b. On tx confirmed: pending-glyphs indicator updates from refetched contribution
7. After resolveEpoch (auto-called by the backend epoch keeper):
   a. ClaimArtifact + ClaimGlyphsPanel both render
   b. User submits claimGlyphs(epochId) — one VRF request for up to 20 random words
   c. VRF callback → GlyphMinted events → backend pushes glyph_reveal WS messages
   d. Frontend enqueues each glyph onto revealQueue → booster-pack reveal animates
   e. Whales with >50 earned call claimGlyphs again for the next batch
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

> **⚠️ SELF-PERPETUATING LIFECYCLE — implemented in source (2026-08-12), NOT yet on mainnet.**
> The flow below is the **new demand-driven design**, with no owner in the loop. It is built
> and tested in the repo but the **deployed mainnet contract is still the old owner-driven
> engine** — this takes effect on the pending engine-only redeploy (new `SummoningEngine` +
> Safe `glyphs.setEngine`/`artifacts.setEngine`; Sepolia rehearsal first). It ships
> **independently** of the Veil Protocol (decoupled — Veil is separate contracts funded by a
> treasury RITUAL reserve). See `~/.claude/plans/polymorphic-knitting-kitten.md`.
> Key points: no Gathering phase (`GATHERING_DURATION = 0`); the first `commitRitual` when no
> epoch is active/unresolved auto-opens a 24h ritual and counts as the opening contribution;
> threshold + Old One escalate on-chain; resolution stays permissionless; the First Cultists
> drop is the launch trigger (a seeded wallet's sacrifice opens epoch 1).

**Self-perpetuating lifecycle:**

```
Idle (no epoch active, or the current one is resolved) — minting always open on the curve
   │
   ├─→ First commitRitual auto-opens the next epoch  (_openNextEpoch)
   │     ├─ threshold: genesis 75k, else prior +150k (win) / ×0.75 floored 25k (loss)
   │     ├─ oldOneId:  genesis Cthulhu(1), else advance-on-win (loop 5→1) / retry-on-loss
   │     ├─ ritualStart = now, ritualEnd = now + 24h  (Gathering collapsed)
   │     └─ the opening sacrifice is counted as contribution #1
   │
   ├─→ Ritual Phase (24h)  [ritualStart ≤ now < ritualEnd]
   │     ├─ Frontend: SacrificePanel active (idle state showed BeginSummoning)
   │     ├─ Users: commitRitual() — pure burn, accumulates contribution
   │     ├─ Portal: evolves through stages by totalCommitted/threshold
   │     └─ Backend: broadcasts ritual_sacrifice via WebSocket on each burn
   │
   ├─→ Resolution  [now ≥ ritualEnd]
   │     ├─ Self-hosted epoch keeper calls resolveEpoch() automatically
   │     │   (epochKeeper.ts polls every 60s; permissionless — anyone can call;
   │     │    epoch_resolution_overdue alert at 30 min if it hasn't landed)
   │     ├─ Contract: successful = totalCommitted >= threshold
   │     └─ Frontend: result screen; keeper's epoch_resolved alert reports next threshold (info only)
   │
   ├─→ Claim Phase (on the resolved epoch)
   │     ├─ claimReward(epochId)  → ERC-1155 artifact by contribution tier
   │     └─ claimGlyphs(epochId)  → batched VRF glyph mint
   │
   └─→ Back to Idle: contract sits with nextThreshold() pre-computed until the
         next sacrifice auto-opens the following epoch. Loop forever, no Safe.
```

---

## 7. Testing Strategy

### 7.1 Smart Contract Tests (Foundry)

```
contracts/test/
├── RitualToken.t.sol        # Mint, burn, access control
├── MintingCurve.t.sol       # Price curve math, withdrawal, slippage
├── SummoningEngine.t.sol    # Epoch lifecycle, auto-start, on-chain escalation, contributions, rewards (108 tests)
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
# Signer comes from the CLI flag, never an env var — the scripts use a bare
# vm.startBroadcast() and read the deployer from msg.sender (--sender). Import
# the keystore once: cast wallet import deployer --interactive
forge script script/DeploySepolia.s.sol:DeploySepolia \
  --rpc-url $SEPOLIA_RPC_URL \
  --account deployer --sender $DEPLOYER_ADDRESS \
  --broadcast --verify \
  --etherscan-api-key $ETHERSCAN_KEY

# Mainnet (hardware wallet or keystore; contracts owned by the Safe multisig)
forge script script/DeployMainnet.s.sol:DeployMainnet \
  --rpc-url $MAINNET_RPC_URL \
  --ledger --sender $DEPLOYER_ADDRESS \
  --broadcast --verify \
  --etherscan-api-key $ETHERSCAN_KEY
```

> Deploy scripts take the signer from `--account` / `--ledger` / `--private-key`,
> not a `DEPLOYER_PRIVATE_KEY` env var, so the raw key never enters the environment.

### 8.2 Backend

- **Hosting**: Railway or Render (Node.js + PostgreSQL managed)
- **Process**: Single process runs Express HTTP + WebSocket + event listener
- **Database**: Railway managed PostgreSQL (auto-backups)
- **Monitoring**: Health check endpoint polled by uptime monitor
- **Scaling**: Single instance is sufficient for V1 (<10K concurrent WS connections)

### 8.3 Frontend

- **Hosting**: Cloudflare Pages (static export). The app is fully client-rendered —
  every route is `"use client"`, with no server components, API routes, or SSR — so
  `next build` with `output: "export"` (set in `next.config.js`) emits a static `out/`
  dir. Pages config: build command `npm run build`, output dir `out`. No edge adapter
  (`@cloudflare/next-on-pages`) needed since there are no server-rendered routes.
- **Why Cloudflare over Vercel**: single vendor with the DNS + `api` subdomain (already
  on Cloudflare), and the root domain is served proxied (orange-cloud) so it gets
  Cloudflare's CDN + DDoS protection and automatic SSL. Contrast the `api` record, which
  must stay DNS-only (grey-cloud) for Render's Let's Encrypt issuance.
- **Domain**: thesummoning.xyz → Cloudflare Pages, thesummoning.eth → ENS content hash
- **CDN**: Cloudflare global edge network (automatic when proxied)
- **IPFS fallback**: Pin the `out/` static export to IPFS for censorship resistance

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
# Deploy scripts take the signer from a CLI flag (--account / --ledger), NOT this
# env var. Prefer a keystore (cast wallet import) or hardware wallet; avoid raw keys.
DEPLOYER_ADDRESS=             # deployer EOA address, passed via --sender (pays gas, not owner)
ETHERSCAN_API_KEY=
ALCHEMY_API_KEY=

# ── Chainlink ──
VRF_COORDINATOR=0x...
VRF_KEY_HASH=0x...
VRF_SUBSCRIPTION_ID=

# ── Backend epoch keeper (replaces Chainlink Automation) ──
# Fresh gas-only wallet; zero protocol authority (resolveEpoch is permissionless)
KEEPER_PRIVATE_KEY=0x...
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
Step 35: forge verify-bytecode against committed source for ALL 5
         contracts. Sepolia divergence (durations + Automation
         interface) was caught twice; mainnet must match source 1:1.
         Abort the launch if any contract diverges.
Step 36: Live `cast call checkUpkeep(0x)` post-deploy on the
         SummoningEngine — must return without reverting before
         registering Chainlink Automation upkeep. A reverting
         checkUpkeep silently disables the upkeep.
Step 37: Production metadata hosting — point ElderArtifacts
         setBaseURI to a stable HTTPS endpoint (api.thesummoning.xyz
         or IPFS-pinned static JSON). Default deploy URI is a
         placeholder; marketplaces show lorem-ipsum if left as-is.
Step 38: Deploy frontend to Cloudflare Pages (static export, build
         `npm run build`, output `out`); point thesummoning.xyz root
         at it (proxied/orange-cloud → automatic SSL + CDN). Set the
         NEXT_PUBLIC_* mainnet env vars in the Pages project. Then
         ENS content hash for thesummoning.eth.
Step 39: Set up monitoring + alerting on backend                          ✅ implemented
         Implemented in commit 6d1983a — three watchdogs run from index.ts:
          a. Stuck-VRF detector (vrfMonitor.ts): persists every
             GlyphsBatchRequested to the VrfRequest table; cron polls every
             5 min, alerts on any request older than 1h with on-chain
             pendingGlyphs.fulfilled=false. This is the audit decision
             record's operational requirement (AUDIT.md C-01 postmortem,
             2026-06-02) — no on-chain recovery for stuck claims, so ops
             relies on this signal.
          b. Low-LINK watchdog (vrfMonitor.ts): polls VRF subscription
             balance every 30 min, alerts when below MIN_LINK_BALANCE
             (default 2 LINK). 1h re-alert suppression.
          c. Indexer heartbeat (heartbeat.ts + /api/health): event handlers
             tick lastEventAt; GET /api/health returns 503 if lag >
             HEALTH_MAX_LAG_MS (default 30 min) OR Postgres is down. Point
             an external uptime monitor at this with a 5-min interval.
          d. Epoch keeper (epochKeeper.ts, added 2026-07-08 after the
             Chainlink Automation sunset): polls every KEEPER_INTERVAL_MS
             (60s); past ritualEnd + unresolved → simulate + send the
             permissionless resolveEpoch() from KEEPER_PRIVATE_KEY (gas-only
             wallet, zero protocol authority). Alerts: epoch_resolved (with
             outcome + the on-chain nextThreshold() reported as info only),
             keeper_error, epoch_resolution_overdue (30-min watchdog, fires
             even if the keeper itself is broken), low_keeper_eth (gas floor,
             6h check). The keeper ONLY resolves — it never starts epochs.
             In the self-perpetuating design (§6.2, built 2026-08-12) epochs
             auto-open on the next sacrifice with on-chain threshold escalation,
             so the old human-start flow and the keeper's suggestNextThreshold
             are removed. startEpoch survives only as an onlyOwner override.

         Pre-launch env wiring (backend/.env):
          - ALERT_WEBHOOK_URL=<Discord incoming webhook>
             OR TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
             (both supported; configure either, both, or neither — alerts
             fan out to every configured channel)
          - VRF_COORDINATOR, VRF_SUBSCRIPTION_ID (mainnet values)
          - MIN_LINK_BALANCE (recommend 5+ LINK for mainnet at launch volume)
          - Optionally tune VRF_STUCK_THRESHOLD_MS, HEALTH_MAX_LAG_MS

         Discord setup: in any Discord channel → Edit Channel →
         Integrations → Webhooks → New Webhook → copy URL.

         Telegram setup: message @BotFather to create a bot (saves the
         token), add the bot to a group/channel, then call
         https://api.telegram.org/bot<TOKEN>/getUpdates to find the
         numeric chat_id.

         External uptime ping: free tier of Better Uptime / UptimeRobot
         pointed at https://<backend>/api/health with 5-min interval and
         alert-on-503.

Step 40: Begin teaser campaign on Twitter/X
```

### Week 5–6: Launch

```
Step 41: Apply audit fixes (if any)
Step 42: Final mainnet deployment with production parameters
Step 43: (self-perpetuating) No manual first-epoch config — genesis threshold (75k)
        and Cthulhu are on-chain; the first sacrifice opens epoch 1. The First Cultists
        drop is the launch trigger.
Step 44: Announce launch, open minting
Step 45: Host launch event (Twitter Space during final ritual hour)
Step 46: Monitor, respond to issues, celebrate
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

// Cult Ranks. Initiate sits between Uninitiated and Whisperer as a lateral
// state for wallets with lifetimeContribution > 0 AND glyphCount == 0
// (sacrificed but never crossed the 100-RITUAL glyph qualification in any
// single epoch). See PRD §7.2.
export const CULT_RANKS = [
  { name: 'Uninitiated',          minGlyphs: 0, color: '#6B7280' },
  { name: 'Initiate',             minGlyphs: 0, color: '#94A3B8', requiresLifetime: true },
  { name: 'Whisperer',            minGlyphs: 3, color: '#8B8B8B' },
  { name: 'Echo Walker',          minGlyphs: 8, color: '#4A9EFF' },
  { name: 'Void Touched',         minGlyphs: 15, color: '#A855F7' },
  { name: 'Rift Keeper',          minGlyphs: 25, color: '#F59E0B' },
  { name: 'Herald of the Breach', minGlyphs: 40, color: '#EF4444' },
];

// ERC-1155 Tier IDs (artifact tiers, per-epoch reward)
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
  GATHERING_DURATION: 0,         // Gathering collapsed — self-perpetuating; immutable, constructor-set
  RITUAL_DURATION:    24 * 3600, // mainnet value — immutable, constructor-set (Sepolia uses minutes)
  MIN_SACRIFICE: 1,              // $RITUAL — low-barrier participation
  GLYPH_UNIT: 100,               // $RITUAL per glyph earned (qualification threshold + count divisor)
  MAX_GLYPHS_PER_CLAIM: 20,      // VRF callback gas cap (Chainlink V2.5 ceiling ~2.5M; 20 batch = ~2.04M measured)
  SACRIFICE_COOLDOWN: 30,        // seconds
  RITUAL_TOKEN_MAX_SUPPLY: 1_000_000_000, // 1B cap (H-05)
  // Self-perpetuating on-chain escalation:
  GENESIS_THRESHOLD: 75_000,     // $RITUAL — epoch 1 target
  WIN_INCREMENT: 150_000,        // +$RITUAL per win (linear ramp)
  THRESHOLD_FLOOR: 25_000,       // $RITUAL — loss decay (×0.75) floor
  OLD_ONE_COUNT: 5,              // Old One rotation length (advance-on-win loop, retry-on-loss)
};
```
