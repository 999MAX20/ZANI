import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { toolingEnvironment } from "./ui-toolkit-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
if (mode !== "dev" && mode !== "build") throw new Error("Expected dev or build mode.");
const env = toolingEnvironment(process.env);
function run(binary, args) {
  const result = spawnSync(process.execPath, [path.join(root, binary), ...args], { cwd: root, env, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
if (mode === "build") run("node_modules/typescript/bin/tsc", ["-p", "tsconfig.storybook.json"]);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "node_modules/storybook/package.json"), "utf8"));
const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin.storybook;
run(path.join("node_modules/storybook", bin), mode === "build"
  ? ["build", "--disable-telemetry"]
  : ["dev", "--host", "127.0.0.1", "--port", "6006", "--no-open", "--disable-telemetry"]);
