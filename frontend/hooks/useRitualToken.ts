/**
 * Hook for $RITUAL token balance and basic operations.
 */

"use client";

import { useReadContract, useAccount } from "wagmi";
import { RITUAL_TOKEN_ADDRESS, RITUAL_TOKEN_ABI } from "@/lib/contracts";
import { formatUnits } from "viem";

export function useRitualBalance() {
  const { address } = useAccount();

  const { data: rawBalance, ...rest } = useReadContract({
    address: RITUAL_TOKEN_ADDRESS,
    abi: RITUAL_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const balance = rawBalance ? BigInt(rawBalance as string) : 0n;
  const formatted = formatUnits(balance, 18);

  return {
    balance,
    formatted,
    display: Number(formatted).toLocaleString(),
    ...rest,
  };
}
