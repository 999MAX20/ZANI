import re


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
SENSITIVE_PAYLOAD_KEYS = {
    "api_key",
    "api_secret",
    "api_token",
    "access_token",
    "authorization",
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
            key: (
                "[redacted]"
                if _is_sensitive_payload_key(key) and item
                else sanitize_error_payload(item, max_string_length=max_string_length)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [sanitize_error_payload(item, max_string_length=max_string_length) for item in value]
    if isinstance(value, str):
        return sanitize_error_text(value, max_length=max_string_length)
    return value


def _is_sensitive_payload_key(key):
    normalized = str(key or "").lower()
    if normalized in SENSITIVE_PAYLOAD_KEYS:
        return True
    return any(part in normalized for part in ("password", "secret", "access_token", "refresh_token"))


class SanitizedErrorFieldsMixin:
    sanitized_text_fields = ()
    sanitized_payload_fields = ()

    def save(self, *args, **kwargs):
        for field_name in self.sanitized_text_fields:
            setattr(self, field_name, sanitize_error_text(getattr(self, field_name, "")))
        for field_name in self.sanitized_payload_fields:
            setattr(self, field_name, sanitize_error_payload(getattr(self, field_name, None)))
        return super().save(*args, **kwargs)
