"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { SUMMONING_ENGINE_ADDRESS, SUMMONING_ENGINE_ABI } from "@/lib/contracts";
import { useClaimReward } from "@/hooks/useSummoning";
import type { EpochData } from "@/hooks/useEpochProgress";

const ARTIFACT_TIERS = [
  { id: 0, name: "Shattered Ritual", color: "#6B7280", flavor: "A relic of failure. Proof you tried." },
  { id: 1, name: "Harbinger",        color: "#F59E0B", flavor: "Top contributor. The Old One sees you." },
  { id: 2, name: "Acolyte",          color: "#A855F7", flavor: "A loyal servant of the void." },
  { id: 3, name: "Cultist",          color: "#4A9EFF", flavor: "A faithful participant in the ritual." },
] as const;

// Mirrors SummoningEngine._calculateTier (including the M-01 sole-summoner Harbinger case).
// Must stay in sync with contracts/src/SummoningEngine.sol.
function predictTier(
  contribution: bigint,
  totalCommitted: bigint,
  participantCount: number,
  successful: boolean,
): number {
  if (!successful) return 0;
  if (participantCount === 0) return 3;
  if (participantCount === 1) return 1; // M-01: sole summoner → Harbinger
  const avg = totalCommitted / BigInt(participantCount);
  if (contribution >= avg * 10n) return 1;
  if (contribution >= avg * 3n) return 2;
  return 3;
}

export default function ClaimArtifact({ epoch }: { epoch: EpochData }) {
  const { address } = useAccount();
  const [claimedTier, setClaimedTier] = useState<number | null>(null);

  const { data: contribution, refetch } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "getContribution",
    args: address ? [BigInt(epoch.epochId), address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address && epoch.resolved },
  });

  // Post-audit (C-01): contribution is no longer zeroed on claim; double-claim is
  // guarded by this flag. Hide the panel after a successful claim even on reload.
  const { data: alreadyClaimed, refetch: refetchClaimed } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "rewardClaimed",
    args: address ? [BigInt(epoch.epochId), address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address && epoch.resolved },
  });

  const { claimReward, isPending, isConfirming, isSuccess } = useClaimReward();

  const tierId =
    contribution !== undefined && contribution > 0n
      ? predictTier(contribution as bigint, epoch.totalCommitted, epoch.participantCount, epoch.successful)
      : null;

  useEffect(() => {
    if (isSuccess && tierId !== null) {
      setClaimedTier(tierId);
      refetch();
      refetchClaimed();
    }
  }, [isSuccess, tierId, refetch, refetchClaimed]);

  // Gate on the on-chain `resolved` flag, not the time-derived phase.
  // The contract's getCurrentPhase() returns Resolved once block.timestamp >= ritualEnd
  // even before resolveEpoch() has been called — claiming during that window reverts.
  if (!epoch.resolved || !address) return null;

  // Success state — sticky until reload
  if (claimedTier !== null) {
    const tier = ARTIFACT_TIERS[claimedTier];
    const tokenId = epoch.epochId * 1000 + claimedTier;
    return (
      <div
        className="card text-center space-y-3"
        style={{
          background: `linear-gradient(135deg, ${tier.color}15, ${tier.color}05)`,
          borderColor: `${tier.color}55`,
          boxShadow: `0 0 30px ${tier.color}33`,
        }}
      >
        <div className="section-label" style={{ color: tier.color }}>
          Artifact Claimed
        </div>
        <div className="font-heading text-2xl sm:text-3xl" style={{ color: tier.color }}>
          {tier.name} of {epoch.oldOneName}
        </div>
        <div className="text-sm sm:text-base text-gray-300 italic">{tier.flavor}</div>
        <div className="text-[12px] font-mono text-gray-300">
          Epoch {epoch.epochId} · Token ID: <span className="text-gray-200">{tokenId}</span>
        </div>
      </div>
    );
  }

  // No contribution → user didn't participate.
  if (contribution === undefined || contribution === 0n || tierId === null) return null;
  // Already claimed on a previous session — hide the card so we don't suggest a re-claim
  // (which would revert on-chain with AlreadyClaimed). The within-session sticky-success
  // path is handled above via claimedTier.
  if (alreadyClaimed === true) return null;

  const tier = ARTIFACT_TIERS[tierId];
  const isBusy = isPending || isConfirming;

  const buttonText = (() => {
    if (isPending) return "Confirm in wallet...";
    if (isConfirming) return "Claiming...";
    return `Claim ${tier.name}`;
  })();

  return (
    <div
      className="card space-y-3"
      style={{
        background: `linear-gradient(135deg, ${tier.color}10, transparent)`,
        borderColor: `${tier.color}44`,
      }}
    >
      <div className="section-label" style={{ color: tier.color }}>
        Reward Available
      </div>

      <div>
        <div className="font-heading text-xl sm:text-2xl" style={{ color: tier.color }}>
          {tier.name} of {epoch.oldOneName}
        </div>
        <div className="text-[11px] tracking-[2px] uppercase font-mono text-gray-500 mt-0.5">
          Epoch {epoch.epochId}
        </div>
        <div className="text-sm text-gray-300 italic mt-1">{tier.flavor}</div>
      </div>

      <div className="text-[13px] font-mono text-gray-300 space-y-1">
        <div className="flex justify-between">
          <span>Your contribution</span>
          <span className="text-gray-200">
            {(Number(contribution) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })} $RITUAL
          </span>
        </div>
        <div className="flex justify-between">
          <span>Epoch outcome</span>
          <span className="text-gray-200">
            {epoch.successful ? "✦ Summoned" : "✕ Failed"}
          </span>
        </div>
      </div>

      <button
        className="btn-sacrifice"
        onClick={() => claimReward(BigInt(epoch.epochId))}
        disabled={isBusy}
        style={{
          background: `linear-gradient(135deg, ${tier.color}aa, ${tier.color}66)`,
          boxShadow: `0 0 20px ${tier.color}44`,
        }}
      >
        {buttonText}
      </button>
    </div>
  );
}
