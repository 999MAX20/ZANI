import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { routeActionRegistry } from "../e2e/certification/route-action-registry.mjs";
import {
  apiModulePolicies,
  backgroundTaskPolicies,
  defectPrecedents,
  errorCodeRegistry,
  fallbackCategories,
  idempotentMutationRules,
  providerStatusPolicies,
  providerStatusSources,
} from "../e2e/fallback/fallback-registry.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(frontendDir, "..");
const reportPath = path.join(repoDir, "actual_docs", "UNIFIED_FALLBACK_INVENTORY.generated.md");

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function walk(directory, predicate) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute, predicate));
    else if (predicate(absolute)) files.push(absolute);
  }
  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function readQuoted(source, start) {
  const quote = source[start];
  if (!["\"", "'", "`"].includes(quote)) return null;
  let value = "";
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      value += char + (source[index + 1] || "");
      index += 1;
      continue;
    }
    if (char === quote) return { value, end: index + 1 };
    value += char;
  }
  return null;
}

function firstArgumentStart(source, start) {
  let index = start;
  while (/\s/.test(source[index] || "")) index += 1;
  if (source[index] === "<") {
    let depth = 0;
    for (; index < source.length; index += 1) {
      if (source[index] === "<") depth += 1;
      else if (source[index] === ">") {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          break;
        }
      }
    }
  }
  while (/\s/.test(source[index] || "")) index += 1;
  if (source[index] !== "(") return -1;
  index += 1;
  while (/\s/.test(source[index] || "")) index += 1;
  return index;
}

function normalizeEndpoint(raw) {
  const endpoint = raw
    .replace(/\$\{baseURL\}/g, "")
    .replace(/\$\{[^}]+\}/g, ":param")
    .replace(/\\`/g, "`")
    .trim();
  return endpoint.startsWith("/api/") ? endpoint : null;
}

function extractApiOperations(rootDir) {
  const apiDir = path.join(rootDir, "src", "api");
  const files = walk(apiDir, (file) => file.endsWith(".ts"));
  const operations = [];
  const unresolved = [];
  const usedModules = new Set();

  for (const file of files) {
    const moduleName = path.basename(file, ".ts");
    if (["client", "crud"].includes(moduleName)) continue;
    const source = fs.readFileSync(file, "utf8");
    const relative = toPosix(path.relative(repoDir, file));
    const callPattern = /\b(apiClient|axios)\.(get|post|put|patch|delete)\b/g;
    for (const match of source.matchAll(callPattern)) {
      const argumentStart = firstArgumentStart(source, match.index + match[0].length);
      const quoted = argumentStart >= 0 ? readQuoted(source, argumentStart) : null;
      if (quoted?.value.includes("${endpoints[type]}")) {
        const endpointBases = [...source.matchAll(/^[ ]{2}[A-Za-z0-9_]+:\s*["'](\/api\/[^"']+)["']/gm)].map(
          (endpointMatch) => endpointMatch[1],
        );
        if (endpointBases.length) {
          usedModules.add(moduleName);
          for (const endpointBase of endpointBases) {
            operations.push({
              method: match[2].toUpperCase(),
              endpoint: `${endpointBase}:param/crm-card/`,
              moduleName,
              source: `${relative}:${lineNumber(source, match.index)}`,
            });
          }
          continue;
        }
      }
      const endpoint = quoted ? normalizeEndpoint(quoted.value) : null;
      if (!endpoint) {
        unresolved.push(`${relative}:${lineNumber(source, match.index)} ${match[0]}`);
        continue;
      }
      usedModules.add(moduleName);
      operations.push({
        method: match[2].toUpperCase(),
        endpoint,
        moduleName,
        source: `${relative}:${lineNumber(source, match.index)}`,
      });
    }

    const crudPattern = /\bcreateCrudApi\b/g;
    for (const match of source.matchAll(crudPattern)) {
      const argumentStart = firstArgumentStart(source, match.index + match[0].length);
      if (argumentStart < 0) continue;
      const quoted = argumentStart >= 0 ? readQuoted(source, argumentStart) : null;
      const endpoint = quoted ? normalizeEndpoint(quoted.value) : null;
      if (!endpoint) {
        unresolved.push(`${relative}:${lineNumber(source, match.index)} createCrudApi`);
        continue;
      }
      usedModules.add(moduleName);
      const detail = `${endpoint}:param/`;
      for (const [method, target, action] of [
        ["GET", endpoint, "list"],
        ["GET", detail, "retrieve"],
        ["POST", endpoint, "create"],
        ["PATCH", detail, "update"],
        ["DELETE", detail, "remove"],
        ["POST", `${detail}archive/`, "archive"],
        ["POST", `${detail}restore/`, "restore"],
      ]) {
        operations.push({
          method,
          endpoint: target,
          moduleName,
          source: `${relative}:${lineNumber(source, match.index)}#${action}`,
        });
      }
    }
  }

  const merged = new Map();
  for (const operation of operations) {
    const key = `${operation.method} ${operation.endpoint}`;
    const existing = merged.get(key) || { ...operation, modules: new Set(), sources: new Set() };
    existing.modules.add(operation.moduleName);
    existing.sources.add(operation.source);
    merged.set(key, existing);
  }

  const classified = [...merged.values()].map((operation) => {
    const modules = [...operation.modules].sort();
    const policies = modules.map((moduleName) => apiModulePolicies[moduleName]).filter(Boolean);
    const idempotencyRule = idempotentMutationRules.find(
      (rule) => rule.method === operation.method && new RegExp(rule.endpointPattern).test(operation.endpoint),
    );
    const isQuery = operation.method === "GET";
    return {
      method: operation.method,
      endpoint: operation.endpoint,
      kind: isQuery ? "query" : "mutation",
      modules,
      sources: [...operation.sources].sort(),
      permissionOwner: [...new Set(policies.map((policy) => policy.permissionOwner))].sort().join(" + "),
      retryLocation: [...new Set(policies.map((policy) => policy.retryLocation))].sort().join(" + "),
      idempotency: isQuery ? "safe_read" : idempotencyRule?.guarantee || "none_proven",
      idempotencyEvidence: isQuery ? "HTTP safe read" : idempotencyRule?.evidence || "No proven frontend retry contract",
      automaticRetryAllowed: isQuery,
    };
  });

  return {
    operations: classified.sort((left, right) => `${left.endpoint} ${left.method}`.localeCompare(`${right.endpoint} ${right.method}`)),
    unresolved,
    usedModules: [...usedModules].sort(),
  };
}

