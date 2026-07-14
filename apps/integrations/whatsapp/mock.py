from apps.integrations.providers.whatsapp import WhatsAppProvider


class WhatsAppMockProvider(WhatsAppProvider):
    adapter = "mock"
