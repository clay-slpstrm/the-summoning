---
name: brand-voice
description: Voice, copy rules, and compliance guardrails for ALL Summoning / Veil Protocol content — UI text, X posts, Discord announcements, NFT metadata, marketing. Use BEFORE writing any user-facing words for this project.
---

# The Summoning / Veil Protocol — Voice & Copy Rules

## Two registers, never mixed in one piece

- **The Herald (~70%)**: in-fiction cult chronicler. Lore, portal updates, Old One arcs.
  Present tense, ominous restraint, no exclamation marks. "The veil grows thin."
  Never explains mechanics, never sells.
- **The Builder (~30%)**: plain first-person engineering. Audit stories, mechanism
  design, verifiable claims with links. This register is what makes the Herald
  trustworthy. Never uses lore vocabulary.

## Hard guardrails (compliance + brand, NO exceptions)

1. **Never promise, imply, or meme financial upside.** No price talk, no "early",
   no charts, no APY. RITUAL is spent for fun and collectibles, like a booster box —
   say so when asked. The treasury earns from primary mints; never frame the tokens
   or NFTs as investments.
2. **The Supercycle is in-fiction prophecy ONLY** — always framed as lore
   ("the prophesied Supercycle"), never as a market expectation.
3. **Only claims that are on-chain verifiable**: provably fair (Chainlink VRF),
   source-verified contracts, 2-of-3 multisig, 1B hard cap, no presale, no VC.
   Do NOT claim "no admin functions" (owner can pause and withdraw).
4. **"We will never DM you first."** Include in pinned content; never DM-shill.
5. Failure states are content: Shattered Ritual = the rare flex, "the stars were
   not right". Own failures loudly, never spin them.

## Style mechanics (user-mandated)

- **NO em-dashes (—) in any user-visible copy.** Use commas; colon before a list
  or in titles; a period when a comma would misread. ("—" as an empty-value
  placeholder in data UI is allowed.)
- "Old Ones" capitalized; "the veil" lowercase in prose.
- UI voice: uppercase mono tracking-wide for labels, serif for lore sentences
  (see CLAUDE.md design system for fonts/colors).
- Old One names + subtitles, glyph tiers (Whisper/Echo/Tremor/Rupture/Breach with
  canonical colors), and cult ranks are canon — exact values in CLAUDE.md and
  `frontend/lib/constants.ts`. Never invent variants.

## Canonical phrases (use verbatim)

- "Make Ethereum Fun Again"
- "No promises. Only rituals."
- "Don't trust us. Verify."
- "Burn $RITUAL. Collect glyphs. Summon Old Ones."
- "The veil grows thin. The cult is gathering." (pre-launch)

## Key facts for content (verified)

- Mint: bonding curve from 0.0001 ETH, integral pricing, 12% protocol fee, 1B cap.
- Glyphs: 1 per 100 RITUAL burned per epoch, max 20/claim, VRF-assigned tier
  (50/28/15/6/1%), on-chain ERC-1155, tradeable.
- Epochs: 48h Gathering + 24h Ritual; artifacts Harbinger/Acolyte/Cultist on
  success, Shattered Ritual on failure.
- Links: thesummoning.xyz, api.thesummoning.xyz, all 5 contracts linked on /about.
- ENS: theveilprotocol.eth → treasury Safe. The Veil Protocol umbrella is NOT
  publicly revealed until after the first successful summoning — do not reference
  it in Summoning content before then.
