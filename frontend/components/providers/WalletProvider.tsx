"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

/**
 * Wallet provider configuration.
 *
 * For production: switch defaultChain to mainnet.
 * RainbowKit can be added here for a polished connect modal.
 * See PRD.md F1 for wallet connection requirements.
 */

const queryClient = new QueryClient();

const config = createConfig({
  chains: [sepolia, mainnet],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
});

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
