from apps.core.sanitization import sanitize_error_payload, sanitize_error_text


SAFE_PROVIDER_FAILURE_DETAIL = "The external provider could not complete the request."

SENSITIVE_CONFIG_KEYS = {
    "api_key",
    "api_secret",
    "api_token",
    "access_token",
    "auth_token",
    "bearer_token",
    "bot_token",
    "client_secret",
    "password",
    "refresh_token",
    "secret",
    "token",
    "webhook_secret",
}


def is_sensitive_config_key(key):
    normalized = str(key or "").lower()
    if normalized.endswith("_configured") or normalized.endswith("_config_id"):
        return False
    if normalized in SENSITIVE_CONFIG_KEYS:
        return True
    return any(part in normalized for part in ("password", "secret", "access_token", "refresh_token"))


def sanitize_config(value):
    if isinstance(value, dict):
        return {
            key: ("configured" if is_sensitive_config_key(key) and item else sanitize_config(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [sanitize_config(item) for item in value]
    return value


__all__ = [
    "SAFE_PROVIDER_FAILURE_DETAIL",
    "is_sensitive_config_key",
    "sanitize_config",
    "sanitize_error_payload",
    "sanitize_error_text",
]
