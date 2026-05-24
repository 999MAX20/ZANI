import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const localDjangoEnv = "DATABASE_URL=sqlite:///db.sqlite3 ALLOWED_HOSTS=localhost,127.0.0.1 SECURE_SSL_REDIRECT=False SESSION_COOKIE_SECURE=False CSRF_COOKIE_SECURE=False AUTH_LOGIN_RATE=1000/min AUTH_REFRESH_RATE=1000/min";

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
      command:
        `cd .. && ${localDjangoEnv} .venv/bin/python manage.py migrate && ${localDjangoEnv} .venv/bin/python manage.py prepare_e2e_smoke_data && ${localDjangoEnv} .venv/bin/python manage.py runserver 127.0.0.1:8000`,
      url: "http://127.0.0.1:8000/api/auth/me/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1",
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
