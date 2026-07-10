# Launch Content — Threads & Announcements

> Voice rules: `.claude/skills/brand-voice/SKILL.md`. All posts ≤280 chars,
> no em-dashes, no price talk. Post from @thesummoningxyz.

## Thread A — "What is The Summoning" (PIN THIS)

Post immediately; pin after posting. Attach `brand/x-banner.jpg` to 1/,
`brand/glyph-tiers.png` to 3/.

> **1/** Ethereum used to be fun. ICO summer. NFT summer. Onchain games that made
> you refresh the page at 3 AM. Somewhere along the way we traded that energy for
> dashboards and doomscrolling. We built The Summoning to bring the feeling back. 🧵

> **2/** The Summoning is a Lovecraftian coordination game, live on Ethereum
> mainnet. The loop: mint $RITUAL on a bonding curve, burn it as a sacrifice when
> a summoning begins, and if the cult burns enough before time runs out, an Old
> One is summoned.

> **3/** Every 100 $RITUAL sacrificed earns an Eldritch Glyph, an onchain NFT
> with a random rune, tier, and lore fragment. Five tiers: Whisper (50%), Echo
> (28%), Tremor (15%), Rupture (6%), Breach (1%). Tiers come from Chainlink VRF.
> No server decides your fate.

> **4/** Each summoning is a 72 hour event: 48h gathering, 24h ritual. Succeed,
> and every contributor claims an artifact: Harbinger for the top 1%, Acolyte for
> the top 10%, Cultist for the rest. Fail, and you claim a Shattered Ritual.
> Proof you were there.

> **5/** Don't trust us. Verify. Every contract is source-verified and linked at
> thesummoning.xyz/about. Owned by a 2-of-3 multisig. Supply hard-capped at 1B.
> No presale. No VC. No yield. You spend $RITUAL to play, like a booster box.
> No promises. Only rituals.

> **6/** The first summoning has not yet been scheduled. The veil grows thin.
> The cult is gathering. thesummoning.xyz. One rule: we will never DM you first.

## Thread B — "The First Cultists" (post 2-4 days after Thread A)

Attach `brand/x-avatar.png` or portal art to 1/.

> **1/** Before the first summoning, the cult will choose its First Cultists.
> 250 wallets. Each receives 100 $RITUAL from the treasury: enough for exactly
> one sacrifice, one glyph, one glimpse beyond the veil. Your first sacrifice,
> on us. Here is how to be chosen. 🧵

> **2/** There is no claim page. There is no form. There is no farm. The 250 are
> chosen by hand from cultists who are present before the veil opens: members of
> the Discord who follow the Herald. That is the whole rite.
> discord.gg/GUvnJRwRkq

> **3/** Why only 250? Because chosen means something farmed does not. One wallet
> each, verified as human. No bots, no scripts. The glyphs you earn are provably
> fair Chainlink VRF rolls. Even we cannot choose who pulls a Breach.

> **4/** What 100 $RITUAL buys: one sacrifice at the first summoning of Cthulhu,
> one Eldritch Glyph with a random rune and tier, and a place in cult history as
> a First Cultist. What it does not buy: any promise of anything. This is a game.
> No promises. Only rituals.

> **5/** The list closes 3 days before the first summoning begins. The chosen
> will be announced by the Herald. The tokens arrive before the gathering opens.
> And remember the one rule: we will never DM you first. The veil grows thin.

## Discord #announcements versions

### After Thread A goes up

> **The Herald speaks.**
> The Summoning is live on Ethereum mainnet. Burn $RITUAL. Collect glyphs.
> Summon Old Ones. The first summoning has not yet been scheduled; you are early,
> which is the best time to be anywhere.
> How it works: https://thesummoning.xyz/about
> The thread: [link to pinned X thread]
> One rule, always: we will never DM you first.

### After Thread B goes up

> **The First Cultists.**
> Before the first summoning, 250 of you will receive 100 $RITUAL from the
> treasury. One sacrifice, one glyph, one glimpse beyond the veil.
> To be eligible: be in this Discord, follow @thesummoningxyz, and post ONE
> wallet address in #first-cultists when the channel opens. Chosen by hand.
> No bots. One wallet per human. The list closes 3 days before the summoning.
> This is a game piece, not a promise of anything. No promises. Only rituals.

## Eligibility mechanics (operator notes, not posted)

1. Create `#first-cultists` channel (open when Thread B posts): members post one
   wallet address each. Pin: "One address per human. Editing allowed until close."
2. At list close (T0 minus 3 days): export channel, cross-check each poster is
   still a member + follows on X, eyeball for obvious bots (account age, avatar,
   history). First 250 valid entries win; announce in #announcements.
3. Batch-send: treasury self-mints 25k RITUAL via curve (~2.84 ETH round-trip,
   Safe withdraws after), then Safe multisend of 100 RITUAL x 250. Script to be
   prepared at launch week.
4. VRF budget: expect ~5-10 LINK burned by 250 single-glyph claims. Watch the
   low-LINK alert; top up from the 10-LINK reserve.

## Posting hygiene

- Reply to every genuine reply in-register (Herald for lore, Builder for tech).
- Never post links in replies to strangers' threads (spam filters).
- Screenshot-quote the contracts page when someone asks "is this a rug".
- Mirror both threads to Farcaster (cast + channel) same day, zero extra effort.
