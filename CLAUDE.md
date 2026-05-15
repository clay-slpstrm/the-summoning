# CLAUDE.md — The Summoning

> Instructions for Claude Code CLI when working on this project.

## Project Overview

The Summoning is a Lovecraftian onchain coordination game on Ethereum mainnet. Players mint $RITUAL tokens via a dynamic minting curve, burn them in timed summoning epochs, and receive gacha-style micro-rewards (Eldritch Glyphs) on every sacrifice plus tiered ERC-1155 artifacts on successful summonings.

## Key Documents

Before making architectural decisions, always reference:

- `PRD.md` — Product requirements, feature specs, acceptance criteria, design system
- `ARCHITECTURE.md` — Technical architecture, contract interfaces, database schemas, API contracts, build order

## Keeping Specs Up To Date

After completing any task that changes game mechanics, balance values,
architecture decisions, or data models, you must:

1. Identify which of these documents is affected:
   - `PRD.md` — Product requirements, feature specs, acceptance criteria, design system
   - `ARCHITECTURE.md` — Technical architecture, contract interfaces, database schemas, API contracts, build order

2. Show me a summary of what changed and why.

3. Ask: "Should I update the spec docs to reflect these changes?"

4. If I say yes, update the relevant sections in the doc and include
   the doc changes in the same commit as the code changes.

Do this every time — even for small

 tweaks. The docs are the
source of truth and must stay in sync with the code.

## Repository Structure

This is a monorepo with three main packages:

```
contracts/    — Foundry project (Solidity smart contracts)
backend/      — Node.js/TypeScript API + WebSocket + Glyph Engine
frontend/     — Next.js 14 App Router + wagmi + Tailwind
subgraph/     — The Graph subgraph for event indexing
```

## Development Commands

### Smart Contracts (contracts/)
```bash
cd contracts
forge build                    # Compile contracts
forge test                     # Run all tests
forge test -vvv                # Verbose test output
forge test --match-test testFuzz --fuzz-runs 10000  # Heavy fuzz testing
forge script script/Deploy.s.sol --fork-url http://localhost:8545 --broadcast  # Deploy local
anvil                          # Start local Ethereum node
```

### Backend (backend/)
```bash
cd backend
npm install                    # Install dependencies
npx prisma generate            # Generate Prisma client
npx prisma db push             # Push schema to database
npm run dev                    # Start development server
npm run test                   # Run tests
```

### Frontend (frontend/)
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start Next.js dev server (port 3000)
npm run build                  # Production build
npm run lint                   # ESLint
```

## Tech Stack Rules

### Contracts
- Solidity ^0.8.24 with Foundry (NOT Hardhat)
- OpenZeppelin Contracts v5.x for standards (ERC-20, ERC-1155, AccessControl, ReentrancyGuard)
- Use custom errors (not require strings) for gas efficiency
- All state-changing functions must emit events
- Use `ReentrancyGuard` on any function that transfers ETH or calls external contracts

### Backend
- Node.js 20, TypeScript strict mode
- Express for REST API, ws library for WebSocket
- Prisma ORM with PostgreSQL
- viem for Ethereum client (NOT ethers.js)
- All chain-derived data must be deterministic (glyph assignment uses keccak256 of txHash)

### Frontend
- Next.js 14 with App Router (NOT Pages Router)
- wagmi v2 + viem for wallet/contract interaction (NOT ethers.js, NOT web3.js)
- Tailwind CSS for styling
- Framer Motion for animations (glyph reveal, portal effects)
- zustand for client state (glyph collection, UI state)
- @tanstack/react-query comes with wagmi, use it for server state
- NO localStorage for persistent data (use backend API)
- All contract addresses and ABIs imported from `lib/contracts.ts`

## Code Style

### Solidity
- NatSpec comments on all public/external functions
- Custom errors prefixed with contract context (e.g., `MintingCurve__SlippageExceeded`)
- Constants in UPPER_SNAKE_CASE
- Events emitted on every state change
- No magic numbers — use named constants

### TypeScript
- Strict mode enabled
- Explicit return types on all exported functions
- Use `as const` for constant arrays/objects
- Prefer `type` over `interface` unless extending
- Use absolute imports with `@/` prefix in frontend

### React/Next.js
- Server Components by default, 'use client' only when needed (hooks, interactivity)
- Colocate hooks with their primary component when single-use
- Shared hooks go in `hooks/` directory
- Component files are PascalCase, hook files are camelCase
- No prop drilling beyond 2 levels — use zustand or context

## Shared Constants

These values MUST be identical across contracts, backend, and frontend:

```
GLYPH_TIERS:
  Whisper  — 50% chance — #8B8B8B
  Echo     — 28% chance — #4A9EFF
  Tremor   — 15% chance — #A855F7
  Rupture  —  6% chance — #F59E0B
  Breach   —  1% chance — #EF4444

