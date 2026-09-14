import { defineConfig } from "vite";

export default defineConfig({
  envDir: false,
  envPrefix: "ZANI_CATALOG_PUBLIC_",
  publicDir: false,
  build: { outDir: "storybook-static" },
  preview: { host: "127.0.0.1", port: 6016, strictPort: true },
});
