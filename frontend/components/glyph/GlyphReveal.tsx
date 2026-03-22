/**
 * Full-screen glyph reveal animation — the gacha "pull" moment.
 *
 * This is the most important UX element in the entire application.
 * See PRD.md Section 4.4 for full timing spec and acceptance criteria.
 *
 * 4-phase animation:
 *   Phase 0 (0ms):    Modal appears, scale(0.5), opacity 0
 *   Phase 1 (100ms):  Scale to 1, spinning channeling symbol
 *   Phase 2 (600ms):  Glyph materializes — rune + color reveal tier
 *   Phase 3 (1200ms): Tier name, lore, "tap to continue"
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGlyphStore, type GlyphData } from "@/stores/glyphStore";
import { GLYPH_TIERS } from "@/lib/constants";

export default function GlyphReveal() {
  const revealGlyph = useGlyphStore((s) => s.revealGlyph);
  const setRevealGlyph = useGlyphStore((s) => s.setRevealGlyph);
  const addGlyph = useGlyphStore((s) => s.addGlyph);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!revealGlyph) {
      setPhase(0);
      return;
    }

    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 600);
    const t3 = setTimeout(() => setPhase(3), 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [revealGlyph]);

  const handleDismiss = useCallback(() => {
    if (phase < 3 || !revealGlyph) return;
    addGlyph(revealGlyph);
    setRevealGlyph(null);
  }, [phase, revealGlyph, addGlyph, setRevealGlyph]);

  if (!revealGlyph) return null;

  const tierConfig = GLYPH_TIERS.find((t) => t.name === revealGlyph.tierName) || GLYPH_TIERS[0];
  const isRare = revealGlyph.tierIndex >= 2;
  const isLegendary = revealGlyph.tierIndex >= 3;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleDismiss}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
        }}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: phase >= 1 ? 1 : 0.5,
            opacity: phase >= 1 ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-center p-6 sm:p-10 rounded-2xl relative mx-4 sm:mx-0"
          style={{
            background: phase >= 2 ? tierConfig.bg : "#0a0a0f",
            border: `1px solid ${phase >= 2 ? tierConfig.color + "66" : "#1e1e2e"}`,
            boxShadow: phase >= 2
              ? `0 0 60px ${tierConfig.glow}, 0 0 120px ${tierConfig.glow}`
              : "none",
          }}
        >
          {/* Phase 1: Channeling spinner */}
          {phase < 2 && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="text-5xl"
              style={{ color: "#4c1d95", opacity: 0.6 }}
            >
              ✦
            </motion.div>
          )}

          {/* Phase 2+: Glyph reveal */}
          {phase >= 2 && (
            <>
              <motion.div
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="text-6xl sm:text-7xl mb-2"
                style={{ filter: `drop-shadow(0 0 20px ${tierConfig.color})` }}
              >
                {revealGlyph.rune}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: phase >= 3 ? 1 : 0 }}
                className="text-[11px] tracking-[4px] uppercase font-mono mb-1"
                style={{ color: tierConfig.color }}
              >
                {revealGlyph.tierName} Glyph
              </motion.div>

              {isRare && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: phase >= 3 ? 0.8 : 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-[10px] italic mt-0.5"
                  style={{ color: tierConfig.color }}
                >
                  {isLegendary ? "✦ LEGENDARY ✦" : "★ RARE ★"}
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: phase >= 3 ? 1 : 0 }}
                transition={{ delay: 0.3 }}
                className="text-[11px] sm:text-xs text-gray-400 italic mt-3 max-w-[220px] sm:max-w-[250px] mx-auto leading-relaxed"
              >
                &ldquo;{revealGlyph.lore}&rdquo;
              </motion.div>

              {phase >= 3 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-[10px] text-gray-600 mt-4 tracking-[2px]"
                >
                  TAP TO CONTINUE
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
