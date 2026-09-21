import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  stories: ["../src/ui-catalog/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: { builder: { viteConfigPath: fileURLToPath(new URL("./vite.config.ts", import.meta.url)) } },
  },
  core: { disableTelemetry: true },
  async viteFinal(config) {
    // This catalogue is not the app: never inherit its API proxy, public assets,
    // telemetry credentials or developer .env files into a publishable build.
    config.envDir = false;
    config.envPrefix = "ZANI_CATALOG_PUBLIC_";
    config.publicDir = false;
    return config;
  },
};

export default config;
