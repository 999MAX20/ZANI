import type { AppError } from "../../api/appError";

export function canOfferActionRecovery(
  error: AppError,
  hasRecovery: boolean,
) {
  return (
    hasRecovery &&
    error.retryable &&
    !["validation", "authentication", "permission"].includes(error.category)
  );
}

export function canUseActionFallback(
  error: AppError,
  hasFallback: boolean,
) {
  return error.source === "runtime" && error.category === "internal" && hasFallback;
}
