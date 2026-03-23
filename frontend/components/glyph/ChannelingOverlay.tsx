/**
 * Channeling overlay — shown while waiting for VRF callback.
 *
 * After a commitRitual() tx confirms on-chain, the SummoningEngine
 * requests a VRF random number from Chainlink. This takes 30-60s.
 * During that time, we show this "channeling" animation.
 *
 * Lore: "The void is deciding your fate..."
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useGlyphStore } from "@/stores/glyphStore";

const CHANNELING_MESSAGES = [
  "The void is deciding your fate...",
  "Entropy coalesces into form...",
  "The stars align in unknowable patterns...",
  "Something stirs beyond the veil...",
  "The ritual resonates through dimensions...",
] as const;

export default function ChannelingOverlay() {
  const pendingGlyphs = useGlyphStore((s) => s.pendingGlyphs);
  const hasPending = pendingGlyphs.length > 0;

  // Pick a message based on the first pending request's timestamp
  const messageIndex = hasPending
    ? pendingGlyphs[0].timestamp % CHANNELING_MESSAGES.length
    : 0;

  return (
    <AnimatePresence>
      {hasPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          style={{
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="text-center p-8 sm:p-10"
          >
            {/* Spinning channeling symbol */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="text-6xl sm:text-7xl mb-6"
              style={{
                color: "#7c3aed",
                filter: "drop-shadow(0 0 30px rgba(124, 58, 237, 0.5))",
              }}
            >
              ✦
            </motion.div>

            {/* Pulsing inner glow */}
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="text-[11px] sm:text-xs tracking-[4px] uppercase font-serif text-purple-400 mb-3"
            >
              CHANNELING
            </motion.div>

            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="text-[11px] sm:text-xs text-gray-400 italic max-w-[260px] mx-auto"
            >
              &ldquo;{CHANNELING_MESSAGES[messageIndex]}&rdquo;
            </motion.div>

            {pendingGlyphs.length > 1 && (
              <div className="text-[10px] text-gray-600 mt-4 tracking-[2px]">
                {pendingGlyphs.length} GLYPHS PENDING
              </div>
            )}

            <div className="text-[9px] text-gray-700 mt-4 tracking-[1px]">
              AWAITING VRF CALLBACK...
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
