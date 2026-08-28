"use client";

/**
 * Pre-launch CTA modal. Pops once per browser session when a visitor lands
 * while no epoch exists on-chain (gated by the parent). Replaces the old
 * inline PreLaunchHero card, which blended into the page.
 *
 * Modes, driven by NEXT_PUBLIC_LAUNCH_AT (ISO 8601 or unix seconds):
 *   unset → soft mode: "the veil thins" + social CTAs, no date promised
 *   set   → hard mode: live countdown to the announced first summoning
 *
 * Social buttons render only when their env URL is set:
 *   NEXT_PUBLIC_X_URL, NEXT_PUBLIC_DISCORD_URL
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const LAUNCH_AT = process.env.NEXT_PUBLIC_LAUNCH_AT || "";
const X_URL = process.env.NEXT_PUBLIC_X_URL || "";
const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL || "";

const SEEN_KEY = "summoning-prelaunch-modal-seen";

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

  if (now === null) return <CountdownDigits d="--" h="--" m="--" s="--" />;

  const remaining = Math.max(0, target - now);
  if (remaining === 0) {
    return (
      <p className="text-sm sm:text-base text-tier-breach font-mono font-bold tracking-[3px] uppercase animate-pulse">
        The ritual begins imminently
      </p>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  return (
    <CountdownDigits
      d={pad(Math.floor(totalSeconds / 86400))}
      h={pad(Math.floor((totalSeconds % 86400) / 3600))}
      m={pad(Math.floor((totalSeconds % 3600) / 60))}
      s={pad(totalSeconds % 60)}
    />
  );
}

function CountdownDigits({ d, h, m, s }: { d: string; h: string; m: string; s: string }) {
  const cells = [
    { value: d, label: "days" },
    { value: h, label: "hours" },
    { value: m, label: "min" },
    { value: s, label: "sec" },
  ];
  return (
    <div className="flex items-start justify-center gap-3 sm:gap-4">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col items-center gap-1">
          <div
            className="w-14 sm:w-16 py-2.5 rounded-lg text-xl sm:text-2xl font-mono font-bold text-ritual-light text-center"
            style={{
              background: "#111118",
              border: "1px solid #7c3aed44",
              boxShadow: "0 0 24px #7c3aed33",
            }}
          >
            {cell.value}
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[2px] uppercase text-gray-400">
            {cell.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PreLaunchModal() {
  const [open, setOpen] = useState(false);
  const launchAt = parseLaunchAt(LAUNCH_AT);

  useEffect(() => {
    if (!sessionStorage.getItem(SEEN_KEY)) {
      setOpen(true);
      sessionStorage.setItem(SEEN_KEY, "1");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(4, 4, 9, 0.82)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-full max-w-md rounded-2xl p-7 sm:p-9 text-center"
            style={{
              background: "linear-gradient(160deg, #14101f 0%, #0d0d15 60%)",
              border: "1px solid #7c3aed66",
              boxShadow: "0 0 90px #7c3aed4d, 0 0 30px #7c3aed33, inset 0 1px 0 #ffffff0d",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute top-3.5 right-4 text-gray-400 hover:text-gray-200 text-xl leading-none bg-transparent border-none cursor-pointer font-mono"
            >
              &times;
            </button>

            <div
              className="text-5xl sm:text-6xl mb-4 text-ritual-light select-none"
              style={{ textShadow: "0 0 40px #7c3aed, 0 0 90px #7c3aed88" }}
              aria-hidden
            >
              &#9672;
            </div>

            <p className="text-[11px] sm:text-[12px] font-mono font-bold tracking-[4px] uppercase text-ritual-light mb-4">
              {launchAt ? "The first summoning begins in" : "Before the first summoning"}
            </p>

            {launchAt ? (
              <Countdown target={launchAt} />
            ) : (
              <p
                className="text-xl sm:text-2xl font-serif font-semibold text-gray-100 leading-snug"
                style={{ textShadow: "0 0 40px #7c3aed44" }}
              >
                The veil grows thin.
                <br />
                The first sacrifice opens the portal.
              </p>
            )}

            {(X_URL || DISCORD_URL) && (
              <div className="flex flex-col gap-3 mt-7">
                {DISCORD_URL && (
                  <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-sacrifice text-[13px] no-underline whitespace-nowrap"
                  >
                    Join the Cult
                  </a>
                )}
                {X_URL && (
                  <a
                    href={X_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-6 rounded-lg text-[13px] font-mono font-bold tracking-[2px] uppercase text-gray-100 hover:text-white transition-colors no-underline whitespace-nowrap"
                    style={{ background: "#16161f", border: "1px solid #7c3aed55" }}
                  >
                    Follow on X
                  </a>
                )}
              </div>
            )}

            <p className="text-[12px] text-gray-400 font-mono font-bold tracking-wider mt-6 italic">
              Be the one whose sacrifice opens the first summoning.
            </p>

            <button
              onClick={() => setOpen(false)}
              className="mt-4 text-[12px] font-mono font-bold tracking-[2px] uppercase text-gray-500 hover:text-gray-300 bg-transparent border-none cursor-pointer underline underline-offset-4 decoration-void-border"
            >
              Continue to the ritual
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
