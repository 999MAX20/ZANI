from django.conf import settings

from apps.ai_core.providers.compatible import OpenAICompatibleProvider


class OpenAIProvider(OpenAICompatibleProvider):
    provider = "openai"

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.base_url = settings.OPENAI_BASE_URL
