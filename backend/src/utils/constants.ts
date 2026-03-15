/**
 * Shared constants — MUST stay in sync with contracts and frontend.
 * See CLAUDE.md for the canonical values.
 */

export const GLYPH_TIERS = [
  { name: "Whisper", index: 0, chance: 0.5, color: "#8B8B8B" },
  { name: "Echo", index: 1, chance: 0.28, color: "#4A9EFF" },
  { name: "Tremor", index: 2, chance: 0.15, color: "#A855F7" },
  { name: "Rupture", index: 3, chance: 0.06, color: "#F59E0B" },
  { name: "Breach", index: 4, chance: 0.01, color: "#EF4444" },
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

export const CULT_RANKS = [
  { name: "Uninitiated", minGlyphs: 0, index: 0 },
  { name: "Whisperer", minGlyphs: 3, index: 1 },
  { name: "Echo Walker", minGlyphs: 8, index: 2 },
  { name: "Void Touched", minGlyphs: 15, index: 3 },
  { name: "Rift Keeper", minGlyphs: 25, index: 4 },
  { name: "Herald of the Breach", minGlyphs: 40, index: 5 },
] as const;

export const TIER_IDS = {
  SHATTERED_RITUAL: 0,
  HARBINGER: 1,
  ACOLYTE: 2,
  CULTIST: 3,
} as const;
