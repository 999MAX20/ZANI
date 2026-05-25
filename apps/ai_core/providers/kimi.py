from django.conf import settings

from apps.ai_core.providers.compatible import OpenAICompatibleProvider


class KimiProvider(OpenAICompatibleProvider):
    provider = "kimi"

    def __init__(self):
        self.api_key = settings.KIMI_API_KEY
        self.base_url = settings.KIMI_BASE_URL
