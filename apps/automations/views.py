from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.automations.engine import retry_automation_run
from apps.automations.models import AutomationAction, AutomationCondition, AutomationRule, AutomationRun
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.automations.serializers import (
    ApplyAutomationTemplateSerializer,
    AutomationActionSerializer,
    AutomationConditionSerializer,
    AutomationRuleSerializer,
    AutomationRunSerializer,
    AutomationTemplateSerializer,
    ManualAutomationRuleSerializer,
)
from apps.businesses.access import Actions, Resources, assert_can
from apps.businesses.models import Business
from apps.core.viewsets import TenantModelViewSet


AUTOMATION_TEMPLATES = [
    {
        "key": "new_lead_create_task",
        "name": "Новая заявка -> задача менеджеру",
        "description": "Когда появляется новая заявка, CRM создает follow-up задачу с высоким приоритетом.",
        "trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED,
        "conditions": [],
        "actions": [
            {
                "action_type": AutomationAction.ActionTypes.CREATE_TASK,
                "config": {"title": "Связаться с новой заявкой", "priority": "high"},
                "delay_seconds": 0,
            }
        ],
    },
    {
        "key": "appointment_created_prepare",
        "name": "Новая запись -> подготовить визит",
        "description": "После создания записи добавляет задачу подготовить клиента, услугу или ресурс.",
        "trigger_type": AutomationRule.TriggerTypes.APPOINTMENT_CREATED,
        "conditions": [],
        "actions": [
            {
                "action_type": AutomationAction.ActionTypes.CREATE_TASK,
                "config": {"title": "Подготовить запись клиента", "priority": "normal"},
                "delay_seconds": 0,
            }
        ],
    },
    {
        "key": "message_received_handoff_task",
        "name": "Новое сообщение -> задача ответить",
        "description": "Когда клиент пишет в подключенный канал, CRM создает задачу для ручного ответа.",
        "trigger_type": AutomationRule.TriggerTypes.BOT_MESSAGE_RECEIVED,
        "conditions": [],
        "actions": [
            {
                "action_type": AutomationAction.ActionTypes.CREATE_TASK,
                "config": {"title": "Ответить клиенту в чате", "priority": "normal"},
                "delay_seconds": 0,
            }
        ],
    },
]


class AutomationRuleViewSet(TenantModelViewSet):
    queryset = AutomationRule.objects.prefetch_related("conditions", "actions").select_related("business")
    serializer_class = AutomationRuleSerializer

    def perform_create(self, serializer):
        business = serializer.validated_data["business"]
        assert_entitlement_allows(business, EntitlementMetrics.AUTOMATIONS)
        super().perform_create(serializer)

    @action(detail=False, methods=["get"])
    def templates(self, request):
        return Response(AutomationTemplateSerializer(AUTOMATION_TEMPLATES, many=True).data)

    @action(detail=False, methods=["post"], url_path="apply-template")
    def apply_template(self, request):
        serializer = ApplyAutomationTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = Business.objects.filter(id=serializer.validated_data["business"]).first()
        if business is None:
            raise ValidationError({"business": "Business was not found."})
        assert_can(request.user, business, Resources.AUTOMATIONS, Actions.CREATE)
        assert_entitlement_allows(business, EntitlementMetrics.AUTOMATIONS)

        template = next((item for item in AUTOMATION_TEMPLATES if item["key"] == serializer.validated_data["template_key"]), None)
        if template is None:
            raise ValidationError({"template_key": "Unknown automation template."})

        rule = AutomationRule.objects.create(
            business=business,
            name=template["name"],
            description=template["description"],
            trigger_type=template["trigger_type"],
            is_active=serializer.validated_data["is_active"],
        )
        for condition in template.get("conditions", []):
            AutomationCondition.objects.create(rule=rule, **condition)
        for order, action_data in enumerate(template["actions"]):
            AutomationAction.objects.create(
                rule=rule,
                order=order,
                action_type=action_data["action_type"],
                config=action_data.get("config", {}),
                delay_seconds=action_data.get("delay_seconds", 0),
            )

        return Response(self.get_serializer(rule).data, status=201)

    @action(detail=False, methods=["post"], url_path="preview")
    def preview(self, request):
        serializer = ManualAutomationRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = self._business_for_manual_payload(serializer.validated_data)
        assert_can(request.user, business, Resources.AUTOMATIONS, Actions.CREATE)
        assert_entitlement_allows(business, EntitlementMetrics.AUTOMATIONS)
        return Response(self._manual_preview(serializer.validated_data))

    @action(detail=False, methods=["post"], url_path="create-manual")
    def create_manual(self, request):
        serializer = ManualAutomationRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = self._business_for_manual_payload(serializer.validated_data)
        assert_can(request.user, business, Resources.AUTOMATIONS, Actions.CREATE)

        payload = serializer.validated_data
        rule = AutomationRule.objects.create(
            business=business,
            name=payload["name"],
            description=payload.get("description", ""),
            trigger_type=payload["trigger_type"],
            is_active=payload.get("is_active", False),
            priority=payload.get("priority", 100),
        )
        for condition in payload.get("conditions", []):
            AutomationCondition.objects.create(rule=rule, **condition)
        for order, action_data in enumerate(payload["actions"]):
            AutomationAction.objects.create(
                rule=rule,
                order=order,
                action_type=action_data["action_type"],
                config=action_data.get("config", {}),
                delay_seconds=action_data.get("delay_seconds", 0),
            )

        return Response(self.get_serializer(rule).data, status=201)

    def _business_for_manual_payload(self, payload):
        business = Business.objects.filter(id=payload["business"]).first()
        if business is None:
            raise ValidationError({"business": "Business was not found."})
        return business

    def _manual_preview(self, payload):
        trigger_label = dict(AutomationRule.TriggerTypes.choices).get(payload["trigger_type"], payload["trigger_type"])
        return {
            "valid": True,
            "name": payload["name"],
            "trigger_type": payload["trigger_type"],
            "trigger_label": trigger_label,
            "conditions_count": len(payload.get("conditions", [])),
            "actions_count": len(payload["actions"]),
            "will_run_when": f"{trigger_label} event is emitted and all conditions match.",
            "steps": [
                {
                    "order": index,
                    "action_type": action["action_type"],
                    "delay_seconds": action.get("delay_seconds", 0),
                    "config": action.get("config", {}),
                }
                for index, action in enumerate(payload["actions"])
            ],
        }


class AutomationConditionViewSet(TenantModelViewSet):
    queryset = AutomationCondition.objects.select_related("rule", "rule__business")
    serializer_class = AutomationConditionSerializer
    business_lookup = "rule__business"


class AutomationActionViewSet(TenantModelViewSet):
    queryset = AutomationAction.objects.select_related("rule", "rule__business")
    serializer_class = AutomationActionSerializer
    business_lookup = "rule__business"


class AutomationRunViewSet(TenantModelViewSet):
    queryset = AutomationRun.objects.select_related("business", "rule")
    serializer_class = AutomationRunSerializer

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        run = self.get_object()
        assert_can(request.user, run.business, Resources.AUTOMATIONS, Actions.MANAGE, obj=run)
        retry_automation_run(run)
        run.refresh_from_db()
        return Response(self.get_serializer(run).data)
