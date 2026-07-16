import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false, ...options });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run("npm", ["run", "typecheck"]);

if (process.env.ZANI_MOBILE_EMAIL && process.env.ZANI_MOBILE_PASSWORD) {
  run("npm", ["run", "smoke:api"]);
} else {
  console.log("Skipping smoke:api because ZANI_MOBILE_EMAIL/ZANI_MOBILE_PASSWORD are not set.");
}

if (process.env.ZANI_MOBILE_LOAD_TEST === "true" && process.env.ZANI_MOBILE_EMAIL && process.env.ZANI_MOBILE_PASSWORD) {
  run("npm", ["run", "load:api"]);
} else {
  console.log("Skipping load:api because ZANI_MOBILE_LOAD_TEST=true and staging credentials are required.");
}

if (process.env.ZANI_EXPO_PUSH_TOKEN) {
  run("npm", ["run", "smoke:push"]);
} else {
  console.log("Skipping smoke:push because ZANI_EXPO_PUSH_TOKEN is not set.");
}

console.log("Mobile release gate completed.");
