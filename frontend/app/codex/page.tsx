/**
 * /codex — the flagship engineering writeup ("the game nobody starts").
 *
 * Builder register throughout (plain first person, receipts, zero lore
 * vocabulary). This is the canonical link target for the X thread, Show HN,
 * and Farcaster: every external mention points here, every claim on the page
 * is verifiable on chain today. Server component on purpose: it exports its
 * own SEO metadata and ships zero client JS.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import {
  RITUAL_TOKEN_ADDRESS,
  MINTING_CURVE_ADDRESS,
  SUMMONING_ENGINE_ADDRESS,
  ELDER_ARTIFACTS_ADDRESS,
  ELDRITCH_GLYPHS_ADDRESS,
} from "@/lib/contracts";

const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_CHAIN_ID === "11155111"
    ? "https://sepolia.etherscan.io"
    : "https://etherscan.io";

export const metadata: Metadata = {
  title: "How The Summoning runs itself: a self-perpetuating onchain game",
  description:
    "No admin starts the game. The first sacrifice opens each 24 hour ritual, difficulty is on-chain policy, and failure is a mechanic. The full mechanism design, with receipts.",
  alternates: { canonical: "/codex" },
  openGraph: {
    title: "The game nobody starts",
    description:
      "An onchain game with no admin in the loop: demand-driven epochs, on-chain difficulty, provable randomness. Every claim checkable on Ethereum mainnet.",
  },
};

const CONTRACTS = [
  { name: "SummoningEngine", addr: SUMMONING_ENGINE_ADDRESS, note: "the self-perpetuating loop" },
  { name: "RitualToken", addr: RITUAL_TOKEN_ADDRESS, note: "$RITUAL, 1B hard cap" },
  { name: "MintingCurve", addr: MINTING_CURVE_ADDRESS, note: "integral pricing, 12% fee" },
  { name: "ElderArtifacts", addr: ELDER_ARTIFACTS_ADDRESS, note: "ERC-1155 reward artifacts" },
  { name: "EldritchGlyphs", addr: ELDRITCH_GLYPHS_ADDRESS, note: "ERC-1155 glyphs + Chainlink VRF" },
] as const;

const ESCALATION = [
  { epoch: "Genesis", threshold: "75,000", rule: "fixed constant, Cthulhu" },
  { epoch: "After a win", threshold: "prior + 150,000", rule: "linear ramp, next Old One" },
  { epoch: "After a loss", threshold: "prior × 0.75", rule: "floored at 25,000, same Old One" },
] as const;

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-xl sm:text-2xl text-gray-100 mt-12 mb-4">{children}</h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-gray-300 mb-4">{children}</p>;
}

export default function CodexPage() {
  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #0d0d1a 0%, #050508 70%)" }}
      />
      <article className="relative z-10 max-w-[680px] mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <Link
          href="/"
          className="text-[12px] font-mono font-bold tracking-[2px] uppercase text-gray-400 hover:text-ritual-light transition-colors no-underline"
        >
          ← The Ritual
        </Link>

        <p className="section-label mt-10">The Codex</p>
        <h1 className="font-heading text-3xl sm:text-4xl text-gray-50 mt-2 leading-tight">
          The game nobody starts
        </h1>
        <p className="text-sm text-gray-500 font-mono mt-3">
          How The Summoning runs itself. Written by the builder. Every claim checkable on chain.
        </p>

        {/* 1 — the problem: permanence betrayed */}
        <H2>Contracts are forever. Games are not.</H2>
        <P>
          The best property Ethereum has is permanence. A contract deployed today will still
          execute, byte for byte, long after every server from this decade is landfill.
          Onchain games should inherit that: worlds that simply cannot be shut down.
        </P>
        <P>
          They do not.{" "}
          <a
            href="https://cointelegraph.com/news/three-quarters-web3-blockchain-games-failed-last-five-years-coingecko"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ritual-light hover:underline"
          >
            Over 75% of the 2,817 web3 games launched between 2018 and 2023 are dead
          </a>
          , by CoinGecko&apos;s count. The contracts are all still there, immortal and idle.
          What died was everything around them: the funding, the roadmap, and above all the
          humans the game needed to keep running, the admin key that starts the next round,
          the server that quietly became load-bearing. Permanence was the promise, and a
          human in the loop was the leak.
        </P>
        <P>
          The Summoning is my attempt to actually collect on Ethereum&apos;s promise.
          Showing up is not my job. The game has no schedule, no start button, and no dev in
          the gameplay loop. It is live on mainnet right now, waiting, and it will keep
          working whether or not anyone shows up, including me.
        </P>

        {/* 2 — the lifecycle */}
        <H2>The lifecycle: demand opens the game</H2>
        <P>
          Players mint $RITUAL on a bonding curve, then burn it in collective rituals to
          summon Old Ones. The interesting part is what happens when no ritual is active:
        </P>
        <pre
          className="card overflow-x-auto text-[12px] sm:text-[13px] leading-relaxed font-mono text-gray-300 p-4 sm:p-5 my-6"
          aria-label="lifecycle diagram"
        >{`      idle (minting open, contract waiting)
        │
        ▼
 someone burns ≥ 1 $RITUAL ──► the SAME transaction
        │                      opens a 24h ritual
        ▼
 24h collective burn race toward the threshold
        │
        ▼
 permissionless resolveEpoch()  (anyone can call)
        │
        ├─ WIN:  threshold +150k, next Old One
        └─ LOSS: threshold ×0.75, same Old One
        │
        ▼
      back to idle … forever`}</pre>
        <P>
          There is no privileged opener. The first line of <code className="text-ritual-light">commitRitual()</code> in
          the verified source:
        </P>
        <pre className="card overflow-x-auto text-[12px] sm:text-[13px] leading-relaxed font-mono text-gray-300 p-4 sm:p-5 my-6">{`function commitRitual(uint256 amount) external nonReentrant whenNotPaused {
    // Self-perpetuating auto-start: if no epoch has ever opened, or the
    // current one is already resolved, this sacrifice opens the next epoch
    // (threshold + Old One derived on-chain) before it is counted.
    if (currentEpochId == 0 || epochs[currentEpochId].resolved) {
        _openNextEpoch();
    }
    ...`}</pre>
        <P>
          The opening sacrifice is not a setup transaction. It counts as the first
          contribution of the epoch it creates. One person, one burn, and a 24 hour clock
          the whole world can watch is running.
        </P>

        {/* 3 — difficulty */}
        <H2>Difficulty is on-chain policy</H2>
        <P>
          Nobody picks the next target either. The threshold for a successful summoning is
          computed by the contract from the previous outcome:
        </P>
        <div className="card overflow-x-auto my-6">
          <table className="w-full text-[13px] font-mono">
            <thead>
              <tr className="text-left text-gray-500 uppercase tracking-wider text-[11px]">
                <th className="p-3">State</th>
                <th className="p-3">Next threshold ($RITUAL)</th>
                <th className="p-3">Rule</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {ESCALATION.map((r) => (
                <tr key={r.epoch} className="border-t border-void-border">
                  <td className="p-3">{r.epoch}</td>
                  <td className="p-3 text-ritual-light">{r.threshold}</td>
                  <td className="p-3 text-gray-400">{r.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          The asymmetry is deliberate. Wins ramp linearly, a fixed +150,000 each time, so a
          growing community faces a steadily rising wall rather than an exponential one.
          Losses decay geometrically to a floor of 25,000, so a summoning is always
          reachable. The two curves meet in the middle: the game finds the difficulty its
          community can actually sustain, with no one tuning it.
        </P>

        {/* 4 — failure */}
        <H2>Failure is a mechanic, not an outage</H2>
        <P>
          If a ritual ends below threshold, the epoch fails honestly. Participants can still
          claim their glyphs, plus a failure memento (the Shattered Ritual). The threshold
          eases, the same Old One waits, and the next sacrifice starts the next attempt.
        </P>
        <P>
          This is what lets the game idle gracefully. A small community can fail its way
          down from 75,000 to the 25,000 floor and then win, and every failed attempt along
          the way is a public, on-chain story beat rather than a dead project. Most games
          need momentum to survive. This one is built to wait.
        </P>

        {/* 5 — randomness */}
        <H2>Provable randomness, with a scar</H2>
        <P>
          Every 100 $RITUAL burned in an epoch earns one Eldritch Glyph, an ERC-1155 whose
          rarity tier is rolled by Chainlink VRF. One VRF request per claim returns up to 20
          random words, one glyph each. Nobody, including me, can choose the outcome.
        </P>
        <P>
          The 20 cap has a story. The original audit suggested 50. A testnet rehearsal ran
          the real callback and hit an out-of-gas inside Chainlink&apos;s 2.5M gas ceiling,
          a stuck batch and lost LINK. We measured, resized to 20 with a ~17% margin, and
          wrote the number down next to the scar it came from.
        </P>

        {/* 6 — honest scope */}
        <H2>What the owner can still do</H2>
        <P>
          Verify-everything cuts both ways, so here is the honest scope. A 2-of-3 multisig
          owns the contracts. It can pause gameplay in an incident and it can withdraw the
          treasury, both visible on chain. What it cannot do is start a ritual on a
          schedule, pick a threshold, choose a glyph, or stop the resolution of an epoch
          already running. The loop needs no one, and resolution stays live even under
          pause.
        </P>
        <P>
          A tiny keeper server usually calls <code className="text-ritual-light">resolveEpoch()</code> at
          the bell, but the function is permissionless by design. If my server dies, anyone
          with gas money settles the round. The keeper key holds zero protocol authority.
        </P>

        {/* 7 — verify */}
        <H2>Verify, don&apos;t trust</H2>
        <div className="card overflow-x-auto my-6">
          <table className="w-full text-[12px] sm:text-[13px] font-mono">
            <tbody className="text-gray-300">
              {CONTRACTS.map((c) => (
                <tr key={c.name} className="border-t first:border-t-0 border-void-border">
                  <td className="p-3 whitespace-nowrap">{c.name}</td>
                  <td className="p-3 text-gray-500">{c.note}</td>
                  <td className="p-3">
                    <a
                      href={`${EXPLORER_BASE}/address/${c.addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ritual-light hover:underline break-all"
                    >
                      {c.addr.slice(0, 10)}…{c.addr.slice(-6)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          All five contracts are source-verified with full bytecode matches against the
          public repo. The security reviews are in the open too, including the internal
          audit that caught a loop-bricking bug in this exact mechanism before it shipped:{" "}
          <a
            href="https://github.com/clay-slpstrm/the-summoning"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ritual-light hover:underline"
          >
            github.com/clay-slpstrm/the-summoning
          </a>{" "}
          (AUDIT.md, AUDIT-PHASE0.md; 246 tests, 10,000-run fuzzing, 100% branch coverage on
          the engine).
        </P>
        <P>
          The Summoning is the first game built this way under The Veil Protocol. It will
          not be the last. The thesis of the whole studio fits in one line: things that
          live onchain should live forever, and games should be one of them. Make Ethereum
          Fun Again. No promises. Only rituals.
        </P>

        <div className="text-center mt-12">
          <Link href="/" className="btn-sacrifice inline-block px-10 no-underline">
            Enter the Ritual
          </Link>
          <p className="text-[12px] font-mono text-gray-500 mt-4 tracking-wider">
            The first sacrifice opens the summoning.
          </p>
        </div>

        <Footer showAbout />
      </article>
    </div>
  );
}
