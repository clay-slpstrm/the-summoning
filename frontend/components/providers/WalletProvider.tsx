"use client";

import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
  type AvatarComponent,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { GLYPH_TIERS, RUNE_SHAPES } from "@/lib/constants";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "The Summoning",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"
    ),
  },
  ssr: true,
});

const queryClient = new QueryClient();

// Deterministic glyph avatar: first address byte → tier color, second → rune.
const GlyphAvatar: AvatarComponent = ({ address, ensImage, size }) => {
  if (ensImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={ensImage}
        width={size}
        height={size}
        style={{ borderRadius: "50%" }}
        alt="avatar"
      />
    );
  }

  const tierIdx = parseInt(address.slice(2, 4) || "00", 16) % GLYPH_TIERS.length;
  const runeIdx = parseInt(address.slice(4, 6) || "00", 16) % RUNE_SHAPES.length;
  const tier = GLYPH_TIERS[tierIdx];
  const rune = RUNE_SHAPES[runeIdx];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: tier.bg,
        border: `1px solid ${tier.color}66`,
        boxShadow: `0 0 ${size * 0.35}px ${tier.glow}, inset 0 0 ${size * 0.25}px ${tier.color}22`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tier.color,
        fontSize: size * 0.55,
        fontFamily: "'Courier New', monospace",
        filter: `drop-shadow(0 0 ${size * 0.15}px ${tier.color})`,
      }}
      title={`${tier.name} sigil`}
    >
      {rune}
    </div>
  );
};

const summoningTheme = {
  ...darkTheme({
    accentColor: "#7c3aed",
    accentColorForeground: "#e2e8f0",
    borderRadius: "medium",
    fontStack: "system",
    overlayBlur: "small",
  }),
  colors: {
    ...darkTheme().colors,
    accentColor: "#7c3aed",
    accentColorForeground: "#e2e8f0",
    modalBackground: "#0d0d15",
    modalBorder: "#1e1e2e",
    modalBackdrop: "rgba(5, 5, 8, 0.85)",
    modalText: "#e2e8f0",
    modalTextDim: "#cbd5e1",
    modalTextSecondary: "#cbd5e1",
    profileForeground: "#111118",
    profileAction: "#1e1e2e",
    profileActionHover: "#2d1b4e",
    menuItemBackground: "#111118",
    generalBorder: "#1e1e2e",
    generalBorderDim: "#1e1e2e",
    actionButtonBorder: "#1e1e2e",
    actionButtonBorderMobile: "#1e1e2e",
    actionButtonSecondaryBackground: "#111118",
    closeButton: "#e2e8f0",
    closeButtonBackground: "#1e1e2e",
    connectButtonBackground: "#0d0d15",
    connectButtonBackgroundError: "#4a1b1b",
    connectButtonInnerBackground: "#111118",
    connectButtonText: "#e2e8f0",
    connectButtonTextError: "#EF4444",
    connectionIndicator: "#7c3aed",
    downloadBottomCardBackground: "#0d0d15",
    downloadTopCardBackground: "#111118",
    error: "#EF4444",
    selectedOptionBorder: "#7c3aed",
    standby: "#c4b5fd",
  },
  fonts: {
    body: "'Crimson Text', Georgia, serif",
  },
};

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={summoningTheme} avatar={GlyphAvatar}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
