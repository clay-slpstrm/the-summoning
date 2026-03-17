"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRitualBalance } from "@/hooks/useRitualToken";
import { useAccount } from "wagmi";

export function Header() {
  const { isConnected } = useAccount();
  const { display } = useRitualBalance();

  return (
    <header className="flex items-center justify-between mb-6">
      <div>
        <h1
          className="text-2xl font-bold tracking-[5px] text-ritual-light uppercase"
          style={{ textShadow: "0 0 40px #7c3aed44" }}
        >
          The Summoning
        </h1>
        <p className="text-[11px] text-gray-600 tracking-[3px] font-mono mt-0.5">
          Epoch I — The Dreaming One Stirs
        </p>
      </div>

      <div className="flex items-center gap-3">
        {isConnected && (
          <div className="stat-box text-right">
            <div className="text-[10px] text-gray-600 tracking-[2px] uppercase font-mono">$RITUAL</div>
            <div className="text-sm text-ritual-light font-mono">{display}</div>
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
