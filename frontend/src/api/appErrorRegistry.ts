export const appErrorCategories = [
  "validation",
  "authentication",
  "permission",
  "not_found",
  "conflict",
  "rate_limit",
  "offline",
  "temporary",
  "provider",
  "internal",
] as const;

export type AppErrorCategory = (typeof appErrorCategories)[number];

export type AppErrorCodePolicy = Readonly<{
  category: AppErrorCategory;
  code: string;
  retryPolicy: string;
  retryable: boolean;
}>;

function errorCode(
  code: string,
  category: AppErrorCategory,
  options: { retryable?: boolean; retryPolicy?: string } = {},
): AppErrorCodePolicy {
  return {
    code,
    category,
    retryable: options.retryable ?? false,
    retryPolicy: options.retryPolicy || "never_blindly",
  };
}

export const appErrorCodeRegistry: readonly AppErrorCodePolicy[] = [
  errorCode("validation_error", "validation"),
  errorCode("request_failed", "validation"),
  errorCode("method_not_allowed", "validation"),
  errorCode("authentication_required", "authentication"),
  errorCode("token_not_valid", "authentication"),
  errorCode("mfa_required", "authentication"),
  errorCode("mfa_enrollment_required", "authentication"),
  errorCode("mfa_challenge_invalid", "authentication"),
  errorCode("mfa_enrollment_invalid", "authentication"),
  errorCode("mfa_code_invalid", "authentication"),
  errorCode("mfa_disable_reason_required", "validation"),
  errorCode("mfa_already_enabled", "conflict"),
  errorCode("mfa_not_available", "permission"),
  errorCode("mfa_step_up_required", "authentication"),
  errorCode("recent_auth_failed", "authentication"),
  errorCode("invitation_account_authentication_required", "authentication"),
  errorCode("permission_denied", "permission"),
  errorCode("module_disabled", "permission"),
  errorCode("not_found", "not_found"),
  errorCode("invalid_transition", "conflict"),
  errorCode("schedule_conflict", "conflict"),
  errorCode("assignee_unavailable", "conflict"),
  errorCode("idempotency_conflict", "conflict"),
  errorCode("ownership_conflict", "conflict"),
  errorCode("rate_limited", "rate_limit", {
    retryable: true,
    retryPolicy: "server_delay_only",
  }),
  errorCode("provider_unavailable", "provider", {
    retryable: true,
    retryPolicy: "owned_status_surface_only",
  }),
  errorCode("temporary_service_failure", "temporary", {
    retryable: true,
    retryPolicy: "idempotent_or_keyed_only",
  }),
  errorCode("database_unavailable", "temporary", {
    retryable: true,
    retryPolicy: "safe_read_only",
  }),
  errorCode("internal_error", "internal"),
];
