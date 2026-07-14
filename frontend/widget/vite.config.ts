import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/widget",
    emptyOutDir: true,
    minify: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ZaniWidget",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "zani-widget.js",
      },
    },
  },
});
