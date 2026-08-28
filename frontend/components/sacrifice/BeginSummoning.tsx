/**
 * BeginSummoning — the idle-state call to action.
 *
 * The Summoning is self-perpetuating: there is no owner-run startEpoch. When no
 * summoning is active — either before the very first one (pre-genesis) or in the
 * quiet gap after a ritual resolves — the next sacrifice auto-opens the next epoch
 * on-chain (commitRitual derives the threshold + Old One itself). This panel is
 * that first sacrifice: approve if needed, then commitRitual, which both opens the
 * 24h ritual window and counts as the opening contribution.
 *
 * `resolvedEpoch` is the just-resolved epoch when we're between summonings, or null
 * before genesis — used to preview which Old One is called next.
 */

"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { activeChain } from "@/lib/chains";
import { parseEther, formatEther } from "viem";
import {
  useCommitRitual,
  useApproveRitual,
  useRitualAllowance,
} from "@/hooks/useSummoning";
import { SUMMONING_ENGINE_ADDRESS, SUMMONING_ENGINE_ABI } from "@/lib/contracts";
import { CONTRACT_PARAMS, OLD_ONES } from "@/lib/constants";
import type { EpochData } from "@/hooks/useEpochProgress";

/** Which Old One the next auto-opened epoch will call. Mirrors the on-chain rule. */
function nextOldOneId(resolvedEpoch: EpochData | null): number {
  if (!resolvedEpoch) return 1; // genesis: Cthulhu
  if (resolvedEpoch.successful) {
    return resolvedEpoch.oldOneId >= CONTRACT_PARAMS.OLD_ONE_COUNT
      ? 1
      : resolvedEpoch.oldOneId + 1;
  }
  return resolvedEpoch.oldOneId; // loss → retry the same Old One
}

export default function BeginSummoning({
  resolvedEpoch,
}: {
  resolvedEpoch: EpochData | null;
}) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("100");

  const { commitRitual, isPending, isConfirming, isSuccess, error: commitError } = useCommitRitual();
  const {
    approve,
    isPending: isApproving,
    isConfirming: isApproveConfirming,
    isSuccess: approveSuccess,
    error: approveError,
  } = useApproveRitual();
  const { data: allowance, refetch: refetchAllowance } = useRitualAllowance(address);

  // The threshold the next auto-opened epoch will require (genesis before epoch 1,
  // escalated/decayed after a resolution).
  const { data: nextThresholdWei } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "nextThreshold",
    chainId: activeChain.id,
    query: { refetchInterval: 30_000 },
  });

  useEffect(() => {
    if (approveSuccess) refetchAllowance();
  }, [approveSuccess, refetchAllowance]);

  // Surface write failures — silently swallowing them left the button looking dead
  // (caught during the Sepolia stage-2 rehearsal).
  const writeError = commitError ?? approveError;
  useEffect(() => {
    if (writeError) console.error("[BeginSummoning] write failed:", writeError);
  }, [writeError]);

  if (!address) return null;

  const oldOne =
    OLD_ONES.find((o) => o.id === nextOldOneId(resolvedEpoch)) ?? OLD_ONES[0];

  const amountWei = (() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  })();

  const isValidAmount = amountWei >= parseEther("1"); // MIN_SACRIFICE
  const needsApproval =
    allowance !== undefined && amountWei > 0n && (allowance as bigint) < amountWei;
  const isBusy = isPending || isConfirming || isApproving || isApproveConfirming;

  const handleBegin = () => {
    if (!isValidAmount || isBusy) return;
    if (needsApproval) approve();
    else commitRitual(amountWei);
  };

  const buttonText = (() => {
    if (isApproving) return "APPROVE IN WALLET...";
    if (isApproveConfirming) return "APPROVING...";
    if (isPending) return "CONFIRM IN WALLET...";
    if (isConfirming) return "OPENING THE PORTAL...";
    if (needsApproval) return "APPROVE & BEGIN";
    return "BEGIN THE SUMMONING";
  })();

  const thresholdLabel =
    nextThresholdWei !== undefined
      ? `${Number(formatEther(nextThresholdWei as bigint)).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })} $RITUAL`
      : "…";

  const title = resolvedEpoch ? "BEGIN THE NEXT SUMMONING" : "BEGIN THE SUMMONING";
  const lead = resolvedEpoch
    ? "The veil is quiet. Your sacrifice opens the next summoning — a 24 hour ritual. Any burn counts toward the threshold."
    : "No summoning is active. Be the first to sacrifice: you open the ritual — a 24 hour window to summon the Old One. Any burn counts.";

  return (
    <div className="card p-4 sm:p-5 text-center">
      <div className="section-label">{title}</div>

      <div className="font-heading text-xl sm:text-2xl text-gray-100 mt-2">
        {oldOne.name}
      </div>
      <div className="text-sm text-gray-500 italic">{oldOne.subtitle}</div>

      <p className="text-xs sm:text-sm text-gray-300 mt-3 leading-relaxed">{lead}</p>

      <div className="mt-3 flex justify-between text-[13px] font-mono px-1">
        <span className="text-gray-500 uppercase tracking-wider">Threshold</span>
        <span className="text-ritual-light">{thresholdLabel}</span>
      </div>

      {/* Amount input */}
      <div className="mt-3">
        <div className="flex items-center gap-2 bg-[#0a0a0f] border border-void-border rounded-lg px-3 py-2.5">
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="flex-1 bg-transparent text-text-primary text-sm font-mono outline-none"
            placeholder="100"
          />
          <span className="text-gray-500 text-xs tracking-wider">$RITUAL</span>
        </div>
      </div>

      {amount && !isValidAmount && amountWei > 0n && (
        <div className="text-[14px] text-red-400 mt-2">Minimum sacrifice: 1 $RITUAL</div>
      )}

      <button
        onClick={handleBegin}
        disabled={!isValidAmount || isBusy}
        className="btn-sacrifice w-full mt-4"
        style={{
          opacity: !isValidAmount || isBusy ? 0.5 : 1,
          cursor: !isValidAmount || isBusy ? "not-allowed" : "pointer",
        }}
      >
        {buttonText}
      </button>

      {isSuccess && (
        <div className="text-sm text-ritual-light font-serif tracking-wide mt-3 animate-fade-in">
          The portal opens. The ritual has begun.
        </div>
      )}

      {writeError && !isBusy && (
        <div className="text-[13px] text-red-400 mt-3 break-words">
          The veil resists:{" "}
          {(writeError as { shortMessage?: string }).shortMessage ?? writeError.message?.slice(0, 160)}
        </div>
      )}
    </div>
  );
}
