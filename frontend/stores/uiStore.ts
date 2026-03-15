import { create } from "zustand";

/**
 * UI state management.
 *
 * Controls which tab is active, sacrifice flow state, etc.
 */

type SacrificeState = "idle" | "approving" | "channeling" | "cooldown";

type UIStore = {
  // Tab navigation
  activeTab: "ritual" | "collection";
  setActiveTab: (tab: "ritual" | "collection") => void;

  // Sacrifice flow
  sacrificeState: SacrificeState;
  setSacrificeState: (state: SacrificeState) => void;
  sacrificeAmount: number;
  setSacrificeAmount: (amount: number) => void;

  // Cooldown
  cooldownEnd: number | null;
  setCooldownEnd: (time: number | null) => void;

  // Lore message (fades in after sacrifice)
  recentLore: string | null;
  setRecentLore: (lore: string | null) => void;

  // Portal shake trigger
  portalShake: boolean;
  triggerPortalShake: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  activeTab: "ritual",
  setActiveTab: (tab) => set({ activeTab: tab }),

  sacrificeState: "idle",
  setSacrificeState: (state) => set({ sacrificeState: state }),
  sacrificeAmount: 1000,
  setSacrificeAmount: (amount) => set({ sacrificeAmount: amount }),

  cooldownEnd: null,
  setCooldownEnd: (time) => set({ cooldownEnd: time }),

  recentLore: null,
  setRecentLore: (lore) => set({ recentLore: lore }),

  portalShake: false,
  triggerPortalShake: () => {
    set({ portalShake: true });
    setTimeout(() => set({ portalShake: false }), 500);
  },
}));
