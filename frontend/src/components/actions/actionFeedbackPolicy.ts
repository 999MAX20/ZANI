export type ActionErrorKind =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "unavailable"
  | "conflict"
  | "rateLimited"
  | "temporary"
  | "network"
  | "generic";

export function classifyActionError(
  status: number | undefined,
  networkFailure: boolean,
): ActionErrorKind {
  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "unavailable";
  if (status === 409) return "conflict";
  if (status === 429) return "rateLimited";
  if (status !== undefined && status >= 500) return "temporary";
  if (networkFailure) return "network";
  return "generic";
}

export function canOfferActionRecovery(
  status: number | undefined,
  hasRecovery: boolean,
) {
  return (
    hasRecovery &&
    status !== 400 &&
    status !== 401 &&
    status !== 403 &&
    status !== 422
  );
}

export function canUseActionFallback(
  kind: ActionErrorKind,
  transportError: boolean,
  hasFallback: boolean,
) {
  return kind === "generic" && !transportError && hasFallback;
}
