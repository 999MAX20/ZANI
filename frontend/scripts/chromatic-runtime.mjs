import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export function validateStoryIndex(index) {
  const count = Object.values(index?.entries ?? {}).filter((entry) => entry?.type === "story").length;
  if (!count) throw new Error("Refusing to publish an empty Storybook index. Run npm run build-storybook and check index.json.");
  return count;
}

export function publicationArguments(args) {
  if (args.length === 0) return [];
  if (args.length === 1 && args[0] === "--force-rebuild") return ["--force-rebuild"];
  throw new Error("Only --force-rebuild is supported. Build paths, tokens and approval flags cannot be supplied as arguments.");
}

export function chromaticTaskOptions(frontendRoot, repositoryRoot, changeDirectory = process.chdir) {
  // Chromatic 18.8.1 mixes root-relative tracked paths with cwd-relative
  // untracked paths. Run only its Git stage at the repository root; package
  // discovery and Storybook operations must remain in frontend.
  // These are public, experimental Node API hooks: recheck on CLI upgrades.
  return {
    experimental_onTaskStart: ({ task }) => changeDirectory(task === "gitInfo" ? repositoryRoot : frontendRoot),
    experimental_onTaskComplete: () => changeDirectory(frontendRoot),
    experimental_onTaskError: () => changeDirectory(frontendRoot),
  };
}

async function publish() {
  const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: frontendRoot, encoding: "utf8", windowsHide: true,
  }).trim();
  const originalDirectory = process.cwd();
  try {
    process.chdir(frontendRoot);
    const { run } = await import("chromatic/node");
    const result = await run({
      argv: [
        `--config-file=${path.join(frontendRoot, "chromatic.config.json")}`,
        `--storybook-build-dir=${path.join(frontendRoot, "storybook-static")}`,
        `--storybook-config-dir=${path.join(frontendRoot, ".storybook")}`,
        "--no-interactive",
        ...publicationArguments(process.argv.slice(2)),
      ],
      options: chromaticTaskOptions(frontendRoot, repositoryRoot),
    });
    return result.code;
  } finally {
    process.chdir(originalDirectory);
  }
}

export async function finishPublication(publishBuild) {
  // Like Chromatic's CLI, explicitly terminate the isolated Node API runtime
  // after its awaited work has finished; vendor handles can otherwise keep it alive.
  process.exit(await publishBuild());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await finishPublication(publish);
}
