# Week 1 Scheduled Posts (from 2026-07-20)

Cadence: ONE single post/day + ONE thread/week (Sunday). Load into X native
scheduler in one sitting. Voice rules: brand-voice skill. Attachments noted.

Mon (Herald; attach backend/public/artifacts/1/1.jpg):
He does not know your name. He does not need to. When the portal fills, He will
know the cult as one voice. The first summoning will call the Dreaming One.

Tue (Builder):
Why build a game where the token cannot be sold? Because every crypto game I
loved died the day its chart mattered more than its play. $RITUAL has one exit:
the portal. That single constraint shaped every design decision that followed.

Wed (Herald; attach brand/glyph-tiers.png):
Five tiers. Whisper, Echo, Tremor, Rupture, Breach. One roll per 100 $RITUAL
sacrificed, decided by Chainlink VRF. 1 in 100 tears a Breach. The cult does
not choose its marked ones.

Thu (Builder):
Six weeks before mainnet, a live testnet rehearsal caught our VRF callback
running out of gas. The test suite said everything was fine. 10,000 fuzz runs
said everything was fine. The full war story is coming soon. Rehearse
everything.

Fri (Herald):
Seven ranks. Uninitiated to Herald of the Breach. Your rank is not what you
hold. It is written onchain by what you have burned.

Sat (Herald; attach backend/public/artifacts/1/0.jpg):
Not every summoning succeeds. Those present when the stars were wrong carry the
Shattered Ritual. Some marks can only be earned by failing.

Sun THREAD (Builder, manifesto "why I built this"):
1/ I did not fall in love with crypto because of charts. I fell in love the
first time I minted an NFT at 2am, refreshing the reveal like a kid at
christmas. Not because it might be worth something. Because it was mine. I
built The Summoning to chase that feeling.
2/ Somewhere along the way, onchain life narrowed to two options: farm yield
or hunt exit liquidity. Everything became a chart. Every mint became a ticket
out. We stopped making things that were fun to own and started making things
that were only fun to sell.
3/ The thing that makes Ethereum special is not any of that. It is
coordination: ten thousand strangers committing to a common goal without
trusting each other, without a company, without permission. That is the magic
almost nobody builds games around.
4/ So The Summoning is a coordination ritual disguised as a game. Everyone
burns $RITUAL toward one shared threshold. Nobody can summon alone. If the
cult clears it together, the Old One rises and every contributor claims an
artifact. Your sacrifice is onchain forever.
5/ Every 100 burned rolls a glyph: provably fair, VRF-random, yours. The mint
IS the game. The reveal is the reward. No yield, no promises, and you cannot
even sell $RITUAL. The only exit is the portal.
6/ Our lore says the summonings will bring the prophesied Supercycle. That is
prophecy, not a promise, and anyone selling you certainty about markets is
running a different kind of cult. What I can promise: minting will feel like
a mint again.
7/ Ethereum can be more than a casino bolted to a savings account. It can be
a campfire. The first summoning approaches. thesummoning.xyz. No promises.
Only rituals.

## BANKED: VRF war-story thread (use for Daily Gwei dev crowd, week 2+)
1/ Six weeks before mainnet, our Chainlink VRF callback ran out of gas live on
Sepolia. This is the story of the bug that 10,000 fuzz runs could not catch,
and why glyph claims are capped at 20.
2/ The design: sacrifices burn $RITUAL, glyphs are claimed after the epoch
resolves. One claim = one VRF request returning N random words, N =
contribution / 100, capped at 50. The math was proven. Every test passed.
3/ What forge cannot simulate: Chainlink's real callback gas ceiling is 2.5M.
A 50-glyph fulfillment needs about 6M. On our first Sepolia rehearsal, a real
claim hit the ceiling and the mint reverted inside the callback itself.
4/ The fix: cap claims at 20 words. Measured fulfillment at 2.04M gas,
comfortably under the ceiling. Whales just claim again. Plus a hard test
asserting the max batch stays under 2.4M so no future change can quietly
break it.
5/ The lesson: fuzz tests prove your math. Rehearsals prove your assumptions.
We ran the full lifecycle on a testnet three times before touching mainnet.
Rehearse everything.
6/ The randomness your glyphs roll on survived all of it. Verify every
contract yourself: thesummoning.xyz/about. No promises. Only rituals.

## Content policy reminders
- Journey/why-I-built = Builder register: YES.
- In-season game future (five Old Ones, doubling thresholds): YES.
- Veil Protocol / future utility / ecosystem promises: NO until after the
  first successful summoning.
- Daily = single posts. Threads = weekly.
