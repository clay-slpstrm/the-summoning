import { create } from "zustand";

/**
 * Client-side glyph state.
 *
 * Stores the user's glyph collection, pending VRF requests, and
 * manages the reveal modal. Hydrated from backend API on wallet
 * connect, updated via WebSocket.
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
  tokenId?: number;
};

export type PendingGlyph = {
  requestId: string;
  epochId: number;
  timestamp: number;
};

type GlyphStore = {
  // Collection
  glyphs: GlyphData[];
  setGlyphs: (glyphs: GlyphData[]) => void;
  addGlyph: (glyph: GlyphData) => void;

  // Pending VRF requests (claimGlyphs tx submitted, awaiting fulfillment)
  pendingGlyphs: PendingGlyph[];
  addPending: (pending: PendingGlyph) => void;
  removePending: (requestId: string) => void;
  clearPending: () => void;

  // Reveal queue — batched claimGlyphs returns N glyphs; we reveal them
  // sequentially with the same gacha animation, like opening a booster pack.
  revealQueue: GlyphData[];
  enqueueReveal: (glyph: GlyphData) => void;
  enqueueRevealBatch: (glyphs: GlyphData[]) => void;
  dequeueReveal: () => void;
  clearRevealQueue: () => void;

  // Detail modal (user-initiated, opened by clicking a glyph in the collection)
  selectedGlyph: GlyphData | null;
  setSelectedGlyph: (glyph: GlyphData | null) => void;

  // Tier counts (derived but cached for perf)
  getTierCount: (tierName: string) => number;
};

export const useGlyphStore = create<GlyphStore>((set, get) => ({
  glyphs: [],

  setGlyphs: (glyphs) => set({ glyphs }),

  addGlyph: (glyph) =>
    set((state) => ({ glyphs: [glyph, ...state.glyphs] })),

  pendingGlyphs: [],

  addPending: (pending) =>
    set((state) => ({
      pendingGlyphs: [...state.pendingGlyphs, pending],
    })),

  removePending: (requestId) =>
    set((state) => ({
      pendingGlyphs: state.pendingGlyphs.filter((p) => p.requestId !== requestId),
    })),

  clearPending: () => set({ pendingGlyphs: [] }),

  revealQueue: [],

  enqueueReveal: (glyph) =>
    set((state) => ({ revealQueue: [...state.revealQueue, glyph] })),

  enqueueRevealBatch: (glyphs) =>
    set((state) => ({ revealQueue: [...state.revealQueue, ...glyphs] })),

  dequeueReveal: () =>
    set((state) => ({ revealQueue: state.revealQueue.slice(1) })),

  clearRevealQueue: () => set({ revealQueue: [] }),

  selectedGlyph: null,

  setSelectedGlyph: (glyph) => set({ selectedGlyph: glyph }),

  getTierCount: (tierName) =>
    get().glyphs.filter((g) => g.tierName === tierName).length,
}));
