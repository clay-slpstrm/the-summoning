/**
 * useCultRank — reads glyph count from EldritchGlyphs contract.
 *
 * With glyphs as tradeable on-chain NFTs, cult rank reflects the
 * wallet's current balance (including purchased glyphs). This hook
 * reads glyphCount(address) directly from the contract so rank
 * updates immediately on transfer.
 *
 * Falls back to the backend API count if the contract is not configured.
 */

"use client";

import { useReadContract } from "wagmi";
import { ELDRITCH_GLYPHS_ADDRESS, ELDRITCH_GLYPHS_ABI } from "@/lib/contracts";
import { CULT_RANKS } from "@/lib/constants";
import { useGlyphStore } from "@/stores/glyphStore";

export function useCultRank(walletAddress?: `0x${string}`) {
  const hasContract = !!ELDRITCH_GLYPHS_ADDRESS;

  // On-chain glyph count
  const { data: onChainCount } = useReadContract({
    address: ELDRITCH_GLYPHS_ADDRESS,
    abi: ELDRITCH_GLYPHS_ABI,
    functionName: "glyphCount",
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: hasContract && !!walletAddress },
  });

  // Fallback to store count (from backend API)
  const storeCount = useGlyphStore((s) => s.glyphs.length);

  const glyphCount = hasContract && onChainCount !== undefined
    ? Number(onChainCount)
    : storeCount;

  // Derive rank from count
  type CultRank = (typeof CULT_RANKS)[number];
  let currentRank: CultRank = CULT_RANKS[0];
  for (const r of CULT_RANKS) {
    if (glyphCount >= r.minGlyphs) currentRank = r;
  }

  const nextRank: CultRank | null = CULT_RANKS.find((r) => r.minGlyphs > glyphCount) ?? null;
  const glyphsToNext = nextRank ? nextRank.minGlyphs - glyphCount : 0;

  return {
    glyphCount,
    currentRank,
    nextRank,
    glyphsToNext,
    isMaxRank: !nextRank,
  };
}
