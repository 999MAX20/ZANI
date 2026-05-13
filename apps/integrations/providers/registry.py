from apps.integrations.providers.mock import MockChannelProvider
from apps.integrations.providers.telegram import TelegramProvider
from apps.integrations.providers.website import WebsiteMockProvider


PROVIDERS = {
    "website": WebsiteMockProvider(),
    "telegram": TelegramProvider(),
    "whatsapp": MockChannelProvider("whatsapp"),
    "instagram": MockChannelProvider("instagram"),
    "email": MockChannelProvider("email"),
}


def get_provider(provider):
    return PROVIDERS[provider]


def send_message(channel, recipient_id, text, payload=None):
    return get_provider(channel.channel).send_message(channel, recipient_id, text, payload or {})


def parse_webhook(provider, payload, headers=None):
    return get_provider(provider).parse_webhook(payload, headers or {})


def verify_webhook(provider, request):
    return get_provider(provider).verify_webhook(request)
