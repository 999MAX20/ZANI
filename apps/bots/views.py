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
from apps.bots.lifecycle import activate_bot, create_bot, ensure_bot_channel, is_bot_runtime_ready, pause_bot, update_bot, update_bot_channel
from apps.bots.serializers import (
    BotChannelSerializer,
    BotConversationSerializer,
    EnsureBotChannelSerializer,
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
from apps.activities.services import create_activity_event, write_activity_event
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.core.viewsets import TenantModelViewSet
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied
from django.shortcuts import get_object_or_404
from rest_framework.throttling import ScopedRateThrottle
from rest_framework import status


class BotViewSet(TenantModelViewSet):
    queryset = Bot.objects.select_related("business").prefetch_related(
        "channels",
        "agent_profiles",
        "business__knowledge_items",
    )
    serializer_class = BotSerializer
    access_resource = Resources.AI_AUTOMATION
    action_permission_map = {
        **TenantModelViewSet.action_permission_map,
        "activate": Actions.MANAGE,
        "pause": Actions.MANAGE,
        "ensure_channel": Actions.MANAGE,
    }

    def perform_create(self, serializer):
        business = serializer.validated_data["business"]
        assert_entitlement_allows(business, EntitlementMetrics.BOTS)
        self._enforce_business_access(serializer)
        instance = create_bot(validated_data=dict(serializer.validated_data))
        serializer.instance = instance
        write_audit_log(self.request, AuditLog.Actions.CREATE, instance)
        write_activity_event(self.request, "bot.created", instance)

    def perform_update(self, serializer):
        self._enforce_business_access(serializer)
        instance = update_bot(bot=serializer.instance, validated_data=dict(serializer.validated_data))
        serializer.instance = instance
        write_audit_log(self.request, AuditLog.Actions.UPDATE, instance)
        write_activity_event(self.request, "bot.updated", instance)

    def _change_status(self, *, target_status):
        bot = self.get_object()
        assert_can(self.request.user, bot.business, Resources.AI_AUTOMATION, Actions.MANAGE, obj=bot)
        previous_status = bot.status
        if target_status == Bot.Statuses.ACTIVE:
            bot, changed = activate_bot(bot=bot)
        else:
            bot, changed = pause_bot(bot=bot)
        if changed:
            metadata = {
                "kind": "lifecycle",
                "from_status": previous_status,
                "to_status": bot.status,
            }
            write_audit_log(self.request, AuditLog.Actions.UPDATE, bot, metadata=metadata)
            write_activity_event(self.request, "bot.updated", bot, metadata=metadata)
        return Response(self.get_serializer(bot).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        return self._change_status(target_status=Bot.Statuses.ACTIVE)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return self._change_status(target_status=Bot.Statuses.PAUSED)

    @action(detail=True, methods=["post"], url_path="channels/ensure")
    def ensure_channel(self, request, pk=None):
        bot = self.get_object()
        assert_can(request.user, bot.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=bot)
        input_serializer = EnsureBotChannelSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        channel, created = ensure_bot_channel(
            bot=bot,
            channel_type=input_serializer.validated_data["channel"],
        )
        if created:
            write_audit_log(
                request,
                AuditLog.Actions.CREATE,
                channel,
                business=bot.business,
                metadata={"kind": "bot_channel_ensured", "bot_id": bot.id},
            )
            create_activity_event(
                business=bot.business,
                event_type="botchannel.created",
                instance=channel,
                actor=request.user,
                source="api",
            )
        return Response(
            BotChannelSerializer(channel, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class BotChannelViewSet(TenantModelViewSet):
    queryset = BotChannel.objects.select_related("bot", "bot__business")
    serializer_class = BotChannelSerializer
    business_lookup = "bot__business"

    manage_actions = {
        "telegram_config",
        "set_telegram_webhook",
        "telegram_test_connection",
        "sync_telegram_updates",
        "whatsapp_config",
        "whatsapp_test_connection",
        "instagram_config",
        "instagram_test_connection",
    }

    def get_object(self):
        channel = super().get_object()
        if self.action in self.manage_actions:
            assert_can(
                self.request.user,
                channel.bot.business,
                Resources.INTEGRATIONS,
                Actions.MANAGE,
                obj=channel,
            )
        return channel

    def perform_update(self, serializer):
        self._enforce_business_access(serializer)
        channel = update_bot_channel(channel=serializer.instance, validated_data=dict(serializer.validated_data))
        serializer.instance = channel
        write_audit_log(
            self.request,
            AuditLog.Actions.UPDATE,
            channel,
            business=channel.bot.business,
        )
        create_activity_event(
            business=channel.bot.business,
            event_type="botchannel.updated",
            instance=channel,
            actor=self.request.user,
            source="api",
        )

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
    http_method_names = ["get", "post", "head", "options"]

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST", detail="Conversations are created by channel services.")

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
        result, log, message_context, sources = suggest_bot_reply(conversation=conversation, user=request.user)
        return Response(
            {
                "suggested_reply": result.output_text,
                "is_mock": result.is_mock,
                "model": result.model,
                "tokens_used": result.tokens_used,
                "log_id": log.id,
                "messages_used": len(message_context),
                "provider": result.provider,
                "provider_state": "mock" if result.is_mock else "live",
                "sources": sources,
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
    if channel.status != BotChannel.Statuses.ACTIVE or not is_bot_runtime_ready(channel.bot):
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
