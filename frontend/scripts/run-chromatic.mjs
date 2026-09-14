import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { toolingEnvironment, uploadPrerequisites } from "./ui-toolkit-policy.mjs";
import { publicationArguments, validateStoryIndex } from "./chromatic-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function run(binary, args, env) {
  const result = spawnSync(process.execPath, [binary, ...args], { cwd: root, env, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

let uploadArgs;
try {
  uploadArgs = publicationArguments(process.argv.slice(2));
  uploadPrerequisites(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const safeEnv = toolingEnvironment(process.env);
// Build fresh in the same invocation. Never publish arbitrary caller-supplied
// directories, stale app builds or developer environment values.
run(path.join(root, "scripts/run-storybook.mjs"), ["build"], safeEnv);
const storyCount = validateStoryIndex(JSON.parse(fs.readFileSync(path.join(root, "storybook-static/index.json"), "utf8")));
console.log(`Verified fresh Storybook index: ${storyCount} stories.`);
run(path.join(root, "scripts/chromatic-runtime.mjs"), uploadArgs, {
  ...safeEnv,
  CHROMATIC_PROJECT_TOKEN: process.env.CHROMATIC_PROJECT_TOKEN,
});
