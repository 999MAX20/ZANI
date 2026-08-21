import re

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
    "authorization",
    "credential",
    "credentials",
    "private_key",
}

SAFE_SENSITIVE_KEY_SUFFIXES = (
    "_configured",
    "_config_id",
    "_digest",
    "_fingerprint",
    "_status",
    "_type",
    "_verified",
)


def normalize_config_key(key):
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(key or ""))
    return re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()


def is_sensitive_config_key(key):
    normalized = normalize_config_key(key)
    if normalized.endswith(SAFE_SENSITIVE_KEY_SUFFIXES):
        return False
    if normalized in SENSITIVE_CONFIG_KEYS:
        return True
    compact = normalized.replace("_", "")
    return any(
        marker in normalized or marker.replace("_", "") in compact
        for marker in (
            "password",
            "secret",
            "access_token",
            "refresh_token",
            "api_key",
            "api_token",
            "auth_token",
            "bearer_token",
            "bot_token",
            "private_key",
            "authorization",
            "credential",
        )
    )


def sensitive_config_paths(value, prefix=""):
    paths = []
    if isinstance(value, dict):
        for key, item in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            if is_sensitive_config_key(key):
                paths.append(path)
            else:
                paths.extend(sensitive_config_paths(item, path))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            path = f"{prefix}[{index}]" if prefix else f"[{index}]"
            paths.extend(sensitive_config_paths(item, path))
    return paths


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
    "normalize_config_key",
    "sanitize_config",
    "sensitive_config_paths",
    "sanitize_error_payload",
    "sanitize_error_text",
]
