/**
 * Portal SVG visualization — the emotional centerpiece of the UI.
 *
 * 6 visual stages from Dormant to Manifestation based on collective progress.
 * See PRD.md Section 6 for full stage descriptions.
 * See the prototype in summoning_prototype.jsx for reference implementation.
 *
 * Props:
 *   progress: number (0-100) — collective burn progress
 *   isRitualActive: boolean — true during sacrifice channeling
 *   shake: boolean — triggers shake animation on sacrifice
 */

"use client";

export default function Portal({
  progress = 0,
  isRitualActive = false,
  shake = false,
}: {
  progress: number;
  isRitualActive?: boolean;
  shake?: boolean;
}) {
  const intensity = Math.min(progress / 100, 1);
  const tearWidth = 2 + intensity * 40;
  const glowOpacity = 0.1 + intensity * 0.6;
  const tentacleCount = Math.floor(intensity * 8);

  return (
    <div className={shake ? "animate-shake" : ""}>
      <svg viewBox="0 0 220 220" className="w-full h-full">
        <defs>
          <radialGradient id="voidGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={glowOpacity} />
            <stop offset="40%" stopColor="#4c1d95" stopOpacity={glowOpacity * 0.5} />
            <stop offset="100%" stopColor="transparent" stopOpacity={0} />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="heavyGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background glow */}
        <circle cx="110" cy="110" r="105" fill="url(#voidGlow)" />

        {/* Outer ritual circle */}
        <circle cx="110" cy="110" r="95" fill="none" stroke="#2d1b4e"
          strokeWidth="1" strokeDasharray="4 4" opacity="0.5">
          <animateTransform attributeName="transform" type="rotate"
            from="0 110 110" to="360 110 110" dur="30s" repeatCount="indefinite" />
        </circle>

        {/* Rune circle */}
        <circle cx="110" cy="110" r="80" fill="none" stroke="#4c1d95"
          strokeWidth="0.5" opacity={0.3 + intensity * 0.4}>
          <animateTransform attributeName="transform" type="rotate"
            from="360 110 110" to="0 110 110" dur="20s" repeatCount="indefinite" />
        </circle>

        {/* Rune marks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x = 110 + 80 * Math.cos(angle);
          const y = 110 + 80 * Math.sin(angle);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central"
              fill="#7c3aed" fontSize="8" opacity={0.3 + intensity * 0.5}
              style={{ fontFamily: "serif" }}>
              {"᛭ᚦᚠᚢᚨᚱᚲᚷᚹᛃᛈᛊ"[i]}
            </text>
          );
        })}

        {/* The Tear / Rift */}
        {intensity > 0.05 && (
          <g filter="url(#heavyGlow)">
            <path
              d={`M ${110 - tearWidth / 2} 110
                  Q ${110 - tearWidth / 3} ${80 - intensity * 15}, 110 ${65 - intensity * 10}
                  Q ${110 + tearWidth / 3} ${80 - intensity * 15}, ${110 + tearWidth / 2} 110
                  Q ${110 + tearWidth / 3} ${140 + intensity * 15}, 110 ${155 + intensity * 10}
                  Q ${110 - tearWidth / 3} ${140 + intensity * 15}, ${110 - tearWidth / 2} 110 Z`}
              fill={intensity > 0.7 ? "#1a0030" : "#0d0015"}
              stroke="#7c3aed"
              strokeWidth={0.5 + intensity * 1.5}
              opacity={0.6 + intensity * 0.4}
            >
              {isRitualActive && (
                <animate attributeName="opacity"
                  values={`${0.6 + intensity * 0.3};${0.8 + intensity * 0.2};${0.6 + intensity * 0.3}`}
                  dur="1.5s" repeatCount="indefinite" />
              )}
            </path>

            {/* Inner void */}
            {intensity > 0.3 && (
              <path
                d={`M ${110 - tearWidth / 4} 110
                    Q ${110 - tearWidth / 5} ${90 - intensity * 8}, 110 ${78 - intensity * 6}
                    Q ${110 + tearWidth / 5} ${90 - intensity * 8}, ${110 + tearWidth / 4} 110
                    Q ${110 + tearWidth / 5} ${130 + intensity * 8}, 110 ${142 + intensity * 6}
                    Q ${110 - tearWidth / 5} ${130 + intensity * 8}, ${110 - tearWidth / 4} 110 Z`}
                fill="#7c3aed"
                opacity={0.15 + intensity * 0.2}
              />
            )}
          </g>
        )}

        {/* Tentacles */}
        {tentacleCount > 0 &&
          Array.from({ length: tentacleCount }).map((_, i) => {
            const baseAngle = (i * (360 / tentacleCount)) * (Math.PI / 180);
            const reach = 15 + intensity * 25;
            const x1 = 110 + (tearWidth / 3) * Math.cos(baseAngle);
            const y1 = 110 + (tearWidth / 3) * Math.sin(baseAngle);
            const x2 = 110 + reach * Math.cos(baseAngle + 0.3);
            const y2 = 110 + reach * Math.sin(baseAngle + 0.3);
            return (
              <line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#7c3aed" strokeWidth={0.5 + intensity}
                strokeLinecap="round" opacity={0.2 + intensity * 0.3}
                filter="url(#glow)">
                <animate attributeName="opacity"
                  values={`${0.1};${0.3 + intensity * 0.3};${0.1}`}
                  dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
              </line>
            );
          })}

        {/* Center eye at very high intensity */}
        {intensity > 0.8 && (
          <g filter="url(#glow)">
            <ellipse cx="110" cy="110"
              rx={3 + (intensity - 0.8) * 20}
              ry={1 + (intensity - 0.8) * 8}
              fill="#EF4444" opacity={0.4 + (intensity - 0.8) * 2}>
              <animate attributeName="ry"
                values={`${1 + (intensity - 0.8) * 8};${3 + (intensity - 0.8) * 12};${1 + (intensity - 0.8) * 8}`}
                dur="3s" repeatCount="indefinite" />
            </ellipse>
          </g>
        )}

        {/* Progress text */}
        <text x="110" y="195" textAnchor="middle" fill="#6b7280"
          fontSize="9" style={{ fontFamily: "'Courier New', monospace" }}>
          {progress.toFixed(1)}% MANIFESTED
        </text>
      </svg>
    </div>
  );
}
