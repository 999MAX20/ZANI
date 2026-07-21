type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function merchantSafeIntegrationError(message: string | null | undefined, t: Translate) {
  if (!message) return t("integrations.error.actionRequired");

  const normalized = message.toLowerCase();

  if (
    normalized.includes("credential") ||
    normalized.includes("token") ||
    normalized.includes("api key") ||
    normalized.includes("access key") ||
    normalized.includes("secret") ||
    normalized.includes("expired") ||
    normalized.includes("unauthorized") ||
    normalized.includes("authentication")
  ) {
    return t("integrations.card.credentialsExpired");
  }

  if (normalized.includes("webhook") || normalized.includes("callback") || normalized.includes("verify")) {
    return t("integrations.error.webhookSetup");
  }

  if (normalized.includes("permission") || normalized.includes("forbidden") || normalized.includes("403")) {
    return t("integrations.error.permission");
  }

  if (normalized.includes("rate limit") || normalized.includes("throttle") || normalized.includes("429")) {
    return t("integrations.error.rateLimit");
  }

  if (
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("unavailable") ||
    normalized.includes("500")
  ) {
    return t("integrations.error.providerUnavailable");
  }

  if (
    normalized.includes("not configured") ||
    normalized.includes("config") ||
    normalized.includes("client id") ||
    normalized.includes("app id") ||
    normalized.includes("environment")
  ) {
    return t("integrations.error.supportReview");
  }

  return t("integrations.error.actionRequired");
}
