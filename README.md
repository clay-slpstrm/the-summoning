# 🔮 The Summoning

**An onchain game that nobody starts. Live on Ethereum mainnet.**

The Summoning is a Lovecraftian coordination game and the first release of
**The Veil Protocol**, a studio of self-running onchain games. Players mint
$RITUAL on a bonding curve and burn it in collective rituals to summon Great
Old Ones. Every 100 $RITUAL burned earns an Eldritch Glyph, a Chainlink
VRF-rolled ERC-1155 with five rarity tiers. Successful summonings mint tiered
artifacts to everyone who took part.

> *Ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn.*

## The part worth reading: a self-perpetuating game loop

Most onchain games die when the team stops showing up. This one removes the
team from the loop entirely:

```
        idle (minting open, contract waiting)
          │
          ▼
   someone burns ≥1 $RITUAL ──► the SAME transaction opens a 24h ritual
          │                     (no admin, no schedule, no start button)
          ▼
   24h collective burn race toward the on-chain threshold
          │
          ▼
   permissionless resolveEpoch() settles it (anyone can call)
          │
          ├─ WIN:  threshold += 150k, next Old One steps forward
          └─ LOSS: threshold ×0.75 (floor 25k), same Old One retries
          │
          ▼
        back to idle, next threshold pre-computed on chain … forever
```

- **Nobody starts the game.** `commitRitual()` auto-opens the next epoch when
  none is active. The opening sacrifice counts as the first contribution.
- **Difficulty is on-chain policy.** Genesis 75,000 $RITUAL. Wins ramp linearly
  (+150k). Losses decay geometrically (×3/4, floored at 25k), so a small
  community walks the difficulty down until it can win. Failure is a game
  mechanic, not an outage.
- **Settlement is permissionless.** A tiny keeper usually calls
  `resolveEpoch()`; if it dies, anyone can. The keeper key has zero protocol
  authority.
- **Randomness is Chainlink VRF v2.5**, batched one request per claim.

Honest scope note, because verify-everything cuts both ways: the owner (a
2-of-3 Safe) retains `pause()` and treasury withdrawal. What the owner cannot
do is start, schedule, or steer the game.

## Verify, don't trust

| Contract (Ethereum mainnet) | Address |
|---|---|
| SummoningEngine (self-perpetuating) | [`0x5029DDfcb2f6BA72f7C618FFd8B1237c246298d0`](https://etherscan.io/address/0x5029DDfcb2f6BA72f7C618FFd8B1237c246298d0) |
| RitualToken ($RITUAL, 1B hard cap) | [`0x8daA5B21136de9B5ac43fd89fDc98cDe934E7863`](https://etherscan.io/address/0x8daA5B21136de9B5ac43fd89fDc98cDe934E7863) |
| MintingCurve (integral pricing, 12% fee) | [`0x8c7c1C76f32277EDc12B28440224fEF0f6985462`](https://etherscan.io/address/0x8c7c1C76f32277EDc12B28440224fEF0f6985462) |
| ElderArtifacts (ERC-1155 rewards) | [`0x832436cdf21d6732fAfD22938ee2b7617D74af5A`](https://etherscan.io/address/0x832436cdf21d6732fAfD22938ee2b7617D74af5A) |
| EldritchGlyphs (ERC-1155 + VRF) | [`0xe820607743E95a694Aa50a9BFFf628C3E202D156`](https://etherscan.io/address/0xe820607743E95a694Aa50a9BFFf628C3E202D156) |
| Treasury Safe (owner, 2-of-3) | [`0x67c6f1dA08Cd99A661ec6f77A060E985d9672baB`](https://etherscan.io/address/0x67c6f1dA08Cd99A661ec6f77A060E985d9672baB) |

All five contracts are source-verified with `forge verify-bytecode` full
matches against this repo. No presale, no VC, no token allocation. The internal
security reviews that shaped the design are in the open:
[`AUDIT.md`](./AUDIT.md) (pre-launch, 2 criticals found and fixed) and
[`AUDIT-PHASE0.md`](./AUDIT-PHASE0.md) (the self-perpetuating engine, including
the loop-bricking H-01 caught by a red-green test before deploy).

**Play:** [thesummoning.xyz](https://thesummoning.xyz) · 246 Foundry tests, 10k-run fuzz, 100% branch coverage on the engine

## How it plays

1. **Mint $RITUAL**: deposit ETH into the curve (price rises with supply)
2. **Sacrifice**: burn $RITUAL any time; if no ritual is active, your burn opens one
3. **Collect glyphs**: 1 per 100 $RITUAL burned per epoch, VRF-tiered
   (Whisper 50% → Breach 1%), tradeable ERC-1155s
4. **Summon or shatter**: threshold met → Harbinger/Acolyte/Cultist artifacts by
   contribution; missed → the Shattered Ritual, proof you were there

## Repository structure

```
contracts/    → Foundry project (Solidity 0.8.24, OpenZeppelin 5, Chainlink VRF v2.5)
backend/      → Node.js/TS event indexer + WebSocket + permissionless epoch keeper
frontend/     → Next.js 14 static export + wagmi v2 (Cloudflare Pages)
subgraph/     → The Graph subgraph for event indexing
```

## Quick start (local)

Prerequisites: [Node.js 20+](https://nodejs.org/), [Foundry](https://book.getfoundry.sh/getting-started/installation), [PostgreSQL 16+](https://www.postgresql.org/)

```bash
git clone https://github.com/clay-slpstrm/the-summoning.git && cd the-summoning

# local chain + contracts
cd contracts && anvil                # terminal 1
forge script script/Deploy.s.sol --fork-url http://localhost:8545 --broadcast  # terminal 2

# backend + frontend
cd backend && npm install && npx prisma db push && npm run dev   # terminal 3
cd frontend && npm install && npm run dev                        # terminal 4
```

Visit `http://localhost:3000`. To watch the self-perpetuating loop run against
a live node with assertions: `bash contracts/script/rehearse_selfperpetuating.sh`.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Smart contracts | Solidity 0.8.24, Foundry, OpenZeppelin 5.x, Chainlink VRF v2.5 |
| Backend | Node.js 20, TypeScript, Express, Prisma, PostgreSQL |
| Frontend | Next.js 14 (static export), wagmi v2, Tailwind, Framer Motion |
| Chain | Ethereum mainnet |

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): contracts, lifecycle, API, build order
- [`AUDIT.md`](./AUDIT.md) / [`AUDIT-PHASE0.md`](./AUDIT-PHASE0.md): security reviews
- [`RUNBOOK.md`](./RUNBOOK.md): operating the self-perpetuating engine
- [`PRD.md`](./PRD.md): product spec

## License

MIT

---

*No promises. Only rituals.*
