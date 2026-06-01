import secrets
import ipaddress
from urllib.parse import urlparse

from django.conf import settings
from apps.bots.ai import suggest_bot_reply
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.bots.serializers import (
    BotChannelSerializer,
    BotConversationSerializer,
    BotMessageSerializer,
    BotSerializer,
    InstagramChannelConfigSerializer,
    PublicWebsiteChatChannelSerializer,
    PublicWebsiteChatConversationCreateSerializer,
    PublicWebsiteChatMessageCreateSerializer,
    TelegramChannelConfigSerializer,
    TelegramSetWebhookSerializer,
    WhatsAppChannelConfigSerializer,
)
from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.businesses.access import Actions, Resources, assert_can
from apps.core.viewsets import TenantModelViewSet
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.throttling import ScopedRateThrottle
from apps.integrations.models import BusinessConnector, IntegrationEventLog
from apps.integrations.providers import get_provider
from apps.integrations.telegram import set_telegram_webhook, sync_telegram_updates as pull_telegram_updates, validate_telegram_token


def is_public_https_url(url):
    parsed = urlparse(url or "")
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    hostname = parsed.hostname.lower()
    if hostname in {"localhost", "127.0.0.1", "0.0.0.0"} or hostname.endswith(".local"):
        return False
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return True
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)


def sync_telegram_connector(channel, status=None, last_error="", operation="config"):
    config = channel.config_json or {}
    connector_status = status or (
        BusinessConnector.Statuses.NEEDS_ATTENTION if config.get("bot_token") else BusinessConnector.Statuses.DRAFT
    )
    connector, _ = BusinessConnector.objects.get_or_create(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.TELEGRAM,
        name="Telegram",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.TOKEN,
            "status": connector_status,
        },
    )
    safe_config = dict(connector.config_json or {})
    safe_config.update(
        {
            "bot_channel_id": channel.id,
            "token_configured": bool(config.get("bot_token")),
            "webhook_secret_configured": bool(config.get("webhook_secret")),
            "webhook_configured": bool(config.get("webhook_configured")),
            "last_operation": operation,
        }
    )
    connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
    connector.auth_type = BusinessConnector.AuthTypes.TOKEN
    connector.status = connector_status
    connector.config_json = safe_config
    connector.last_error = last_error
    if connector_status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    connector.save(
        update_fields=[
            "capability",
            "auth_type",
            "status",
            "config_json",
            "last_error",
            "connected_at",
            "updated_at",
        ]
    )
    return connector


def sync_whatsapp_connector(channel, status=None, last_error="", operation="config"):
    config = channel.config_json or {}
    credentials_configured = bool((config.get("phone_number_id") or channel.external_id) and config.get("access_token"))
    connector_status = status or (
        BusinessConnector.Statuses.CONNECTED if credentials_configured else BusinessConnector.Statuses.NEEDS_ATTENTION
    )
    connector, _ = BusinessConnector.objects.get_or_create(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.WHATSAPP,
        name="WhatsApp",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.TOKEN,
            "status": connector_status,
        },
    )
    safe_config = dict(connector.config_json or {})
    safe_config.update(
        {
            "bot_channel_id": channel.id,
            "provider_mode": config.get("provider_mode") or "mock",
            "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
            "access_token_configured": bool(config.get("access_token")),
            "business_account_id_configured": bool(config.get("business_account_id")),
            "last_operation": operation,
        }
    )
    connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
    connector.auth_type = BusinessConnector.AuthTypes.TOKEN
    connector.status = connector_status
    connector.config_json = safe_config
    connector.last_error = last_error
    if connector_status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])
    return connector


def sync_instagram_connector(channel, status=None, last_error="", operation="config"):
    config = channel.config_json or {}
    credentials_configured = bool((config.get("instagram_user_id") or channel.external_id) and config.get("access_token"))
    connector_status = status or (
        BusinessConnector.Statuses.CONNECTED if credentials_configured else BusinessConnector.Statuses.NEEDS_ATTENTION
    )
    connector, _ = BusinessConnector.objects.get_or_create(
        business=channel.bot.business,
        provider=BusinessConnector.Providers.INSTAGRAM,
        name="Instagram",
        defaults={
            "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
            "auth_type": BusinessConnector.AuthTypes.OAUTH,
            "status": connector_status,
        },
    )
    safe_config = dict(connector.config_json or {})
    safe_config.update(
        {
            "bot_channel_id": channel.id,
            "provider_mode": config.get("provider_mode") or "mock",
            "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
            "access_token_configured": bool(config.get("access_token")),
            "page_id_configured": bool(config.get("page_id")),
            "last_operation": operation,
        }
    )
    connector.capability = BusinessConnector.Capabilities.COMMUNICATIONS
    connector.auth_type = BusinessConnector.AuthTypes.OAUTH
    connector.status = connector_status
    connector.config_json = safe_config
    connector.last_error = last_error
    if connector_status == BusinessConnector.Statuses.CONNECTED and connector.connected_at is None:
        connector.connected_at = timezone.now()
    connector.save(update_fields=["capability", "auth_type", "status", "config_json", "last_error", "connected_at", "updated_at"])
    return connector


