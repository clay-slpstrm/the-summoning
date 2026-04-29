/**
 * SacrificePanel — burn $RITUAL to earn on-chain glyph NFTs.
 *
 * Handles the full flow:
 *   1. Check allowance → prompt approve if needed
 *   2. commitRitual(amount) → burns tokens + triggers VRF
 *   3. Show tx status feedback
 *
 * Only visible during Ritual phase of an active epoch.
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

  // Refetch cooldown after a successful sacrifice — kicks the countdown immediately.
  useEffect(() => {
    if (sacrificeSuccess) {
      refetchCooldown();
    }
  }, [sacrificeSuccess, refetchCooldown]);

  if (!address) return null;
  if (epoch.phase !== "Ritual") return null;

  const amountWei = (() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  })();

  const needsApproval = allowance !== undefined && amountWei > 0n && (allowance as bigint) < amountWei;
  const isValidAmount = amountWei >= parseEther("100"); // MIN_SACRIFICE
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
          Minimum sacrifice: 100 $RITUAL
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

      {/* Success feedback */}
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
            VRF requested — channeling your glyph...
          </div>
        </div>
      )}
    </div>
  );
}
