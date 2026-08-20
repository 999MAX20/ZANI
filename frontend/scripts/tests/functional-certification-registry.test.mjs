import assert from "node:assert/strict";
import test from "node:test";

import { verifyFunctionalCertificationRegistry } from "../check-functional-certification.mjs";

test("every router path declaration has a complete functional certification entry", () => {
  const result = verifyFunctionalCertificationRegistry();

  assert.ok(result.registryEntries > 0);
  assert.ok(result.routerPathDeclarations > 0);
  assert.ok(result.uniqueRouterPaths > 0);
});
