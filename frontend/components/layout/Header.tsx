"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRitualBalance } from "@/hooks/useRitualToken";
import { useEpochProgress } from "@/hooks/useEpochProgress";
import { useAccount } from "wagmi";

export function Header() {
  const { isConnected } = useAccount();
  const { display } = useRitualBalance();
  const { epoch } = useEpochProgress();

  const subtitle = epoch
    ? `Epoch ${epoch.epochId} — ${epoch.oldOneSubtitle}`
    : "The veil grows thin...";

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
      <div>
        <div className="flex items-center gap-3 sm:gap-4">
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-[4px] sm:tracking-[6px] text-ritual-light uppercase"
            style={{ textShadow: "0 0 60px #7c3aed66, 0 0 120px #7c3aed22" }}
          >
            The Summoning
          </h1>
          <Link
            href="/about"
            className="text-[9px] sm:text-[10px] tracking-[2px] uppercase font-mono text-gray-600 hover:text-ritual-light transition-colors hidden sm:block"
          >
            About
          </Link>
        </div>
        <p className="text-[10px] sm:text-[11px] text-gray-600 tracking-[2px] sm:tracking-[3px] font-mono mt-0.5">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/about"
          className="text-[9px] tracking-[2px] uppercase font-mono text-gray-600 hover:text-ritual-light transition-colors sm:hidden"
        >
          About
        </Link>
        {isConnected && (
          <div className="stat-box text-right">
            <div className="text-[9px] sm:text-[10px] text-gray-600 tracking-[2px] uppercase font-mono">$RITUAL</div>
            <div className="text-xs sm:text-sm text-ritual-light font-mono">{display}</div>
          </div>
        )}
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus="avatar"
        />
      </div>
    </header>
  );
}
