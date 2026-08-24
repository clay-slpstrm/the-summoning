/**
 * Hook for summoning engine interactions.
 *
 * Wraps wagmi's useWriteContract for commitRitual() and claimReward().
 * See ARCHITECTURE.md Section 5.5 for the hook pattern.
 */

"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import {
  SUMMONING_ENGINE_ADDRESS,
  SUMMONING_ENGINE_ABI,
  RITUAL_TOKEN_ABI,
  RITUAL_TOKEN_ADDRESS,
} from "@/lib/contracts";

export function useCommitRitual() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const commitRitual = (amount: bigint) => {
    writeContract({
      address: SUMMONING_ENGINE_ADDRESS,
      abi: SUMMONING_ENGINE_ABI,
      functionName: "commitRitual",
      args: [amount],
    });
  };

  return {
    commitRitual,
    hash,
    isPending, // tx submitted, waiting for wallet
    isConfirming, // tx in mempool, waiting for block
    isSuccess, // tx confirmed — glyph incoming via WS
    error, // wallet rejection / RPC / simulation failure — render this, never swallow
  };
}

export function useClaimReward() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimReward = (epochId: bigint) => {
    writeContract({
      address: SUMMONING_ENGINE_ADDRESS,
      abi: SUMMONING_ENGINE_ABI,
      functionName: "claimReward",
      args: [epochId],
    });
  };

  return { claimReward, hash, isPending, isConfirming, isSuccess };
}

export function useClaimGlyphs() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimGlyphs = (epochId: bigint) => {
    writeContract({
      address: SUMMONING_ENGINE_ADDRESS,
      abi: SUMMONING_ENGINE_ABI,
      functionName: "claimGlyphs",
      args: [epochId],
    });
  };

  return { claimGlyphs, hash, isPending, isConfirming, isSuccess };
}

export function useApproveRitual() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = () => {
    writeContract({
      address: RITUAL_TOKEN_ADDRESS,
      abi: RITUAL_TOKEN_ABI,
      functionName: "approve",
      args: [SUMMONING_ENGINE_ADDRESS, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

export function useRitualAllowance(walletAddress?: `0x${string}`) {
  return useReadContract({
    address: RITUAL_TOKEN_ADDRESS,
    abi: RITUAL_TOKEN_ABI,
    functionName: "allowance",
    args: walletAddress ? [walletAddress, SUMMONING_ENGINE_ADDRESS] : undefined,
    query: { enabled: !!walletAddress },
  });
}
