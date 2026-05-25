from apps.ai_core.providers.kimi import KimiProvider
from apps.ai_core.providers.mock import MockAIProvider
from apps.ai_core.providers.openai import OpenAIProvider
from apps.ai_core.providers.openrouter import OpenRouterProvider


PROVIDERS = {
    "mock": MockAIProvider,
    "openai": OpenAIProvider,
    "openrouter": OpenRouterProvider,
    "kimi": KimiProvider,
}


def get_ai_provider(provider_name):
    provider_class = PROVIDERS.get((provider_name or "mock").lower())
    if provider_class is None:
        provider_class = MockAIProvider
    return provider_class()
