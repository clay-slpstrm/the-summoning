"use client";

import { useAccount } from "wagmi";
import { Header } from "@/components/layout/Header";
import { MintInterface } from "@/components/mint/MintInterface";
import GlyphReveal from "@/components/glyph/GlyphReveal";
import ChannelingOverlay from "@/components/glyph/ChannelingOverlay";
import GlyphCollection from "@/components/glyph/GlyphCollection";
import GlyphDetailModal from "@/components/glyph/GlyphDetailModal";
import Portal from "@/components/portal/Portal";
import EpochStatus from "@/components/epoch/EpochStatus";
import CultRankBar from "@/components/rank/CultRankBar";
import Leaderboard from "@/components/rank/Leaderboard";
import SacrificePanel from "@/components/sacrifice/SacrificePanel";
import ClaimArtifact from "@/components/claim/ClaimArtifact";
import ClaimGlyphsPanel from "@/components/claim/ClaimGlyphsPanel";
import PreLaunchModal from "@/components/layout/PreLaunchModal";
import Footer from "@/components/layout/Footer";
import { useGlyphs } from "@/hooks/useGlyphs";
import { useEpochProgress } from "@/hooks/useEpochProgress";
import { useUIStore } from "@/stores/uiStore";
import Link from "next/link";

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
      <GlyphDetailModal />

      {/* Content */}
      <div className="relative z-10 max-w-[900px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Header />

        {/* Hero / onboarding — shown when wallet not connected */}
        {!address && (
          <div className="text-center mt-8 sm:mt-12 mb-6 sm:mb-8 max-w-lg mx-auto">
            <p
              className="text-lg sm:text-xl font-serif text-gray-300 leading-relaxed"
              style={{ textShadow: "0 0 40px #7c3aed22" }}
            >
              Burn <span className="text-ritual-light">$RITUAL</span> tokens.
              Receive <span className="text-tier-echo">eldritch glyphs</span>.
              Summon <span className="text-tier-breach">the Old Ones</span>.
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-3 font-mono tracking-wide">
              A collective onchain coordination game on Ethereum.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <Link
                href="/about"
                className="text-[12px] sm:text-[13px] tracking-[2px] uppercase font-mono text-gray-400 hover:text-ritual-light transition-colors underline underline-offset-4 decoration-void-border hover:decoration-ritual/50"
              >
                How it works
              </Link>
            </div>
          </div>
        )}

        {/* Pre-launch CTA modal, once per session while no epoch exists on-chain */}
        {!epoch && <PreLaunchModal />}

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

        {/* Sacrifice / Claim / Pending panel — depends on phase + on-chain resolved flag */}
        {address && epoch && (
          <div className="max-w-md mx-auto mt-6 sm:mt-8">
            {epoch.phase === "Ritual" ? (
              <SacrificePanel epoch={epoch} />
            ) : epoch.phase === "Resolved" && !epoch.resolved ? (
              <div className="card text-center py-6 space-y-2">
                <div className="section-label" style={{ color: "#FCD34D" }}>Awaiting Resolution</div>
                <p className="text-xs sm:text-sm text-gray-300 italic">
                  The ritual window has closed. Chainlink Automation will finalize the outcome shortly. Rewards will appear here once resolution is on-chain.
                </p>
              </div>
            ) : epoch.phase === "Resolved" ? (
              <>
                <ClaimArtifact epoch={epoch} />
                <ClaimGlyphsPanel epoch={epoch} />
              </>
            ) : epoch.phase === "Gathering" ? (
              <div className="card text-center py-6 space-y-2">
                <div className="section-label">Sacrifice opens soon</div>
                <p className="text-xs sm:text-sm text-gray-300 italic">
                  The gathering phase is active. Mint your $RITUAL tokens now. When the ritual phase begins, you&apos;ll sacrifice them to receive on-chain glyphs.
                </p>
              </div>
            ) : null}
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

        <Footer showAbout />
      </div>
    </div>
  );
}
