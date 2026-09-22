import json
from urllib import error, request
from django.conf import settings

from apps.ai_core.providers.base import AIProviderError, AIProviderResponse, BaseAIProvider


def _message_content_to_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(part for part in parts if part)
    return ""


class OpenAICompatibleProvider(BaseAIProvider):
    api_key = ""
    base_url = ""
    app_name = "ZANI"
    site_url = ""

    def _headers(self):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.provider == "openrouter":
            if self.site_url:
                headers["HTTP-Referer"] = self.site_url
            if self.app_name:
                headers["X-Title"] = self.app_name
        return headers

    def generate_text(self, prompt, *, model, temperature, timeout_seconds):
        if not self.api_key:
            raise AIProviderError("AI provider is not configured.", code="not_configured", retryable=False)
        if not self.base_url:
            raise AIProviderError(f"{self.provider} base URL is not configured.")

        payload = {
            "model": model,
            "messages": getattr(prompt, "messages", [{"role": "user", "content": str(prompt)}]),
            "temperature": temperature,
            "max_tokens": getattr(settings, "AI_MAX_OUTPUT_TOKENS", 1200),
        }
        endpoint = self.base_url.rstrip("/") + "/chat/completions"
        api_request = request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=self._headers(),
            method="POST",
        )

        try:
            with request.urlopen(api_request, timeout=timeout_seconds) as response:
                data = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            # Provider bodies/URLs may contain customer data or credentials.
            retryable = exc.code in {408, 429} or exc.code >= 500
            code = "rate_limited" if exc.code == 429 else "provider_unavailable" if retryable else "provider_rejected"
            raise AIProviderError("AI provider could not complete the request.", code=code, retryable=retryable) from None
        except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise AIProviderError("AI provider could not complete the request.") from None

        if not isinstance(data, dict):
            raise AIProviderError("AI provider returned an invalid response.", code="invalid_response", retryable=False)
        choices = data.get("choices") or []
        if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
            raise AIProviderError("AI provider returned an empty response.", code="invalid_response", retryable=False)
        message = choices[0].get("message", {}) if choices else {}
        if not isinstance(message, dict) or choices[0].get("finish_reason") in {"length", "content_filter"}:
            raise AIProviderError("AI provider returned an incomplete response.", code="invalid_response", retryable=False)
        output_text = _message_content_to_text(message.get("content"))
        if not output_text.strip():
            raise AIProviderError("AI provider returned an empty response.", code="invalid_response", retryable=False)
        usage = data.get("usage") or {}
        if not isinstance(usage, dict):
            usage = {}
        tokens = usage.get("total_tokens", 0)
        tokens = tokens if isinstance(tokens, int) and not isinstance(tokens, bool) and tokens >= 0 else 0
        return AIProviderResponse(
            output_text=output_text,
            model=data.get("model") or model,
            tokens_used=tokens,
            is_mock=False,
            provider=self.provider,
        )
