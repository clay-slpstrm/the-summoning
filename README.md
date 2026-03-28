# 🔮 The Summoning

**A Lovecraftian Onchain Coordination Game on Ethereum Mainnet**

Players collectively burn $RITUAL tokens to breach the veil and summon Great Old Ones. Every sacrifice triggers an Eldritch Glyph — a gacha-style micro-reward with five rarity tiers. Successful summonings mint tiered ERC-1155 artifacts to participants.

> *Ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn.*

## How It Works

1. **Mint $RITUAL** — Deposit ETH into the minting curve to receive $RITUAL tokens
2. **Join the Ritual** — During the Ritual Phase, sacrifice $RITUAL to help breach the veil
3. **Receive Glyphs** — Every sacrifice reveals an Eldritch Glyph (5 rarity tiers, 50% → 1%)
4. **Summon the Old One** — If the collective burn threshold is met, the Old One is summoned
5. **Claim Artifacts** — Successful participants claim tiered ERC-1155 reward artifacts

## Repository Structure

```
contracts/    → Foundry project (Solidity smart contracts)
backend/      → Node.js API + WebSocket + Glyph Engine
frontend/     → Next.js 14 + wagmi + Tailwind
subgraph/     → The Graph subgraph for event indexing
```

## Quick Start

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [PostgreSQL 16+](https://www.postgresql.org/)

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/your-org/the-summoning.git
cd the-summoning

# 2. Start local Ethereum node
cd contracts && anvil

# 3. Deploy contracts locally (new terminal)
forge script script/Deploy.s.sol --fork-url http://localhost:8545 --broadcast

# 4. Start backend (new terminal)
cd backend && npm install && npx prisma db push && npm run dev

# 5. Start frontend (new terminal)
cd frontend && npm install && npm run dev
```

Visit `http://localhost:3000` to open the application.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24+, Foundry, OpenZeppelin 5.x |
| Backend | Node.js 20, TypeScript, Express, Prisma, PostgreSQL |
| Frontend | Next.js 14, wagmi v2, Tailwind CSS, Framer Motion |
| Blockchain | Ethereum Mainnet (Sepolia testnet) |
| Indexing | The Graph (subgraph) |
| Oracles | Chainlink VRF v2.5, Chainlink Automation |

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — Development instructions for Claude Code CLI
- [`PRD.md`](./PRD.md) — Product requirements and feature specifications
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Technical architecture and implementation reference

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `RitualToken.sol` | ERC-20 $RITUAL token with restricted minting |
| `MintingCurve.sol` | ETH → $RITUAL minting with 12% protocol fee |
| `SummoningEngine.sol` | Epoch lifecycle, token burns, reward distribution |
| `ElderArtifacts.sol` | ERC-1155 multi-token for summoning rewards |

## License

MIT
