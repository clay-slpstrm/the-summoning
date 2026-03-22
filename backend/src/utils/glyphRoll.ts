/**
 * Deterministic glyph assignment from a transaction hash.
 *
 * CRITICAL: This function must be deterministic. The same txHash
 * must ALWAYS produce the same glyph. This is the foundation of
 * the trust model — anyone can verify a glyph assignment by running
 * this function on the corresponding transaction hash.
 *
 * See ARCHITECTURE.md Section 4.2 for full specification.
 */

import { keccak256 } from "viem";
import { GLYPH_TIERS, RUNE_SHAPES, LORE_MESSAGES } from "./constants.js";

export type GlyphRoll = {
  tierName: string;
  tierIndex: number;
  color: string;
  rune: string;
  lore: string;
};

export function rollGlyphFromTxHash(txHash: string): GlyphRoll {
  // Use keccak256 of txHash as deterministic seed
  const seed = keccak256(txHash as `0x${string}`);
  const seedNum = BigInt(seed);

  // Tier roll: use first 8 bytes as a fraction of 10000
  const tierRoll = Number(seedNum % 10000n) / 10000;
  let tier: typeof GLYPH_TIERS[number] = GLYPH_TIERS[0];
  let cumulative = 0;
  for (const t of GLYPH_TIERS) {
    cumulative += t.chance;
    if (tierRoll < cumulative) {
      tier = t;
      break;
    }
  }

  // Rune selection: use next 8 bytes
  const runeIndex = Number((seedNum >> 64n) % BigInt(RUNE_SHAPES.length));
  const rune = RUNE_SHAPES[runeIndex];

  // Lore selection: use next 8 bytes
  const loreIndex = Number((seedNum >> 128n) % BigInt(LORE_MESSAGES.length));
  const lore = LORE_MESSAGES[loreIndex];

  return {
    tierName: tier.name,
    tierIndex: tier.index,
    color: tier.color,
    rune,
    lore,
  };
}
