from decimal import Decimal, InvalidOperation

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.analytics.crm_metrics import build_crm_operational_metrics
from apps.analytics.models import AnalyticsEvent, ReportWidget, ScheduledReport
from apps.analytics.reports import build_report_summary
from apps.analytics.serializers import AnalyticsEventSerializer, ReportWidgetSerializer, ScheduledReportSerializer
from apps.core.audit import write_audit_log
from apps.core.date_ranges import parse_bounded_date_range
from apps.core.export_jobs import request_report_export
from apps.core.models import AuditLog
from apps.core.serializers import ExportJobSerializer
from apps.businesses.access import Actions, Resources, assert_can, scope_queryset
from apps.businesses.capabilities import assert_resource_enabled
from apps.core.permissions import accessible_businesses, user_can_access_business
from apps.core.viewsets import TenantModelViewSet
from apps.core.work_queues import overdue_tasks_queryset
from apps.leads.models import Lead
from apps.integrations.models import BusinessConnector, BusinessEvent
from apps.scheduling.models import Appointment
from apps.tasks.models import Task

SALES_REVENUE_EVENT_TYPES = [
    "sale.recorded",
    "sale_imported",
    "kaspi_order_imported",
    "kaspi_sale_detected",
    "moysklad_sale_imported",
]


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
    assert_resource_enabled(business, Resources.ANALYTICS)
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
    appointment_revenue = completed_appointments.aggregate(total=Sum("service__price_from"))["total"] or 0
    sales_events = BusinessEvent.objects.filter(business=business, event_type__in=SALES_REVENUE_EVENT_TYPES)
    imported_revenue = sum((_payload_amount(event.payload_json) for event in sales_events), Decimal("0"))
    revenue = appointment_revenue + imported_revenue
    now = timezone.now()
    open_tasks = tasks.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
    new_leads_count = leads.filter(status=Lead.Statuses.NEW).count()
    overdue_tasks_count = overdue_tasks_queryset(queryset=open_tasks, now=now).count()
    crm_operational_metrics = build_crm_operational_metrics(business, user=request.user, now=now)
    sales_events_count = sales_events.count()
    today_imported_revenue = sum(
        (_payload_amount(event.payload_json) for event in sales_events.filter(occurred_at__date=today)),
        Decimal("0"),
    )
    yesterday = today - timezone.timedelta(days=1)
    yesterday_imported_revenue = sum(
        (_payload_amount(event.payload_json) for event in sales_events.filter(occurred_at__date=yesterday)),
        Decimal("0"),
    )
    connected_connectors = BusinessConnector.objects.filter(
        business=business,
        status__in=[BusinessConnector.Statuses.CONNECTED, BusinessConnector.Statuses.SYNCING],
    )
    connector_health = crm_operational_metrics["connector_health"]
    latest_business_events = _latest_business_events(business)
    setup_sources = {
        "landing": bool(business.landing_id or business.landing_domain or business.landing_preview_url),
        "lead_form": business.lead_forms.filter(is_active=True).exists(),
        "sales_data": sales_events.exists(),
        "communications": connected_connectors.filter(capability=BusinessConnector.Capabilities.COMMUNICATIONS).exists(),
        "inventory": connected_connectors.filter(capability=BusinessConnector.Capabilities.INVENTORY).exists(),
    }
    setup_score = round((sum(1 for value in setup_sources.values() if value) / len(setup_sources)) * 100)
    recommendations = _build_owner_recommendations(
        has_sales_data=sales_events.exists(),
        new_leads_count=new_leads_count,
        overdue_tasks_count=overdue_tasks_count,
        setup_sources=setup_sources,
    )

    mobile_onboarding = _build_mobile_owner_onboarding(
        business=business,
        setup_score=setup_score,
        setup_sources=setup_sources,
        has_sales_data=sales_events.exists(),
        new_leads_count=new_leads_count,
        overdue_tasks_count=overdue_tasks_count,
    )

    response_payload = {
        "business": business.id,
        "new_leads": new_leads_count,
        "total_leads": total_leads,
        "leads_by_source": leads_by_source,
        "appointments_today": appointments.filter(start_at__date=today).count(),
        "appointments_completed": completed_appointments.count(),
        "no_show_count": appointments.filter(status=Appointment.Statuses.NO_SHOW).count(),
        "conversion_lead_to_appointment": conversion,
        "open_tasks": open_tasks.count(),
        "overdue_tasks": overdue_tasks_count,
        "manager_response_time": None,
        "revenue_estimate": str(revenue),
        "sales_events_count": sales_events_count,
        "revenue": {
            "today": str(today_imported_revenue),
            "yesterday": str(yesterday_imported_revenue),
            "total_estimate": str(revenue),
            "growth_percent": _growth_percent(today_imported_revenue, yesterday_imported_revenue),
        },
        "business_pulse": _build_business_pulse(
            has_sales_data=sales_events.exists(),
            new_leads_count=new_leads_count,
            overdue_tasks_count=overdue_tasks_count,
            revenue=revenue,
            top_source=leads_by_source[0]["source"] if leads_by_source else "",
            setup_score=setup_score,
        ),
        "recommendations": recommendations,
        "quick_connect": [
            {
                "key": "whatsapp",
                "title": "Подключить WhatsApp",
                "description": "Чтобы заявки и переписка попадали в ZANI, а владелец видел обработку клиентов.",
                "status": "connect" if not setup_sources["communications"] else "connected",
                "href": "/app/integrations",
            },
            {
                "key": "excel_csv",
                "title": "Загрузить Excel / CSV",
                "description": "Дайте ZANI продажи и услуги, чтобы dashboard показывал бизнес, а не пустоту.",
                "status": "connect" if not setup_sources["sales_data"] else "connected",
                "href": "/app/settings#data-tools",
            },
            {
                "key": "staff",
                "title": "Добавить сотрудников",
                "description": "Назначайте заявки и задачи, чтобы видеть ответственность по каждому клиенту.",
                "status": "connect",
                "href": "/app/settings",
            },
        ],
        "setup": {
            "score": setup_score,
            "sources": setup_sources,
        },
        "data_quality": {
            "has_sales_data": sales_events.exists(),
            "sales_events_count": sales_events_count,
            "recommendation": "Загрузите CSV продаж или добавьте продажу вручную, чтобы ZANI считал выручку без догадок."
            if not sales_events.exists()
            else "Данные продаж подключены. ZANI использует загруженные события для базовой выручки.",
        },
        "connector_health": connector_health,
        "latest_business_events": latest_business_events,
        "crm_funnel": crm_operational_metrics["crm_funnel"],
        "crm_metrics_meta": crm_operational_metrics["meta"],
        "manager_performance": crm_operational_metrics["manager_performance"],
        "ai_insight_cards": crm_operational_metrics["ai_insight_cards"],
        "attention_items": _build_attention_items(
            new_leads_count=new_leads_count,
            overdue_tasks_count=overdue_tasks_count,
            connector_health=connector_health,
            has_sales_data=sales_events.exists(),
        ),
        "mobile_onboarding": mobile_onboarding,
    }
    return Response(response_payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_summary(request):
    business = _resolve_business(request)
    assert_resource_enabled(business, Resources.ANALYTICS)
    assert_can(request.user, business, Resources.ANALYTICS, Actions.VIEW)
    start_date, end_date = parse_bounded_date_range(request.query_params)
    return Response(
        build_report_summary(
            business,
            user=request.user,
            start_date=start_date,
            end_date=end_date,
        )
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def report_export(request):
    business = _resolve_business(request)
    assert_resource_enabled(business, Resources.ANALYTICS)
    assert_can(request.user, business, Resources.ANALYTICS, Actions.VIEW)
    report_key = request.query_params.get("report", "source_roi")
    start_date, end_date = parse_bounded_date_range(request.query_params)
    try:
        response, job = request_report_export(
            business=business,
            actor=request.user,
            report_key=report_key,
            start_date=start_date,
            end_date=end_date,
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    write_audit_log(
        request,
        AuditLog.Actions.CREATE,
        job or business,
        business=business,
        metadata={"kind": "export", "entity_type": "analytics_report", "report": report_key, "queued": bool(job)},
    )
    if job:
        return Response(ExportJobSerializer(job, context={"request": request}).data, status=202)
    return response



def _build_mobile_owner_onboarding(*, business, setup_score, setup_sources, has_sales_data, new_leads_count, overdue_tasks_count):
    steps = [
        {
            "key": "landing",
            "title": "Лендинг активирован",
            "description": "ZANI уже знает источник заявок и может принимать лиды из формы.",
            "status": "done" if setup_sources.get("landing") else "todo",
            "href": business.landing_preview_url or "/app/leads",
            "cta": "Открыть лендинг" if business.landing_preview_url else "Проверить заявки",
            "priority": 1,
        },
        {
            "key": "lead_form",
            "title": "Форма заявок подключена",
            "description": "Новая заявка с сайта попадёт в CRM Light и создаст уведомление.",
            "status": "done" if setup_sources.get("lead_form") else "todo",
            "href": "/app/leads",
            "cta": "Открыть CRM",
            "priority": 2,
        },
        {
            "key": "communications",
            "title": "Подключить сообщения",
            "description": "WhatsApp/Telegram/сайт дадут ZANI живые обращения и историю общения с клиентом.",
            "status": "done" if setup_sources.get("communications") else "todo",
            "href": "/app/integrations",
            "cta": "Подключить канал",
            "priority": 3,
        },
        {
            "key": "sales_data",
            "title": "Загрузить продажи",
            "description": "Без продаж AI не будет выдумывать аналитику. CSV/Excel даст выручку, динамику и первые выводы.",
            "status": "done" if has_sales_data else "todo",
            "href": "/app/settings#data-tools",
            "cta": "Загрузить Excel",
            "priority": 4,
        },
        {
            "key": "team",
            "title": "Добавить сотрудников",
            "description": "Назначайте заявки и задачи, чтобы владелец видел ответственность и скорость обработки.",
            "status": "todo",
            "href": "/app/settings",
            "cta": "Добавить команду",
            "priority": 5,
        },
    ]
    todo_steps = [step for step in steps if step["status"] != "done"]
    if overdue_tasks_count:
        headline = "Есть задачи, которые требуют реакции"
        subtext = f"{overdue_tasks_count} задач просрочены. Начните с них, чтобы не потерять клиентов."
        primary_action = {"label": "Открыть задачи", "href": "/app/tasks"}
    elif new_leads_count:
        headline = "Новые заявки ждут обработки"
        subtext = f"{new_leads_count} заявок нужно быстро разобрать или назначить менеджеру."
        primary_action = {"label": "Открыть заявки", "href": "/app/leads"}
    elif todo_steps:
        headline = "ZANI готовится увидеть бизнес полностью"
        subtext = "Подключайте источники по шагам. Первый месяц расширенного доступа уже включён."
        primary_action = {"label": todo_steps[0]["cta"], "href": todo_steps[0]["href"]}
    else:
        headline = "Базовый контур подключён"
        subtext = "CRM, форма и данные готовы. Следующий шаг — AI-задачи и регулярные отчёты владельцу."
        primary_action = {"label": "Открыть AI", "href": "/app/ai"}
    return {
        "headline": headline,
        "subtext": subtext,
        "score": setup_score,
        "primary_action": primary_action,
        "steps": steps,
        "next_step_key": todo_steps[0]["key"] if todo_steps else "ai",
    }


def _growth_percent(today_value, yesterday_value):
    if not yesterday_value:
        return None if not today_value else 100
    return round(((today_value - yesterday_value) / yesterday_value) * 100)


def _build_business_pulse(*, has_sales_data, new_leads_count, overdue_tasks_count, revenue, top_source, setup_score):
    if not has_sales_data:
        return {
            "tone": "setup",
            "title": "ZANI ждёт данные продаж",
            "text": "Лендинг и CRM уже подключены. Загрузите Excel/CSV или добавьте продажи вручную, чтобы владелец увидел выручку, каналы и первые AI-выводы.",
            "primary_action": {"label": "Загрузить Excel", "href": "/app/settings#data-tools"},
        }
    if overdue_tasks_count:
        return {
            "tone": "warning",
            "title": "Есть просроченные задачи",
            "text": f"{overdue_tasks_count} задач требуют реакции. Проверьте ответственных, чтобы заявки не зависали без обработки.",
            "primary_action": {"label": "Открыть задачи", "href": "/app/tasks"},
        }
    if new_leads_count:
        return {
            "tone": "attention",
            "title": "Новые заявки ждут обработки",
            "text": f"Сегодня в работе {new_leads_count} новых заявок. Быстрая реакция поможет не потерять клиентов.",
            "primary_action": {"label": "Открыть заявки", "href": "/app/leads"},
        }
    if revenue:
        source_text = f" Лучший источник сейчас: {top_source}." if top_source else ""
        return {
            "tone": "growth",
            "title": "Бизнес начал давать данные",
            "text": f"ZANI уже видит продажи и может считать базовую выручку.{source_text} Следующий шаг — подключить каналы и сотрудников.",
            "primary_action": {"label": "Подключить каналы", "href": "/app/integrations"},
        }
    return {
        "tone": "setup",
        "title": "Настройка бизнеса продолжается",
        "text": f"Готовность подключения: {setup_score}%. Добавьте сотрудников, услуги и источники данных, чтобы dashboard стал полезнее.",
        "primary_action": {"label": "Открыть настройки", "href": "/app/settings#operations-setup"},
    }


def _build_owner_recommendations(*, has_sales_data, new_leads_count, overdue_tasks_count, setup_sources):
    recommendations = []
    if not setup_sources.get("communications"):
        recommendations.append({
            "key": "connect_communications",
            "title": "Подключить WhatsApp / Telegram",
            "description": "Так заявки и сообщения начнут попадать в единый кабинет, а сотрудники смогут быстрее отвечать клиентам.",
            "priority": "high",
            "action_label": "Подключить",
            "href": "/app/integrations",
        })
    if not has_sales_data:
        recommendations.append({
            "key": "upload_sales",
            "title": "Загрузить продажи",
            "description": "Без продаж ZANI не будет выдумывать аналитику. Загрузите Excel/CSV, чтобы увидеть выручку и динамику.",
            "priority": "high",
            "action_label": "Загрузить данные",
            "href": "/app/settings#data-tools",
        })
    if new_leads_count:
        recommendations.append({
            "key": "process_new_leads",
            "title": "Разобрать новые заявки",
            "description": f"{new_leads_count} новых заявок ждут реакции. Назначьте ответственного или создайте задачу.",
            "priority": "medium",
            "action_label": "Открыть заявки",
            "href": "/app/leads",
        })
    if overdue_tasks_count:
        recommendations.append({
            "key": "fix_overdue_tasks",
            "title": "Закрыть просроченные задачи",
            "description": f"{overdue_tasks_count} задач просрочены. Это риск потерять клиента или не выполнить обещанное действие.",
            "priority": "high",
            "action_label": "Открыть задачи",
            "href": "/app/tasks",
        })
    if not recommendations:
        recommendations.append({
            "key": "next_growth_step",
            "title": "Подключить следующий источник данных",
            "description": "Добавьте канал, сотрудников или склад, чтобы ZANI показывал больше причин роста и просадок.",
            "priority": "medium",
            "action_label": "Открыть интеграции",
            "href": "/app/integrations",
        })
    return recommendations[:4]

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


def _payload_amount(payload):
    try:
        return Decimal(str((payload or {}).get("amount", "0")).replace(",", "."))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def _latest_business_events(business):
    events = BusinessEvent.objects.filter(business=business).select_related("connector").order_by("-occurred_at", "-created_at")[:6]
    return [
        {
            "id": event.id,
            "event_type": event.event_type,
            "source": event.source,
            "connector": event.connector.name if event.connector else "",
            "occurred_at": event.occurred_at.isoformat(),
            "status": event.status,
            "amount": str(_payload_amount(event.payload_json)),
        }
        for event in events
    ]


def _build_attention_items(*, new_leads_count, overdue_tasks_count, connector_health, has_sales_data):
    items = []
    if new_leads_count:
        items.append({"key": "new_leads", "count": new_leads_count, "tone": "warning", "href": "/app/leads"})
    if overdue_tasks_count:
        items.append({"key": "overdue_tasks", "count": overdue_tasks_count, "tone": "danger", "href": "/app/tasks"})
    if connector_health["error"]:
        items.append({"key": "connector_errors", "count": connector_health["error"], "tone": "danger", "href": "/app/integrations"})
    if connector_health["pending"]:
        items.append({"key": "connector_pending", "count": connector_health["pending"], "tone": "info", "href": "/app/integrations"})
    if not has_sales_data:
        items.append({"key": "sales_data", "count": 0, "tone": "info", "href": "/app/integrations"})
    return items[:5]
