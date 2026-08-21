import axios from "axios";

import {
  appErrorCodeRegistry,
  type AppErrorCategory,
} from "./appErrorRegistry.ts";

export { appErrorCategories, appErrorCodeRegistry } from "./appErrorRegistry.ts";
export type { AppErrorCategory } from "./appErrorRegistry.ts";

export type AppErrorSource = "api" | "network" | "runtime";

export type AppError = Readonly<{
  category: AppErrorCategory;
  code: string;
  fieldErrors: Record<string, string[]>;
  messageKey: string;
  requestId?: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  retryPolicy: string;
  source: AppErrorSource;
  status?: number;
}>;

const categoryMessageKeys: Record<AppErrorCategory, string> = {
  validation: "actions.errorValidation",
  authentication: "actions.errorUnauthenticated",
  permission: "actions.errorForbidden",
  not_found: "actions.errorUnavailable",
  conflict: "actions.errorConflict",
  rate_limit: "actions.errorRateLimited",
  offline: "actions.errorNetwork",
  temporary: "actions.errorTemporary",
  provider: "actions.errorTemporary",
  internal: "actions.errorGeneric",
};

const errorCodePolicies = new Map(
  appErrorCodeRegistry.map((policy) => [policy.code, policy]),
);

const reservedEnvelopeFields = new Set([
  "category",
  "code",
  "detail",
  "errors",
  "request_id",
  "retry_after_seconds",
  "retryable",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeStatusCategory(status: number | undefined): AppErrorCategory {
  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "authentication";
  if (status === 403) return "permission";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limit";
  if (status !== undefined && status >= 500) return "temporary";
  return "internal";
}

function fallbackCode(category: AppErrorCategory) {
  const codes: Record<AppErrorCategory, string> = {
    validation: "validation_error",
    authentication: "authentication_required",
    permission: "permission_denied",
    not_found: "not_found",
    conflict: "request_conflict",
    rate_limit: "rate_limited",
    offline: "network_unavailable",
    temporary: "temporary_service_failure",
    provider: "provider_unavailable",
    internal: "internal_error",
  };
  return codes[category];
}

function normalizeRequestId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const requestId = value.trim();
  return requestId && requestId.length <= 128 ? requestId : undefined;
}

function normalizeRetryDelay(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(86_400, Math.max(0, Math.ceil(value)));
}

function normalizeMessages(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((message): message is string => typeof message === "string")
    .map((message) => message.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeFieldErrors(value: unknown) {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([field]) => (
        !reservedEnvelopeFields.has(field)
        && field.length <= 80
        && /^[A-Za-z0-9_.-]+$/.test(field)
      ))
      .slice(0, 50)
      .map(([field, messages]) => [field, normalizeMessages(messages)] as const)
      .filter(([, messages]) => messages.length > 0),
  );
}

function normalizeApiError(error: unknown): AppError | null {
  if (!axios.isAxiosError(error)) return null;
  if (!error.response) {
    return {
      category: "offline",
      code: fallbackCode("offline"),
      fieldErrors: {},
      messageKey: categoryMessageKeys.offline,
      retryable: true,
      retryPolicy: "user_initiated_only",
      source: "network",
    };
  }

  const status = error.response.status;
  const payload = isRecord(error.response.data) ? error.response.data : {};
  const suppliedCode = typeof payload.code === "string" ? payload.code : "";
  const codePolicy = errorCodePolicies.get(suppliedCode);
  const category = codePolicy?.category || safeStatusCategory(status);
  const retryable = codePolicy
    ? codePolicy.retryable && payload.retryable !== false
    : payload.retryable === true && ["rate_limit", "temporary", "provider"].includes(category);
  const retryAfterSeconds = retryable
    ? normalizeRetryDelay(payload.retry_after_seconds)
    : undefined;

  return {
    category,
    code: codePolicy?.code || fallbackCode(category),
    fieldErrors: normalizeFieldErrors(payload.errors),
    messageKey: categoryMessageKeys[category],
    requestId: normalizeRequestId(payload.request_id),
    retryable,
    retryAfterSeconds,
    retryPolicy: codePolicy?.retryPolicy || (retryable ? "explicit_backend_only" : "never_blindly"),
    source: "api",
    status,
  };
}

export function normalizeAppError(error: unknown): AppError {
  return normalizeApiError(error) || {
    category: "internal",
    code: fallbackCode("internal"),
    fieldErrors: {},
    messageKey: categoryMessageKeys.internal,
    retryable: false,
    retryPolicy: "never_blindly",
    source: "runtime",
  };
}

export function getAppErrorMessage(
  error: unknown,
  translator: (key: string) => string,
) {
  return translator(normalizeAppError(error).messageKey);
}
