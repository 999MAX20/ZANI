from dataclasses import dataclass
import json

from django.conf import settings

from apps.ai_core.providers import get_ai_provider
from apps.ai_core.providers.base import AIProviderError


class AIClientError(Exception):
    pass


@dataclass
class AIClientResult:
    output_text: str
    model: str
    tokens_used: int = 0
    is_mock: bool = False
    provider: str = "mock"


def _prompt_tier(prompt_type):
    try:
        prompt_tiers = json.loads(settings.AI_PROMPT_MODEL_TIERS or "{}")
    except json.JSONDecodeError:
        prompt_tiers = {}
    return prompt_tiers.get(prompt_type) or settings.AI_DEFAULT_MODEL_TIER


def resolve_model(*, prompt_type=None, model=None, model_tier=None):
    if model:
        return model

    tier = model_tier or _prompt_tier(prompt_type or "")
    models_by_tier = {
        "fast": settings.AI_FAST_MODEL,
        "cheap": settings.AI_CHEAP_MODEL,
        "smart": settings.AI_SMART_MODEL,
    }
    return models_by_tier.get(tier) or settings.AI_MODEL


def generate_text(prompt, *, model=None, model_tier=None, prompt_type=None, temperature=None, allow_mock=True):
    provider_name = "mock" if not settings.AI_ENABLED else settings.AI_PROVIDER
    selected_model = resolve_model(prompt_type=prompt_type, model=model, model_tier=model_tier)
    temperature = settings.AI_TEMPERATURE if temperature is None else temperature

    try:
        response = get_ai_provider(provider_name).generate_text(
            prompt,
            model=selected_model,
            temperature=temperature,
            timeout_seconds=settings.AI_HTTP_TIMEOUT_SECONDS,
        )
    except AIProviderError as exc:
        if not allow_mock:
            raise AIClientError(str(exc)) from exc
        response = get_ai_provider("mock").generate_text(
            prompt,
            model=selected_model,
            temperature=temperature,
            timeout_seconds=settings.AI_HTTP_TIMEOUT_SECONDS,
        )

    return AIClientResult(
        output_text=response.output_text,
        model=response.model,
        tokens_used=response.tokens_used,
        is_mock=response.is_mock,
        provider=response.provider,
    )
