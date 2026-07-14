from dataclasses import dataclass


class AIProviderError(Exception):
    pass


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
