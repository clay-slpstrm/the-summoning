"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReadContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { useGlyphStore } from "@/stores/glyphStore";
import { GLYPH_TIERS, OLD_ONES, RUNE_SHAPES } from "@/lib/constants";
import {
  ELDRITCH_GLYPHS_ADDRESS,
  SUMMONING_ENGINE_ADDRESS,
  SUMMONING_ENGINE_ABI,
} from "@/lib/contracts";
import { isMainnet } from "@/lib/chains";

const TIER_RARITY_LABEL: Record<string, string> = {
  Whisper: "Common",
  Echo: "Uncommon",
  Tremor: "Rare",
  Rupture: "Legendary",
  Breach: "Mythic",
};

const TIER_BASE_RATE: Record<string, string> = {
  Whisper: "50%",
  Echo: "28%",
  Tremor: "15%",
  Rupture: "6%",
  Breach: "1%",
};

function openseaUrl(tokenId: number): string {
  const network = isMainnet ? "ethereum" : "sepolia";
  const host = isMainnet ? "opensea.io" : "testnets.opensea.io";
  return `https://${host}/assets/${network}/${ELDRITCH_GLYPHS_ADDRESS}/${tokenId}`;
}

function etherscanUrl(tokenId: number): string {
  const host = isMainnet ? "etherscan.io" : "sepolia.etherscan.io";
  return `https://${host}/token/${ELDRITCH_GLYPHS_ADDRESS}?a=${tokenId}`;
}

export default function GlyphDetailModal() {
  const glyph = useGlyphStore((s) => s.selectedGlyph);
  const close = useGlyphStore((s) => s.setSelectedGlyph);

  // Close on Escape
  useEffect(() => {
    if (!glyph) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [glyph, close]);

  return (
    <AnimatePresence>
      {glyph && <GlyphDetailContent glyph={glyph} onClose={() => close(null)} />}
    </AnimatePresence>
  );
}

function GlyphDetailContent({
  glyph,
  onClose,
}: {
  glyph: NonNullable<ReturnType<typeof useGlyphStore.getState>["selectedGlyph"]>;
  onClose: () => void;
}) {
  const tier = GLYPH_TIERS.find((t) => t.name === glyph.tierName) ?? GLYPH_TIERS[0];
  const runeIndex = RUNE_SHAPES.indexOf(glyph.rune as (typeof RUNE_SHAPES)[number]);

  // Look up the actual oldOneId for this epoch on-chain — owner picks per epoch,
  // not derivable from epochId via modulo.
  const { data: epochData } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "getEpoch",
    args: [BigInt(glyph.epochId)],
    chainId: sepolia.id,
  });

  const oldOneId = epochData ? Number(epochData[0]) : 0;
  const oldOne = oldOneId > 0 ? OLD_ONES.find((o) => o.id === oldOneId) : undefined;
  const rarityLabel = TIER_RARITY_LABEL[glyph.tierName] ?? "Glyph";
  const baseRate = TIER_BASE_RATE[glyph.tierName] ?? "—";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ background: "rgba(5, 5, 8, 0.85)" }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-md card"
        style={{
          background: "#0d0d15",
          border: `1px solid ${tier.color}55`,
          boxShadow: `0 0 60px ${tier.glow}, 0 0 120px ${tier.glow}`,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-100 transition-colors text-lg"
          style={{ background: "#1e1e2e" }}
        >
          ✕
        </button>

        {/* Large rune render */}
        <div className="flex flex-col items-center pt-4 pb-2">
          <div
            className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl flex items-center justify-center text-7xl sm:text-8xl"
            style={{
              background: tier.bg,
              border: `1px solid ${tier.color}66`,
              boxShadow: `0 0 32px ${tier.glow}, inset 0 0 24px ${tier.color}22`,
            }}
          >
            <span
              style={{
                color: tier.color,
                filter: `drop-shadow(0 0 12px ${tier.color})`,
              }}
            >
              {glyph.rune}
            </span>
          </div>
        </div>

        {/* Tier heading */}
        <div className="text-center mt-3">
          <div
            className="font-heading text-2xl sm:text-3xl font-bold tracking-wide"
            style={{ color: tier.color }}
          >
            {glyph.tierName} Glyph
          </div>
          <div className="text-[13px] sm:text-[14px] font-mono uppercase tracking-[3px] text-gray-300 mt-1">
            {rarityLabel} · {baseRate} baseline drop rate
          </div>
        </div>

        {/* Lore */}
        <div
          className="text-center text-sm sm:text-base text-gray-200 italic mt-4 mx-2 leading-relaxed"
          style={{ fontFamily: "'Crimson Text', Georgia, serif" }}
        >
          &ldquo;{glyph.lore}&rdquo;
        </div>

        {/* Stats grid */}
        <div className="mt-5 space-y-2 text-[13px] sm:text-[14px] font-mono">
          <StatRow label="Rune" value={`${glyph.rune}  ·  ${runeIndex >= 0 ? `${runeIndex + 1} of ${RUNE_SHAPES.length}` : "?"}`} />
          <StatRow label="Epoch" value={oldOne ? `${glyph.epochId} — ${oldOne.name}` : `${glyph.epochId}`} />
          {glyph.tokenId !== undefined && <StatRow label="Token ID" value={`#${glyph.tokenId}`} />}
        </div>

        {/* External links */}
        {glyph.tokenId !== undefined && (
          <div className="flex gap-2 mt-5">
            <a
              href={openseaUrl(glyph.tokenId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 px-3 rounded-lg text-[13px] font-mono uppercase tracking-widest text-gray-200 hover:text-white transition-colors"
              style={{ background: "#1e1e2e", border: "1px solid #2a2a3e" }}
            >
              OpenSea ↗
            </a>
            <a
              href={etherscanUrl(glyph.tokenId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 px-3 rounded-lg text-[13px] font-mono uppercase tracking-widest text-gray-200 hover:text-white transition-colors"
              style={{ background: "#1e1e2e", border: "1px solid #2a2a3e" }}
            >
              Etherscan ↗
            </a>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-gray-100">{value}</span>
    </div>
  );
}
