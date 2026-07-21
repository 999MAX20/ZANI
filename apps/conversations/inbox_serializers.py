from rest_framework import serializers

from apps.bots.models import BotConversation, BotMessage
from apps.core.models import FileAttachment
from apps.core.serializers import FileAttachmentSerializer
from apps.integrations.sanitization import sanitize_config


def _attachments_for(serializer, obj, entity_type):
    cache_key = f"attachment_map:{entity_type}"
    attachment_map = serializer.context.get(cache_key)
    if attachment_map is None:
        parent_instance = getattr(serializer.parent, "instance", None)
        instances = list(parent_instance) if parent_instance is not None and not isinstance(parent_instance, (str, bytes)) else [obj]
        entity_ids = [str(instance.id) for instance in instances]
        business_ids = {
            getattr(instance, "business_id", None) or getattr(getattr(instance, "conversation", None), "business_id", None)
            for instance in instances
        }
        attachments = FileAttachment.objects.filter(
            business_id__in={business_id for business_id in business_ids if business_id},
            entity_type=entity_type,
            entity_id__in=entity_ids,
        )
        attachment_map = {}
        for attachment in attachments:
            attachment_map.setdefault((attachment.business_id, attachment.entity_id), []).append(attachment)
        serializer.context[cache_key] = attachment_map
    business_id = getattr(obj, "business_id", None) or obj.conversation.business_id
    return attachment_map.get((business_id, str(obj.id)), [])


class InboxMessageSerializer(serializers.ModelSerializer):
    attachments = serializers.SerializerMethodField()

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
            "attachments",
        ]
        read_only_fields = fields

    def get_attachments(self, obj):
        attachments = _attachments_for(self, obj, "bot_message")
        return FileAttachmentSerializer(attachments, many=True, context=self.context).data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["payload_json"] = sanitize_config(data.get("payload_json") or {})
        return data


class InboxConversationSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    bot_name = serializers.CharField(source="bot.name", read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    client_phone = serializers.CharField(source="client.phone", read_only=True)
    assigned_to_email = serializers.CharField(source="assigned_to.email", read_only=True)
    last_message = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

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
            "deal",
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
            "attachments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_last_message(self, obj):
        if hasattr(obj, "latest_message_id"):
            if obj.latest_message_id is None:
                return None
            return {
                "id": obj.latest_message_id,
                "direction": obj.latest_message_direction,
                "sender_type": obj.latest_message_sender_type,
                "text": obj.latest_message_text,
                "status": obj.latest_message_status,
                "created_at": obj.latest_message_created_at,
            }
        message = obj.messages.order_by("-created_at", "-id").first()
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

    def get_attachments(self, obj):
        attachments = _attachments_for(self, obj, "bot_conversation")
        return FileAttachmentSerializer(attachments, many=True, context=self.context).data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["metadata_json"] = sanitize_config(data.get("metadata_json") or {})
        return data


class InboxAssignSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False, allow_null=True)


class InboxHandoffSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class InboxCloseSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class InboxPrioritySerializer(serializers.Serializer):
    priority = serializers.ChoiceField(choices=["low", "normal", "high", "urgent"])


class InboxRetryMessageSerializer(serializers.Serializer):
    message_id = serializers.IntegerField()


class InboxOutboundMessageSerializer(serializers.Serializer):
    text = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    sender_type = serializers.ChoiceField(choices=["manager"], default="manager")


class InboxCreateTaskSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(choices=["low", "normal", "high", "urgent"], default="normal")
    due_at = serializers.DateTimeField(required=False, allow_null=True)


class InboxCreateAppointmentSerializer(serializers.Serializer):
    service_id = serializers.IntegerField(required=True)
    resource_id = serializers.IntegerField(required=False, allow_null=True)
    start_at = serializers.DateTimeField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class InboxLinkLeadSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField(required=True)


class InboxLinkClientSerializer(serializers.Serializer):
    client_id = serializers.IntegerField(required=True)


class InboxLinkDealSerializer(serializers.Serializer):
    deal_id = serializers.IntegerField(required=True)


class InboxCreateClientSerializer(serializers.Serializer):
    full_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=64)
    email = serializers.EmailField(required=False, allow_blank=True)
    force_create = serializers.BooleanField(required=False, default=False)


class InboxCreateLeadSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True)


class InboxCreateDealSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    amount = serializers.DecimalField(required=False, max_digits=12, decimal_places=2)
    currency = serializers.CharField(required=False, allow_blank=True, max_length=8, default="KZT")


class InboxRunPipelineSerializer(serializers.Serializer):
    use_ai_qualification = serializers.BooleanField(required=False, default=True)
    apply_ai_decisions = serializers.BooleanField(required=False, default=True)
    create_lead = serializers.BooleanField(required=False, default=True)
    create_deal = serializers.BooleanField(required=False, default=True)
    create_task = serializers.BooleanField(required=False, default=True)
    lead_message = serializers.CharField(required=False, allow_blank=True)
    deal_title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    deal_amount = serializers.DecimalField(required=False, max_digits=12, decimal_places=2, default=0)
    deal_currency = serializers.CharField(required=False, allow_blank=True, max_length=8, default="KZT")
    task_title = serializers.CharField(required=False, allow_blank=True, max_length=255)
    task_description = serializers.CharField(required=False, allow_blank=True)
    task_priority = serializers.ChoiceField(choices=["low", "normal", "high", "urgent"], default="normal")
    task_due_at = serializers.DateTimeField(required=False, allow_null=True)
