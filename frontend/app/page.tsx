"use client";

import { Header } from "@/components/layout/Header";
import { MintInterface } from "@/components/mint/MintInterface";

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, #0d0d1a 0%, #050508 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-[900px] mx-auto px-4 py-6">
        <Header />

        <div className="max-w-md mx-auto mt-8">
          <MintInterface />
        </div>

        {/* TODO Week 2: Portal + SacrificePanel grid */}
        {/* TODO Week 2: GlyphCollection */}
        {/* TODO Week 3: EpochStatus + Leaderboard */}
      </div>
    </div>
  );
}
