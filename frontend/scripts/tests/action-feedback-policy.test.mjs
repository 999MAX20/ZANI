import assert from "node:assert/strict";
import test from "node:test";

import {
  canOfferActionRecovery,
  canUseActionFallback,
} from "../../src/components/actions/actionFeedbackPolicy.ts";

const appError = (overrides = {}) => ({
  category: "internal",
  code: "internal_error",
  fieldErrors: {},
  messageKey: "actions.errorGeneric",
  retryable: false,
  retryPolicy: "never_blindly",
  source: "runtime",
  ...overrides,
});

test("validation and authorization failures never offer blind recovery", () => {
  assert.equal(canOfferActionRecovery(appError({ category: "validation", retryable: true }), true), false);
  assert.equal(canOfferActionRecovery(appError({ category: "authentication", retryable: true }), true), false);
  assert.equal(canOfferActionRecovery(appError({ category: "permission", retryable: true }), true), false);
  assert.equal(canOfferActionRecovery(appError({ category: "conflict", retryable: false }), true), false);
  assert.equal(canOfferActionRecovery(appError({ category: "temporary", retryable: true }), true), true);
  assert.equal(canOfferActionRecovery(appError({ category: "offline", retryable: true }), true), true);
  assert.equal(canOfferActionRecovery(appError({ category: "temporary", retryable: true }), false), false);
});

test("transport errors never expose a caller fallback as raw action feedback", () => {
  assert.equal(canUseActionFallback(appError({ category: "offline", source: "network" }), true), false);
  assert.equal(canUseActionFallback(appError({ category: "validation", source: "api" }), true), false);
  assert.equal(canUseActionFallback(appError(), true), true);
  assert.equal(canUseActionFallback(appError(), false), false);
});
