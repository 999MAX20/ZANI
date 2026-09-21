import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import { chromaticTaskOptions, publicationArguments, validateStoryIndex } from "../chromatic-runtime.mjs";
import { catalogModes } from "../../.storybook/modes.ts";

test("the distributable env template never contains a token or upload opt-in", () => {
  const template = parseEnv(fs.readFileSync(new URL("../../.env.chromatic.example", import.meta.url), "utf8"));
  assert.equal(Boolean(template.CHROMATIC_PROJECT_TOKEN?.trim()), false, "Keep the real token only in .env.chromatic.local");
  assert.equal(Boolean(template.ZANI_ALLOW_VISUAL_UPLOAD?.trim()), false);
});

test("cloud modes cover each locale and viewport once with stable names", () => {
  assert.equal(Object.keys(catalogModes).length, 6);
  for (const locale of ["ru", "kk", "en"]) {
    assert.deepEqual(catalogModes[`${locale} desktop`], { locale, viewport: { width: 1440, height: 1000 } });
    assert.deepEqual(catalogModes[`${locale} mobile`], { locale, viewport: { width: 390, height: 844 } });
  }
  const preview = fs.readFileSync(new URL("../../.storybook/preview.tsx", import.meta.url), "utf8");
  assert.match(preview, /chromatic: \{ modes: catalogModes \}/);
});

test("empty, missing and docs-only indexes cannot be published", () => {
  for (const index of [undefined, {}, { entries: {} }, { entries: { docs: { type: "docs" } } }]) {
    assert.throws(() => validateStoryIndex(index), /empty Storybook/);
  }
  assert.equal(validateStoryIndex({ entries: { story: { type: "story" }, docs: { type: "docs" } } }), 1);
});

test("explicit repeat builds are supported without arbitrary upload or approval flags", () => {
  assert.deepEqual(publicationArguments([]), []);
  assert.deepEqual(publicationArguments(["--force-rebuild"]), ["--force-rebuild"]);
  for (const args of [["--auto-accept-changes"], ["--storybook-build-dir=dist"], ["--force-rebuild", "--exit-zero-on-changes"]]) {
    assert.throws(() => publicationArguments(args), /Only --force-rebuild/);
  }
});

test("only the Git task uses repository-root paths and restores frontend on completion or failure", () => {
  const directories = [];
  const hooks = chromaticTaskOptions("repo/frontend", "repo", (directory) => directories.push(directory));
  hooks.experimental_onTaskStart({ task: "auth" });
  hooks.experimental_onTaskStart({ task: "gitInfo" });
  hooks.experimental_onTaskComplete({ task: "gitInfo" });
  hooks.experimental_onTaskStart({ task: "storybookInfo" });
  hooks.experimental_onTaskStart({ task: "gitInfo" });
  hooks.experimental_onTaskError({ task: "gitInfo" });
  assert.deepEqual(directories, ["repo/frontend", "repo", "repo/frontend", "repo/frontend", "repo", "repo/frontend"]);
});

test("publishing uses the fresh index guard and an isolated child runtime", () => {
  const runner = fs.readFileSync(new URL("../run-chromatic.mjs", import.meta.url), "utf8");
  const build = runner.indexOf('["build"], safeEnv');
  const validate = runner.indexOf("const storyCount = validateStoryIndex");
  const upload = runner.indexOf('run(path.join(root, "scripts/chromatic-runtime.mjs")');
  assert.ok(build >= 0 && validate > build && upload > validate);
  assert.doesNotMatch(runner, /--project-token[= ]/);
});

test("completed publication exits despite lingering handles and preserves success/change codes", () => {
  const runtime = new URL("../chromatic-runtime.mjs", import.meta.url).href;
  for (const exitCode of [0, 1]) {
    const script = `
      import { finishPublication } from ${JSON.stringify(runtime)};
      setInterval(() => {}, 1000);
      await finishPublication(async () => ${exitCode});
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      encoding: "utf8", timeout: 10000, windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, exitCode);
    assert.equal(result.signal, null);
  }
});
