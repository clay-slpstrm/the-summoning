import { create } from "zustand";

/**
 * Client-side glyph state.
 *
 * Stores the user's glyph collection and manages the reveal modal.
 * Hydrated from backend API on wallet connect, updated via WebSocket.
 */

export type GlyphData = {
  tierName: string;
  tierIndex: number;
  color: string;
  rune: string;
  lore: string;
  txHash: string;
  amount: string;
  epochId: number;
  id?: string;
};

type GlyphStore = {
  // Collection
  glyphs: GlyphData[];
  setGlyphs: (glyphs: GlyphData[]) => void;
  addGlyph: (glyph: GlyphData) => void;

  // Reveal modal
  revealGlyph: GlyphData | null;
  setRevealGlyph: (glyph: GlyphData | null) => void;

  // Tier counts (derived but cached for perf)
  getTierCount: (tierName: string) => number;
};

export const useGlyphStore = create<GlyphStore>((set, get) => ({
  glyphs: [],

  setGlyphs: (glyphs) => set({ glyphs }),

  addGlyph: (glyph) =>
    set((state) => ({ glyphs: [glyph, ...state.glyphs] })),

  revealGlyph: null,

  setRevealGlyph: (glyph) => set({ revealGlyph: glyph }),

  getTierCount: (tierName) =>
    get().glyphs.filter((g) => g.tierName === tierName).length,
}));
