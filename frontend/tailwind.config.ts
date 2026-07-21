import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zani: {
          bg: "#F7F3EE",
          page: "#F4EEE7",
          surface: "#FFFFFF",
          surfaceWarm: "#FFFCF8",
          muted: "#F2EDE6",
          border: "#E6DDD2",
          text: "#17120F",
          subtle: "#5F554D",
          faint: "#8A7B70",
          primary: "#D96718",
          secondary: "#6F4CC3",
          success: "#15803D",
          warning: "#B7791F",
          danger: "#C2410C",
          info: "#0E7490",
        },
        primary: {
          50: "#FFF0E4",
          100: "#FFE2C8",
          500: "#D96718",
          600: "#D96718",
          700: "#B84F0B",
        },
        brand: {
          50: "#FFF0E4",
          100: "#FFE2C8",
          500: "#D96718",
          600: "#D96718",
          700: "#B84F0B",
        },
        ai: {
          50: "#F4F0FF",
          100: "#DDD2FF",
          500: "#6F4CC3",
          600: "#6F4CC3",
          700: "#5E3CAE",
        },
        surface: {
          DEFAULT: "#F7F3EE",
          page: "#F4EEE7",
          muted: "#F2EDE6",
          card: "#FFFFFF",
          warm: "#FFFCF8",
        },
        ink: "#17120F",
        midnight: "#17120F",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(23, 18, 15, 0.06)",
        card: "0 4px 12px rgba(23, 18, 15, 0.05)",
        panel: "0 12px 28px rgba(23, 18, 15, 0.10)",
        glow: "0 12px 32px rgba(217, 103, 24, 0.16)",
        premium: "0 10px 15px rgba(23, 18, 15, 0.10)",
      },
      fontSize: {
        "crm-caption": ["0.75rem", { lineHeight: "1rem" }],
        "crm-body": ["0.875rem", { lineHeight: "1.25rem" }],
        "crm-section": ["1.125rem", { lineHeight: "1.5rem" }],
        "crm-title": ["1.5rem", { lineHeight: "2rem" }],
      },
      borderRadius: {
        control: "0.625rem",
        card: "0.75rem",
        "2xl": "0.75rem",
        "3xl": "1rem",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, #D96718 0%, #B84F0B 100%)",
        "dashboard-gradient": "linear-gradient(135deg, #FFFCF8 0%, #F2EDE6 100%)",
        "ai-gradient": "linear-gradient(135deg, #6F4CC3 0%, #5E3CAE 100%)",
        "sidebar-depth":
          "linear-gradient(180deg, #FFFCF8 0%, #F7F3EE 100%)",
        "soft-mesh":
          "linear-gradient(180deg, #F7F3EE 0%, #F4EEE7 100%)",
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
