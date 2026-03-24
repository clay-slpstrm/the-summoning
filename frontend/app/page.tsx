"use client";

import { useAccount } from "wagmi";
import { Header } from "@/components/layout/Header";
import { MintInterface } from "@/components/mint/MintInterface";
import GlyphReveal from "@/components/glyph/GlyphReveal";
import ChannelingOverlay from "@/components/glyph/ChannelingOverlay";
import GlyphCollection from "@/components/glyph/GlyphCollection";
import Portal from "@/components/portal/Portal";
import EpochStatus from "@/components/epoch/EpochStatus";
import CultRankBar from "@/components/rank/CultRankBar";
import Leaderboard from "@/components/rank/Leaderboard";
import SacrificePanel from "@/components/sacrifice/SacrificePanel";
import { useGlyphs } from "@/hooks/useGlyphs";
import { useEpochProgress } from "@/hooks/useEpochProgress";
import { useUIStore } from "@/stores/uiStore";

export default function Home() {
  const { address } = useAccount();
  useGlyphs(); // Hydrates glyphStore from REST API on wallet connect

  const { epoch } = useEpochProgress();
  const portalShake = useUIStore((s) => s.portalShake);

  const progress = epoch?.progress ?? 0;
  const isRitualActive = epoch?.phase === "Ritual";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, #0d0d1a 0%, #050508 70%)",
        }}
      />

      {/* Full-screen glyph reveal modal */}
      <ChannelingOverlay />
      <GlyphReveal />

      {/* Content */}
      <div className="relative z-10 max-w-[900px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Header />

        {/* Mint interface */}
        <div className="max-w-md mx-auto mt-6 sm:mt-8">
          <MintInterface />
        </div>

        {/* Portal + Epoch Status */}
        <div className="mt-6 sm:mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
          {/* Portal */}
          <div className="flex flex-col items-center">
            <div className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px]">
              <Portal
                progress={progress}
                isRitualActive={isRitualActive}
                shake={portalShake}
              />
            </div>
          </div>

          {/* Epoch status */}
          <EpochStatus />
        </div>

        {/* Sacrifice panel — visible during Ritual phase */}
        {address && epoch && (
          <div className="max-w-md mx-auto mt-6 sm:mt-8">
            <SacrificePanel epoch={epoch} />
          </div>
        )}

        {/* Glyph collection + rank */}
        {address && (
          <div className="mt-6 sm:mt-8">
            <GlyphCollection />
            <CultRankBar />
          </div>
        )}

        {/* Leaderboard */}
        <div className="mt-6 sm:mt-8">
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}