function findPageSource(pageName) {
  const candidates = walk(path.join(frontendDir, "src"), (file) => file.endsWith(`${pageName}.tsx`));
  return candidates.length === 1 ? candidates[0] : null;
}

function routeSurfaceInventory() {
  return routeActionRegistry.map((route) => {
    const pageSource = findPageSource(route.page);
    const source = pageSource ? fs.readFileSync(pageSource, "utf8") : "";
    const sourcePath = pageSource ? toPosix(path.relative(repoDir, pageSource)) : "route_registry_only";
    const detected = {
      loading: /LoadingState|isLoading|isPending|Suspense/.test(source) ? "detected" : "not_detected",
      empty: /EmptyState|empty state|isEmpty|emptyState/i.test(source) ? "detected" : "not_detected",
      denied: /ForbiddenState|PermissionRoute|permission_denied/.test(source) || route.guard !== "PublicRoute" ? "guarded" : "not_applicable",
      failure: /ErrorState|getApiErrorMessage|notifyError|isError|error\.message|statusText/.test(source) ? "detected" : "not_detected",
      recovery: /onRetry|refetch\(|retry|navigate\(|returnTo/.test(source) ? "detected" : "not_detected",
    };
    return {
      id: route.id,
      route: route.route,
      page: route.page,
      group: route.group,
      roles: route.roles,
      permissionOwner: route.capabilities.length ? route.capabilities.join(" + ") : route.guard,
      intendedRetryLocation: route.group === "authentication" ? "authentication_flow" : route.group === "platform" ? "platform_owned_surface" : "owning_page_or_action",
      currentSurfaceEvidence: detected,
      source: sourcePath,
      defectPrecedents: defectPrecedents.filter((id) => id.startsWith("ZR-") || id === "ZD-004"),
    };
  });
}

function extractBackgroundTasks() {
  const files = walk(path.join(repoDir, "apps"), (file) => file.endsWith(".py"));
  const tasks = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const pattern = /@shared_task\(([^)]*)\)\s*\r?\n(?:async\s+)?def\s+([A-Za-z0-9_]+)/g;
    for (const match of source.matchAll(pattern)) {
      const name = match[1].match(/name\s*=\s*["']([^"']+)["']/)?.[1] || match[2];
      const queue = match[1].match(/queue\s*=\s*["']([^"']+)["']/)?.[1] || "default";
      tasks.push({
        name,
        queue,
        source: `${toPosix(path.relative(repoDir, file))}:${lineNumber(source, match.index)}`,
        ...backgroundTaskPolicies[name],
      });
    }
  }
  return tasks.sort((left, right) => left.name.localeCompare(right.name));
}

