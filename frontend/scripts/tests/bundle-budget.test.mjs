import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "check-bundle.mjs",
);

function runBundleCheck(files) {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "zani-bundle-budget-"),
  );
  try {
    for (const [file, size] of Object.entries(files)) {
      fs.writeFileSync(path.join(fixtureRoot, file), Buffer.alloc(size, "a"));
    }
    return spawnSync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        BUNDLE_ASSETS_DIR: fixtureRoot,
      },
      encoding: "utf8",
    });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("bundle budget rejects a missing app-shell chunk", () => {
  const result = runBundleCheck({ "vendor-fixture.js": 128 });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected exactly one app-shell-\* JS chunk, found 0/);
});

test("bundle budget rejects a renamed app-shell chunk", () => {
  const result = runBundleCheck({ "application-shell-fixture.js": 128 });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected exactly one app-shell-\* JS chunk, found 0/);
});

test("bundle budget rejects multiple app-shell chunks", () => {
  const result = runBundleCheck({
    "app-shell-first.js": 128,
    "app-shell-second.js": 128,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected exactly one app-shell-\* JS chunk, found 2/);
});

test("bundle budget rejects an oversized app-shell chunk", () => {
  const result = runBundleCheck({
    "app-shell-oversized.js": 400 * 1024 + 1,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /exceeds 400 kB before gzip/);
});

test("bundle budget accepts exactly one app-shell chunk within budget", () => {
  const result = runBundleCheck({
    "app-shell-valid.js": 400 * 1024,
    "vendor-fixture.js": 128,
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /App shell budget OK/);
});
