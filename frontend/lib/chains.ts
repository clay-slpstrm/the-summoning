import { mainnet, sepolia } from "wagmi/chains";

/**
 * Chain configuration.
 *
 * Development: Sepolia (NEXT_PUBLIC_CHAIN_ID=11155111)
 * Production: Mainnet (NEXT_PUBLIC_CHAIN_ID=1)
 */

const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");

export const activeChain = chainId === 1 ? mainnet : sepolia;

export const isMainnet = chainId === 1;
