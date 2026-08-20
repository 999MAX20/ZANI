import assert from "node:assert/strict";
import test from "node:test";

import { buildFallbackInventory, verifyFallbackInventory } from "../check-fallback-inventory.mjs";

test("fallback registry covers routes, API operations, jobs and provider states", () => {
  const inventory = buildFallbackInventory();
  assert.ok(inventory.routes.length > 0);
  assert.ok(inventory.apiOperations.some((operation) => operation.kind === "query"));
  assert.ok(inventory.apiOperations.some((operation) => operation.kind === "mutation"));
  assert.ok(inventory.backgroundTasks.length > 0);
  assert.ok(inventory.providerStatuses.length > 0);
  assert.deepEqual(inventory.unresolvedApiCalls, []);
  assert.ok(inventory.apiOperations.filter((operation) => operation.kind === "mutation").every((operation) => !operation.automaticRetryAllowed));
});

test("generated fallback report is current", () => {
  const result = verifyFallbackInventory();
  assert.ok(result.routes > 0);
  assert.ok(result.errorCodes > 0);
});

