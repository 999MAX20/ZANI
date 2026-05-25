import json
from urllib import error, request

from apps.ai_core.providers.base import AIProviderError, AIProviderResponse, BaseAIProvider


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
            raise AIProviderError(f"{self.provider} API key is not configured.")
        if not self.base_url:
            raise AIProviderError(f"{self.provider} base URL is not configured.")

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
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
            detail = exc.read().decode("utf-8", errors="replace")
            raise AIProviderError(f"{self.provider} request failed with HTTP {exc.code}: {detail[:500]}") from exc
        except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise AIProviderError(f"{self.provider} request failed: {exc}") from exc

        choices = data.get("choices") or []
        message = choices[0].get("message", {}) if choices else {}
        output_text = message.get("content") or ""
        usage = data.get("usage") or {}
        return AIProviderResponse(
            output_text=output_text,
            model=data.get("model") or model,
            tokens_used=usage.get("total_tokens") or 0,
            is_mock=False,
            provider=self.provider,
        )
