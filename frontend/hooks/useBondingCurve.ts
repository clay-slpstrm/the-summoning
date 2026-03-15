/**
 * Hook for bonding curve interactions — mint $RITUAL by depositing ETH.
 *
 * See PRD.md Section 4.2 for acceptance criteria.
 */

"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { BONDING_CURVE_ADDRESS, BONDING_CURVE_ABI } from "@/lib/contracts";
import { parseEther } from "viem";

export function useMintRitual() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const mint = (ethAmount: string, minTokens: bigint = 0n) => {
    writeContract({
      address: BONDING_CURVE_ADDRESS,
      abi: BONDING_CURVE_ABI,
      functionName: "mint",
      args: [minTokens],
      value: parseEther(ethAmount),
    });
  };

  return { mint, hash, isPending, isConfirming, isSuccess };
}

export function useCurrentPrice() {
  return useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_ABI,
    functionName: "getCurrentPrice",
    query: { refetchInterval: 30_000 },
  });
}

export function useEstimatedCost(tokenAmount: bigint) {
  return useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_ABI,
    functionName: "getEstimatedCost",
    args: [tokenAmount],
    query: { enabled: tokenAmount > 0n },
  });
}
