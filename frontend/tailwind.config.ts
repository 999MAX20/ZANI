import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        ai: {
          50: "#f5f3ff",
          100: "#ede9fe",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
        },
        ink: "#111827",
        midnight: "#0f172a",
      },
      boxShadow: {
        soft: "0 16px 42px rgba(15, 23, 42, 0.07)",
        glow: "0 18px 54px rgba(124, 58, 237, 0.18)",
        premium: "0 22px 64px rgba(15, 23, 42, 0.11)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      backgroundImage: {
        "ai-gradient": "linear-gradient(135deg, #2563eb 0%, #6d28d9 100%)",
        "sidebar-depth":
          "linear-gradient(140deg, rgba(255,255,255,.96), rgba(248,250,252,.9) 48%, rgba(239,246,255,.82)), linear-gradient(180deg, rgba(255,255,255,.3), rgba(37,99,235,.06))",
        "soft-mesh":
          "linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
