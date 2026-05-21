from django.utils.dateparse import parse_date
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.analytics.models import AnalyticsEvent, ReportWidget, ScheduledReport
from apps.analytics.reports import build_report_summary, export_report_csv
from apps.analytics.serializers import AnalyticsEventSerializer, ReportWidgetSerializer, ScheduledReportSerializer
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.businesses.access import Actions, Resources, assert_can, scope_queryset
from apps.core.permissions import accessible_businesses, user_can_access_business
from apps.core.viewsets import TenantModelViewSet
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


class AnalyticsEventViewSet(TenantModelViewSet):
    queryset = AnalyticsEvent.objects.select_related("business", "client")
    serializer_class = AnalyticsEventSerializer


class ReportWidgetViewSet(TenantModelViewSet):
    queryset = ReportWidget.objects.select_related("business")
    serializer_class = ReportWidgetSerializer
    access_resource = Resources.ANALYTICS


class ScheduledReportViewSet(TenantModelViewSet):
    queryset = ScheduledReport.objects.select_related("business", "created_by")
    serializer_class = ScheduledReportSerializer
    access_resource = Resources.ANALYTICS

    def perform_create(self, serializer):
        self._enforce_business_access(serializer)
        instance = serializer.save(created_by=self.request.user)
        write_audit_log(self.request, AuditLog.Actions.CREATE, instance, business=instance.business)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def owner_dashboard(request):
    business = _resolve_business(request)
    assert_can(request.user, business, Resources.ANALYTICS, Actions.VIEW)
    today = timezone.localdate()

    leads = scope_queryset(Lead.objects.filter(business=business), request.user, business, Resources.LEADS)
    appointments = scope_queryset(Appointment.objects.filter(business=business), request.user, business, Resources.APPOINTMENTS)
    tasks = scope_queryset(Task.objects.filter(business=business), request.user, business, Resources.TASKS)

    total_leads = leads.count()
    leads_with_appointment = leads.filter(status=Lead.Statuses.APPOINTMENT_CREATED).count()
    conversion = round((leads_with_appointment / total_leads) * 100) if total_leads else 0

    leads_by_source = list(
        leads.values("source")
        .annotate(count=Count("id"))
        .order_by("-count", "source")
    )
    completed_appointments = appointments.filter(status=Appointment.Statuses.COMPLETED)
    revenue = completed_appointments.aggregate(total=Sum("service__price_from"))["total"] or 0
    open_tasks = tasks.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])

    return Response(
        {
            "business": business.id,
            "new_leads": leads.filter(status=Lead.Statuses.NEW).count(),
            "total_leads": total_leads,
            "leads_by_source": leads_by_source,
            "appointments_today": appointments.filter(start_at__date=today).count(),
            "appointments_completed": completed_appointments.count(),
            "no_show_count": appointments.filter(status=Appointment.Statuses.NO_SHOW).count(),
            "conversion_lead_to_appointment": conversion,
            "open_tasks": open_tasks.count(),
            "overdue_tasks": open_tasks.filter(due_at__lt=timezone.now()).count(),
            "manager_response_time": None,
            "revenue_estimate": str(revenue),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_summary(request):
    business = _resolve_business(request)
    assert_can(request.user, business, Resources.ANALYTICS, Actions.VIEW)
    return Response(
        build_report_summary(
            business,
            start_date=parse_date(request.query_params.get("start", "") or ""),
            end_date=parse_date(request.query_params.get("end", "") or ""),
        )
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_export(request):
    business = _resolve_business(request)
    assert_can(request.user, business, Resources.ANALYTICS, Actions.VIEW)
    report_key = request.query_params.get("report", "source_roi")
    try:
        response = export_report_csv(
            business,
            report_key,
            start_date=parse_date(request.query_params.get("start", "") or ""),
            end_date=parse_date(request.query_params.get("end", "") or ""),
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    write_audit_log(
        request,
        AuditLog.Actions.CREATE,
        business,
        business=business,
        metadata={"kind": "export", "entity_type": "analytics_report", "report": report_key},
    )
    return response


def _resolve_business(request):
    business_id = request.query_params.get("business")
    businesses = accessible_businesses(request.user)
    if business_id:
        business = businesses.filter(id=business_id).first()
        if business is None:
            raise ValidationError({"business": "Business is not available."})
        return business
    business = businesses.first()
    if business is None:
        raise ValidationError({"business": "Business is required."})
    if not user_can_access_business(request.user, business):
        raise ValidationError({"business": "Business is not available."})
    return business
