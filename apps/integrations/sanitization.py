import re


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

SENSITIVE_TEXT_KEY_PATTERN = re.compile(
    r"(?i)(password|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization)"
)
SENSITIVE_QUERY_PATTERN = re.compile(
    r"(?i)([?&](?:password|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization)=)[^&\s]+"
)
JSON_SECRET_PATTERN = re.compile(
    r"(?i)(['\"](?:password|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization)['\"]\s*:\s*['\"])[^'\"]+(['\"])"
)
HEADER_SECRET_PATTERN = re.compile(r"(?i)\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+")
TELEGRAM_TOKEN_PATTERN = re.compile(r"\b\d{5,}:[A-Za-z0-9_-]{10,}\b")
USERINFO_PATTERN = re.compile(r"://[^/@\s]+@")


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


def sanitize_error_text(value, *, max_length=1000):
    text = str(value or "")
    if not text:
        return ""
    text = USERINFO_PATTERN.sub("://[redacted]@", text)
    text = SENSITIVE_QUERY_PATTERN.sub(lambda match: f"{match.group(1)}[redacted]", text)
    text = JSON_SECRET_PATTERN.sub(lambda match: f"{match.group(1)}[redacted]{match.group(2)}", text)
    text = HEADER_SECRET_PATTERN.sub(lambda match: f"{match.group(1)} [redacted]", text)
    text = TELEGRAM_TOKEN_PATTERN.sub("[redacted-telegram-token]", text)
    if SENSITIVE_TEXT_KEY_PATTERN.search(text):
        text = re.sub(
            r"(?i)(password|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization)(\s*[=:]\s*)\S+",
            lambda match: f"{match.group(1)}{match.group(2)}[redacted]",
            text,
        )
    return text[:max_length]


def sanitize_error_payload(value, *, max_string_length=1000):
    if isinstance(value, dict):
        return {
            key: "[redacted]" if is_sensitive_config_key(key) and item else sanitize_error_payload(item, max_string_length=max_string_length)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [sanitize_error_payload(item, max_string_length=max_string_length) for item in value]
    if isinstance(value, str):
        return sanitize_error_text(value, max_length=max_string_length)
    return value
