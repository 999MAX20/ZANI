from apps.ai_core.providers.base import AIProviderResponse, BaseAIProvider


class MockAIProvider(BaseAIProvider):
    provider = "mock"

    def generate_text(self, prompt, *, model, temperature, timeout_seconds):
        return AIProviderResponse(
            output_text="AI mock response: no real AI provider is configured.",
            model=model,
            tokens_used=0,
            is_mock=True,
            provider=self.provider,
        )
