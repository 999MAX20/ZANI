import csv
import io
from decimal import Decimal

from django.db.models import Avg, Count, Sum
from django.http import HttpResponse
from django.utils import timezone

from apps.analytics.models import ReportWidget
from apps.clients.models import Client
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


DEFAULT_WIDGETS = [
    ("source-roi", "Источники и ROI", ReportWidget.WidgetTypes.TABLE, {"report": "source_roi"}),
    ("funnel-velocity", "Скорость воронки", ReportWidget.WidgetTypes.FUNNEL, {"report": "funnel_velocity"}),
    ("retention-ltv", "Повторность и LTV", ReportWidget.WidgetTypes.KPI, {"report": "retention_ltv"}),
    ("manager-performance", "Команда", ReportWidget.WidgetTypes.TABLE, {"report": "manager_performance"}),
]


def ensure_default_report_widgets(business):
    widgets = []
    for index, (key, title, widget_type, config) in enumerate(DEFAULT_WIDGETS, start=1):
        widget, _ = ReportWidget.objects.get_or_create(
            business=business,
            key=key,
            defaults={
                "title": title,
                "widget_type": widget_type,
                "config_json": config,
                "sort_order": index,
                "is_active": True,
            },
        )
        widgets.append(widget)
    return widgets


def build_report_summary(business, *, start_date=None, end_date=None):
    ensure_default_report_widgets(business)
    leads = Lead.objects.filter(business=business, is_archived=False)
    deals = Deal.objects.filter(business=business, is_archived=False)
    appointments = Appointment.objects.filter(business=business, is_archived=False)
    tasks = Task.objects.filter(business=business, is_archived=False)

    leads = _date_filter(leads, "created_at", start_date, end_date)
    deals = _date_filter(deals, "created_at", start_date, end_date)
    appointments = _date_filter(appointments, "created_at", start_date, end_date)
    tasks = _date_filter(tasks, "created_at", start_date, end_date)

    return {
        "business": business.id,
        "period": {"start": str(start_date) if start_date else None, "end": str(end_date) if end_date else None},
        "widgets": [_widget_payload(widget) for widget in business.report_widgets.filter(is_active=True)],
        "source_roi": source_roi(leads, appointments),
        "funnel_velocity": funnel_velocity(leads, deals),
        "manager_performance": manager_performance(leads, deals, tasks),
        "retention_ltv": retention_ltv(business, appointments),
    }


def source_roi(leads, appointments):
    rows = []
    lead_sources = leads.values("source").annotate(leads=Count("id")).order_by("-leads", "source")
    for item in lead_sources:
        source = item["source"] or "unknown"
        source_appointments = appointments.filter(lead__source=source)
        completed = source_appointments.filter(status=Appointment.Statuses.COMPLETED)
        revenue = completed.aggregate(total=Sum("service__price_from"))["total"] or Decimal("0")
        rows.append(
            {
                "source": source,
                "leads": item["leads"],
                "appointments": source_appointments.count(),
                "completed_appointments": completed.count(),
                "revenue_estimate": str(revenue),
                "conversion_rate": _percent(source_appointments.count(), item["leads"]),
                "roi_status": "tracked_without_cost",
            }
        )
    return rows


def funnel_velocity(leads, deals):
    lead_rows = [
        {"status": item["status"], "count": item["count"]}
        for item in leads.values("status").annotate(count=Count("id")).order_by("status")
    ]
    stage_rows = []
    for item in deals.values("stage_id", "stage__name").annotate(count=Count("id"), avg_probability=Avg("probability")).order_by("stage__order", "stage__name"):
        stage_deals = deals.filter(stage_id=item["stage_id"]).exclude(stage_entered_at=None)
        age_days = [(timezone.now().date() - deal.stage_entered_at.date()).days for deal in stage_deals.only("stage_entered_at")]
        stage_rows.append(
            {
                "stage": item["stage__name"] or "No stage",
                "count": item["count"],
                "avg_probability": round(item["avg_probability"] or 0, 1),
                "avg_days_in_stage": round(sum(age_days) / len(age_days), 1) if age_days else None,
            }
        )
    return {
        "lead_statuses": lead_rows,
        "deal_stages": stage_rows,
        "open_deals": deals.filter(status=Deal.Statuses.OPEN).count(),
        "won_deals": deals.filter(status=Deal.Statuses.WON).count(),
        "lost_deals": deals.filter(status=Deal.Statuses.LOST).count(),
        "velocity_note": "avg_days_in_stage is a lightweight placeholder until stage history snapshots are added.",
    }


