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

const PHASE_COLOR: Record<string, string> = {
  Gathering: "#4A9EFF",
  Ritual: "#A855F7",
  Resolved: "#F59E0B",
  Inactive: "#6B7280",
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
        <div className="text-[10px] font-mono text-red-500/60">RPC error — retrying</div>
        <div className="text-[9px] font-mono text-gray-700 mt-1 break-all">{error.slice(0, 80)}</div>
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

  const countdownTarget =
    epoch.phase === "Gathering" ? epoch.ritualStart :
    epoch.phase === "Ritual" ? epoch.ritualEnd : 0;

  return (
    <div className="card space-y-3 sm:space-y-4">
      {/* Old One identity */}
      <div>
        <div className="text-[9px] sm:text-[10px] tracking-[2px] sm:tracking-[3px] uppercase font-mono text-gray-600">
          Epoch {epoch.epochId}
        </div>
        <div className="font-heading text-xl sm:text-2xl text-gray-100 mt-0.5">
          {epoch.oldOneName}
        </div>
        <div className="text-[11px] sm:text-xs text-gray-500 italic">{epoch.oldOneSubtitle}</div>
      </div>

      {/* Phase badge + countdown */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="text-[8px] sm:text-[9px] tracking-[1.5px] sm:tracking-[2px] uppercase font-mono px-1.5 sm:px-2 py-1 rounded whitespace-nowrap"
          style={{
            color: phaseColor,
            border: `1px solid ${phaseColor}44`,
            background: `${phaseColor}11`,
          }}
        >
          {PHASE_LABEL[epoch.phase]}
        </div>

        {countdownTarget > 0 && (
          <div className="text-right">
            <div className="text-[8px] sm:text-[9px] text-gray-600 uppercase tracking-wider sm:tracking-widest">
              {epoch.phase === "Gathering" ? "Ritual begins in" : "Ritual ends in"}
            </div>
            <div className="font-mono text-xs sm:text-sm" style={{ color: phaseColor }}>
              <Countdown targetTimestamp={countdownTarget} />
            </div>
          </div>
        )}

        {epoch.phase === "Resolved" && (
          <div
            className="text-[10px] sm:text-[11px] font-mono tracking-widest"
            style={{ color: phaseColor }}
          >
            {epoch.successful ? "✦ SUMMONED" : "✕ FAILED"}
          </div>
        )}
      </div>

      {/* Collective progress bar */}
      <ProgressBar progress={epoch.progress} />

      {/* Burned / needed */}
      <div className="flex justify-between text-[9px] sm:text-[10px] font-mono text-gray-600">
        <span>{formatRitual(epoch.totalCommitted)} $RITUAL burned</span>
        <span>{formatRitual(epoch.threshold)} needed</span>
      </div>

      {/* Stage + participants */}
      <div className="flex justify-between text-[9px] sm:text-[10px] font-mono text-gray-600">
        <span className="italic" style={{ color: phaseColor + "99" }}>
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
