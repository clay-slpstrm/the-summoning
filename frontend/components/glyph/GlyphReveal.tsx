/**
 * Full-screen glyph reveal animation — the gacha "pull" moment.
 *
 * Now powered by glyphStore.revealQueue. When the user calls claimGlyphs(),
 * the resulting N freshly-minted glyphs are enqueued; this component reveals
 * them one at a time. Each tap advances to the next, like opening a booster
 * pack. A "1 of N" indicator at the top shows progress.
 *
 * 4-phase animation per glyph:
 *   Phase 0 (0ms):    Modal appears, scale(0.5), opacity 0
 *   Phase 1 (100ms):  Scale to 1, spinning channeling symbol
 *   Phase 2 (600ms):  Glyph materializes — rune + color reveal tier
 *   Phase 3 (1200ms): Tier name, lore, "tap to continue"
 *
 * See PRD.md Section 4.4 for full timing spec.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGlyphStore } from "@/stores/glyphStore";
import { GLYPH_TIERS } from "@/lib/constants";

export default function GlyphReveal() {
  const revealQueue = useGlyphStore((s) => s.revealQueue);
  const dequeueReveal = useGlyphStore((s) => s.dequeueReveal);
  const addGlyph = useGlyphStore((s) => s.addGlyph);
  const [phase, setPhase] = useState(0);

  // Track the total batch size so we can show "card 3 of 10". When the queue
  // length climbs (new batch pushed) we reset; once it starts draining we hold
  // the snapshot so the running index keeps counting up.
  const [batchTotal, setBatchTotal] = useState(0);
  useEffect(() => {
    if (revealQueue.length === 0) {
      setBatchTotal(0);
      return;
    }
    setBatchTotal((prev) => Math.max(prev, revealQueue.length));
  }, [revealQueue.length]);

  const revealGlyph = revealQueue[0] ?? null;
  const revealedIndex = batchTotal > 0 ? batchTotal - revealQueue.length + 1 : 0;

  useEffect(() => {
    if (!revealGlyph) {
      setPhase(0);
      return;
    }

    // Longer suspense for rarer tiers — PRD spec: ~2.5s common, ~4s rare+.
    const tierIndex = revealGlyph.tierIndex ?? 0;
    const suspenseMultiplier = tierIndex >= 3 ? 3.0 : tierIndex >= 2 ? 2.2 : 1.0;

    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 400 + 600 * suspenseMultiplier);
    const t3 = setTimeout(() => setPhase(3), 800 + 1200 * suspenseMultiplier);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [revealGlyph]);

  const handleDismiss = useCallback(() => {
    if (phase < 3 || !revealGlyph) return;
    addGlyph(revealGlyph);
    dequeueReveal();
  }, [phase, revealGlyph, addGlyph, dequeueReveal]);

  if (!revealGlyph) return null;

  const tierConfig = GLYPH_TIERS.find((t) => t.name === revealGlyph.tierName) || GLYPH_TIERS[0];
  const isRare = revealGlyph.tierIndex >= 2;
  const isLegendary = revealGlyph.tierIndex >= 3;
  const isBatch = batchTotal > 1;
  const remaining = revealQueue.length - 1;

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
        {/* Batch progress indicator — "1 of 10" style booster pack counter */}
        {isBatch && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 sm:top-6">
            <div
              className="px-4 py-1.5 rounded-full font-mono text-[11px] tracking-[3px] uppercase"
              style={{
                background: "rgba(13, 13, 21, 0.85)",
                border: "1px solid #7c3aed44",
                color: "#c4b5fd",
                boxShadow: "0 0 20px #7c3aed22",
              }}
            >
              Glyph {revealedIndex} of {batchTotal}
            </div>
          </div>
        )}

        {/* Stacked card silhouettes behind the active reveal — booster-pack depth */}
        {isBatch && remaining > 0 && phase >= 2 && (
          <>
            {[1, 2].map((depth) =>
              depth <= remaining ? (
                <motion.div
                  key={depth}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 0.35 - depth * 0.12, scale: 0.95 - depth * 0.03 }}
                  className="absolute rounded-2xl pointer-events-none"
                  style={{
                    width: "min(85vw, 360px)",
                    height: "min(60vh, 380px)",
                    background: "#0a0a0f",
                    border: "1px solid #1e1e2e",
                    transform: `translateY(${depth * 10}px)`,
                  }}
                />
              ) : null,
            )}
          </>
        )}

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
          {/* Phase 1: Channeling spinner — pulses faster for rare tiers */}
          {phase < 2 && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: isRare ? 0.6 : 1, ease: "linear" }}
              className="text-5xl sm:text-6xl"
              style={{
                color: isRare ? tierConfig.color : "#4c1d95",
                opacity: 0.6,
                filter: isRare ? `drop-shadow(0 0 20px ${tierConfig.color})` : undefined,
              }}
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
                  {remaining > 0 ? "TAP FOR NEXT" : "TAP TO CONTINUE"}
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
