from apps.automations.models import AutomationAction, AutomationCondition, AutomationRule, AutomationRun
from apps.automations.serializers import (
    AutomationActionSerializer,
    AutomationConditionSerializer,
    AutomationRuleSerializer,
    AutomationRunSerializer,
)
from apps.core.viewsets import TenantModelViewSet


class AutomationRuleViewSet(TenantModelViewSet):
    queryset = AutomationRule.objects.prefetch_related("conditions", "actions").select_related("business")
    serializer_class = AutomationRuleSerializer


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

