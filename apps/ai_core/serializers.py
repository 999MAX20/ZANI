from rest_framework import serializers

from apps.ai_core.models import AIRequestLog, BusinessKnowledgeItem
from apps.businesses.models import Business


class AIRequestLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRequestLog
        fields = "__all__"
        read_only_fields = ["created_at"]


class BusinessKnowledgeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessKnowledgeItem
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class AIAssistantChatSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())
    message = serializers.CharField(required=True, allow_blank=False)
    prompt_type = serializers.CharField(required=False, default="crm_assistant")
