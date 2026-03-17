/**
 * Cult rank progress bar.
 *
 * Shows current rank, distance to next rank, and segmented progress.
 * See PRD.md Section 4.7 and Section 7 for acceptance criteria.
 */

"use client";

import { CULT_RANKS } from "@/lib/constants";
import { useGlyphStore } from "@/stores/glyphStore";

export default function CultRankBar() {
  const glyphCount = useGlyphStore((s) => s.glyphs.length);

  // Calculate current rank
  let currentRank: (typeof CULT_RANKS)[number] = CULT_RANKS[0];
  for (const r of CULT_RANKS) {
    if (glyphCount >= r.minGlyphs) currentRank = r;
  }

  // Find next rank
  const nextRank = CULT_RANKS.find((r) => r.minGlyphs > glyphCount);

  return (
    <div className="card-raised p-3 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[10px] text-gray-500 tracking-[2px]">
            CULT RANK:{" "}
          </span>
          <span
            className="text-[13px] font-bold"
            style={{ color: currentRank.color }}
          >
            {currentRank.name}
          </span>
        </div>
        {nextRank ? (
          <div className="text-[10px] text-gray-600">
            {nextRank.minGlyphs - glyphCount} glyphs to{" "}
            <span style={{ color: nextRank.color }}>{nextRank.name}</span>
          </div>
        ) : (
          <div className="text-[10px] text-tier-breach">MAX RANK</div>
        )}
      </div>

      {/* Segmented progress bar */}
      <div className="flex gap-[3px] mt-2">
        {CULT_RANKS.slice(1).map((rank, i) => {
          const prevMin = CULT_RANKS[i].minGlyphs;
          const thisMin = rank.minGlyphs;
          const filled =
            glyphCount >= thisMin
              ? 1
              : glyphCount > prevMin
                ? (glyphCount - prevMin) / (thisMin - prevMin)
                : 0;
          return (
            <div
              key={rank.name}
              className="flex-1 h-1 bg-void-border rounded-sm overflow-hidden"
            >
              <div
                className="h-full rounded-sm transition-all duration-300"
                style={{
                  width: `${filled * 100}%`,
                  background: rank.color,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