function modelBody(source, modelName) {
  const pattern = new RegExp(`^class ${modelName}\\([^\\n]+\\):`, "m");
  const match = pattern.exec(source);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = source.slice(start);
  const nextClass = /^class [A-Za-z0-9_]+\(/m.exec(rest);
  return nextClass ? rest.slice(0, nextClass.index) : rest;
}

function statusesBody(body) {
  const match = /^    class Statuses\(models\.TextChoices\):\s*$/m.exec(body);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const nextPeer = /^    (?:class|[a-zA-Z_][a-zA-Z0-9_]*\s*=)/m.exec(rest);
  return nextPeer ? rest.slice(0, nextPeer.index) : rest;
}

function extractProviderStatuses() {
  const rows = [];
  for (const [relativeFile, modelName] of providerStatusSources) {
    const absolute = path.join(repoDir, ...relativeFile.split("/"));
    const source = fs.readFileSync(absolute, "utf8");
    const body = modelBody(source, modelName);
    const statusBody = body && statusesBody(body);
    if (!statusBody) {
      rows.push({ source: relativeFile, model: modelName, status: null });
      continue;
    }
    for (const match of statusBody.matchAll(/^        [A-Z][A-Z0-9_]+\s*=\s*["']([^"']+)["']/gm)) {
      const status = match[1];
      const policy = providerStatusPolicies[status];
      rows.push({
        source: relativeFile,
        model: modelName,
        status,
        category: policy?.[0],
        copyFamily: policy?.[1],
        recovery: policy?.[2],
      });
    }
  }
  return rows.sort((left, right) => `${left.model}.${left.status}`.localeCompare(`${right.model}.${right.status}`));
}

export function buildFallbackInventory() {
  const api = extractApiOperations(frontendDir);
  return {
    routes: routeSurfaceInventory(),
    apiOperations: api.operations,
    unresolvedApiCalls: api.unresolved,
    usedApiModules: api.usedModules,
    backgroundTasks: extractBackgroundTasks(),
    providerStatuses: extractProviderStatuses(),
  };
}

function validateInventory(inventory) {
  const errors = [];
  const categoryNames = new Set(Object.keys(fallbackCategories));
  const codes = new Set();
  for (const entry of errorCodeRegistry) {
    if (codes.has(entry.code)) errors.push(`duplicate error code: ${entry.code}`);
    codes.add(entry.code);
    if (!categoryNames.has(entry.category)) errors.push(`${entry.code} has unknown category ${entry.category}`);
  }
  if (inventory.unresolvedApiCalls.length) {
    errors.push(`unresolved API calls:\n  ${inventory.unresolvedApiCalls.join("\n  ")}`);
  }
  for (const moduleName of inventory.usedApiModules) {
    if (!apiModulePolicies[moduleName]) errors.push(`missing API module policy: ${moduleName}`);
  }
  const detectedTasks = new Set(inventory.backgroundTasks.map((task) => task.name));
  for (const task of inventory.backgroundTasks) {
    if (!task.permissionOwner || !task.idempotency || !task.retryLocation) errors.push(`missing background task policy: ${task.name}`);
  }
  for (const taskName of Object.keys(backgroundTaskPolicies)) {
    if (!detectedTasks.has(taskName)) errors.push(`stale background task policy: ${taskName}`);
  }
  for (const status of inventory.providerStatuses) {
    if (!status.status) errors.push(`missing Statuses class: ${status.model}`);
    else if (!status.category || !status.copyFamily || !status.recovery) errors.push(`missing provider status policy: ${status.model}.${status.status}`);
  }
  const defectSource = fs.readFileSync(path.join(repoDir, "actual_docs", "DEFECT_KNOWLEDGE_BASE.md"), "utf8");
  for (const precedent of defectPrecedents) {
    if (!defectSource.includes(precedent)) errors.push(`missing defect precedent: ${precedent}`);
  }
  if (inventory.routes.length !== routeActionRegistry.length) errors.push("route inventory does not match route registry");
  if (!inventory.apiOperations.some((operation) => operation.kind === "query")) errors.push("no API queries detected");
  if (!inventory.apiOperations.some((operation) => operation.kind === "mutation")) errors.push("no API mutations detected");
  return errors;
}

function tableCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(tableCell).join(" | ")} |`),
  ].join("\n");
}

export function renderFallbackReport(inventory) {
  const queryCount = inventory.apiOperations.filter((operation) => operation.kind === "query").length;
  const mutationCount = inventory.apiOperations.length - queryCount;
  const routeRows = inventory.routes.map((route) => [
    route.id,
    route.route,
    route.permissionOwner,
    Object.entries(route.currentSurfaceEvidence).map(([key, value]) => `${key}:${value}`).join("; "),
    route.intendedRetryLocation,
    route.source,
  ]);
  const apiRows = inventory.apiOperations.map((operation) => [
    operation.method,
    operation.endpoint,
    operation.kind,
    operation.permissionOwner,
    operation.idempotency,
    operation.automaticRetryAllowed ? "safe read only" : "no automatic retry",
    operation.retryLocation,
    operation.sources.join("<br>"),
  ]);
  const taskRows = inventory.backgroundTasks.map((task) => [task.name, task.queue, task.permissionOwner, task.idempotency, task.retryLocation, task.source]);
  const statusRows = inventory.providerStatuses.map((status) => [status.model, status.status, status.category, status.copyFamily, status.recovery, status.source]);
  const codeRows = errorCodeRegistry.map((entry) => [entry.code, entry.category, entry.copyFamily, entry.retryable, entry.retryPolicy]);
  const categoryRows = Object.entries(fallbackCategories).map(([name, value]) => [name, value.copyFamily, value.defaultSurface, value.recovery]);

  return `# ZANI Unified Fallback Inventory (generated)\n\n` +
    `> Generated by \`frontend/scripts/check-fallback-inventory.mjs --write\`. Do not edit this report manually.\n\n` +
    `## Coverage Summary\n\n` +
    `- Routes: **${inventory.routes.length}** (derived from the functional certification registry).\n` +
    `- Distinct frontend API operations: **${inventory.apiOperations.length}** (${queryCount} queries, ${mutationCount} mutations).\n` +
    `- Background tasks: **${inventory.backgroundTasks.length}**.\n` +
    `- Async/provider status values: **${inventory.providerStatuses.length}** across ${providerStatusSources.length} models.\n` +
    `- Stable backend/API error codes: **${errorCodeRegistry.length}**.\n` +
    `- Defect precedents applied: ${defectPrecedents.map((value) => `\`${value}\``).join(", ")}.\n\n` +
    `The registry is conservative: only GET operations are automatically retryable. A mutation marked \`conditional_idempotency_key\` is still not retried automatically until its caller proves and supplies a stable key.\n\n` +
    `## Fallback Taxonomy\n\n${table(["Category", "Copy family", "Default surface", "Default recovery"], categoryRows)}\n\n` +
    `## Error-Code Registry\n\n${table(["Code", "Category", "Localized copy family", "Backend retryable", "Retry policy"], codeRows)}\n\n` +
    `## Route And Surface Inventory\n\n` +
    `Detection records which fallback signals currently exist in the owning page source; \`not_detected\` is an explicit migration gap for FB-004 through FB-006, not proof that a state is impossible.\n\n` +
    `${table(["ID", "Route", "Permission owner", "Current evidence", "Intended recovery location", "Source"], routeRows)}\n\n` +
    `## Frontend API Query And Mutation Inventory\n\n${table(["Method", "Endpoint", "Kind", "Permission owner", "Idempotency", "Automatic retry", "Retry location", "Source"], apiRows)}\n\n` +
    `## Background Job Inventory\n\n${table(["Task", "Queue", "Permission owner", "Idempotency", "Retry location", "Source"], taskRows)}\n\n` +
    `## Async And Provider Status Inventory\n\n${table(["Model", "Status", "Category", "Copy family", "Recovery", "Source"], statusRows)}\n\n` +
    `## Defect Precedent Contract\n\n` +
    `All later fallback phases must apply ${defectPrecedents.map((value) => `\`${value}\``).join(", ")} from \`actual_docs/DEFECT_KNOWLEDGE_BASE.md\`. In particular, raw technical text must never reach merchant UI, recovery must appear once, cancel/focus context must remain stable, and the normal success path must remain green.\n`;
}

export function verifyFallbackInventory({ write = false } = {}) {
  const inventory = buildFallbackInventory();
  const errors = validateInventory(inventory);
  if (errors.length) throw new Error(`Fallback inventory is invalid:\n- ${errors.join("\n- ")}`);
  const report = renderFallbackReport(inventory);
  if (write) fs.writeFileSync(reportPath, report, "utf8");
  else if (!fs.existsSync(reportPath) || fs.readFileSync(reportPath, "utf8") !== report) {
    throw new Error("Generated fallback report is stale. Run npm run generate:fallback-inventory.");
  }
  return {
    routes: inventory.routes.length,
    apiOperations: inventory.apiOperations.length,
    backgroundTasks: inventory.backgroundTasks.length,
    providerStatuses: inventory.providerStatuses.length,
    errorCodes: errorCodeRegistry.length,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  const result = verifyFallbackInventory({ write: process.argv.includes("--write") });
  console.log(
    `Fallback inventory OK: ${result.routes} routes, ${result.apiOperations} API operations, ` +
      `${result.backgroundTasks} tasks, ${result.providerStatuses} statuses, ${result.errorCodes} error codes.`,
  );
}
