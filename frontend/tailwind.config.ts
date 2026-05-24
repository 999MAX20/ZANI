import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
        },
        ai: {
          50: "#f5f3ff",
          100: "#ede9fe",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
        ink: "#172033",
        midnight: "#07111f",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(15, 23, 42, 0.08)",
        glow: "0 24px 80px rgba(14, 165, 233, 0.24)",
        premium: "0 24px 70px rgba(15, 23, 42, 0.12)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      backgroundImage: {
        "ai-gradient": "linear-gradient(135deg, #06b6d4 0%, #2563eb 48%, #8b5cf6 100%)",
        "sidebar-depth":
          "linear-gradient(140deg, rgba(255,255,255,.92), rgba(240,249,255,.72) 46%, rgba(245,243,255,.76)), linear-gradient(180deg, rgba(255,255,255,.28), rgba(14,165,233,.08))",
        "soft-mesh":
          "radial-gradient(circle at 20% 20%, rgba(14, 165, 233, .18), transparent 28%), radial-gradient(circle at 80% 0%, rgba(139, 92, 246, .18), transparent 30%), linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)",
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
