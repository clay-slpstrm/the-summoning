/**
 * Cult rank progress bar.
 *
 * Shows current rank, distance to next rank, and segmented progress.
 * Uses on-chain glyph count from EldritchGlyphs contract when available,
 * so rank reflects purchased glyphs too.
 *
 * See PRD.md Section 4.7 and Section 7 for acceptance criteria.
 */

"use client";

import { useAccount } from "wagmi";
import { CULT_RANKS } from "@/lib/constants";
import { useCultRank } from "@/hooks/useCultRank";

export default function CultRankBar() {
  const { address } = useAccount();
  const { glyphCount, currentRank, nextRank, glyphsToNext, isMaxRank } = useCultRank(address);

  return (
    <div className="card-raised p-2.5 sm:p-3 mt-3 sm:mt-4">
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0">
          <span className="text-[9px] sm:text-[10px] text-gray-500 tracking-[1.5px] sm:tracking-[2px]">
            CULT RANK:{" "}
          </span>
          <span
            className="text-[12px] sm:text-[13px] font-bold"
            style={{ color: currentRank.color }}
          >
            {currentRank.name}
          </span>
        </div>
        {!isMaxRank && nextRank ? (
          <div className="text-[9px] sm:text-[10px] text-gray-600 whitespace-nowrap">
            {glyphsToNext} to{" "}
            <span style={{ color: nextRank.color }}>{nextRank.name}</span>
          </div>
        ) : (
          <div className="text-[9px] sm:text-[10px] text-tier-breach">MAX RANK</div>
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