class BotViewSet(TenantModelViewSet):
    queryset = Bot.objects.select_related("business")
    serializer_class = BotSerializer

    def perform_create(self, serializer):
        business = serializer.validated_data["business"]
        assert_entitlement_allows(business, EntitlementMetrics.BOTS)
        super().perform_create(serializer)


class BotChannelViewSet(TenantModelViewSet):
    queryset = BotChannel.objects.select_related("bot", "bot__business")
    serializer_class = BotChannelSerializer
    business_lookup = "bot__business"

    def _get_telegram_channel(self):
        channel = self.get_object()
        if channel.channel != BotChannel.Channels.TELEGRAM:
            raise PermissionDenied("This action is only available for Telegram channels.")
        return channel

    def _get_whatsapp_channel(self):
        channel = self.get_object()
        if channel.channel != BotChannel.Channels.WHATSAPP:
            raise PermissionDenied("This action is only available for WhatsApp channels.")
        return channel

    def _get_instagram_channel(self):
        channel = self.get_object()
        if channel.channel != BotChannel.Channels.INSTAGRAM:
            raise PermissionDenied("This action is only available for Instagram channels.")
        return channel

    @action(detail=True, methods=["post"], url_path="telegram-config")
    def telegram_config(self, request, pk=None):
        channel = self._get_telegram_channel()
        serializer = TelegramChannelConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = dict(channel.config_json or {})
        if "bot_token" in serializer.validated_data:
            config["bot_token"] = serializer.validated_data["bot_token"]
            config["token_verified"] = False
            config.pop("bot_username", None)
        if "webhook_secret" in serializer.validated_data:
            config["webhook_secret"] = serializer.validated_data["webhook_secret"]
        if config.get("bot_token") and not config.get("webhook_secret"):
            config["webhook_secret"] = secrets.token_urlsafe(32)
        channel.config_json = config
        channel.status = BotChannel.Statuses.ACTIVE if config.get("bot_token") else channel.status
        channel.save(update_fields=["config_json", "status", "updated_at"])
        sync_telegram_connector(channel, operation="config")
        return Response(
            {
                "ok": True,
                "token_configured": bool(config.get("bot_token")),
                "webhook_secret_configured": bool(config.get("webhook_secret")),
                "status": channel.status,
            }
        )

    @action(detail=True, methods=["post"], url_path="set-telegram-webhook")
    def set_telegram_webhook(self, request, pk=None):
        channel = self._get_telegram_channel()
        serializer = TelegramSetWebhookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = set_telegram_webhook(channel, serializer.validated_data["webhook_url"])
        connector_status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        if result.get("ok"):
            config = dict(channel.config_json or {})
            config["webhook_configured"] = True
            channel.config_json = config
            channel.save(update_fields=["config_json", "updated_at"])
        sync_telegram_connector(
            channel,
            status=connector_status,
            last_error="" if result.get("ok") else result.get("reason", "Telegram webhook setup failed."),
            operation="set_webhook",
        )
        return Response(result)

    @action(detail=True, methods=["get"], url_path="telegram-status")
    def telegram_status(self, request, pk=None):
        channel = self._get_telegram_channel()
        failed_event = IntegrationEventLog.objects.filter(
            business=channel.bot.business,
            provider=BotChannel.Channels.TELEGRAM,
            channel=BotChannel.Channels.TELEGRAM,
            status=IntegrationEventLog.Statuses.FAILED,
        ).first()
        last_inbound_event = IntegrationEventLog.objects.filter(
            business=channel.bot.business,
            provider=BotChannel.Channels.TELEGRAM,
            channel=BotChannel.Channels.TELEGRAM,
            direction=IntegrationEventLog.Directions.INBOUND,
        ).first()
        last_outbound_event = IntegrationEventLog.objects.filter(
            business=channel.bot.business,
            provider=BotChannel.Channels.TELEGRAM,
            channel=BotChannel.Channels.TELEGRAM,
            direction=IntegrationEventLog.Directions.OUTBOUND,
        ).first()
        config = channel.config_json or {}
        webhook_url = request.build_absolute_uri("/api/integrations/telegram/webhook/")
        inbound_backend_ready = bool(last_inbound_event and last_inbound_event.status == IntegrationEventLog.Statuses.PROCESSED)
        webhook_public_ready = is_public_https_url(webhook_url)
        return Response(
            {
                "status": channel.status,
                "token_configured": bool(config.get("bot_token")),
                "token_verified": bool(config.get("token_verified")),
                "bot_username": config.get("bot_username", ""),
                "webhook_secret_configured": bool(config.get("webhook_secret")),
                "webhook_configured": bool(config.get("webhook_configured")),
                "webhook_url": webhook_url,
                "webhook_public_ready": webhook_public_ready,
                "inbound_backend_ready": inbound_backend_ready,
                "inbound_ready": bool(config.get("webhook_configured") and webhook_public_ready and inbound_backend_ready),
                "last_error": failed_event.error if failed_event else "",
                "last_inbound_status": last_inbound_event.status if last_inbound_event else "",
                "last_inbound_at": last_inbound_event.created_at if last_inbound_event else None,
                "last_outbound_status": last_outbound_event.status if last_outbound_event else "",
                "last_outbound_at": last_outbound_event.created_at if last_outbound_event else None,
            }
        )

    @action(detail=True, methods=["post"], url_path="telegram-test-connection")
    def telegram_test_connection(self, request, pk=None):
        channel = self._get_telegram_channel()
        result = validate_telegram_token(channel)
        channel.status = BotChannel.Statuses.ACTIVE if result.get("ok") else BotChannel.Statuses.ERROR
        config = dict(channel.config_json or {})
        config["token_verified"] = bool(result.get("ok"))
        if result.get("ok") and result.get("bot", {}).get("username"):
            config["bot_username"] = result["bot"]["username"]
        channel.config_json = config
        channel.save(update_fields=["config_json", "status", "updated_at"])
        connector_status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        sync_telegram_connector(
            channel,
            status=connector_status,
            last_error="" if result.get("ok") else result.get("reason", "Telegram token validation failed."),
            operation="test_connection",
        )
        return Response(
            {
                "ok": result.get("ok", False),
                "reason": result.get("reason", ""),
                "status": channel.status,
                "token_configured": result.get("token_configured", False),
                "bot": result.get("bot", {}),
            }
        )

    @action(detail=True, methods=["post"], url_path="sync-telegram-updates")
    def sync_telegram_updates(self, request, pk=None):
        channel = self._get_telegram_channel()
        result = pull_telegram_updates(channel, limit=20)
        sync_telegram_connector(
            channel,
            status=BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED,
            last_error="" if result.get("ok") else result.get("reason", "Telegram updates sync failed."),
            operation="sync_updates",
        )
        return Response(result)

    @action(detail=True, methods=["post"], url_path="whatsapp-config")
    def whatsapp_config(self, request, pk=None):
        channel = self._get_whatsapp_channel()
        serializer = WhatsAppChannelConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = dict(channel.config_json or {})
        for key, value in serializer.validated_data.items():
            config[key] = value
        if not config.get("provider_mode"):
            config["provider_mode"] = "meta_cloud" if config.get("access_token") and config.get("phone_number_id") else "mock"
        channel.config_json = config
        channel.external_id = config.get("phone_number_id", channel.external_id)
        channel.status = BotChannel.Statuses.PAUSED if config.get("provider_mode") == "disabled" else BotChannel.Statuses.ACTIVE
        channel.save(update_fields=["config_json", "external_id", "status", "updated_at"])
        sync_whatsapp_connector(channel, operation="config")
        return Response(
            {
                "ok": True,
                "provider_mode": config["provider_mode"],
                "status": channel.status,
                "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
                "access_token_configured": bool(config.get("access_token")),
                "webhook_secret_configured": bool(config.get("webhook_secret")),
            }
        )

    @action(detail=True, methods=["post"], url_path="whatsapp-test-connection")
    def whatsapp_test_connection(self, request, pk=None):
        channel = self._get_whatsapp_channel()
        result = get_provider(BotChannel.Channels.WHATSAPP).validate_credentials(channel)
        channel.status = BotChannel.Statuses.ACTIVE if result.get("ok") else BotChannel.Statuses.ERROR
        channel.save(update_fields=["status", "updated_at"])
        connector_status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        sync_whatsapp_connector(
            channel,
            status=connector_status,
            last_error="" if result.get("ok") else result.get("reason", "WhatsApp credentials validation failed."),
            operation="test_connection",
        )
        config = channel.config_json or {}
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "status": channel.status,
                "provider_mode": config.get("provider_mode") or "mock",
                "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
                "access_token_configured": bool(config.get("access_token")),
                "phone_number": result.get("phone_number", {}),
            }
        )

    @action(detail=True, methods=["get"], url_path="whatsapp-status")
    def whatsapp_status(self, request, pk=None):
        channel = self._get_whatsapp_channel()
        failed_event = IntegrationEventLog.objects.filter(
            business=channel.bot.business,
            provider=BotChannel.Channels.WHATSAPP,
            channel=BotChannel.Channels.WHATSAPP,
            status=IntegrationEventLog.Statuses.FAILED,
        ).first()
        last_event = IntegrationEventLog.objects.filter(
            business=channel.bot.business,
            provider=BotChannel.Channels.WHATSAPP,
            channel=BotChannel.Channels.WHATSAPP,
        ).first()
        webhook_url = request.build_absolute_uri("/api/integrations/whatsapp/webhook/")
        config = channel.config_json or {}
        return Response(
            {
                "status": channel.status,
                "provider_mode": config.get("provider_mode") or "mock",
                "webhook_url": webhook_url,
                "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
                "access_token_configured": bool(config.get("access_token")),
                "business_account_id_configured": bool(config.get("business_account_id")),
                "webhook_secret_configured": bool(config.get("webhook_secret")),
                "verify_token_configured": bool(settings.WHATSAPP_VERIFY_TOKEN),
                "app_secret_configured": bool(settings.WHATSAPP_APP_SECRET),
                "last_error": failed_event.error if failed_event else "",
                "last_event_status": last_event.status if last_event else "",
                "last_event_at": last_event.created_at if last_event else None,
            }
        )

    @action(detail=True, methods=["post"], url_path="instagram-config")
    def instagram_config(self, request, pk=None):
        channel = self._get_instagram_channel()
        serializer = InstagramChannelConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = dict(channel.config_json or {})
        for key, value in serializer.validated_data.items():
            config[key] = value
        if not config.get("provider_mode"):
            config["provider_mode"] = "meta_graph" if config.get("access_token") and config.get("instagram_user_id") else "mock"
        channel.config_json = config
        channel.external_id = config.get("instagram_user_id", channel.external_id)
        channel.status = BotChannel.Statuses.PAUSED if config.get("provider_mode") == "disabled" else BotChannel.Statuses.ACTIVE
        channel.save(update_fields=["config_json", "external_id", "status", "updated_at"])
        sync_instagram_connector(channel, operation="config")
        return Response(
            {
                "ok": True,
                "provider_mode": config["provider_mode"],
                "status": channel.status,
                "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
                "access_token_configured": bool(config.get("access_token")),
                "page_id_configured": bool(config.get("page_id")),
            }
        )

    @action(detail=True, methods=["post"], url_path="instagram-test-connection")
    def instagram_test_connection(self, request, pk=None):
        channel = self._get_instagram_channel()
        result = get_provider(BotChannel.Channels.INSTAGRAM).validate_credentials(channel)
        channel.status = BotChannel.Statuses.ACTIVE if result.get("ok") else BotChannel.Statuses.ERROR
        channel.save(update_fields=["status", "updated_at"])
        connector_status = BusinessConnector.Statuses.CONNECTED if result.get("ok") else BusinessConnector.Statuses.FAILED
        sync_instagram_connector(
            channel,
            status=connector_status,
            last_error="" if result.get("ok") else result.get("reason", "Instagram credentials validation failed."),
            operation="test_connection",
        )
        config = channel.config_json or {}
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "status": channel.status,
                "provider_mode": config.get("provider_mode") or "mock",
                "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
                "access_token_configured": bool(config.get("access_token")),
                "instagram_account": result.get("instagram_account", {}),
            }
        )

    @action(detail=True, methods=["get"], url_path="instagram-status")
    def instagram_status(self, request, pk=None):
        channel = self._get_instagram_channel()
        failed_event = IntegrationEventLog.objects.filter(
            business=channel.bot.business,
            provider=BotChannel.Channels.INSTAGRAM,
            channel=BotChannel.Channels.INSTAGRAM,
            status=IntegrationEventLog.Statuses.FAILED,
        ).first()
        last_event = IntegrationEventLog.objects.filter(
            business=channel.bot.business,
            provider=BotChannel.Channels.INSTAGRAM,
            channel=BotChannel.Channels.INSTAGRAM,
        ).first()
        webhook_url = request.build_absolute_uri("/api/integrations/instagram/webhook/")
        config = channel.config_json or {}
        return Response(
            {
                "status": channel.status,
                "provider_mode": config.get("provider_mode") or "mock",
                "webhook_url": webhook_url,
                "instagram_user_id_configured": bool(config.get("instagram_user_id") or channel.external_id),
                "access_token_configured": bool(config.get("access_token")),
                "page_id_configured": bool(config.get("page_id")),
                "verify_token_configured": bool(settings.INSTAGRAM_VERIFY_TOKEN),
                "app_secret_configured": bool(settings.INSTAGRAM_APP_SECRET or settings.META_APP_SECRET),
                "last_error": failed_event.error if failed_event else "",
                "last_event_status": last_event.status if last_event else "",
                "last_event_at": last_event.created_at if last_event else None,
            }
        )


