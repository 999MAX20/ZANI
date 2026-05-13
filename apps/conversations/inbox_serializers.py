from rest_framework import serializers

from apps.bots.models import BotConversation, BotMessage


class InboxMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotMessage
        fields = [
            "id",
            "conversation",
            "direction",
            "sender_type",
            "text",
            "external_message_id",
            "payload_json",
            "error_text",
            "status",
            "sent_at",
            "delivered_at",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields


class InboxConversationSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    bot_name = serializers.CharField(source="bot.name", read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    client_phone = serializers.CharField(source="client.phone", read_only=True)
    assigned_to_email = serializers.CharField(source="assigned_to.email", read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = BotConversation
        fields = [
            "id",
            "public_id",
            "business",
            "business_name",
            "bot",
            "bot_name",
            "channel",
            "external_user_id",
            "external_thread_id",
            "client",
            "client_name",
            "client_phone",
            "lead",
            "assigned_to",
            "assigned_to_email",
            "status",
            "priority",
            "bot_enabled",
            "handoff_required",
            "handoff_reason",
            "last_message_at",
            "last_inbound_at",
            "last_outbound_at",
            "unread_count",
            "metadata_json",
            "last_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_last_message(self, obj):
        message = getattr(obj, "_prefetched_last_message", None) or obj.messages.order_by("-created_at").first()
        if message is None:
            return None
        return {
            "id": message.id,
            "direction": message.direction,
            "sender_type": message.sender_type,
            "text": message.text,
            "status": message.status,
            "created_at": message.created_at,
        }


class InboxAssignSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False, allow_null=True)


class InboxHandoffSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class InboxOutboundMessageSerializer(serializers.Serializer):
    text = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    sender_type = serializers.ChoiceField(choices=["manager"], default="manager")


class InboxCreateTaskSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(choices=["low", "normal", "high", "urgent"], default="normal")
    due_at = serializers.DateTimeField(required=False, allow_null=True)


class InboxLinkLeadSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField(required=True)


class InboxCreateLeadSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True)
