import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { toolingEnvironment, uploadPrerequisites } from "../ui-toolkit-policy.mjs";

test("visual upload requires a token and separate synthetic-data acknowledgement", () => {
  assert.throws(() => uploadPrerequisites({}), /CHROMATIC_PROJECT_TOKEN/);
  assert.throws(() => uploadPrerequisites({ CHROMATIC_PROJECT_TOKEN: "fixture-not-a-secret" }), /synthetic-only/);
  assert.doesNotThrow(() => uploadPrerequisites({ CHROMATIC_PROJECT_TOKEN: "fixture-not-a-secret", ZANI_ALLOW_VISUAL_UPLOAD: "synthetic-only" }));
});

test("tooling environment drops app/provider/monitoring credentials and unsafe Node options", () => {
  const env = toolingEnvironment({ Path: "safe-path", SystemRoot: "C:/Windows", VITE_POSTHOG_KEY: "fixture", VITE_API_URL: "https://example.invalid", CHROMATIC_PROJECT_TOKEN: "fixture", OPENAI_API_KEY: "fixture", NODE_OPTIONS: "--require unsafe.cjs" });
  assert.deepEqual(env, { Path: "safe-path", SystemRoot: "C:/Windows", STORYBOOK_DISABLE_TELEMETRY: "1", DO_NOT_TRACK: "1" });
});

test("catalogue cannot silently inherit the app Vite config, public assets or env files", () => {
  const config = fs.readFileSync(new URL("../../.storybook/main.ts", import.meta.url), "utf8");
  assert.match(config, /viteConfigPath: fileURLToPath\(new URL\("\.\/vite\.config\.ts", import\.meta\.url\)\)/);
  assert.match(config, /config\.envDir = false/);
  assert.match(config, /config\.publicDir = false/);
  const preview = fs.readFileSync(new URL("../../.storybook/preview.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(preview, /AppProviders|initFrontendMonitoring|AuthProvider/);
});

test("visual changes are never automatically accepted or reported as green", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../../chromatic.config.json", import.meta.url), "utf8"));
  assert.equal(config.autoAcceptChanges, false);
  assert.equal(config.exitZeroOnChanges, false);
  assert.equal(config.projectToken, undefined);
});

test("both local catalogue commands use the sanitized launcher, never a direct inherited-env CLI", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.scripts.storybook, "node scripts/run-storybook.mjs dev");
  assert.equal(manifest.scripts["build-storybook"], "node scripts/run-storybook.mjs build");
});
