from rest_framework.exceptions import PermissionDenied

from apps.bots.models import BotChannel
from apps.bots.serializers import (
    InstagramChannelConfigSerializer,
    TelegramChannelConfigSerializer,
    TelegramSetWebhookSerializer,
    WhatsAppChannelConfigSerializer,
)
from apps.bots.services import (
    configure_instagram_channel,
    configure_telegram_channel,
    configure_whatsapp_channel,
    instagram_channel_status,
    set_telegram_channel_webhook,
    sync_telegram_channel_updates,
    telegram_channel_status,
    test_instagram_channel_connection,
    test_telegram_channel_connection,
    test_whatsapp_channel_connection,
    whatsapp_channel_status,
)


CHANNEL_ACTION_ERRORS = {
    BotChannel.Channels.TELEGRAM: "This action is only available for Telegram channels.",
    BotChannel.Channels.WHATSAPP: "This action is only available for WhatsApp channels.",
    BotChannel.Channels.INSTAGRAM: "This action is only available for Instagram channels.",
}


def get_provider_channel(viewset, expected_channel):
    channel = viewset.get_object()
    if channel.channel != expected_channel:
        raise PermissionDenied(CHANNEL_ACTION_ERRORS[expected_channel])
    return channel


def configure_telegram_action(viewset, request):
    channel = get_provider_channel(viewset, BotChannel.Channels.TELEGRAM)
    serializer = TelegramChannelConfigSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return configure_telegram_channel(channel, serializer.validated_data)


def set_telegram_webhook_action(viewset, request):
    channel = get_provider_channel(viewset, BotChannel.Channels.TELEGRAM)
    serializer = TelegramSetWebhookSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return set_telegram_channel_webhook(channel, serializer.validated_data["webhook_url"])


def telegram_status_action(viewset, request):
    channel = get_provider_channel(viewset, BotChannel.Channels.TELEGRAM)
    webhook_url = request.build_absolute_uri("/api/integrations/telegram/webhook/")
    return telegram_channel_status(channel, webhook_url)


def test_telegram_connection_action(viewset):
    channel = get_provider_channel(viewset, BotChannel.Channels.TELEGRAM)
    return test_telegram_channel_connection(channel)


def sync_telegram_updates_action(viewset):
    channel = get_provider_channel(viewset, BotChannel.Channels.TELEGRAM)
    return sync_telegram_channel_updates(channel, limit=20)


def configure_whatsapp_action(viewset, request):
    channel = get_provider_channel(viewset, BotChannel.Channels.WHATSAPP)
    serializer = WhatsAppChannelConfigSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return configure_whatsapp_channel(channel, serializer.validated_data)


def test_whatsapp_connection_action(viewset):
    channel = get_provider_channel(viewset, BotChannel.Channels.WHATSAPP)
    return test_whatsapp_channel_connection(channel)


def whatsapp_status_action(viewset, request):
    channel = get_provider_channel(viewset, BotChannel.Channels.WHATSAPP)
    webhook_url = request.build_absolute_uri("/api/integrations/whatsapp/webhook/")
    return whatsapp_channel_status(channel, webhook_url)


def configure_instagram_action(viewset, request):
    channel = get_provider_channel(viewset, BotChannel.Channels.INSTAGRAM)
    serializer = InstagramChannelConfigSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return configure_instagram_channel(channel, serializer.validated_data)


def test_instagram_connection_action(viewset):
    channel = get_provider_channel(viewset, BotChannel.Channels.INSTAGRAM)
    return test_instagram_channel_connection(channel)


def instagram_status_action(viewset, request):
    channel = get_provider_channel(viewset, BotChannel.Channels.INSTAGRAM)
    webhook_url = request.build_absolute_uri("/api/integrations/instagram/webhook/")
    return instagram_channel_status(channel, webhook_url)
