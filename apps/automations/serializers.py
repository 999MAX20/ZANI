from rest_framework import serializers

from apps.automations.models import AutomationAction, AutomationCondition, AutomationRule, AutomationRun
from apps.integrations.sanitization import sanitize_config, sanitize_error_payload, sanitize_error_text


SUPPORTED_AUTOMATION_ACTION_TYPES = {
    AutomationAction.ActionTypes.CREATE_TASK,
    AutomationAction.ActionTypes.CREATE_FOLLOW_UP,
    AutomationAction.ActionTypes.CREATE_NOTIFICATION,
    AutomationAction.ActionTypes.ASSIGN_USER,
    AutomationAction.ActionTypes.ADD_NOTE,
    AutomationAction.ActionTypes.WAIT,
}


class AutomationConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationCondition
        fields = ["id", "rule", "field", "operator", "value"]


class AutomationActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationAction
        fields = ["id", "rule", "action_type", "config", "order", "delay_seconds"]

    def validate(self, attrs):
        action_type = attrs.get("action_type") or getattr(self.instance, "action_type", None)
        delay_seconds = attrs.get("delay_seconds", getattr(self.instance, "delay_seconds", 0))
        if action_type not in SUPPORTED_AUTOMATION_ACTION_TYPES:
            raise serializers.ValidationError(
                {"action_type": "This action is not supported by the current automation engine."}
            )
        if action_type == AutomationAction.ActionTypes.WAIT and not delay_seconds:
            raise serializers.ValidationError({"delay_seconds": "Wait action requires a positive delay."})
        return attrs


class AutomationRuleSerializer(serializers.ModelSerializer):
    conditions = AutomationConditionSerializer(many=True, read_only=True)
    actions = AutomationActionSerializer(many=True, read_only=True)

    class Meta:
        model = AutomationRule
        fields = [
            "id",
            "business",
            "name",
            "trigger_type",
            "description",
            "is_active",
            "priority",
            "conditions",
            "actions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["conditions", "actions", "created_at", "updated_at"]


class AutomationRunSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source="rule.name", read_only=True)
    protected_state_fields = {
        "status",
        "payload",
        "action_results",
        "error",
        "attempts",
        "max_attempts",
        "next_retry_at",
        "locked_at",
        "started_at",
        "finished_at",
    }

    class Meta:
        model = AutomationRun
        fields = [
            "id",
            "business",
            "rule",
            "rule_name",
            "trigger_type",
            "entity_type",
            "entity_id",
            "idempotency_key",
            "status",
            "payload",
            "action_results",
            "error",
            "attempts",
            "max_attempts",
            "run_after",
            "next_retry_at",
            "locked_at",
            "started_at",
            "finished_at",
            "created_at",
        ]
        read_only_fields = fields

    def validate(self, attrs):
        attempted_state_fields = sorted(self.protected_state_fields.intersection((self.initial_data or {}).keys()))
        if attempted_state_fields:
            raise serializers.ValidationError(
                {
                    "detail": "Use automation runtime services for run state changes.",
                    "fields": attempted_state_fields,
                }
            )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["payload"] = sanitize_config(data.get("payload") or {})
        data["action_results"] = sanitize_error_payload(sanitize_config(data.get("action_results") or []))
        data["error"] = sanitize_error_text(data.get("error"))
        return data


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
        for action in actions:
            if action["action_type"] not in SUPPORTED_AUTOMATION_ACTION_TYPES:
                raise serializers.ValidationError(f"{action['action_type']} is not supported by the current automation engine.")
            if action["action_type"] == AutomationAction.ActionTypes.WAIT and not action.get("delay_seconds"):
                raise serializers.ValidationError("Wait action requires delay_seconds.")
        return actions
