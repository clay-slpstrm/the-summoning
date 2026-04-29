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
            className="text-[13px] sm:text-[14px] tracking-[2px] uppercase font-mono text-gray-300 hover:text-ritual-light transition-colors hidden sm:block font-bold"
          >
            About
          </Link>
        </div>
        <p className="text-[14px] sm:text-[15px] text-gray-300 tracking-[2px] sm:tracking-[3px] font-mono mt-0.5">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/about"
          className="text-[13px] tracking-[2px] uppercase font-mono text-gray-300 hover:text-ritual-light transition-colors sm:hidden"
        >
          About
        </Link>
        {isConnected && (
          <div className="stat-box text-right">
            <div className="text-[13px] sm:text-[14px] text-gray-300 tracking-[2px] uppercase font-mono font-bold">$RITUAL</div>
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
