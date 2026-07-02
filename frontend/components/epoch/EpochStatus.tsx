"use client";

import { formatEther } from "viem";
import { useEpochProgress } from "@/hooks/useEpochProgress";
import Countdown from "./Countdown";
import ProgressBar from "./ProgressBar";

function formatRitual(wei: bigint): string {
  const tokens = Number(formatEther(wei));
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toFixed(0);
}

const PHASE_LABEL: Record<string, string> = {
  Gathering: "GATHERING PHASE",
  Ritual: "RITUAL PHASE",
  Resolved: "EPOCH RESOLVED",
  Inactive: "INACTIVE",
};

// Visual accents (badge border/bg, progress gradients) — saturated tier colors.
const PHASE_COLOR: Record<string, string> = {
  Gathering: "#4A9EFF",
  Ritual: "#A855F7",
  Resolved: "#F59E0B",
  Inactive: "#6B7280",
};

// Text variant — brighter on dark bg so countdown / stage labels stay legible.
const PHASE_TEXT_COLOR: Record<string, string> = {
  Gathering: "#93C5FD",
  Ritual: "#D8B4FE",
  Resolved: "#FCD34D",
  Inactive: "#CBD5E1",
};

export default function EpochStatus() {
  const { epoch, isLoading, error } = useEpochProgress();

  if (isLoading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="h-3 bg-[#1e1e2e] rounded w-1/4" />
        <div className="h-5 bg-[#1e1e2e] rounded w-1/2" />
        <div className="h-3 bg-[#1e1e2e] rounded w-1/3" />
        <div className="h-1.5 bg-[#1e1e2e] rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-8">
        <div className="text-[12px] font-mono text-red-500/80">RPC error, retrying</div>
        <div className="text-[11px] font-mono text-gray-500 mt-1 break-all">{error.slice(0, 80)}</div>
      </div>
    );
  }

  if (!epoch) {
    return (
      <div className="card text-center py-8">
        <div className="text-gray-600 text-sm italic">No active epoch</div>
      </div>
    );
  }

  const phaseColor =
    epoch.phase === "Resolved"
      ? epoch.successful ? "#F59E0B" : "#6B7280"
      : PHASE_COLOR[epoch.phase] ?? "#6B7280";

  const phaseTextColor =
    epoch.phase === "Resolved"
      ? epoch.successful ? "#FCD34D" : "#CBD5E1"
      : PHASE_TEXT_COLOR[epoch.phase] ?? "#CBD5E1";

  // The contract returns phase="Resolved" once block.timestamp >= ritualEnd,
  // even before resolveEpoch() is actually called. Distinguish that limbo state
  // so the UI doesn't claim outcomes that haven't been written on-chain yet.
  const isPendingResolution = epoch.phase === "Resolved" && !epoch.resolved;

  const countdownTarget =
    epoch.phase === "Gathering" ? epoch.ritualStart :
    epoch.phase === "Ritual" ? epoch.ritualEnd : 0;

  return (
    <div className="card space-y-3 sm:space-y-4">
      {/* Old One identity */}
      <div>
        <div className="text-[13px] sm:text-[14px] tracking-[2px] sm:tracking-[3px] uppercase font-mono text-gray-300 font-bold">
          Epoch {epoch.epochId}
        </div>
        <div className="font-heading text-xl sm:text-2xl text-gray-100 mt-0.5">
          {epoch.oldOneName}
        </div>
        <div className="text-sm sm:text-base text-gray-500 italic">{epoch.oldOneSubtitle}</div>
      </div>

      {/* Phase badge + countdown */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="text-[12px] sm:text-[13px] tracking-[1.5px] sm:tracking-[2px] uppercase font-mono font-bold px-1.5 sm:px-2 py-1 rounded whitespace-nowrap"
          style={{
            color: isPendingResolution ? "#FCD34D" : phaseTextColor,
            border: `1px solid ${isPendingResolution ? "#F59E0B" : phaseColor}66`,
            background: `${isPendingResolution ? "#F59E0B" : phaseColor}11`,
          }}
        >
          {isPendingResolution ? "PENDING RESOLUTION" : PHASE_LABEL[epoch.phase]}
        </div>

        {countdownTarget > 0 && (
          <div className="text-right">
            <div className="text-[12px] sm:text-[13px] text-gray-300 uppercase tracking-wider sm:tracking-widest font-bold">
              {epoch.phase === "Gathering" ? "Ritual begins in" : "Ritual ends in"}
            </div>
            <div className="font-mono text-base sm:text-lg font-bold tabular-nums" style={{ color: phaseTextColor }}>
              <Countdown targetTimestamp={countdownTarget} />
            </div>
          </div>
        )}

        {epoch.phase === "Resolved" && epoch.resolved && (
          <div
            className="text-[14px] sm:text-[15px] font-mono tracking-widest font-bold"
            style={{ color: phaseTextColor }}
          >
            {epoch.successful ? "✦ SUMMONED" : "✕ FAILED"}
          </div>
        )}

        {isPendingResolution && (
          <div className="text-[12px] sm:text-[13px] text-gray-300 italic max-w-[180px] text-right">
            Awaiting Chainlink Automation to finalize&hellip;
          </div>
        )}
      </div>

      {/* Collective progress bar */}
      <ProgressBar progress={epoch.progress} />

      {/* Burned / needed */}
      <div className="flex justify-between text-[13px] sm:text-[14px] font-mono text-gray-300">
        <span>{formatRitual(epoch.totalCommitted)} $RITUAL burned</span>
        <span>{formatRitual(epoch.threshold)} needed</span>
      </div>

      {/* Stage + participants */}
      <div className="flex justify-between text-[13px] sm:text-[14px] font-mono text-gray-300">
        <span className="italic font-bold" style={{ color: phaseTextColor }}>
          {epoch.stage.name}
        </span>
        <span>
          {epoch.participantCount}{" "}
          {epoch.participantCount === 1 ? "cultist" : "cultists"}
        </span>
      </div>
    </div>
  );
}
