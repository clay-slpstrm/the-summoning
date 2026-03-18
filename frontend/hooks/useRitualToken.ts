"use client";

import { useReadContract, useAccount } from "wagmi";
import { RITUAL_TOKEN_ADDRESS, RITUAL_TOKEN_ABI } from "@/lib/contracts";
import { formatUnits } from "viem";

export function useRitualBalance() {
  const { address } = useAccount();

  const { data: balance, ...rest } = useReadContract({
    address: RITUAL_TOKEN_ADDRESS,
    abi: RITUAL_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const raw = balance ?? 0n;
  const formatted = formatUnits(raw, 18);

  return {
    balance: raw,
    formatted,
    display: Number(formatted).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    ...rest,
  };
}
