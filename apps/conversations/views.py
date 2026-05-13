from apps.conversations.models import Conversation, Message
from apps.conversations.serializers import ConversationSerializer, MessageSerializer
from apps.core.viewsets import TenantModelViewSet


class ConversationViewSet(TenantModelViewSet):
    queryset = Conversation.objects.select_related("business", "client")
    serializer_class = ConversationSerializer


class MessageViewSet(TenantModelViewSet):
    queryset = Message.objects.select_related("conversation", "conversation__business")
    serializer_class = MessageSerializer
    business_lookup = "conversation__business"
