from rest_framework import serializers

from apps.conversations.models import Conversation, Message, QuickReplyTemplate


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = [
            "id",
            "business",
            "client",
            "channel",
            "external_chat_id",
            "status",
            "close_reason",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "archived_at", "archived_by"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        if client and business and client.business_id != business.id:
            raise serializers.ValidationError("Client must belong to the selected business.")
        return attrs


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender_type",
            "text",
            "raw_payload",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class QuickReplyTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuickReplyTemplate
        fields = [
            "id",
            "business",
            "title",
            "text",
            "category",
            "channel",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
