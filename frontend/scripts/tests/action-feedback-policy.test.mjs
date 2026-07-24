import assert from "node:assert/strict";
import test from "node:test";

import {
  canOfferActionRecovery,
  canUseActionFallback,
  classifyActionError,
} from "../../src/components/actions/actionFeedbackPolicy.ts";

test("action feedback maps sensitive and unmapped statuses to safe copy keys", () => {
  assert.equal(classifyActionError(400, false), "validation");
  assert.equal(classifyActionError(401, false), "unauthenticated");
  assert.equal(classifyActionError(403, false), "forbidden");
  assert.equal(classifyActionError(409, false), "conflict");
  assert.equal(classifyActionError(422, false), "validation");
  assert.equal(classifyActionError(503, false), "temporary");
  assert.equal(classifyActionError(418, false), "generic");
  assert.equal(classifyActionError(undefined, true), "network");
  assert.equal(classifyActionError(undefined, false), "generic");
});

test("validation and authorization failures never offer blind recovery", () => {
  assert.equal(canOfferActionRecovery(400, true), false);
  assert.equal(canOfferActionRecovery(401, true), false);
  assert.equal(canOfferActionRecovery(403, true), false);
  assert.equal(canOfferActionRecovery(422, true), false);
  assert.equal(canOfferActionRecovery(409, true), true);
  assert.equal(canOfferActionRecovery(503, true), true);
  assert.equal(canOfferActionRecovery(undefined, false), false);
});

test("transport errors never expose a caller fallback as raw action feedback", () => {
  assert.equal(canUseActionFallback("generic", true, true), false);
  assert.equal(canUseActionFallback("validation", false, true), false);
  assert.equal(canUseActionFallback("generic", false, true), true);
  assert.equal(canUseActionFallback("generic", false, false), false);
});
