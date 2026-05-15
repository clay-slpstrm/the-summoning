/**
 * SacrificePanel — burn $RITUAL during the Ritual phase.
 *
 * After the C-01 redesign, commitRitual is a pure burn: tokens are destroyed,
 * contribution + lifetimeContribution accumulate, and the wallet earns one
 * glyph per 100 RITUAL of cumulative contribution to the epoch. No VRF runs
 * during sacrifice — glyphs are batched-claimed after epoch resolution.
 *
 * Flow:
 *   1. Check allowance → prompt approve if needed
 *   2. commitRitual(amount) → burns tokens, no VRF
 *   3. Pending-glyphs indicator updates from the contract's contributions map
 *
 * Only visible during the Ritual phase of an active epoch.
 */

"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { parseEther, formatEther } from "viem";
import {
  useCommitRitual,
  useApproveRitual,
  useRitualAllowance,
} from "@/hooks/useSummoning";
import { SUMMONING_ENGINE_ADDRESS, SUMMONING_ENGINE_ABI } from "@/lib/contracts";
import { CONTRACT_PARAMS } from "@/lib/constants";
import type { EpochData } from "@/hooks/useEpochProgress";

const QUICK_AMOUNTS = [
  { label: "100", value: "100" },
  { label: "500", value: "500" },
  { label: "1,000", value: "1000" },
] as const;

const GLYPH_UNIT_WEI = parseEther(String(CONTRACT_PARAMS.GLYPH_UNIT));

