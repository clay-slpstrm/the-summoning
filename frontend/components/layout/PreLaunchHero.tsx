"use client";

/**
 * Pre-launch hero — rendered only while no epoch exists on-chain.
 *
 * Two modes, driven by NEXT_PUBLIC_LAUNCH_AT (ISO 8601 or unix seconds):
 *   unset  → soft mode: "the veil thins" + social CTAs, no date promised
 *   set    → hard mode: live countdown to the announced first summoning
 *
 * Social buttons render only when their env URL is set:
 *   NEXT_PUBLIC_X_URL, NEXT_PUBLIC_DISCORD_URL
 */

import { useEffect, useState } from "react";

const LAUNCH_AT = process.env.NEXT_PUBLIC_LAUNCH_AT || "";
const X_URL = process.env.NEXT_PUBLIC_X_URL || "";
const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL || "";

function parseLaunchAt(raw: string): number | null {
  if (!raw) return null;
  const asNumber = Number(raw);
  const ms = Number.isFinite(asNumber) && raw.trim() !== ""
    ? asNumber * 1000
    : Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function Countdown({ target }: { target: number }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Avoid hydration mismatch: render placeholders until mounted
  if (now === null) {
    return <CountdownDigits d="--" h="--" m="--" s="--" />;
  }

  const remaining = Math.max(0, target - now);
  if (remaining === 0) {
    return (
      <p className="text-sm sm:text-base text-tier-breach font-mono tracking-[3px] uppercase animate-pulse">
        The ritual begins imminently
      </p>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return <CountdownDigits d={pad(d)} h={pad(h)} m={pad(m)} s={pad(s)} />;
}

function CountdownDigits({ d, h, m, s }: { d: string; h: string; m: string; s: string }) {
  const cells = [
    { value: d, label: "days" },
    { value: h, label: "hours" },
    { value: m, label: "min" },
    { value: s, label: "sec" },
  ];
  return (
    <div className="flex items-start justify-center gap-3 sm:gap-5">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col items-center gap-1">
          <div
            className="w-14 sm:w-16 py-2.5 rounded-lg text-xl sm:text-2xl font-mono text-ritual-light text-center"
            style={{
              background: "#0d0d15",
              border: "1px solid #1e1e2e",
              boxShadow: "0 0 24px #7c3aed22",
            }}
          >
            {cell.value}
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono tracking-[2px] uppercase text-gray-500">
            {cell.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PreLaunchHero() {
  const launchAt = parseLaunchAt(LAUNCH_AT);

  return (
    <div className="text-center mt-6 sm:mt-8 mb-2 max-w-lg mx-auto">
      <div
        className="rounded-xl p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, #4c1d9518, #7c3aed0d)",
          border: "1px solid #7c3aed2e",
        }}
      >
        <p className="text-[11px] sm:text-[12px] font-mono tracking-[4px] uppercase text-gray-400 mb-3">
          {launchAt ? "The first summoning begins in" : "Before the first summoning"}
        </p>

        {launchAt ? (
          <Countdown target={launchAt} />
        ) : (
          <p
            className="text-lg sm:text-xl font-serif text-gray-200 leading-relaxed"
            style={{ textShadow: "0 0 40px #7c3aed33" }}
          >
            The veil grows thin. The cult is gathering.
          </p>
        )}

        {(X_URL || DISCORD_URL) && (
          <div className="flex items-center justify-center gap-3 mt-6">
            {X_URL && (
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-lg text-[12px] font-mono tracking-[2px] uppercase text-gray-200 hover:text-white transition-colors no-underline whitespace-nowrap"
                style={{ background: "#111118", border: "1px solid #1e1e2e" }}
              >
                Follow on X
              </a>
            )}
            {DISCORD_URL && (
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-sacrifice px-5 py-2.5 text-[12px] no-underline whitespace-nowrap"
              >
                Join the Cult
              </a>
            )}
          </div>
        )}

        <p className="text-[11px] text-gray-500 font-mono tracking-wider mt-5 italic">
          Be first through the portal when the gathering begins.
        </p>
      </div>
    </div>
  );
}
