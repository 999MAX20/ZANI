import assert from "node:assert/strict";
import test from "node:test";

import { verifyFailureCertification } from "../check-failure-certification.mjs";

test("FB-010 has a complete role, viewport, journey and failure-state matrix", () => {
  const result = verifyFailureCertification();

  assert.equal(result.journeys, 10);
  assert.equal(result.roles, 5);
  assert.equal(result.states, 12);
  assert.equal(result.viewports, 2);
  assert.equal(result.cells, 744);
});
