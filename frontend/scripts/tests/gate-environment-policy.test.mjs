import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadEnv } from "vite";

const expectedGateValues = {
  VITE_APPLE_CLIENT_ID: "",
  VITE_CRM_KANBAN_DEFAULT: "false",
  VITE_CRM_UNIFIED_DESIGN: "false",
  VITE_GOOGLE_CLIENT_ID: "",
  VITE_PLAUSIBLE_DOMAIN: "",
  VITE_POSTHOG_HOST: "http://127.0.0.1:9",
  VITE_POSTHOG_KEY: "",
  VITE_SENTRY_DSN: "",
  VITE_SENTRY_TRACES_SAMPLE_RATE: "0",
};

test("quality-gate process values override ignored Vite env files", () => {
  assert.equal(process.env.ZANI_QUALITY_GATE, "1");
  assert.match(process.env.VITE_API_URL ?? "", /^http:\/\/127\.0\.0\.1:\d+$/);

  const envDirectory = mkdtempSync(join(tmpdir(), "zani-vite-env-policy-"));
  const originalValues = new Map();
  const safeValues = {
    ...expectedGateValues,
    VITE_API_URL: process.env.VITE_API_URL,
  };

  try {
    for (const [key, value] of Object.entries(safeValues)) {
      originalValues.set(key, process.env[key]);
      process.env[key] = value;
    }
    writeFileSync(
      join(envDirectory, ".env"),
      [
        "VITE_API_URL=https://production.invalid",
        "VITE_APPLE_CLIENT_ID=live-apple-client",
        "VITE_CRM_KANBAN_DEFAULT=true",
        "VITE_CRM_UNIFIED_DESIGN=true",
        "VITE_GOOGLE_CLIENT_ID=live-google-client",
        "VITE_PLAUSIBLE_DOMAIN=production.invalid",
        "VITE_POSTHOG_HOST=https://telemetry.production.invalid",
        "VITE_POSTHOG_KEY=live-posthog-key",
        "VITE_SENTRY_DSN=https://live@sentry.invalid/1",
        "VITE_SENTRY_TRACES_SAMPLE_RATE=1",
      ].join("\n"),
      "utf8",
    );

    const loaded = loadEnv("development", envDirectory, "VITE_");
    for (const [key, value] of Object.entries(safeValues)) {
      assert.equal(loaded[key], value, `${key} was overridden by .env`);
    }
  } finally {
    for (const [key, value] of originalValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    rmSync(envDirectory, { recursive: true, force: true });
  }
});
