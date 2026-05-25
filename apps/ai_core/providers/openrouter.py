from django.conf import settings

from apps.ai_core.providers.compatible import OpenAICompatibleProvider


class OpenRouterProvider(OpenAICompatibleProvider):
    provider = "openrouter"

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL
        self.app_name = settings.OPENROUTER_APP_NAME
        self.site_url = settings.OPENROUTER_SITE_URL
