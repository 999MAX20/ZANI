from rest_framework import serializers

from apps.automations.models import AutomationAction, AutomationCondition, AutomationRule, AutomationRun


class AutomationConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationCondition
        fields = "__all__"


class AutomationActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationAction
        fields = "__all__"


class AutomationRuleSerializer(serializers.ModelSerializer):
    conditions = AutomationConditionSerializer(many=True, read_only=True)
    actions = AutomationActionSerializer(many=True, read_only=True)

    class Meta:
        model = AutomationRule
        fields = "__all__"


class AutomationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationRun
        fields = "__all__"

