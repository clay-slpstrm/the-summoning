"use client";

/**
 * Main summoning page.
 *
 * Layout (desktop): Two-column — Portal left, Sacrifice controls right
 * Layout (mobile): Single column — Portal stacked above controls
 *
 * See PRD.md Section 4 for feature specs.
 * See PRD.md Section 8 for design system.
 */
export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Starfield background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, #0d0d1a 0%, #050508 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-[900px] mx-auto px-4 py-6">
        {/* Header */}
        <header className="text-center mb-2">
          <h1 className="text-[32px] font-bold tracking-[6px] text-ritual-light uppercase m-0"
            style={{ textShadow: "0 0 40px #7c3aed44, 0 0 80px #7c3aed22" }}>
            The Summoning
          </h1>
          <p className="text-[13px] text-gray-500 tracking-[3px] mt-1 italic">
            Epoch I — The Dreaming One Stirs
          </p>
        </header>

        {/* TODO: EpochStatus */}
        {/* TODO: Glyph tier counts */}
        {/* TODO: Tab navigation (Ritual Chamber / Glyphs) */}
        {/* TODO: Main grid (Portal + Sacrifice controls) */}
        {/* TODO: Cult Rank bar */}

        <div className="card mt-8 text-center text-gray-500 italic py-20">
          Connect your wallet to begin the ritual.
          <br />
          <span className="text-[10px] tracking-[2px] uppercase mt-4 block text-gray-600 font-mono">
            Build in progress — see ARCHITECTURE.md Step 1
          </span>
        </div>
      </div>
    </div>
  );
}
