from dataclasses import dataclass


class AIProviderError(Exception):
    def __init__(self, message="AI provider is unavailable.", *, code="provider_unavailable", retryable=True):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


@dataclass(frozen=True)
class AIProviderResponse:
    output_text: str
    model: str
    tokens_used: int = 0
    is_mock: bool = False
    provider: str = "mock"


class BaseAIProvider:
    provider = "base"

    def generate_text(self, prompt, *, model, temperature, timeout_seconds):
        raise NotImplementedError
