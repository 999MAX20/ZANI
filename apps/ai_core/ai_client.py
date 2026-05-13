from dataclasses import dataclass

from django.conf import settings


class AIClientError(Exception):
    pass


@dataclass
class AIClientResult:
    output_text: str
    model: str
    tokens_used: int = 0
    is_mock: bool = False


def generate_text(prompt, *, model=None, temperature=None, allow_mock=True):
    model = model or settings.OPENAI_MODEL
    temperature = settings.OPENAI_TEMPERATURE if temperature is None else temperature

    if not settings.OPENAI_API_KEY:
        if allow_mock:
            return AIClientResult(
                output_text="AI mock response: OPENAI_API_KEY is not configured.",
                model=model,
                tokens_used=0,
                is_mock=True,
            )
        raise AIClientError("OPENAI_API_KEY is not configured.")

    try:
        from openai import OpenAI
    except ImportError as exc:
        if allow_mock:
            return AIClientResult(
                output_text="AI mock response: openai package is not installed.",
                model=model,
                tokens_used=0,
                is_mock=True,
            )
        raise AIClientError("openai package is not installed.") from exc

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.responses.create(
        model=model,
        input=prompt,
        temperature=temperature,
    )
    output_text = getattr(response, "output_text", "") or ""
    usage = getattr(response, "usage", None)
    tokens_used = getattr(usage, "total_tokens", 0) if usage else 0
    return AIClientResult(output_text=output_text, model=model, tokens_used=tokens_used, is_mock=False)
