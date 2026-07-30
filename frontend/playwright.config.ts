import { defineConfig, devices } from "@playwright/test";

const djangoPort = process.env.E2E_DJANGO_PORT || "8000";
const frontendPort = process.env.E2E_FRONTEND_PORT || "5173";
const baseURL =
  process.env.E2E_BASE_URL || `http://127.0.0.1:${frontendPort}`;
const gateRun = process.env.ZANI_QUALITY_GATE === "1";
const reuseExistingServer =
  !gateRun && process.env.E2E_REUSE_EXISTING_SERVER !== "false";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/django-e2e.mjs serve",
      url: `http://127.0.0.1:${djangoPort}/health/`,
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: baseURL,
      reuseExistingServer,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "tablet-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
