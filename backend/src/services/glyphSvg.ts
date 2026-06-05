/**
 * Server-rendered SVG for an Eldritch Glyph NFT.
 *
 * Matches the in-app GlyphReveal aesthetic: a centered rune in the tier color,
 * a soft tier-colored glow, dark Lovecraftian background, faint outer ritual
 * circle, and a small "Whisper/Echo/Tremor/Rupture/Breach" tier label.
 *
 * Marketplaces and wallets render the returned SVG directly (OpenSea, Rainbow,
 * MetaMask all support image/svg+xml in ERC-1155 metadata). 512×512 canvas is
 * a safe default for grid views and detail panels.
 */

import { GLYPH_TIERS, RUNE_SHAPES, LORE_MESSAGES } from "../utils/constants.js";

export type GlyphImageInput = {
  tier: number;       // 0–4
  runeIndex: number;  // 0–29
  loreIndex: number;  // 0–9
  tokenId: number;
};

// Per-tier visual presets. The base color drives the rune fill + glow; the
// rare flag triples the glow blur radius so Rupture and Breach pulls scream
// from a thumbnail grid.
const TIER_VISUALS = [
  { glowBlur: 18, ringOpacity: 0.25, label: "Whisper" },
  { glowBlur: 22, ringOpacity: 0.35, label: "Echo" },
  { glowBlur: 28, ringOpacity: 0.5, label: "Tremor" },
  { glowBlur: 36, ringOpacity: 0.7, label: "Rupture" },
  { glowBlur: 44, ringOpacity: 0.9, label: "Breach" },
] as const;

export function renderGlyphSvg(g: GlyphImageInput): string {
  const tier = GLYPH_TIERS[g.tier] ?? GLYPH_TIERS[0];
  const rune = RUNE_SHAPES[g.runeIndex] ?? RUNE_SHAPES[0];
  const lore = LORE_MESSAGES[g.loreIndex] ?? LORE_MESSAGES[0];
  const visual = TIER_VISUALS[g.tier] ?? TIER_VISUALS[0];

  // Background is a radial gradient from a tier-tinted core to deep void black,
  // so each tier feels different even at thumbnail scale.
  const bgInner = mixWithBlack(tier.color, 0.85);
  const bgOuter = "#050508";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="${bgInner}"/>
      <stop offset="100%" stop-color="${bgOuter}"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${visual.glowBlur}"/>
    </filter>
  </defs>

  <rect width="512" height="512" fill="url(#bg)"/>

  <!-- Outer ritual circle: faint dashed ring; opacity scales with rarity -->
  <circle cx="256" cy="256" r="220" fill="none"
          stroke="${tier.color}" stroke-opacity="${visual.ringOpacity}"
          stroke-width="1.5" stroke-dasharray="3 9"/>
  <circle cx="256" cy="256" r="180" fill="none"
          stroke="${tier.color}" stroke-opacity="${visual.ringOpacity * 0.5}"
          stroke-width="1"/>

  <!-- Rune glow halo behind the symbol -->
  <text x="256" y="290" font-family="Georgia, serif" font-size="280"
        text-anchor="middle" fill="${tier.color}" filter="url(#glow)"
        opacity="0.75">${escapeXml(rune)}</text>

  <!-- Rune symbol on top -->
  <text x="256" y="290" font-family="Georgia, serif" font-size="280"
        text-anchor="middle" fill="${tier.color}">${escapeXml(rune)}</text>

  <!-- Tier label -->
  <text x="256" y="430" font-family="'Courier New', monospace" font-size="20"
        text-anchor="middle" fill="${tier.color}" letter-spacing="6"
        opacity="0.85">${visual.label.toUpperCase()}</text>

  <!-- Lore line (faint, italic) -->
  <text x="256" y="465" font-family="Georgia, serif" font-size="13"
        text-anchor="middle" fill="#c0c0c8" font-style="italic" opacity="0.55"
  >${escapeXml(lore)}</text>

  <!-- Token ID watermark in corner -->
  <text x="488" y="500" font-family="'Courier New', monospace" font-size="10"
        text-anchor="end" fill="#6b7280" opacity="0.5">#${g.tokenId}</text>
</svg>`;
}

// Linear interpolate hex toward black. tier color → bg core color.
function mixWithBlack(hex: string, blackness: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const t = 1 - blackness;
  const mix = (c: number) => Math.round(c * t)
    .toString(16)
    .padStart(2, "0");
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