class BotConversationViewSet(TenantModelViewSet):
    queryset = BotConversation.objects.select_related("business", "bot", "client", "lead")
    serializer_class = BotConversationSerializer

    @action(detail=True, methods=["post"], url_path="suggest-reply")
    def suggest_reply(self, request, pk=None):
        conversation = self.get_object()
        assert_can(request.user, conversation.business, Resources.AI_ASSISTANT, Actions.SUGGEST, obj=conversation)
        result, log, message_context = suggest_bot_reply(conversation=conversation, user=request.user)
        return Response(
            {
                "suggested_reply": result.output_text,
                "is_mock": result.is_mock,
                "model": result.model,
                "tokens_used": result.tokens_used,
                "log_id": log.id,
                "messages_used": len(message_context),
            }
        )


class BotMessageViewSet(TenantModelViewSet):
    queryset = BotMessage.objects.select_related("conversation", "conversation__business", "conversation__bot")
    serializer_class = BotMessageSerializer
    business_lookup = "conversation__business"

    def perform_create(self, serializer):
        super().perform_create(serializer)
        message = serializer.instance
        if message.direction == BotMessage.Directions.INBOUND:
            run_automations_for_event(
                business=message.conversation.business,
                trigger_type=AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
                entity=message.conversation,
                payload={
                    "trigger_type": AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
                    "conversation_id": message.conversation_id,
                    "message_id": message.id,
                    "text": message.text,
                },
            )