export default function SacrificePanel({ epoch }: { epoch: EpochData }) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("100");

  // Hooks
  const { commitRitual, isPending: isSacrificing, isConfirming: isSacrificeConfirming, isSuccess: sacrificeSuccess } = useCommitRitual();
  const { approve, isPending: isApproving, isConfirming: isApproveConfirming, isSuccess: approveSuccess } = useApproveRitual();
  const { data: allowance, refetch: refetchAllowance } = useRitualAllowance(address);

  // Cooldown — preempt SACRIFICE_COOLDOWN (30s) on-chain revert.
  const { data: lastSacrificeTime, refetch: refetchCooldown } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "lastSacrificeTime",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  // Current epoch contribution — drives the pending-glyphs indicator.
  const { data: contribution, refetch: refetchContribution } = useReadContract({
    address: SUMMONING_ENGINE_ADDRESS,
    abi: SUMMONING_ENGINE_ABI,
    functionName: "getContribution",
    args: address ? [BigInt(epoch.epochId), address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  const cooldownEnd =
    lastSacrificeTime !== undefined
      ? Number(lastSacrificeTime) + CONTRACT_PARAMS.SACRIFICE_COOLDOWN
      : 0;

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const cooldownRemaining = Math.max(0, cooldownEnd - now);
  const isCooldown = cooldownRemaining > 0;

  useEffect(() => {
    if (!isCooldown) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [isCooldown]);

  // Refetch allowance after successful approve
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
    }
  }, [approveSuccess, refetchAllowance]);

  // Refetch cooldown + contribution after a successful sacrifice.
  useEffect(() => {
    if (sacrificeSuccess) {
      refetchCooldown();
      refetchContribution();
    }
  }, [sacrificeSuccess, refetchCooldown, refetchContribution]);

  if (!address) return null;
  if (epoch.phase !== "Ritual") return null;

  const amountWei = (() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  })();

  const currentContribution = (contribution as bigint | undefined) ?? 0n;
  const pendingGlyphs = currentContribution / GLYPH_UNIT_WEI;
  const contributionAfter = currentContribution + amountWei;
  const glyphsAfter = contributionAfter / GLYPH_UNIT_WEI;
  // RITUAL still needed to earn the next glyph beyond the post-sacrifice total.
  const nextThresholdWei = (glyphsAfter + 1n) * GLYPH_UNIT_WEI;
  const ritualToNext = nextThresholdWei - contributionAfter;

  const needsApproval = allowance !== undefined && amountWei > 0n && (allowance as bigint) < amountWei;
  const isValidAmount = amountWei >= parseEther("1"); // MIN_SACRIFICE
  const isBusy = isSacrificing || isSacrificeConfirming || isApproving || isApproveConfirming;

  const handleSacrifice = () => {
    if (!isValidAmount || isBusy || isCooldown) return;
    if (needsApproval) {
      approve();
    } else {
      commitRitual(amountWei);
    }
  };

  const buttonText = (() => {
    if (isApproving) return "APPROVE IN WALLET...";
    if (isApproveConfirming) return "APPROVING...";
    if (isSacrificing) return "CONFIRM IN WALLET...";
    if (isSacrificeConfirming) return "SACRIFICING...";
    if (isCooldown) return `WAIT ${cooldownRemaining}s`;
    if (sacrificeSuccess) return "SACRIFICE ACCEPTED";
    if (needsApproval) return "APPROVE & SACRIFICE";
    return "SACRIFICE $RITUAL";
  })();

  return (
    <div className="card p-4 sm:p-5">
      <div className="section-label">SACRIFICE $RITUAL</div>

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

      {/* Quick amount buttons */}
      <div className="flex gap-2 mt-2">
        {QUICK_AMOUNTS.map((qa) => (
          <button
            key={qa.value}
            onClick={() => setAmount(qa.value)}
            className={`btn-quick ${amount === qa.value ? "btn-quick-active" : "btn-quick-inactive"}`}
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Minimum warning */}
      {amount && !isValidAmount && amountWei > 0n && (
        <div className="text-[14px] text-red-400 mt-2">
          Minimum sacrifice: 1 $RITUAL
        </div>
      )}

      {/* Sacrifice button */}
      <button
        onClick={handleSacrifice}
        disabled={!isValidAmount || isBusy || isCooldown}
        className="btn-sacrifice w-full mt-4"
        style={{
          opacity: !isValidAmount || isBusy || isCooldown ? 0.5 : 1,
          cursor: !isValidAmount || isBusy || isCooldown ? "not-allowed" : "pointer",
        }}
      >
        {buttonText}
      </button>

      {/* Pending glyphs indicator — drives expectations during the Ritual window.
          Glyphs are not minted here; they're claimable in a batch once the epoch resolves. */}
      <div
        className="mt-4 p-3 rounded-lg"
        style={{
          background: "rgba(13, 13, 21, 0.6)",
          border: "1px solid #1e1e2e",
        }}
      >
        <div className="flex justify-between items-baseline">
          <span className="text-[12px] sm:text-[13px] tracking-[2px] uppercase font-mono text-gray-400">
            Pending glyphs
          </span>
          <span className="text-base sm:text-lg font-mono text-ritual-light">
            {pendingGlyphs.toString()}
          </span>
        </div>
        <div className="flex justify-between items-baseline mt-1.5">
          <span className="text-[11px] sm:text-[12px] tracking-[1.5px] uppercase font-mono text-gray-500">
            Until next glyph
          </span>
          <span className="text-xs sm:text-sm font-mono text-gray-300">
            {Number(formatEther(currentContribution > 0n ? (pendingGlyphs + 1n) * GLYPH_UNIT_WEI - currentContribution : GLYPH_UNIT_WEI))
              .toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
            $RITUAL
          </span>
        </div>
        {amountWei > 0n && (
          <div className="flex justify-between items-baseline mt-1.5 pt-1.5 border-t border-void-border/50">
            <span className="text-[11px] sm:text-[12px] tracking-[1.5px] uppercase font-mono text-gray-500">
              After this sacrifice
            </span>
            <span className="text-xs sm:text-sm font-mono text-purple-300">
              {glyphsAfter.toString()} glyph{glyphsAfter === 1n ? "" : "s"}
              {ritualToNext > 0n && glyphsAfter < pendingGlyphs + 10n ? (
                <span className="text-gray-500">
                  {" "}
                  ·{" "}
                  {Number(formatEther(ritualToNext)).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}{" "}
                  to next
                </span>
              ) : null}
            </span>
          </div>
        )}
      </div>

      {/* Success feedback — pure burn, no VRF channeling. */}
      {sacrificeSuccess && (
        <div
          className="text-center mt-3 py-3 rounded-lg animate-fade-in"
          style={{
            background: "linear-gradient(135deg, #4c1d9522, #7c3aed22)",
            border: "1px solid #7c3aed44",
            boxShadow: "0 0 30px #7c3aed22",
          }}
        >
          <div className="text-sm text-ritual-light font-serif tracking-wide">
            The void accepts your offering
          </div>
          <div className="text-[14px] text-gray-400 mt-1 font-mono tracking-wider">
            Glyphs claimable after the ritual resolves
          </div>
        </div>
      )}
    </div>
  );
}
