/**
 * Shared constants — MUST stay in sync with contracts and backend.
 * See CLAUDE.md for canonical values.
 */

export const GLYPH_TIERS = [
  { name: "Whisper", index: 0, chance: 0.5, color: "#8B8B8B", glow: "#8B8B8B44", symbol: "𐌀", bg: "linear-gradient(135deg, #2a2a2a, #3d3d3d)" },
  { name: "Echo", index: 1, chance: 0.28, color: "#4A9EFF", glow: "#4A9EFF44", symbol: "𐌁", bg: "linear-gradient(135deg, #1a2a4a, #2a3d6a)" },
  { name: "Tremor", index: 2, chance: 0.15, color: "#A855F7", glow: "#A855F766", symbol: "𐌂", bg: "linear-gradient(135deg, #2d1b4e, #4a2d7a)" },
  { name: "Rupture", index: 3, chance: 0.06, color: "#F59E0B", glow: "#F59E0B66", symbol: "𐌃", bg: "linear-gradient(135deg, #4a3a1b, #6a5a2d)" },
  { name: "Breach", index: 4, chance: 0.01, color: "#EF4444", glow: "#EF444488", symbol: "𐌄", bg: "linear-gradient(135deg, #4a1b1b, #7a2d2d)" },
] as const;

export const RUNE_SHAPES = [
  "◈", "◇", "⬡", "△", "▽", "⬢", "◆", "⬠", "☍", "⚝",
  "✧", "⊛", "⊕", "⊗", "⊘", "⊙", "⊚", "⊜", "⊡", "⊞",
  "᛭", "ᚦ", "ᚠ", "ᚢ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᛃ",
] as const;

export const LORE_MESSAGES = [
  "The void stirs...",
  "Something ancient takes notice.",
  "The veil grows thin.",
  "Whispers from beyond the stars.",
  "The geometry of space bends.",
  "Dead dreams ripple outward.",
  "The sleeping one shifts.",
  "Reality fractures, just slightly.",
  "The darkness between stars pulses.",
  "An eye opens in the deep.",
] as const;

// Cult ranks. "Initiate" sits between Uninitiated and Whisperer for wallets that
// have sacrificed but never crossed the 100-RITUAL glyph qualification threshold
// in any single epoch — gated on lifetimeContribution rather than glyph count.
export const CULT_RANKS = [
  { name: "Uninitiated", minGlyphs: 0, index: 0, color: "#6B7280" },
  { name: "Initiate", minGlyphs: 0, index: 1, color: "#94A3B8", requiresLifetime: true },
  { name: "Whisperer", minGlyphs: 3, index: 2, color: "#8B8B8B" },
  { name: "Echo Walker", minGlyphs: 8, index: 3, color: "#4A9EFF" },
  { name: "Void Touched", minGlyphs: 15, index: 4, color: "#A855F7" },
  { name: "Rift Keeper", minGlyphs: 25, index: 5, color: "#F59E0B" },
  { name: "Herald of the Breach", minGlyphs: 40, index: 6, color: "#EF4444" },
] as const;

export const OLD_ONES = [
  { id: 1, name: "Cthulhu", subtitle: "The Dreaming One Stirs" },
  { id: 2, name: "Nyarlathotep", subtitle: "The Crawling Chaos Whispers" },
  { id: 3, name: "Azathoth", subtitle: "The Blind Idiot God Writhes" },
  { id: 4, name: "Shub-Niggurath", subtitle: "The Black Goat Breeds" },
  { id: 5, name: "Yog-Sothoth", subtitle: "The Gate Opens" },
] as const;

export const TIER_IDS = {
  SHATTERED_RITUAL: 0,
  HARBINGER: 1,
  ACOLYTE: 2,
  CULTIST: 3,
} as const;

export const CONTRACT_PARAMS = {
  BASE_PRICE_ETH: 0.0001,
  SCALE_FACTOR: 100_000_000,
  PROTOCOL_FEE_BPS: 1200,
  GATHERING_DURATION: 48 * 3600,
  RITUAL_DURATION: 24 * 3600,
  MIN_SACRIFICE: 1,
  GLYPH_UNIT: 100,           // 100 RITUAL per glyph earned (qualification threshold + divisor)
  MAX_GLYPHS_PER_CLAIM: 20,  // sized for Chainlink V2.5 2.5M callback gas ceiling
  SACRIFICE_COOLDOWN: 30,
} as const;
