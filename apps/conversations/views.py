from apps.conversations.models import Conversation, Message, QuickReplyTemplate
from apps.conversations.serializers import ConversationSerializer, MessageSerializer, QuickReplyTemplateSerializer
from apps.core.viewsets import TenantModelViewSet


class ConversationViewSet(TenantModelViewSet):
    queryset = Conversation.objects.select_related("business", "client")
    serializer_class = ConversationSerializer


class MessageViewSet(TenantModelViewSet):
    queryset = Message.objects.select_related("conversation", "conversation__business")
    serializer_class = MessageSerializer
    business_lookup = "conversation__business"


class QuickReplyTemplateViewSet(TenantModelViewSet):
    queryset = QuickReplyTemplate.objects.select_related("business")
    serializer_class = QuickReplyTemplateSerializer
    access_resource = "conversations"

    def get_queryset(self):
        queryset = super().get_queryset()
        channel = self.request.query_params.get("channel")
        active = self.request.query_params.get("is_active")
        search = (self.request.query_params.get("q") or "").strip()
        if channel:
            queryset = queryset.filter(channel__in=["all", channel])
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        if search:
            queryset = queryset.filter(title__icontains=search) | queryset.filter(text__icontains=search)
        return queryset.distinct()
