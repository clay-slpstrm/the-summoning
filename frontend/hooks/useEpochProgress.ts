/**
 * useEpochProgress
 *
 * Reads epoch state directly from the SummoningEngine contract via wagmi.
 * Returns progress (0-100), timing data for countdowns, and Old One identity.
 *
 * Polls every 15s for totalCommitted updates during active Ritual phase.
 */

"use client";

import { useReadContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { SUMMONING_ENGINE_ADDRESS, SUMMONING_ENGINE_ABI } from "@/lib/contracts";
import { OLD_ONES } from "@/lib/constants";
import { getStageForProgress, type PortalStage } from "@/components/portal/PortalStages";

export type EpochData = {
  epochId: number;
  oldOneId: number;
  oldOneName: string;
  oldOneSubtitle: string;
  threshold: bigint;
  totalCommitted: bigint;
  gatheringStart: number; // unix seconds
  ritualStart: number;
  ritualEnd: number;
  successful: boolean;
  resolved: boolean;
  participantCount: number;
  phase: "Inactive" | "Gathering" | "Ritual" | "Resolved";
  progress: number; // 0-100
  stage: PortalStage;
};

const PHASE_NAMES = ["Inactive", "Gathering", "Ritual", "Resolved"] as const;

export function useEpochProgress(): {
  epoch: EpochData | null;
  isLoading: boolean;
  error: string | null;
} {
  const {
    data: currentEpochId,
    isLoading: isLoadingId,
    error: errorId,
  } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "currentEpochId",
    chainId: sepolia.id,
    query: { refetchInterval: 30_000 },
  });

  const { data: phase } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "getCurrentPhase",
    chainId: sepolia.id,
    query: { refetchInterval: 15_000 },
  });

  const {
    data: epochData,
    isLoading: isLoadingEpoch,
    error: errorEpoch,
  } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "getEpoch",
    args: currentEpochId !== undefined ? [currentEpochId] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: currentEpochId !== undefined && currentEpochId > 0n,
      refetchInterval: 15_000,
    },
  });

  const isLoading = isLoadingId || isLoadingEpoch;
  const error = errorId ?? errorEpoch;

  if (error) {
    console.error("[useEpochProgress] RPC error:", error.message);
    return { epoch: null, isLoading: false, error: error.message };
  }

  if (isLoading || currentEpochId === undefined) {
    return { epoch: null, isLoading: true, error: null };
  }

  if (currentEpochId === 0n || !epochData) {
    return { epoch: null, isLoading: false, error: null };
  }

  const [
    oldOneId, threshold, totalCommitted,
    gatheringStart, ritualStart, ritualEnd,
    successful, resolved, participantCount,
  ] = epochData;

  const phaseName = PHASE_NAMES[Number(phase ?? 0)] ?? "Inactive";

  const progress =
    threshold > 0n
      ? Math.min(Number((totalCommitted * 10000n) / threshold) / 100, 100)
      : 0;

  const oldOne =
    OLD_ONES.find((o) => o.id === Number(oldOneId)) ??
    ({ name: "Unknown", subtitle: "" } as const);

  return {
    epoch: {
      epochId: Number(currentEpochId),
      oldOneId: Number(oldOneId),
      oldOneName: oldOne.name,
      oldOneSubtitle: oldOne.subtitle,
      threshold,
      totalCommitted,
      gatheringStart: Number(gatheringStart),
      ritualStart: Number(ritualStart),
      ritualEnd: Number(ritualEnd),
      successful,
      resolved,
      participantCount: Number(participantCount),
      phase: phaseName,
      progress,
      stage: getStageForProgress(progress),
    },
    isLoading: false,
    error: null,
  };
}
