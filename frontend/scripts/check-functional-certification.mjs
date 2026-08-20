import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { routeActionRegistry } from "../e2e/certification/route-action-registry.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");

const requiredFields = [
  "id",
  "route",
  "aliases",
  "routerPaths",
  "page",
  "group",
  "guard",
  "roles",
  "capabilities",
  "pageReadyMarker",
  "primaryActions",
  "secondaryActions",
  "controls",
  "apiEndpoints",
  "entities",
  "viewports",
  "fixtures",
  "automatedTests",
  "status",
];

const allowedStatuses = new Set(["NOT_RUN", "PASS", "FAIL", "BLOCKED", "EXCLUDED"]);

function counts(values) {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) || 0) + 1);
  return result;
}

function countDiff(expected, actual) {
  const keys = new Set([...expected.keys(), ...actual.keys()]);
  return [...keys]
    .sort()
    .filter((key) => expected.get(key) !== actual.get(key))
    .map((key) => `${key}: registry=${expected.get(key) || 0}, router=${actual.get(key) || 0}`);
}

export function verifyFunctionalCertificationRegistry({ rootDir = frontendDir } = {}) {
  const errors = [];
  const routerPath = path.join(rootDir, "src", "app", "router.tsx");
  const routerSource = fs.readFileSync(routerPath, "utf8");
  const routerPaths = [...routerSource.matchAll(/\bpath:\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );

  const ids = new Set();
  for (const [index, entry] of routeActionRegistry.entries()) {
    for (const field of requiredFields) {
      if (!(field in entry)) errors.push(`entry ${index} (${entry.id || "unknown"}) is missing ${field}`);
    }
    if (ids.has(entry.id)) errors.push(`duplicate registry id: ${entry.id}`);
    ids.add(entry.id);
    if (!Array.isArray(entry.routerPaths) || entry.routerPaths.length === 0) {
      errors.push(`${entry.id} has no routerPaths`);
    }
    if (!Array.isArray(entry.roles) || entry.roles.length === 0) {
      errors.push(`${entry.id} has no supported roles`);
    }
    if (!Array.isArray(entry.viewports) || entry.viewports.length === 0) {
      errors.push(`${entry.id} has no viewport classes`);
    }
    if (!allowedStatuses.has(entry.status)) {
      errors.push(`${entry.id} has invalid status ${entry.status}`);
    }
    for (const testLocation of entry.automatedTests || []) {
      if (!fs.existsSync(path.join(rootDir, testLocation))) {
        errors.push(`${entry.id} references missing test ${testLocation}`);
      }
    }
  }

  const registeredPaths = routeActionRegistry.flatMap((entry) => entry.routerPaths);
  errors.push(...countDiff(counts(registeredPaths), counts(routerPaths)));

  if (errors.length) {
    throw new Error(`Functional certification registry is invalid:\n- ${errors.join("\n- ")}`);
  }

  return {
    registryEntries: routeActionRegistry.length,
    routerPathDeclarations: routerPaths.length,
    uniqueRouterPaths: new Set(routerPaths).size,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = verifyFunctionalCertificationRegistry();
  console.log(
    `Functional certification registry OK: ${result.registryEntries} entries cover ` +
      `${result.routerPathDeclarations} router path declarations (${result.uniqueRouterPaths} unique).`,
  );
}
