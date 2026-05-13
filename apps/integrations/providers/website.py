from apps.integrations.providers.mock import MockChannelProvider


class WebsiteMockProvider(MockChannelProvider):
    def __init__(self):
        super().__init__("website")