CULT_RANKS:
  Uninitiated         —  0 glyphs, 0 lifetime
  Initiate            —  0 glyphs, lifetimeContribution > 0 (#94A3B8)
  Whisperer           —  3 glyphs
  Echo Walker         —  8 glyphs
  Void Touched        — 15 glyphs
  Rift Keeper         — 25 glyphs
  Herald of the Breach — 40 glyphs

CONTRACT_PARAMS:
  BASE_PRICE             — 0.0001 ETH
  SCALE_FACTOR           — 100,000,000
  PROTOCOL_FEE           — 12% (1200 BPS)
  GATHERING_DURATION     — 48 hours
  RITUAL_DURATION        — 24 hours
  MIN_SACRIFICE          — 1 $RITUAL (low-barrier participation)
  GLYPH_UNIT             — 100 $RITUAL (qualification threshold + count divisor)
  MAX_GLYPHS_PER_CLAIM   — 50 (VRF callback gas cap; whales claim in batches)
  SACRIFICE_COOLDOWN     — 30 seconds
  RITUAL_TOKEN_MAX_SUPPLY — 1,000,000,000 $RITUAL (1B hard cap, H-05)

ERC-1155 TOKEN IDS:
  Format: epochId * 1000 + tierId
  tierId 0 = Shattered Ritual (failed epoch)
  tierId 1 = Harbinger (top ~1%)
  tierId 2 = Acolyte (top ~10%)
  tierId 3 = Cultist (everyone else)
```

## Design System Quick Reference

```
Background:     #0a0a0f
Surface:        #0d0d15
Surface Raised: #111118
Border:         #1e1e2e
Text Primary:   #e2e8f0
Text Secondary: #6b7280
Accent:         #7c3aed (purple)
Accent Deep:    #4c1d95
Accent Light:   #c4b5fd

Font Heading:   'Crimson Text', 'Georgia', serif
Font Mono:      'Courier New', monospace

Cards: bg #0d0d15, border 1px solid #1e1e2e, rounded-xl, p-5
Buttons: bg gradient(135deg, #4c1d95, #7c3aed), uppercase, tracking-widest, serif
```

## Critical Implementation Notes

1. **Glyphs are on-chain ERC-1155 NFTs** minted by the EldritchGlyphs contract via **Chainlink VRF**. Tier, rune, and lore are provably fair random assignments. The backend is an event indexer — it does NOT assign glyphs.

2. **Sacrifice does NOT mint glyphs** (post-audit, C-01). `commitRitual()` is a pure burn: it destroys $RITUAL, updates `contributions[epochId][wallet]` and `lifetimeContribution[wallet]`, and issues no VRF request. Glyphs are claimed in a batch after the epoch resolves via `claimGlyphs(epochId)`, which issues ONE VRF request returning `contributions[epochId][wallet] / GLYPH_UNIT` random words (capped at MAX_GLYPHS_PER_CLAIM=50). Below 100 RITUAL of cumulative epoch contribution → zero glyphs (Initiate rank only). Per-epoch reset is automatic (contributions are keyed by epochId; never carry over).

3. **Bracket is selected by cumulative epoch contribution, not per-sacrifice amount.** Splitting and concentrating produce identical glyph counts and identical odds — the H-01 incentive inversion is eliminated.

4. **VRF resilience**: `claimGlyphs()` calls `glyphs.requestBatch()` directly (no try/catch). If VRF is unavailable, the claim transaction reverts cleanly and the user can retry later. State is unaffected. Sacrifices remain fully functional during VRF outages because they never call VRF.

5. **MintingCurve uses integral pricing**: `mint()` solves the quadratic formula over the price curve integral, not a spot price. This prevents large mints from underpaying. The frontend reads `getTokensOut(ethIn)` (mirrors the integral exactly) for slippage-protected mints — `minTokens = quote * 99 / 100` (1% tolerance, H-03). `getEstimatedCost()` is a trapezoidal approximation for previews. All ETH in the contract is withdrawable by the owner (multisig) via `withdraw()`. There is no sell-back mechanism.

6. **Pausable** (H-02): owner can pause `MintingCurve.mint`, `SummoningEngine.commitRitual`, `claimGlyphs`, and `claimReward` during an incident. `resolveEpoch` and `withdraw` stay live so epochs can still settle and treasury remains recoverable.

7. **RitualToken.MAX_SUPPLY = 1B tokens** (H-05). `RitualToken.mint` reverts above the cap.

8. **The glyph reveal animation is the most important UX element**. After `claimGlyphs` confirms and the batched `GlyphMinted` events arrive, the GlyphReveal queues all N glyphs and reveals them sequentially in a booster-pack flow (X-of-N pill, faded stacked cards behind). Per-glyph timing: ~2.5s for Whisper/Echo, ~4s for Tremor+. See PRD.md §4.4.

9. **Users must approve() the SummoningEngine before their first sacrifice**. The SacrificePanel handles this — checks allowance, prompts approval if needed, then proceeds to sacrifice.

10. **WebSocket reconnection**: If WS disconnects, query `/api/glyphs/:wallet` and `/api/glyphs/:wallet/pending` on reconnect to catch missed glyphs.

11. **Portal state is shared**: All users see the same portal progression. It's derived from `totalCommitted / threshold` for the current epoch.

12. **Gas costs are near zero**: At 0.03 gwei, a sacrifice costs ~$0.006. Don't show gas warnings unless price spikes above 5 gwei.

13. **Sole-contributor Harbinger** (M-01): `_calculateTier` special-cases `participantCount == 1` to return Harbinger (tier 1). Without this, the avg-multiple thresholds are unreachable for a sole summoner.

## Testing Requirements

- Contracts: 183 tests across 5 suites, all passing with 10,000 fuzz runs
- Contracts: 100% branch coverage on MintingCurve, SummoningEngine, and EldritchGlyphs
- Contracts: Fuzz test on EldritchGlyphs tier distribution — 10,000 VRF seeds, ±2% of 50/28/15/6/1
- Backend: Idempotency test — processing same GlyphMinted event twice must not create duplicate glyphs
- Frontend: Portal renders correctly at 0%, 25%, 50%, 75%, 95% progress

## Build Order

Follow the numbered steps in ARCHITECTURE.md Section 10. Each step should be fully tested before proceeding. The high-level sequence is:

1. Week 1: RitualToken + MintingCurve → deploy to Sepolia → basic mint frontend
2. Week 2: SummoningEngine + ElderArtifacts + Glyph Engine backend + glyph reveal UI
3. Week 3: Portal visualization + epoch status + leaderboard + polish
4. Week 4: Security review + audit prep + mainnet staging
5. Week 5-6: Mainnet launch
