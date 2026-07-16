import type { Config } from "tailwindcss";

const animate = require("tailwindcss-animate");

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zani: {
          bg: "#F4F6F8",
          surface: "#FFFFFF",
          muted: "#EEF1F4",
          border: "#DCE1E7",
          text: "#111827",
          subtle: "#5D6574",
          faint: "#8B94A3",
          primary: "#D96718",
          secondary: "#9F410D",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
          info: "#3B82F6",
        },
        primary: {
          50: "#FFF0E4",
          100: "#FFE2CC",
          500: "#ED7A22",
          600: "#D96718",
          700: "#B84F0B",
        },
        brand: {
          50: "#FFF0E4",
          100: "#FFE2CC",
          500: "#ED7A22",
          600: "#D96718",
          700: "#9F410D",
        },
        ai: {
          50: "#FFF6EE",
          100: "#FFE6D2",
          500: "#C65D17",
          600: "#A94910",
          700: "#7F350E",
        },
        surface: {
          DEFAULT: "#F4F6F8",
          muted: "#EEF1F4",
          card: "#ffffff",
        },
        ink: "#111827",
        midnight: "#111827",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(15, 23, 42, 0.08)",
        card: "0 4px 12px rgba(17, 24, 39, 0.06)",
        panel: "0 12px 28px rgba(17, 24, 39, 0.10)",
        glow: "0 12px 32px rgba(37, 99, 235, 0.16)",
        premium: "0 10px 15px rgba(0, 0, 0, 0.10)",
      },
      fontSize: {
        "crm-caption": ["0.75rem", { lineHeight: "1rem" }],
        "crm-body": ["0.875rem", { lineHeight: "1.25rem" }],
        "crm-section": ["1.125rem", { lineHeight: "1.5rem" }],
        "crm-title": ["1.5rem", { lineHeight: "2rem" }],
      },
      borderRadius: {
        control: "0.75rem",
        card: "1.125rem",
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, #ED7A22 0%, #B84F0B 100%)",
        "dashboard-gradient": "linear-gradient(135deg, #171D29 0%, #2B3341 100%)",
        "ai-gradient": "linear-gradient(135deg, #D96718 0%, #9F410D 100%)",
        "sidebar-depth":
          "linear-gradient(180deg, #ffffff 0%, #F4F6F8 100%)",
        "soft-mesh":
          "linear-gradient(180deg, #F4F6F8 0%, #EEF1F4 100%)",
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
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        "slide-down": "slideDown 180ms ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
