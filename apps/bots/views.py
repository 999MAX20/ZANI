from apps.bots.ai import suggest_bot_reply
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.bots.serializers import (
    BotChannelSerializer,
    BotConversationSerializer,
    BotMessageSerializer,
    BotSerializer,
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
from apps.core.viewsets import TenantModelViewSet
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from rest_framework.throttling import ScopedRateThrottle
from apps.integrations.models import IntegrationEventLog
from apps.integrations.telegram import set_telegram_webhook, validate_telegram_token


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

    @action(detail=True, methods=["post"], url_path="telegram-config")
    def telegram_config(self, request, pk=None):
        channel = self._get_telegram_channel()
        serializer = TelegramChannelConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = dict(channel.config_json or {})
        if "bot_token" in serializer.validated_data:
            config["bot_token"] = serializer.validated_data["bot_token"]
        if "webhook_secret" in serializer.validated_data:
            config["webhook_secret"] = serializer.validated_data["webhook_secret"]
        channel.config_json = config
        channel.status = BotChannel.Statuses.ACTIVE if config.get("bot_token") else channel.status
        channel.save(update_fields=["config_json", "status", "updated_at"])
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
        return Response(
            {
                "status": channel.status,
                "token_configured": bool((channel.config_json or {}).get("bot_token")),
                "webhook_secret_configured": bool((channel.config_json or {}).get("webhook_secret")),
                "last_error": failed_event.error if failed_event else "",
            }
        )

    @action(detail=True, methods=["post"], url_path="telegram-test-connection")
    def telegram_test_connection(self, request, pk=None):
        channel = self._get_telegram_channel()
        result = validate_telegram_token(channel)
        channel.status = BotChannel.Statuses.ACTIVE if result.get("ok") else BotChannel.Statuses.ERROR
        channel.save(update_fields=["status", "updated_at"])
        return Response(
            {
                "ok": result.get("ok", False),
                "mock": result.get("mock", False),
                "reason": result.get("reason", ""),
                "status": channel.status,
                "token_configured": result.get("token_configured", False),
                "bot": result.get("bot", {}),
            }
        )

    @action(detail=True, methods=["post"], url_path="whatsapp-config")
    def whatsapp_config(self, request, pk=None):
        channel = self._get_whatsapp_channel()
        serializer = WhatsAppChannelConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = dict(channel.config_json or {})
        for key, value in serializer.validated_data.items():
            config[key] = value
        if not config.get("provider_mode"):
            config["provider_mode"] = "mock"
        channel.config_json = config
        channel.external_id = config.get("phone_number_id", channel.external_id)
        channel.status = BotChannel.Statuses.PAUSED if config.get("provider_mode") == "disabled" else BotChannel.Statuses.ACTIVE
        channel.save(update_fields=["config_json", "external_id", "status", "updated_at"])
        return Response(
            {
                "ok": True,
                "provider_mode": config["provider_mode"],
                "status": channel.status,
                "phone_number_id_configured": bool(config.get("phone_number_id") or channel.external_id),
                "webhook_secret_configured": bool(config.get("webhook_secret")),
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
                "webhook_secret_configured": bool(config.get("webhook_secret")),
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
