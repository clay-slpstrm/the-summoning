"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import { GLYPH_TIERS, CULT_RANKS } from "@/lib/constants";
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

const CONTRACTS = [
  { name: "RitualToken", addr: RITUAL_TOKEN_ADDRESS },
  { name: "MintingCurve", addr: MINTING_CURVE_ADDRESS },
  { name: "SummoningEngine", addr: SUMMONING_ENGINE_ADDRESS },
  { name: "ElderArtifacts", addr: ELDER_ARTIFACTS_ADDRESS },
  { name: "EldritchGlyphs", addr: ELDRITCH_GLYPHS_ADDRESS },
] as const;

function shortAddr(addr: string): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

function Section({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: { opacity: 0, y: 40 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, #0d0d1a 0%, #050508 70%)",
        }}
      />

      <div className="relative z-10 max-w-[720px] mx-auto px-5 sm:px-6 py-8 sm:py-12">
        {/* Back nav */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[12px] sm:text-[13px] tracking-[2px] uppercase font-mono text-gray-300 hover:text-ritual-light transition-colors mb-10 sm:mb-14 font-bold"
        >
          <span>&larr;</span> Back to the Ritual
        </Link>

        {/* ─── Hero ─── */}
        <Section>
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-3xl sm:text-5xl font-bold tracking-[4px] sm:tracking-[8px] text-ritual-light uppercase text-center"
            style={{ textShadow: "0 0 80px #7c3aed44, 0 0 160px #7c3aed22" }}
          >
            The Summoning
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center text-gray-300 font-mono text-[12px] sm:text-[13px] tracking-[3px] uppercase mt-3 font-bold"
          >
            A Lovecraftian Onchain Coordination Game
          </motion.p>
        </Section>

        {/* ─── The Pitch ─── */}
        <Section className="mt-16 sm:mt-24" delay={0.1}>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-gray-200 text-center">
            Make Ethereum <em className="text-ritual-light not-italic">Fun</em> Again
          </h2>
          <p className="text-lg sm:text-xl font-serif text-gray-300 leading-relaxed text-center mt-5">
            Ethereum used to be <em className="text-ritual-light not-italic">fun</em>.
          </p>
          <p className="text-base sm:text-lg font-serif text-gray-400 leading-relaxed text-center mt-4">
            ICO summer. NFT summer. On-chain games that made you refresh the page
            at 3 AM. Somewhere along the way, we traded that energy for dashboards
            and doom-scrolling.
          </p>
          <p className="text-base sm:text-lg font-serif text-gray-300 leading-relaxed text-center mt-4">
            The Summoning is a love letter to that feeling, built for the current moment.
            Instead of watching charts, you&apos;re channeling collective degen energy into
            summoning the Old Ones to bring about the prophesied Supercycle upon the crypto market.
          </p>
        </Section>

        {/* ─── How It Works ─── */}
        <Section className="mt-16 sm:mt-24" delay={0.1}>
          <h2 className="text-[13px] sm:text-[14px] tracking-[4px] uppercase font-mono text-gray-300 font-bold mb-8 text-center">
            The Ritual, Explained
          </h2>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="space-y-6"
          >
            {[
              {
                step: "I",
                title: "Mint $RITUAL",
                desc: "Deposit ETH into the minting curve. The price rises with supply, early believers pay less. You receive $RITUAL tokens, the fuel for everything that follows.",
                color: "#7c3aed",
              },
              {
                step: "II",
                title: "Sacrifice to the Void",
                desc: "Burn your $RITUAL whenever you choose. If no summoning is active, your sacrifice IS the beginning: it opens a 24-hour ritual on the spot — no schedule, no announcement, no one's permission. Every burn feeds the portal and earns provably fair Eldritch Glyphs, on-chain ERC-1155 NFTs with a random rune, tier, and lore fragment.",
                color: "#A855F7",
              },
              {
                step: "III",
                title: "Collect Glyphs, Rise in Rank",
                desc: "Glyphs come in five tiers from common Whispers to the mythic Breach. Collect enough and your cult rank rises, from Uninitiated to Herald of the Breach. Each glyph is yours to keep or trade.",
                color: "#4A9EFF",
              },
              {
                step: "IV",
                title: "Summon the Old One",
                desc: "If the collective sacrifice meets the threshold before the 24 hours run out, the summoning succeeds — the threshold rises and the next Old One awaits. If it fails, the threshold eases and the same Old One waits for the cult to regroup. Top contributors earn tiered artifacts: Harbinger, Acolyte, or Cultist. Failure mints the Shattered Ritual. Proof you tried. Either way, the game never stops: the next sacrifice always opens the next summoning.",
                color: "#EF4444",
              },
            ].map((item) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="flex gap-4 sm:gap-5"
              >
                <div
                  className="text-2xl sm:text-3xl font-serif font-bold shrink-0 w-10 text-right"
                  style={{ color: item.color, opacity: 0.5 }}
                >
                  {item.step}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-serif text-gray-200">
                    {item.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-300 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Section>

        {/* ─── Glyph Tiers ─── */}
        <Section className="mt-16 sm:mt-24" delay={0.1}>
          <h2 className="text-[13px] sm:text-[14px] tracking-[4px] uppercase font-mono text-gray-300 font-bold mb-6 text-center">
            Eldritch Glyphs
          </h2>
          <p className="text-sm sm:text-base text-gray-300 text-center mb-8 max-w-md mx-auto">
            Every sacrifice mints a glyph. Tier is determined by Chainlink VRF,
            provably fair and fully on-chain. No server decides your fate.
          </p>

          <div className="grid grid-cols-5 gap-2 sm:gap-3 max-w-sm mx-auto">
            {GLYPH_TIERS.map((tier) => (
              <motion.div
                key={tier.name}
                whileHover={{ scale: 1.1, y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center text-xl sm:text-2xl border"
                  style={{
                    background: tier.bg,
                    borderColor: tier.color + "44",
                    boxShadow: `0 0 12px ${tier.glow}`,
                  }}
                >
                  <span style={{ color: tier.color, filter: `drop-shadow(0 0 6px ${tier.color})` }}>
                    {tier.symbol}
                  </span>
                </div>
                <span
                  className="text-[11px] sm:text-[12px] font-mono tracking-wider font-bold"
                  style={{ color: tier.color }}
                >
                  {tier.name}
                </span>
                <span className="text-[11px] text-gray-300 font-mono">
                  {(tier.chance * 100).toFixed(0)}%
                </span>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ─── Cult Ranks ─── */}
        <Section className="mt-16 sm:mt-24" delay={0.1}>
          <h2 className="text-[13px] sm:text-[14px] tracking-[4px] uppercase font-mono text-gray-300 font-bold mb-6 text-center">
            Cult Ranks
          </h2>
          <p className="text-sm sm:text-base text-gray-300 text-center mb-8 max-w-md mx-auto">
            Your rank reflects your devotion. Collect glyphs to ascend.
          </p>

          <div className="space-y-2 max-w-sm mx-auto">
            {CULT_RANKS.map((rank) => (
              <div
                key={rank.name}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{
                  background: `${rank.color}08`,
                  border: `1px solid ${rank.color}22`,
                }}
              >
                <span
                  className="text-xs sm:text-sm font-serif"
                  style={{ color: rank.color }}
                >
                  {rank.name}
                </span>
                <span className="text-[12px] font-mono text-gray-300">
                  {rank.minGlyphs === 0 ? "Start" : `${rank.minGlyphs} glyphs`}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── Why This Exists ─── */}
        <Section className="mt-16 sm:mt-24" delay={0.1}>
          <h2 className="text-[13px] sm:text-[14px] tracking-[4px] uppercase font-mono text-gray-300 font-bold mb-6 text-center">
            Why
          </h2>
          <div className="space-y-4 text-sm sm:text-base text-gray-400 font-serif leading-relaxed text-center max-w-lg mx-auto">
            <p>
              The feedback loop is the point. The glyph gacha, the cult ranks,
              the collective portal progress. It&apos;s designed to be slightly
              addicting because the best games are.
            </p>
            <p>
              We didn&apos;t build another yield farm or another governance token.
              We built a game, one that rewards coordination, creates shared
              moments, and gives you something tangible for showing up.
            </p>
            <p className="text-gray-500">
              Everything is on-chain. Glyphs are ERC-1155 NFTs with provably fair
              VRF randomness. Artifacts are on-chain. The minting curve is transparent
              and deterministic. No hidden servers deciding your fate. No rug vectors.
              Just a portal, a void, and whatever is on the other side.
            </p>
          </div>
        </Section>

        {/* ─── Fully On-Chain ─── */}
        <Section className="mt-16 sm:mt-24" delay={0.1}>
          <div
            className="rounded-xl p-5 sm:p-8 text-center"
            style={{
              background: "linear-gradient(135deg, #4c1d9515, #7c3aed10)",
              border: "1px solid #7c3aed22",
            }}
          >
            <h3 className="text-[12px] sm:text-[13px] tracking-[3px] uppercase font-mono text-gray-300 mb-4 font-bold">
              Fully On-Chain
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {[
                { label: "Minting Curve", detail: "Deterministic pricing" },
                { label: "Glyph Tiers", detail: "Chainlink VRF" },
                { label: "Artifacts", detail: "ERC-1155 NFTs" },
                { label: "Epoch Logic", detail: "Smart contracts" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-xs sm:text-sm text-ritual-light font-serif">
                    {item.label}
                  </div>
                  <div className="text-[11px] sm:text-[12px] text-gray-300 font-mono mt-0.5">
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6" style={{ borderTop: "1px solid #7c3aed22" }}>
              <div className="text-[11px] sm:text-[12px] tracking-[3px] uppercase font-mono text-gray-300 mb-4 font-bold">
                Don&apos;t trust us. Verify.
              </div>
              <div className="space-y-1.5 max-w-xs mx-auto">
                {CONTRACTS.map((c) => (
                  <a
                    key={c.name}
                    href={`${EXPLORER_BASE}/address/${c.addr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-[12px] sm:text-[13px] font-mono text-gray-300 hover:text-ritual-light transition-colors no-underline"
                  >
                    <span>{c.name}</span>
                    <span>
                      {shortAddr(c.addr)} <span aria-hidden>&#8599;</span>
                    </span>
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 font-mono mt-4 leading-relaxed">
                Source-verified on Etherscan. Owned by a 2-of-3 multisig.
                Supply hard-capped at 1B $RITUAL.
              </p>
            </div>
          </div>
        </Section>

        {/* ─── CTA ─── */}
        <Section className="mt-16 sm:mt-24 mb-12 sm:mb-16 text-center" delay={0.1}>
          <p className="text-sm sm:text-base text-gray-300 font-mono tracking-wide mb-6">
            The portal is open. The Old Ones are waiting.
          </p>
          <Link
            href="/"
            className="btn-sacrifice inline-block px-10 sm:px-14 py-4 text-sm sm:text-base no-underline"
          >
            Enter the Ritual
          </Link>
          <p className="text-[11px] text-gray-400 font-mono tracking-wider mt-4 italic">
            &ldquo;That is not dead which can eternal lie&rdquo;
          </p>
        </Section>

        <Footer />
      </div>
    </div>
  );
}
