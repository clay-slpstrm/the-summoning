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
  const setSelectedGlyph = useGlyphStore((s) => s.setSelectedGlyph);

  if (glyphs.length === 0) {
    return (
      <div className="card min-h-[200px] sm:min-h-[300px]">
        <div className="section-label">
          Your Glyph Collection, 0 acquired
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
        Your Glyph Collection, {glyphs.length} acquired
      </div>
      <div className="grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))" }}>
        {glyphs.map((glyph, i) => {
          const tier = GLYPH_TIERS.find((t) => t.name === glyph.tierName) || GLYPH_TIERS[0];
          const isNewest = i === 0;
          return (
            <button
              key={glyph.txHash || i}
              onClick={() => setSelectedGlyph(glyph)}
              className={`glyph-cell group cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-void ${isNewest ? "animate-glyph-enter" : ""}`}
              style={{
                background: tier.bg,
                borderColor: tier.color + "44",
                boxShadow: isNewest
                  ? `0 0 16px ${tier.glow}, 0 0 32px ${tier.glow}`
                  : `0 0 8px ${tier.glow}`,
              }}
              title={`${glyph.tierName} Glyph: ${glyph.rune} — click for details`}
            >
              <span
                className="transition-transform duration-200 group-hover:scale-125"
                style={{
                  filter: `drop-shadow(0 0 4px ${tier.color})`,
                  color: tier.color,
                }}
              >
                {glyph.rune}
              </span>
              {isNewest && (
                <span
                  className="absolute -top-1 -right-1 text-[7px] font-mono tracking-wider px-1 rounded"
                  style={{ background: tier.color, color: "#0a0a0f" }}
                >
                  NEW
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
