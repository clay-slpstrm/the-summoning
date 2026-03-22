/**
 * Glyph collection grid.
 *
 * Displays all acquired glyphs with tier coloring and tooltips.
 * See PRD.md Section 4.5 for acceptance criteria.
 */

"use client";

import { useGlyphStore } from "@/stores/glyphStore";
import { GLYPH_TIERS } from "@/lib/constants";

export default function GlyphCollection() {
  const glyphs = useGlyphStore((s) => s.glyphs);

  if (glyphs.length === 0) {
    return (
      <div className="card min-h-[200px] sm:min-h-[300px]">
        <div className="section-label">
          Your Glyph Collection — 0 acquired
        </div>
        <div className="text-center py-8 sm:py-10 text-gray-600 italic text-sm">
          No glyphs yet. Perform a sacrifice to receive your first glyph.
        </div>
      </div>
    );
  }

  return (
    <div className="card min-h-[200px] sm:min-h-[300px]">
      <div className="section-label">
        Your Glyph Collection — {glyphs.length} acquired
      </div>
      <div className="grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))" }}>
        {glyphs.map((glyph, i) => {
          const tier = GLYPH_TIERS.find((t) => t.name === glyph.tierName) || GLYPH_TIERS[0];
          return (
            <div
              key={glyph.txHash || i}
              className={`glyph-cell ${i === 0 ? "animate-fade-in" : ""}`}
              style={{
                background: tier.bg,
                borderColor: tier.color + "44",
                boxShadow: `0 0 8px ${tier.glow}`,
              }}
              title={`${glyph.tierName} Glyph: ${glyph.rune}\n"${glyph.lore}"`}
            >
              <span
                style={{
                  filter: `drop-shadow(0 0 4px ${tier.color})`,
                  color: tier.color,
                }}
              >
                {glyph.rune}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
