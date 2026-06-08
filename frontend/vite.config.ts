import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router-dom")) return "react";
          if (id.includes("node_modules/@tanstack/react-query") || id.includes("node_modules/axios")) return "query";
          if (id.includes("node_modules/framer-motion")) return "motion";
          if (id.includes("node_modules/@dnd-kit")) return "dnd";
          if (id.includes("node_modules/react-hook-form") || id.includes("node_modules/@hookform/resolvers") || id.includes("node_modules/zod")) return "forms";
          if (id.includes("/src/lib/i18n/ru.ts")) return "i18n-ru";
          if (id.includes("/src/lib/i18n/kk.ts")) return "i18n-kk";
          if (id.includes("/src/lib/i18n/en.ts")) return "i18n-en";
          if (id.includes("/src/lib/i18n.tsx")) return "i18n";
          if (id.includes("/src/features/public/")) return "public";
          if (id.includes("/src/components/layout/")) return "layout";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
