import assert from "node:assert/strict";
import test from "node:test";

import {
  getAppErrorMessage,
  normalizeAppError,
} from "../../src/api/appError.ts";
import { appErrorCodeRegistry } from "../../src/api/appErrorRegistry.ts";

function axiosError(status, data) {
  return {
    config: {},
    isAxiosError: true,
    message: "SQLSTATE secret_provider_payload",
    name: "AxiosError",
    response: status === undefined ? undefined : {
      config: {},
      data,
      headers: {},
      status,
      statusText: "provider stack trace",
    },
    toJSON: () => ({}),
  };
}

test("stable backend code takes priority over conflicting HTTP status", () => {
  const normalized = normalizeAppError(axiosError(403, {
    category: "permission",
    code: "schedule_conflict",
    detail: "SQLSTATE secret_provider_payload",
    errors: { start_time: ["This slot is no longer available."] },
    request_id: "request-42",
    retryable: false,
  }));

  assert.equal(normalized.code, "schedule_conflict");
  assert.equal(normalized.category, "conflict");
  assert.equal(normalized.messageKey, "actions.errorConflict");
  assert.deepEqual(normalized.fieldErrors, {
    start_time: ["This slot is no longer available."],
  });
  assert.equal(normalized.requestId, "request-42");
  assert.equal(JSON.stringify(normalized).includes("SQLSTATE"), false);
});

test("unknown backend codes fall back to HTTP classification without leaking payload", () => {
  const normalized = normalizeAppError(axiosError(403, {
    code: "private_internal_exception_name",
    detail: "password=secret",
    unrelated: "must not become a field error",
  }));

  assert.equal(normalized.code, "permission_denied");
  assert.equal(normalized.category, "permission");
  assert.equal(normalized.messageKey, "actions.errorForbidden");
  assert.deepEqual(normalized.fieldErrors, {});
  assert.equal(JSON.stringify(normalized).includes("secret"), false);
});

test("field errors come only from the bounded errors envelope", () => {
  const normalized = normalizeAppError(axiosError(400, {
    code: "validation_error",
    detail: "Validation failed.",
    email: ["legacy root compatibility field"],
    errors: {
      detail: "reserved",
      email: ["Enter a valid email.", 123, ""],
      nested: { unsafe: "object" },
      password: "This field is required.",
    },
  }));

  assert.deepEqual(normalized.fieldErrors, {
    email: ["Enter a valid email."],
    password: ["This field is required."],
  });
});

test("network and runtime errors use safe localized copy keys", () => {
  const network = normalizeAppError(axiosError(undefined));
  const runtime = normalizeAppError(new Error("database password leaked"));

  assert.equal(network.category, "offline");
  assert.equal(network.messageKey, "actions.errorNetwork");
  assert.equal(network.retryable, true);
  assert.equal(runtime.category, "internal");
  assert.equal(runtime.messageKey, "actions.errorGeneric");
  assert.equal(JSON.stringify(runtime).includes("password"), false);
  assert.equal(
    getAppErrorMessage(runtime, (key) => ({
      "actions.errorGeneric": "Безопасное сообщение",
    })[key] || key),
    "Безопасное сообщение",
  );
});

test("retry metadata is accepted only for registered retryable codes and bounded", () => {
  const retryable = normalizeAppError(axiosError(429, {
    code: "rate_limited",
    retry_after_seconds: 100_000,
    retryable: true,
  }));
  const denied = normalizeAppError(axiosError(400, {
    code: "validation_error",
    retry_after_seconds: 30,
    retryable: true,
  }));

  assert.equal(retryable.retryable, true);
  assert.equal(retryable.retryAfterSeconds, 86_400);
  assert.equal(denied.retryable, false);
  assert.equal(denied.retryAfterSeconds, undefined);
});

test("runtime error-code registry has unique stable codes", () => {
  const codes = appErrorCodeRegistry.map((entry) => entry.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.includes("ownership_conflict"));
  assert.ok(codes.includes("invitation_account_authentication_required"));
});
