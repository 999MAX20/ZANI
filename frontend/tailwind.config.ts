import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zani: {
          bg: "#F9FAFB",
          surface: "#FFFFFF",
          muted: "#F3F4F6",
          border: "#E5E7EB",
          text: "#111827",
          subtle: "#6B7280",
          faint: "#9CA3AF",
          primary: "#4F46E5",
          secondary: "#7C3AED",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
          info: "#3B82F6",
        },
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#4F46E5",
          600: "#4338CA",
          700: "#3730A3",
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#4F46E5",
          600: "#4338CA",
          700: "#3730A3",
        },
        ai: {
          50: "#f5f3ff",
          100: "#ede9fe",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
        },
        surface: {
          DEFAULT: "#F9FAFB",
          muted: "#F3F4F6",
          card: "#ffffff",
        },
        ink: "#111827",
        midnight: "#111827",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0, 0, 0, 0.10)",
        card: "0 4px 12px rgba(17, 24, 39, 0.06)",
        panel: "0 12px 28px rgba(17, 24, 39, 0.10)",
        glow: "0 12px 32px rgba(79, 70, 229, 0.16)",
        premium: "0 10px 15px rgba(0, 0, 0, 0.10)",
      },
      fontSize: {
        "crm-caption": ["0.75rem", { lineHeight: "1rem" }],
        "crm-body": ["0.875rem", { lineHeight: "1.25rem" }],
        "crm-section": ["1.125rem", { lineHeight: "1.5rem" }],
        "crm-title": ["1.5rem", { lineHeight: "2rem" }],
      },
      borderRadius: {
        control: "0.5rem",
        card: "0.75rem",
        "2xl": "0.75rem",
        "3xl": "1rem",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
        "dashboard-gradient": "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
        "ai-gradient": "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
        "sidebar-depth":
          "linear-gradient(180deg, #ffffff 0%, #F9FAFB 100%)",
        "soft-mesh":
          "linear-gradient(180deg, #F9FAFB 0%, #F3F4F6 100%)",
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
  plugins: [],
} satisfies Config;
