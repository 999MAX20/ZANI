from rest_framework import serializers

from apps.analytics.models import AnalyticsEvent, ReportWidget, ScheduledReport


class AnalyticsEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsEvent
        fields = "__all__"
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        client = attrs.get("client") or getattr(self.instance, "client", None)
        if client and business and client.business_id != business.id:
            raise serializers.ValidationError("Client must belong to the selected business.")
        return attrs


class ReportWidgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportWidget
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class ScheduledReportSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = ScheduledReport
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "created_by", "created_by_email", "last_run_at"]

    def validate_recipients_json(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Recipients must be a list of emails.")
        invalid = [item for item in value if not isinstance(item, str) or "@" not in item]
        if invalid:
            raise serializers.ValidationError("Recipients must contain valid email strings.")
        return value
