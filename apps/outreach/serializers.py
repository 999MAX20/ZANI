from rest_framework import serializers

from django.utils import timezone

from apps.outreach.models import OutreachCampaign, OutreachConsent, OutreachRecipient, OutreachTemplate
from apps.outreach.services import preview_campaign_audience, unsupported_template_variables


class OutreachTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutreachTemplate
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        if not business:
            raise serializers.ValidationError("Business is required.")
        unsupported = unsupported_template_variables(attrs.get("body") or getattr(self.instance, "body", ""))
        if unsupported:
            raise serializers.ValidationError({"body": f"Unsupported variables: {', '.join(unsupported)}."})
        return attrs


class OutreachCampaignSerializer(serializers.ModelSerializer):
    recipients_total = serializers.IntegerField(read_only=True)
    recipients_pending = serializers.IntegerField(read_only=True)
    recipients_sent = serializers.IntegerField(read_only=True)
    recipients_failed = serializers.IntegerField(read_only=True)
    recipients_skipped = serializers.IntegerField(read_only=True)
    audience_preview = serializers.SerializerMethodField()

    class Meta:
        model = OutreachCampaign
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "created_by", "started_at", "finished_at"]

    def get_audience_preview(self, obj):
        request = self.context.get("request")
        if not request or request.query_params.get("include_preview") not in {"1", "true", "yes"}:
            return None
        return preview_campaign_audience(obj)

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        segment = attrs.get("segment") or getattr(self.instance, "segment", None)
        template = attrs.get("template") or getattr(self.instance, "template", None)
        message_text = attrs.get("message_text") or getattr(self.instance, "message_text", "")
        if segment and business and segment.business_id != business.id:
            raise serializers.ValidationError("Segment must belong to the selected business.")
        if template and business and template.business_id != business.id:
            raise serializers.ValidationError("Template must belong to the selected business.")
        if not message_text.strip():
            raise serializers.ValidationError("Message text is required.")
        unsupported = unsupported_template_variables(message_text)
        if unsupported:
            raise serializers.ValidationError({"message_text": f"Unsupported variables: {', '.join(unsupported)}."})
        channel = attrs.get("channel") or getattr(self.instance, "channel", None)
        whatsapp_template_status = attrs.get("whatsapp_template_status") or getattr(self.instance, "whatsapp_template_status", OutreachCampaign.TemplateStatuses.NOT_REQUIRED)
        if channel == OutreachCampaign.Channels.WHATSAPP and whatsapp_template_status == OutreachCampaign.TemplateStatuses.NOT_REQUIRED:
            attrs["whatsapp_template_status"] = OutreachCampaign.TemplateStatuses.DRAFT
        rate_limit = attrs.get("rate_limit_per_minute", getattr(self.instance, "rate_limit_per_minute", 60))
        batch_size = attrs.get("batch_size", getattr(self.instance, "batch_size", 100))
        if rate_limit < 1 or rate_limit > 1000:
            raise serializers.ValidationError("Rate limit must be between 1 and 1000.")
        if batch_size < 1 or batch_size > 5000:
            raise serializers.ValidationError("Batch size must be between 1 and 5000.")
        return attrs


class OutreachRecipientSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    client_phone = serializers.CharField(source="client.phone", read_only=True)
    notification_status = serializers.CharField(source="notification.status", read_only=True)

    class Meta:
        model = OutreachRecipient
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class OutreachConsentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    client_phone = serializers.CharField(source="client.phone", read_only=True)

    class Meta:
        model = OutreachConsent
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "opted_in_at", "opted_out_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        if client and business and client.business_id != business.id:
            raise serializers.ValidationError("Client must belong to the selected business.")
        return attrs

    def create(self, validated_data):
        self._stamp_status(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._stamp_status(validated_data)
        return super().update(instance, validated_data)

    def _stamp_status(self, validated_data):
        status = validated_data.get("status")
        if status == OutreachConsent.Statuses.OPTED_IN:
            validated_data["opted_in_at"] = timezone.now()
            validated_data["opted_out_at"] = None
        if status == OutreachConsent.Statuses.OPTED_OUT:
            validated_data["opted_out_at"] = timezone.now()
