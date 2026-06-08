import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Syne", "sans-serif"],
        mono:    ["DM Mono", "monospace"],
        body:    ["DM Sans", "sans-serif"],
      },
      colors: {
        ink:   { DEFAULT: "#0c0e12", 1: "#13161c", 2: "#1a1e26", 3: "#232834" },
        slate: { DEFAULT: "#8892a4", dim: "#5a6270" },
        cream: { DEFAULT: "#f0ece4", dim: "#c8c4bc" },
        amber: { DEFAULT: "#c8923a", light: "#e0a84a", dim: "#8a6428" },
        jade:  { DEFAULT: "#3a9e7a", light: "#4bb88e" },
        rose:  { DEFAULT: "#c45252", light: "#d96a6a" },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(200,194,188,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(200,194,188,0.03) 1px, transparent 1px)",
      },
      backgroundSize: { grid: "48px 48px" },
      animation: {
        "fade-up":    "fadeUp 0.5s ease-out forwards",
        "fade-in":    "fadeIn 0.4s ease-out forwards",
        "shimmer":    "shimmer 2s linear infinite",
        "pulse-slow": "pulse 4s ease-in-out infinite",
      },
      keyframes: {
        fadeUp:  { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
    },
  },
  plugins: [],
};
export default config;
