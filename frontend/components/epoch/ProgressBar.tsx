"use client";

/**
 * Collective sacrifice progress bar.
 * Color shifts from purple (#7c3aed) to red (#EF4444) as progress approaches 100%.
 */
export default function ProgressBar({ progress }: { progress: number }) {
  const t = Math.min(progress / 100, 1);
  // Interpolate purple → red
  const r = Math.round(124 + (239 - 124) * t);
  const g = Math.round(58 + (68 - 58) * t);
  const b = Math.round(237 + (68 - 237) * t);
  const color = `rgb(${r},${g},${b})`;

  return (
    <div>
      <div className="flex justify-between text-[14px] font-mono text-gray-300 mb-1.5 font-bold">
        <span>COLLECTIVE PROGRESS</span>
        <span style={{ color }}>{progress.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, #7c3aed, ${color})`,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}
