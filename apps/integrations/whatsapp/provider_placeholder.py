from apps.integrations.providers.whatsapp import (
    WhatsAppDialog360PlaceholderAdapter,
    WhatsAppMetaPlaceholderAdapter,
    WhatsAppQrPilotPlaceholderAdapter,
    WhatsAppTwilioPlaceholderAdapter,
)


AVAILABLE_WHATSAPP_PLACEHOLDERS = {
    "meta_cloud": WhatsAppMetaPlaceholderAdapter,
    "twilio": WhatsAppTwilioPlaceholderAdapter,
    "360dialog": WhatsAppDialog360PlaceholderAdapter,
    "qr_pilot": WhatsAppQrPilotPlaceholderAdapter,
}
