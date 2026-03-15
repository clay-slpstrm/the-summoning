import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: "#0a0a0f",
          surface: "#0d0d15",
          raised: "#111118",
          border: "#1e1e2e",
        },
        ritual: {
          DEFAULT: "#7c3aed",
          deep: "#4c1d95",
          light: "#c4b5fd",
          dark: "#2d1b4e",
        },
        tier: {
          whisper: "#8B8B8B",
          echo: "#4A9EFF",
          tremor: "#A855F7",
          rupture: "#F59E0B",
          breach: "#EF4444",
        },
      },
      fontFamily: {
        serif: ["Crimson Text", "Georgia", "serif"],
        mono: ["Courier New", "monospace"],
      },
      animation: {
        "portal-spin": "spin 30s linear infinite",
        "portal-spin-reverse": "spin 20s linear infinite reverse",
        "portal-pulse": "pulse 2s ease-in-out infinite",
        shake: "shake 0.5s ease-in-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "glyph-enter": "glyphEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "20%": { transform: "translate(-3px, 2px)" },
          "40%": { transform: "translate(3px, -2px)" },
          "60%": { transform: "translate(-2px, -3px)" },
          "80%": { transform: "translate(2px, 3px)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        glyphEnter: {
          from: { opacity: "0", transform: "scale(0.5)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
