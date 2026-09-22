from apps.ai_core.providers.kimi import KimiProvider
from apps.ai_core.providers.mock import MockAIProvider
from apps.ai_core.providers.openai import OpenAIProvider
from apps.ai_core.providers.openrouter import OpenRouterProvider
from apps.ai_core.providers.base import AIProviderError


PROVIDERS = {
    "mock": MockAIProvider,
    "openai": OpenAIProvider,
    "openrouter": OpenRouterProvider,
    "kimi": KimiProvider,
}


def get_ai_provider(provider_name):
    provider_class = PROVIDERS.get((provider_name or "mock").lower())
    if provider_class is None:
        raise AIProviderError("AI provider is not configured.", code="not_configured", retryable=False)
    return provider_class()
