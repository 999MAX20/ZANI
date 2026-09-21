import { defineConfig } from "vite";

// Explicitly selected instead of the application's Vite config/API proxy.
export default defineConfig({ envDir: false, envPrefix: "ZANI_CATALOG_PUBLIC_", publicDir: false });