def get_public_website_channel(public_token):
    channel = get_object_or_404(
        BotChannel.objects.select_related("bot", "bot__business"),
        public_token=public_token,
        channel=BotChannel.Channels.WEBSITE,
    )
    if channel.status not in [BotChannel.Statuses.DRAFT, BotChannel.Statuses.ACTIVE] or channel.bot.status == Bot.Statuses.PAUSED:
        raise PermissionDenied("This website chat channel is not available.")
    return channel


class PublicWebsiteChatChannelView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_widget"

    def get(self, request, public_token):
        channel = get_public_website_channel(public_token)
        return Response(PublicWebsiteChatChannelSerializer(channel).data)


class PublicWebsiteChatConversationCreateView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_widget"

    def post(self, request, public_token):
        channel = get_public_website_channel(public_token)
        serializer = PublicWebsiteChatConversationCreateSerializer(data=request.data, context={"channel": channel})
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        conversation = result["conversation"]
        message = result["message"]
        lead = result["lead"]
        client = result["client"]
        run_automations_for_event(
            business=conversation.business,
            trigger_type=AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
            entity=conversation,
            payload={
                "trigger_type": AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
                "conversation_id": conversation.id,
                "message_id": message.id,
                "text": message.text,
            },
        )
        return Response(
            {
                "conversation_id": str(conversation.public_id),
                "message_id": message.id,
                "lead_id": lead.id if lead else None,
                "client_id": client.id if client else None,
                "status": conversation.status,
            },
            status=201,
        )


class PublicWebsiteChatMessageCreateView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_widget"

    def post(self, request, public_token, conversation_id):
        channel = get_public_website_channel(public_token)
        conversation = get_object_or_404(
            BotConversation.objects.select_related("business", "bot"),
            public_id=conversation_id,
            bot=channel.bot,
            channel=BotConversation.Channels.WEBSITE,
        )
        serializer = PublicWebsiteChatMessageCreateSerializer(data=request.data, context={"conversation": conversation})
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        run_automations_for_event(
            business=message.conversation.business,
            trigger_type=AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
            entity=message.conversation,
            payload={
                "trigger_type": AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
                "conversation_id": message.conversation_id,
                "message_id": message.id,
                "text": message.text,
            },
        )
        return Response(
            {
                "conversation_id": str(conversation.public_id),
                "message_id": message.id,
                "status": message.status,
            },
            status=201,
        )
