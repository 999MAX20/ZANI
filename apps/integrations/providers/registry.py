from apps.integrations.providers.mock import MockChannelProvider
from apps.integrations.providers.instagram import InstagramProvider
from apps.integrations.providers.telegram import TelegramProvider
from apps.integrations.providers.website import WebsiteMockProvider
from apps.integrations.providers.whatsapp import WhatsAppProvider


PROVIDERS = {
    "website": WebsiteMockProvider(),
    "telegram": TelegramProvider(),
    "whatsapp": WhatsAppProvider(),
    "instagram": InstagramProvider(),
    "email": MockChannelProvider("email"),
}

# Only code-reviewed accounting adapters may supply locally persisted, verified
# financial snapshots. Existing messaging/order/import providers do not qualify.
# Tests patch this registry in isolation; no production mock is registered.
FINANCIAL_SOURCE_READERS = {}


def get_financial_source_reader(provider):
    return FINANCIAL_SOURCE_READERS.get(provider)


class UnknownIntegrationProvider(ValueError):
    pass


def registered_providers():
    return sorted(PROVIDERS.keys())


def get_provider(provider):
    if provider not in PROVIDERS:
        raise UnknownIntegrationProvider(f"Unknown integration provider: {provider}")
    return PROVIDERS[provider]


def send_message(channel, recipient_id, text, payload=None):
    return get_provider(channel.channel).send_message(channel, recipient_id, text, payload or {})


def parse_webhook(provider, payload, headers=None):
    return get_provider(provider).parse_webhook(payload, headers or {})


def verify_webhook(provider, request):
    return get_provider(provider).verify_webhook(request)
