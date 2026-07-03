"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { CULT_RANKS } from "@/lib/constants";

type LeaderboardEntry = {
  walletAddr: string;
  glyphCount: number;
  rankName: string;
  rankIndex: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Leaderboard() {
  const { address } = useAccount();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/leaderboard`)
      .then((r) => r.json())
      .then((data: { leaderboard: LeaderboardEntry[] }) => setEntries(data.leaderboard))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="card">
      <div className="section-label">Leaderboard, Top Collectors</div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-[#1e1e2e] rounded animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-6 text-gray-600 text-sm italic">
          No sacrifices yet. Be the first.
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((entry, i) => {
            const rank = CULT_RANKS.find((r) => r.name === entry.rankName) ?? CULT_RANKS[0];
            const isMe = address?.toLowerCase() === entry.walletAddr.toLowerCase();
            return (
              <div
                key={entry.walletAddr}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg transition-colors"
                style={{
                  background: isMe ? `${rank.color}11` : "transparent",
                  border: isMe ? `1px solid ${rank.color}33` : "1px solid transparent",
                }}
              >
                {/* Position */}
                <div className="text-[14px] sm:text-[15px] font-mono text-gray-600 w-4 sm:w-5 text-right">
                  {i + 1}
                </div>

                {/* Wallet */}
                <div className="flex-1 font-mono text-[14px] sm:text-[15px] text-gray-200 min-w-0">
                  {shortAddr(entry.walletAddr)}
                  {isMe && (
                    <span className="ml-1 sm:ml-1.5 text-[10px] sm:text-[11px] tracking-widest" style={{ color: rank.color }}>
                      YOU
                    </span>
                  )}
                </div>

                {/* Rank name — hidden on very small screens */}
                <div
                  className="hidden sm:block text-[13px] tracking-[1px] font-mono"
                  style={{ color: rank.color }}
                >
                  {entry.rankName}
                </div>

                {/* Glyph count — with rank color dot on mobile to replace hidden rank name */}
                <div className="text-[14px] sm:text-[15px] font-mono text-gray-500 w-10 sm:w-12 text-right flex items-center justify-end gap-1">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full sm:hidden"
                    style={{ background: rank.color }}
                  />
                  {entry.glyphCount} ◈
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
