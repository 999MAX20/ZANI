import math

from django.conf import settings
from rest_framework.exceptions import ValidationError


def validate_ai_settings(value):
    if not isinstance(value, dict):
        raise ValidationError("Agent settings must be an object.")
    value = dict(value)
    temperature = value.get("temperature")
    if temperature is not None:
        if isinstance(temperature, bool) or not isinstance(temperature, (int, float)) or not math.isfinite(temperature) or not 0 <= temperature <= 1:
            raise ValidationError("Temperature must be a number between 0 and 1.")
    model = value.get("model")
    if model is not None and (not isinstance(model, str) or len(model) > 128):
        raise ValidationError("Invalid model selection.")
    if settings.AI_PROVIDER == "openrouter" and model in {"gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"}:
        value["model"] = f"openai/{model}"
    tier = value.get("model_tier")
    if tier is not None and (not isinstance(tier, str) or tier not in {"fast", "smart", "cheap"}):
        raise ValidationError("Invalid model tier.")
    return value
