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
    rule_name = serializers.CharField(source="rule.name", read_only=True)

    class Meta:
        model = AutomationRun
        fields = "__all__"


class AutomationTemplateSerializer(serializers.Serializer):
    key = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    trigger_type = serializers.CharField()
    actions = serializers.ListField(child=serializers.DictField())
    conditions = serializers.ListField(child=serializers.DictField(), required=False)


class ApplyAutomationTemplateSerializer(serializers.Serializer):
    business = serializers.IntegerField()
    template_key = serializers.CharField()
    is_active = serializers.BooleanField(default=False)


class AutomationConditionInputSerializer(serializers.Serializer):
    field = serializers.CharField(max_length=128)
    operator = serializers.ChoiceField(choices=AutomationCondition.Operators.choices, default=AutomationCondition.Operators.EQ)
    value = serializers.JSONField(default=dict)


class AutomationActionInputSerializer(serializers.Serializer):
    action_type = serializers.ChoiceField(choices=AutomationAction.ActionTypes.choices)
    config = serializers.JSONField(default=dict)
    delay_seconds = serializers.IntegerField(default=0, min_value=0)


class ManualAutomationRuleSerializer(serializers.Serializer):
    business = serializers.IntegerField()
    name = serializers.CharField(max_length=255)
    trigger_type = serializers.ChoiceField(choices=AutomationRule.TriggerTypes.choices)
    description = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(default=False)
    priority = serializers.IntegerField(default=100, min_value=0)
    conditions = AutomationConditionInputSerializer(many=True, required=False)
    actions = AutomationActionInputSerializer(many=True)

    def validate_actions(self, actions):
        if not actions:
            raise serializers.ValidationError("At least one action is required.")
        allowed_action_types = {
            AutomationAction.ActionTypes.CREATE_TASK,
            AutomationAction.ActionTypes.CREATE_NOTIFICATION,
            AutomationAction.ActionTypes.WAIT,
        }
        for action in actions:
            if action["action_type"] not in allowed_action_types:
                raise serializers.ValidationError(f"{action['action_type']} is not supported by the current automation engine.")
            if action["action_type"] == AutomationAction.ActionTypes.WAIT and not action.get("delay_seconds"):
                raise serializers.ValidationError("Wait action requires delay_seconds.")
        return actions
