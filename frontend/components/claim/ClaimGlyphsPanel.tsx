/**
 * ClaimGlyphsPanel — batched VRF claim for glyph NFTs earned in a resolved epoch.
 *
 * Reads:
 *   contributions[epochId][wallet]      → total burned this epoch (in wei)
 *   glyphsClaimedCount[epochId][wallet] → glyphs already claimed
 * Computes:
 *   totalEarned   = contribution / 100  (GLYPH_UNIT)
 *   remaining     = totalEarned - claimed
 *   claimableNow  = min(remaining, 50)  (MAX_GLYPHS_PER_CLAIM)
 *
 * On click, calls claimGlyphs(epochId). The contract burns nothing more and
 * issues ONE VRF request for `claimableNow` random words; glyphs arrive
 * shortly after the callback fires. Whales call again for the next batch.
 *
 * Only renders when epoch.resolved && contribution > 0.
 */

"use client";

import { useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatEther } from "viem";
import { SUMMONING_ENGINE_ADDRESS, SUMMONING_ENGINE_ABI } from "@/lib/contracts";
import { useClaimGlyphs } from "@/hooks/useSummoning";
import { CONTRACT_PARAMS } from "@/lib/constants";
import type { EpochData } from "@/hooks/useEpochProgress";

const GLYPH_UNIT = BigInt(CONTRACT_PARAMS.GLYPH_UNIT) * BigInt(1e18);
const MAX_PER_CLAIM = BigInt(CONTRACT_PARAMS.MAX_GLYPHS_PER_CLAIM);

export default function ClaimGlyphsPanel({ epoch }: { epoch: EpochData }) {
  const { address } = useAccount();

  const { data: contribution, refetch: refetchContribution } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "getContribution",
    args: address ? [BigInt(epoch.epochId), address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address && epoch.resolved },
  });

  const { data: claimed, refetch: refetchClaimed } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "glyphsClaimedCount",
    args: address ? [BigInt(epoch.epochId), address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address && epoch.resolved },
  });

  const { claimGlyphs, isPending, isConfirming, isSuccess } = useClaimGlyphs();

  // Refetch after success so the UI advances to the next batch / hides when done.
  useEffect(() => {
    if (isSuccess) {
      refetchContribution();
      refetchClaimed();
    }
  }, [isSuccess, refetchContribution, refetchClaimed]);

  if (!address || !epoch.resolved) return null;

  const contribWei = (contribution as bigint | undefined) ?? 0n;
  const claimedCount = (claimed as bigint | undefined) ?? 0n;

  // No participation in this epoch → nothing to show.
  if (contribWei === 0n) return null;

  const totalEarned = contribWei / GLYPH_UNIT;
  // Below-threshold sacrificer — earned no glyphs. Show a hint instead of a claim button.
  if (totalEarned === 0n) {
    const toThreshold = GLYPH_UNIT - contribWei;
    return (
      <div
        className="card text-center py-5 space-y-2 mt-4"
        style={{
          background: "linear-gradient(135deg, #94A3B815, transparent)",
          borderColor: "#94A3B844",
        }}
      >
        <div className="section-label" style={{ color: "#94A3B8" }}>
          No Glyphs Earned
        </div>
        <div className="text-xs sm:text-sm text-gray-300 italic">
          You sacrificed {Number(formatEther(contribWei)).toLocaleString(undefined, { maximumFractionDigits: 0 })} $RITUAL,
          below the 100 RITUAL threshold for a glyph in this epoch.
        </div>
        <div className="text-[11px] sm:text-[12px] text-gray-500 font-mono tracking-wide">
          Lifetime contribution still earns Initiate rank ·{" "}
          {Number(formatEther(toThreshold)).toLocaleString(undefined, { maximumFractionDigits: 0 })} short of qualifying
        </div>
      </div>
    );
  }

  const remaining = totalEarned > claimedCount ? totalEarned - claimedCount : 0n;
  const claimableNow = remaining > MAX_PER_CLAIM ? MAX_PER_CLAIM : remaining;
  const remainingAfter = remaining > MAX_PER_CLAIM ? remaining - MAX_PER_CLAIM : 0n;

  // All glyphs claimed → done state.
  if (remaining === 0n) {
    return (
      <div
        className="card text-center py-5 space-y-2 mt-4"
        style={{
          background: "linear-gradient(135deg, #7c3aed10, transparent)",
          borderColor: "#7c3aed44",
        }}
      >
        <div className="section-label" style={{ color: "#c4b5fd" }}>
          Glyphs Claimed
        </div>
        <div className="text-sm text-gray-300">
          All {totalEarned.toString()} glyph{totalEarned === 1n ? "" : "s"} from this epoch have been requested.
        </div>
        <div className="text-[11px] text-gray-500 font-mono tracking-wide italic">
          They&apos;ll appear in your collection once VRF fulfills.
        </div>
      </div>
    );
  }

  const isBusy = isPending || isConfirming;
  const buttonText = (() => {
    if (isPending) return "Confirm in wallet...";
    if (isConfirming) return "Channeling...";
    return `Claim ${claimableNow.toString()} Glyph${claimableNow === 1n ? "" : "s"}`;
  })();

  return (
    <div
      className="card space-y-3 mt-4"
      style={{
        background: "linear-gradient(135deg, #7c3aed15, transparent)",
        borderColor: "#7c3aed55",
      }}
    >
      <div className="section-label" style={{ color: "#c4b5fd" }}>
        Glyphs Earned
      </div>

      <div className="text-[13px] font-mono text-gray-300 space-y-1">
        <div className="flex justify-between">
          <span>Your contribution</span>
          <span className="text-gray-200">
            {Number(formatEther(contribWei)).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            $RITUAL
          </span>
        </div>
        <div className="flex justify-between">
          <span>Total earned</span>
          <span className="text-gray-200">{totalEarned.toString()} glyph{totalEarned === 1n ? "" : "s"}</span>
        </div>
        {claimedCount > 0n && (
          <div className="flex justify-between">
            <span>Already claimed</span>
            <span className="text-gray-200">{claimedCount.toString()}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-void-border/50 pt-1 mt-1">
          <span>Claim now</span>
          <span className="text-ritual-light font-bold">
            {claimableNow.toString()}
            {remainingAfter > 0n ? (
              <span className="text-gray-500 font-normal"> ({remainingAfter.toString()} after)</span>
            ) : null}
          </span>
        </div>
      </div>

      <button
        className="btn-sacrifice"
        onClick={() => claimGlyphs(BigInt(epoch.epochId))}
        disabled={isBusy}
        style={{
          background: "linear-gradient(135deg, #7c3aedaa, #4c1d9588)",
          boxShadow: "0 0 20px #7c3aed44",
        }}
      >
        {buttonText}
      </button>

      {remaining > MAX_PER_CLAIM && (
        <div className="text-[11px] text-gray-500 italic tracking-wide text-center">
          Capped at {MAX_PER_CLAIM.toString()} per claim, call again for the rest.
        </div>
      )}
    </div>
  );
}
