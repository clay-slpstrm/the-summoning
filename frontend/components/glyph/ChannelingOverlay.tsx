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
          className="fixed bottom-6 right-6 z-40 pointer-events-none sm:bottom-8 sm:right-8"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="text-center p-4 sm:p-5 rounded-xl"
            style={{
              background: "rgba(13, 13, 21, 0.95)",
              border: "1px solid #7c3aed44",
              boxShadow: "0 0 40px #7c3aed22, 0 4px 20px rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="flex items-center gap-3">
              {/* Spinning channeling symbol */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="text-2xl sm:text-3xl"
                style={{
                  color: "#7c3aed",
                  filter: "drop-shadow(0 0 15px rgba(124, 58, 237, 0.5))",
                }}
              >
                ✦
              </motion.div>

              <div className="text-left">
                {/* Pulsing label */}
                <motion.div
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="text-[10px] sm:text-[11px] tracking-[3px] uppercase font-serif text-purple-400"
                >
                  CHANNELING
                </motion.div>

                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="text-[10px] text-gray-500 italic max-w-[200px]"
                >
                  &ldquo;{CHANNELING_MESSAGES[messageIndex]}&rdquo;
                </motion.div>
              </div>
            </div>

            {pendingGlyphs.length > 1 && (
              <div className="text-[9px] text-gray-600 mt-2 tracking-[2px]">
                {pendingGlyphs.length} GLYPHS PENDING
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
