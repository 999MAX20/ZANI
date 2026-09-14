import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-ui-toolkit",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  workers: 2,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/ui-toolkit", open: "never" }]],
  outputDir: "test-results/ui-toolkit",
  use: {
    baseURL: "http://127.0.0.1:6016",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --config .storybook/serve.config.ts",
    url: "http://127.0.0.1:6016",
    reuseExistingServer: false,
  },
  projects: [
    { name: "catalog-desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "catalog-mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
