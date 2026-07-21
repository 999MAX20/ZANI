from apps.bots.ai import suggest_bot_reply
from apps.bots.channel_actions import (
    configure_instagram_action,
    configure_telegram_action,
    configure_whatsapp_action,
    instagram_status_action,
    set_telegram_webhook_action,
    sync_telegram_updates_action,
    telegram_status_action,
    test_instagram_connection_action,
    test_telegram_connection_action,
    test_whatsapp_connection_action,
    whatsapp_status_action,
)
from apps.bots.models import Bot, BotChannel, BotConversation, BotMessage
from apps.bots.serializers import (
    BotChannelSerializer,
    BotConversationSerializer,
    BotMessageSerializer,
    BotSerializer,
    PublicWebsiteChatChannelSerializer,
    PublicWebsiteChatConversationCreateSerializer,
    PublicWebsiteChatMessageCreateSerializer,
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
from rest_framework.throttling import ScopedRateThrottle


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

    @action(detail=True, methods=["post"], url_path="telegram-config")
    def telegram_config(self, request, pk=None):
        return Response(configure_telegram_action(self, request))

    @action(detail=True, methods=["post"], url_path="set-telegram-webhook")
    def set_telegram_webhook(self, request, pk=None):
        return Response(set_telegram_webhook_action(self, request))

    @action(detail=True, methods=["get"], url_path="telegram-status")
    def telegram_status(self, request, pk=None):
        return Response(telegram_status_action(self, request))

    @action(detail=True, methods=["post"], url_path="telegram-test-connection")
    def telegram_test_connection(self, request, pk=None):
        return Response(test_telegram_connection_action(self))

    @action(detail=True, methods=["post"], url_path="sync-telegram-updates")
    def sync_telegram_updates(self, request, pk=None):
        return Response(sync_telegram_updates_action(self))

    @action(detail=True, methods=["post"], url_path="whatsapp-config")
    def whatsapp_config(self, request, pk=None):
        return Response(configure_whatsapp_action(self, request))

    @action(detail=True, methods=["post"], url_path="whatsapp-test-connection")
    def whatsapp_test_connection(self, request, pk=None):
        return Response(test_whatsapp_connection_action(self))

    @action(detail=True, methods=["get"], url_path="whatsapp-status")
    def whatsapp_status(self, request, pk=None):
        return Response(whatsapp_status_action(self, request))

    @action(detail=True, methods=["post"], url_path="instagram-config")
    def instagram_config(self, request, pk=None):
        return Response(configure_instagram_action(self, request))

    @action(detail=True, methods=["post"], url_path="instagram-test-connection")
    def instagram_test_connection(self, request, pk=None):
        return Response(test_instagram_connection_action(self))

    @action(detail=True, methods=["get"], url_path="instagram-status")
    def instagram_status(self, request, pk=None):
        return Response(instagram_status_action(self, request))


class BotConversationViewSet(TenantModelViewSet):
    queryset = BotConversation.objects.select_related("business", "bot", "client", "lead")
    serializer_class = BotConversationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        client_ids = self.parse_query_id_list("client_ids")
        if client_ids:
            queryset = queryset.filter(client_id__in=client_ids)
        return queryset

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
