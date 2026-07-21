from rest_framework import serializers

from apps.ai_core.models import AIToolCallLog, AIRequestLog, AgentProfile, ApprovalRequest, BusinessKnowledgeItem
from apps.businesses.models import Business
from apps.bots.models import BotConversation
from apps.integrations.sanitization import sanitize_config, sanitize_error_text


class AIRequestLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRequestLog
        fields = "__all__"
        read_only_fields = ["created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["input_json"] = sanitize_config(data.get("input_json") or {})
        data["output_text"] = sanitize_error_text(data.get("output_text"))
        return data


class BusinessKnowledgeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessKnowledgeItem
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class AgentProfileSerializer(serializers.ModelSerializer):
    bot_name = serializers.CharField(source="bot.name", read_only=True)

    class Meta:
        model = AgentProfile
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        bot = attrs.get("bot") if "bot" in attrs else getattr(self.instance, "bot", None)
        if business and bot and bot.business_id != business.id:
            raise serializers.ValidationError("Bot must belong to the selected business.")
        return attrs


class AIAssistantChatSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())
    message = serializers.CharField(required=True, allow_blank=False)
    prompt_type = serializers.CharField(required=False, default="crm_assistant")


class AIAssistantStatusSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())


class AIAnalystBriefSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())
    limit = serializers.IntegerField(required=False, min_value=1, max_value=50, default=24)


class AIOwnerDailyBriefSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())
    limit = serializers.IntegerField(required=False, min_value=1, max_value=20, default=8)


class AIToolCallLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIToolCallLog
        fields = "__all__"
        read_only_fields = ["created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["input_json"] = sanitize_config(data.get("input_json") or {})
        data["output_json"] = sanitize_config(data.get("output_json") or {})
        data["error"] = sanitize_error_text(data.get("error"))
        return data


class ApprovalRequestSerializer(serializers.ModelSerializer):
    requested_by_email = serializers.EmailField(source="requested_by.email", read_only=True)
    approved_by_email = serializers.EmailField(source="approved_by.email", read_only=True)
    rejected_by_email = serializers.EmailField(source="rejected_by.email", read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = "__all__"
        read_only_fields = [
            "created_at",
            "updated_at",
            "requested_by",
            "status",
            "approved_by",
            "approved_at",
            "rejected_by",
            "rejected_at",
        ]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        ai_request_log = attrs.get("ai_request_log") if "ai_request_log" in attrs else getattr(self.instance, "ai_request_log", None)
        ai_tool_call_log = attrs.get("ai_tool_call_log") if "ai_tool_call_log" in attrs else getattr(self.instance, "ai_tool_call_log", None)
        if ai_request_log and business and ai_request_log.business_id != business.id:
            raise serializers.ValidationError({"ai_request_log": "AI request log must belong to the selected business."})
        if ai_tool_call_log and business and ai_tool_call_log.business_id != business.id:
            raise serializers.ValidationError({"ai_tool_call_log": "AI tool call must belong to the selected business."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["payload"] = sanitize_config(data.get("payload") or {})
        return data


class AIToolSuggestSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())
    conversation = serializers.PrimaryKeyRelatedField(queryset=BotConversation.objects.all(), required=False, allow_null=True)
    message = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        business = attrs["business"]
        conversation = attrs.get("conversation")
        if conversation and conversation.business_id != business.id:
            raise serializers.ValidationError("Conversation must belong to the selected business.")
        return attrs
