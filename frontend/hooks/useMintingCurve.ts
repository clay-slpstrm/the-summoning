/**
 * Hook for minting curve interactions — mint $RITUAL by depositing ETH.
 *
 * See PRD.md Section 4.2 for acceptance criteria.
 *
 * MEV protection (H-03): mint() applies slippage protection by computing
 * minTokens = expectedTokens * (10000 - slippageBps) / 10000. Callers pass
 * the live quote from useTokensOut() (mirrors the contract's integral
 * exactly), so a sandwich attack that bumps price by more than the
 * tolerance reverts the mint.
 */

"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { MINTING_CURVE_ADDRESS, MINTING_CURVE_ABI } from "@/lib/contracts";
import { parseEther } from "viem";

/// Slippage tolerance in basis points: 100 = 1%.
export const DEFAULT_SLIPPAGE_BPS = 100n;

export function useMintRitual() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  /// Mint with slippage protection.
  /// @param ethAmount    Decimal ETH string (e.g. "0.01").
  /// @param expectedTokens On-chain getTokensOut quote for ethAmount. Pass 0n only if
  ///                       you intentionally want no slippage protection.
  /// @param slippageBps  Tolerance in BPS. 100 = 1% (default). 0 = no drift allowed.
  const mint = (
    ethAmount: string,
    expectedTokens: bigint,
    slippageBps: bigint = DEFAULT_SLIPPAGE_BPS,
  ) => {
    const value = parseEther(ethAmount);
    const minTokens =
      expectedTokens === 0n
        ? 0n
        : (expectedTokens * (10_000n - slippageBps)) / 10_000n;

    writeContract({
      address: MINTING_CURVE_ADDRESS,
      abi: MINTING_CURVE_ABI,
      functionName: "mint",
      args: [minTokens],
      value,
    });
  };

  return { mint, hash, isPending, isConfirming, isSuccess };
}

export function useCurrentPrice() {
  return useReadContract({
    address: MINTING_CURVE_ADDRESS,
    abi: MINTING_CURVE_ABI,
    functionName: "getCurrentPrice",
    query: { refetchInterval: 30_000 },
  });
}

export function useEstimatedCost(tokenAmount: bigint) {
  return useReadContract({
    address: MINTING_CURVE_ADDRESS,
    abi: MINTING_CURVE_ABI,
    functionName: "getEstimatedCost",
    args: [tokenAmount],
    query: { enabled: tokenAmount > 0n },
  });
}

/// Live preview of tokens-out for an ETH input. Source of truth — mirrors mint() exactly.
/// Pass the returned value to useMintRitual().mint() for slippage protection.
export function useTokensOut(ethWei: bigint) {
  return useReadContract({
    address: MINTING_CURVE_ADDRESS,
    abi: MINTING_CURVE_ABI,
    functionName: "getTokensOut",
    args: [ethWei],
    query: { enabled: ethWei > 0n, refetchInterval: 15_000 },
  });
}
