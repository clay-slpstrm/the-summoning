# MARKETING.md — Pre-Launch Traction Plan

> Goal: fill the room BEFORE the Safe calls `startEpoch`. The 48h gathering clock
> starts the instant that transaction executes, and "the first summoning in
> history" is a one-time marketing moment. See RUNBOOK.md for the launch mechanics.

## 1. The concrete target

Epoch 1 succeeds at **50,000 RITUAL burned ≈ 5.7 ETH collective ≈ 25 "full-pack"
wallets** (2,000 RITUAL each) or ~50–60 mixed casual/committed wallets.

Working backwards at typical crypto funnel rates (~5% visitor→wallet):

| Metric | Target before T0 |
|---|---|
| Engaged site visitors (CF Web Analytics) | 500–1,000 |
| X followers | 300+ |
| Discord members | 100+ |
| Wallets that have minted any $RITUAL | 40+ (mint opens before epoch 1 — the curve is live now) |

The mint-before-launch number is the truest signal: minting works today, and
RITUAL bought now is RITUAL waiting to be burned at T0.

## 2. Positioning & guardrails

**The pitch:** Make Ethereum Fun Again. A Lovecraftian coordination game where the
community collectively summons Old Ones. Provably fair (Chainlink VRF), fully
on-chain, no presale, no VC, no yield, supply hard-capped, multisig-owned,
source-verified. "Don't trust us. Verify." (the about page links every contract).

**Hard rules for every post, reply, and DM — no exceptions:**
- Never promise, imply, or meme token price appreciation. No "early", no "ape now
  before", no charts. The Supercycle is *in-fiction prophecy*, always framed as lore.
- It's a game you spend on for fun and collectibles, like a booster box. Say so.
- Never DM-shill. Never paid-shill without disclosure. No engagement bait
  ("tag 3 cultists") in the first weeks — earn credibility first.
- Failure states are content, not embarrassments (Shattered Ritual = the rare flex).

## 3. Channels, in priority order

### X (primary stage)
- Handle: TBD → set `NEXT_PUBLIC_X_URL` and update here.
- Cadence: 1 lore/art post per day + 1 substantive builder post per week.
- Bio links to thesummoning.xyz; pinned post = the "what is this" thread.

### Farcaster (best audience fit)
- The onchain-games/degen crowd lives here and distribution is native.
- Mirror the X cadence into relevant channels (/onchain-games, /nft, /degen).
- Post-launch: live portal-progress casts during ritual windows.

### Discord (home base, not a megaphone)
- Own server: #welcome, #lore, #ritual-status (webhook potential later),
  #glyph-flexes, #summoning-strategy. Invite link → `NEXT_PUBLIC_DISCORD_URL`.
- Other servers: join 5–10 onchain-gaming/NFT communities and *participate
  genuinely*; share only where self-promo is on-topic. Cold-posting = spam = bans.

### Secondary (opportunistic)
- Reddit r/ethereum / r/ethfinance: one honest "we built a Lovecraftian burn game,
  here's the mechanism design" post — builder framing, not promotion.
- Telegram: mirror announcements only.

## 4. Content arsenal (already have the assets)

1. **Lore arc per Old One** (5 arcs × 4 artifact art pieces = 20 images at
   `backend/public/artifacts/`). Tease Cthulhu's arc pre-launch; hold the rest.
2. **Builder-cred threads** (crypto X shares these; each is true and checkable):
   - The audit story: C-01 sacrifice/VRF decoupling, what almost shipped.
   - The live Sepolia OOG that cut glyph batches 50 → 20 (2.5M gas ceiling).
   - Bonding-curve integral pricing: why big mints can't underpay (H-03).
   - "Don't trust us, verify": walking the 5 verified contracts + Safe setup.
3. **Mechanics explainers**: glyph odds table (50/28/15/6/1), cult ranks ladder,
   the 100-RITUAL glyph unit, portal threshold math.
4. **Visual candy**: portal animation screen recordings, glyph reveal flow
   (the booster-pack moment), server-rendered glyph SVGs.

## 5. Phase plan

### Phase 0 — Infrastructure (this week) ✅ = shipped
- ✅ Pre-launch hero on site (soft mode: no date, social CTAs)
- ✅ OG/Twitter card meta + share image (link previews everywhere)
- ✅ Cloudflare Web Analytics
- ☐ Create X account, Discord server → set `NEXT_PUBLIC_X_URL` /
  `NEXT_PUBLIC_DISCORD_URL`, rebuild, deploy (recipe in memory/RUNBOOK)
- ☐ Pinned "what is The Summoning" X thread + matching Discord #welcome

### Phase 1 — Drumbeat (1–2 weeks)
- Daily lore/art cadence on X + Farcaster; weekly builder thread.
- Genuine participation in target communities; soft mentions where welcome.
- Watch CF Analytics + follower counts weekly against §1 targets.

### Phase 2 — Crescendo (final week)
- Announce the T0 date/time → set `NEXT_PUBLIC_LAUNCH_AT` → countdown goes live
  on-site automatically (hard mode).
- Daily countdown-flavored lore ("the stars align in N days").
- Remind that minting is already open: walking in with a full pack ready > FOMO-minting
  mid-ritual.

### Phase 3 — T0 and the live loop
- Execute RUNBOOK.md. Announcement fires the moment the Safe tx lands.
- During gathering: portal-progress updates at milestones (25/50/75/90%).
- During ritual: live totalCommitted casts; leaderboard screenshots.
- Resolution: success → artifact-claim celebration + next Old One tease at 1.3×;
  failure → own it loudly, Shattered Ritual lore, retry at 0.8× ("the cult regroups").

## 6. T0 timing (from RUNBOOK, repeated because it's a marketing decision)

The **ritual window is T+48h → T+72h** — that's when burns happen and the game is
most alive. Schedule T0 so the ritual lands in peak crossover hours.
Recommended: **T0 Thursday ~16:00 UTC → ritual window Saturday 16:00 UTC through
Sunday 16:00 UTC** (US morning ↔ EU evening, weekend).

## 7. Measurement

- **Site**: Cloudflare Web Analytics (visitors, referrers — which channel works).
- **Social**: X/Farcaster follower + impression trends, Discord member count.
- **Onchain (ground truth)**: unique `TokensMinted` buyers on the curve, RITUAL
  supply, and post-T0 `RitualSacrifice` participant counts via the backend API.
- Review weekly during Phase 1; go/no-go for Phase 2 when §1 targets are ~70% met
  or 2 weeks elapse, whichever first (don't let the drumbeat go stale).
