import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#1E6BFF",
          600: "#0052D2",
          700: "#003FA5",
        },
        ai: {
          50: "#f5f3ff",
          100: "#ede9fe",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
        },
        surface: {
          DEFAULT: "#f8f9fb",
          muted: "#f2f4f7",
          card: "#ffffff",
        },
        ink: "#191c1e",
        midnight: "#001b44",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(0, 47, 108, 0.04)",
        glow: "0 12px 32px rgba(30, 107, 255, 0.14)",
        premium: "0 12px 34px rgba(0, 27, 68, 0.08)",
      },
      borderRadius: {
        "2xl": "0.75rem",
        "3xl": "1rem",
      },
      backgroundImage: {
        "ai-gradient": "linear-gradient(135deg, #7C3AED 0%, #1E6BFF 100%)",
        "sidebar-depth":
          "linear-gradient(180deg, #ffffff 0%, #f8f9fb 100%)",
        "soft-mesh":
          "linear-gradient(180deg, #f8f9fb 0%, #f2f4f7 100%)",
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
