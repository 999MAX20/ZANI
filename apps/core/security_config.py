PLACEHOLDER_SECRET_KEYS = frozenset(
    {
        "change-me-in-production",
        "change-me-use-32-plus-random-characters",
        "replace-with-strong-production-secret-32-plus-random-chars",
        "replace-with-32-plus-random-secret",
        "replace-with-strong-32-plus-character-secret",
        "local-dev-secret-key-change-before-production",
    }
)

WEAK_SECRET_KEY_MARKERS = ("change-me", "replace-with", "local-dev", "placeholder")


def secret_key_strength(secret_key: object) -> dict:
    value = str(secret_key or "").strip()
    lower_value = value.lower()
    unique_chars = len(set(value))
    has_placeholder = lower_value in PLACEHOLDER_SECRET_KEYS or any(marker in lower_value for marker in WEAK_SECRET_KEY_MARKERS)

    return {
        "length": len(value),
        "unique_chars": unique_chars,
        "has_placeholder": has_placeholder,
        "is_strong": len(value) >= 32 and unique_chars >= 12 and not has_placeholder,
    }


def has_strong_secret_key(secret_key: object) -> bool:
    return secret_key_strength(secret_key)["is_strong"]


def secret_key_strength_detail(secret_key: object) -> str:
    strength = secret_key_strength(secret_key)
    return (
        "SECRET_KEY length={length}; unique_chars={unique_chars}; placeholder={has_placeholder}".format(
            **strength
        )
    )
