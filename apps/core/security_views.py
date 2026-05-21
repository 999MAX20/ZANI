from django.db.models import Count
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.businesses.access import Actions, Resources, assert_can, can
from apps.businesses.models import Business
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog, LoginHistory, SupportAccessGrant
from apps.core.permissions import accessible_businesses, is_platform_admin
from apps.core.serializers import AuditLogSerializer, LoginHistorySerializer, SupportAccessGrantSerializer


def _security_business(request):
    business_id = request.query_params.get("business") or request.data.get("business")
    businesses = accessible_businesses(request.user)
    if is_platform_admin(request.user):
        businesses = Business.objects.all()
    business = businesses.filter(id=business_id).first() if business_id else businesses.first()
    if not business:
        raise PermissionDenied("Business is required.")
    assert_can(request.user, business, Resources.AUDIT_LOGS, Actions.VIEW)
    return business


def _apply_audit_filters(queryset, request):
    actor = request.query_params.get("actor")
    entity_type = request.query_params.get("entity_type")
    action = request.query_params.get("action")
    risk = request.query_params.get("risk")
    category = request.query_params.get("category")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    if actor:
        queryset = queryset.filter(actor_id=actor)
    if entity_type:
        queryset = queryset.filter(entity_type=entity_type)
    if action:
        queryset = queryset.filter(action=action)
    if risk:
        queryset = queryset.filter(risk_level=risk)
    if category:
        queryset = queryset.filter(category=category)
    if date_from:
        parsed = parse_datetime(date_from)
        queryset = queryset.filter(created_at__gte=parsed or date_from)
    if date_to:
        parsed = parse_datetime(date_to)
        queryset = queryset.filter(created_at__lte=parsed or date_to)
    return queryset


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def security_audit(request):
    business = _security_business(request)
    queryset = _apply_audit_filters(
        AuditLog.objects.filter(business=business).select_related("business", "actor"),
        request,
    )
    return Response(AuditLogSerializer(queryset[:100], many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def security_login_history(request):
    business = _security_business(request)
    queryset = LoginHistory.objects.filter(business=business).select_related("business", "user")
    status_filter = request.query_params.get("status")
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    return Response(LoginHistorySerializer(queryset[:100], many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def security_risk_summary(request):
    business = _security_business(request)
    logs = AuditLog.objects.filter(business=business)
    log_counts = {row["risk_level"]: row["count"] for row in logs.values("risk_level").annotate(count=Count("id"))}
    failed_logins = LoginHistory.objects.filter(business=business, status=LoginHistory.Statuses.FAILED).count()
    active_support_grants = SupportAccessGrant.objects.filter(business=business, is_active=True).count()
    return Response(
        {
            "business": business.id,
            "risk_counts": {risk: log_counts.get(risk, 0) for risk in AuditLog.RiskLevels.values},
            "failed_logins": failed_logins,
            "active_support_grants": active_support_grants,
        }
    )


class SupportAccessGrantViewSet(ModelViewSet):
    serializer_class = SupportAccessGrantSerializer
    queryset = SupportAccessGrant.objects.select_related("business", "user", "created_by")
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        businesses = accessible_businesses(self.request.user)
        if is_platform_admin(self.request.user):
            businesses = Business.objects.all()
        allowed_ids = [business.id for business in businesses if can(self.request.user, business, Resources.AUDIT_LOGS, Actions.VIEW).allowed]
        queryset = self.queryset.filter(business_id__in=allowed_ids)
        business_id = self.request.query_params.get("business")
        if business_id:
            queryset = queryset.filter(business_id=business_id)
        return queryset

    def perform_create(self, serializer):
        business = serializer.validated_data["business"]
        assert_can(self.request.user, business, Resources.AUDIT_LOGS, Actions.MANAGE)
        instance = serializer.save(created_by=self.request.user)
        write_audit_log(
            self.request,
            AuditLog.Actions.SUPPORT_ACCESS,
            instance,
            business=business,
            metadata={"support_access": True, "risk_level": AuditLog.RiskLevels.HIGH, "category": AuditLog.Categories.ACCESS},
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        assert_can(self.request.user, instance.business, Resources.AUDIT_LOGS, Actions.MANAGE)
        serializer.save()
