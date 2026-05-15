/**
 * useCultRank — derives the wallet's cult rank from on-chain state.
 *
 * Rank resolution (per the audit C-01 redesign):
 *   - glyphCount > 0 → glyph-tier rank (Whisperer .. Herald of the Breach, or
 *     Uninitiated when between 0 and the Whisperer threshold).
 *   - glyphCount == 0 AND lifetimeContribution > 0 → Initiate
 *     (the wallet has sacrificed but never crossed 100 RITUAL in a single epoch).
 *   - Otherwise → Uninitiated.
 *
 * Both inputs are read on-chain so rank updates immediately on transfer or new
 * sacrifice. Falls back to the backend-derived store count if EldritchGlyphs is
 * not configured.
 */

"use client";

import { useReadContract } from "wagmi";
import {
  ELDRITCH_GLYPHS_ADDRESS,
  ELDRITCH_GLYPHS_ABI,
  SUMMONING_ENGINE_ADDRESS,
  SUMMONING_ENGINE_ABI,
} from "@/lib/contracts";
import { CULT_RANKS } from "@/lib/constants";
import { useGlyphStore } from "@/stores/glyphStore";

type CultRank = (typeof CULT_RANKS)[number];

function isLifetimeOnly(r: CultRank): boolean {
  return "requiresLifetime" in r && r.requiresLifetime === true;
}

// Ranks gated by glyphCount only (excludes Initiate).
const GLYPH_TIER_RANKS: readonly CultRank[] = CULT_RANKS.filter((r) => !isLifetimeOnly(r));
const INITIATE_RANK: CultRank = CULT_RANKS.find(isLifetimeOnly) ?? CULT_RANKS[0];
const UNINITIATED_RANK: CultRank = CULT_RANKS[0];

export function useCultRank(walletAddress?: `0x${string}`) {
  const hasGlyphContract = !!ELDRITCH_GLYPHS_ADDRESS;
  const hasEngineContract = !!SUMMONING_ENGINE_ADDRESS;

  // On-chain glyph count (current wallet balance, includes purchased glyphs)
  const { data: onChainCount } = useReadContract({
    address: ELDRITCH_GLYPHS_ADDRESS,
    abi: ELDRITCH_GLYPHS_ABI,
    functionName: "glyphCount",
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: hasGlyphContract && !!walletAddress },
  });

  // Lifetime contribution (sum of all sacrifices ever, powers the Initiate rank)
  const { data: onChainLifetime } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "lifetimeContribution",
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: hasEngineContract && !!walletAddress },
  });

  // Fallback to store count (from backend API) when contract isn't configured
  const storeCount = useGlyphStore((s) => s.glyphs.length);
  const glyphCount =
    hasGlyphContract && onChainCount !== undefined ? Number(onChainCount) : storeCount;
  const lifetimeContribution = onChainLifetime ?? 0n;

  // Derive rank: glyph-tiers when glyphCount > 0; otherwise Initiate if lifetime > 0.
  let currentRank: CultRank;
  if (glyphCount > 0) {
    currentRank = UNINITIATED_RANK;
    for (const r of GLYPH_TIER_RANKS) {
      if (glyphCount >= r.minGlyphs) currentRank = r;
    }
  } else if (lifetimeContribution > 0n) {
    currentRank = INITIATE_RANK;
  } else {
    currentRank = UNINITIATED_RANK;
  }

  // Next rank: smallest glyph-tier rank above current glyphCount (skips Initiate, which
  // is a lateral state for non-glyph-holders, not a progression step).
  const nextRank: CultRank | null =
    GLYPH_TIER_RANKS.find((r) => r.minGlyphs > glyphCount) ?? null;
  const glyphsToNext = nextRank ? nextRank.minGlyphs - glyphCount : 0;

  return {
    glyphCount,
    lifetimeContribution,
    currentRank,
    nextRank,
    glyphsToNext,
    isMaxRank: !nextRank,
  };
}