def manager_performance(leads, deals, tasks):
    user_ids = set(leads.exclude(responsible_user_id=None).values_list("responsible_user_id", flat=True))
    user_ids.update(deals.exclude(owner_id=None).values_list("owner_id", flat=True))
    user_ids.update(tasks.exclude(assignee_id=None).values_list("assignee_id", flat=True))
    rows = []
    for user_id in sorted(user_ids):
        user_leads = leads.filter(responsible_user_id=user_id)
        user_deals = deals.filter(owner_id=user_id)
        user_tasks = tasks.filter(assignee_id=user_id)
        user = (user_leads.first() and user_leads.first().responsible_user) or (user_deals.first() and user_deals.first().owner) or (user_tasks.first() and user_tasks.first().assignee)
        rows.append(
            {
                "user_id": user_id,
                "email": getattr(user, "email", ""),
                "full_name": getattr(user, "full_name", ""),
                "assigned_leads": user_leads.count(),
                "appointment_leads": user_leads.filter(status=Lead.Statuses.APPOINTMENT_CREATED).count(),
                "lost_leads": user_leads.filter(status=Lead.Statuses.LOST).count(),
                "won_deals": user_deals.filter(status=Deal.Statuses.WON).count(),
                "lost_deals": user_deals.filter(status=Deal.Statuses.LOST).count(),
                "open_tasks": user_tasks.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED]).count(),
            }
        )
    return rows


def retention_ltv(business, appointments):
    completed = appointments.filter(status=Appointment.Statuses.COMPLETED)
    completed_by_client = completed.values("client_id").annotate(count=Count("id"), revenue=Sum("service__price_from"))
    repeat_clients = [row for row in completed_by_client if row["count"] > 1]
    total_clients = Client.objects.filter(business=business, is_archived=False).count()
    total_revenue = completed.aggregate(total=Sum("service__price_from"))["total"] or Decimal("0")
    return {
        "total_clients": total_clients,
        "repeat_clients": len(repeat_clients),
        "repeat_rate": _percent(len(repeat_clients), total_clients),
        "ltv_estimate": str(round(total_revenue / total_clients, 2)) if total_clients else "0",
        "data_quality": "estimate_from_completed_appointments",
    }


def export_report_csv(business, report_key, *, start_date=None, end_date=None):
    summary = build_report_summary(business, start_date=start_date, end_date=end_date)
    rows, fields = _export_rows(summary, report_key)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        writer.writerow({field: row.get(field, "") for field in fields})
    response = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{report_key}.csv"'
    return response


def _export_rows(summary, report_key):
    if report_key == "source_roi":
        return summary["source_roi"], ["source", "leads", "appointments", "completed_appointments", "conversion_rate", "revenue_estimate", "roi_status"]
    if report_key == "manager_performance":
        return summary["manager_performance"], ["user_id", "email", "full_name", "assigned_leads", "appointment_leads", "lost_leads", "won_deals", "lost_deals", "open_tasks"]
    if report_key == "funnel_velocity":
        return summary["funnel_velocity"]["deal_stages"], ["stage", "count", "avg_probability", "avg_days_in_stage"]
    if report_key == "retention_ltv":
        return [summary["retention_ltv"]], ["total_clients", "repeat_clients", "repeat_rate", "ltv_estimate", "data_quality"]
    raise ValueError("Unsupported analytics report.")


def _date_filter(queryset, field, start_date, end_date):
    if start_date:
        queryset = queryset.filter(**{f"{field}__date__gte": start_date})
    if end_date:
        queryset = queryset.filter(**{f"{field}__date__lte": end_date})
    return queryset


def _widget_payload(widget):
    return {
        "id": widget.id,
        "key": widget.key,
        "title": widget.title,
        "widget_type": widget.widget_type,
        "config_json": widget.config_json,
        "sort_order": widget.sort_order,
    }


def _percent(value, total):
    return round((value / total) * 100) if total else 0
