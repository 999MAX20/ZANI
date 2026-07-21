from decimal import Decimal

from django.db.models import Count, F, Q, Sum
from django.utils import timezone

from apps.bots.models import BotConversation
from apps.businesses.access import Actions, Resources, can, get_membership, scope_queryset, user_is_business_owner
from apps.businesses.capabilities import resource_is_enabled
from apps.businesses.models import BusinessMember, TeamMember
from apps.core.permissions import is_platform_admin, platform_admin_has_global_access
from apps.core.work_queues import (
    handoff_conversations_queryset,
    overdue_handoff_conversations_queryset,
    overdue_tasks_queryset,
    unread_conversations_queryset,
    unread_sla_overdue_conversations_queryset,
)
from apps.crm.models import Deal
from apps.integrations.models import BusinessConnector, BusinessEvent, ConnectorSyncRun
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


CONNECTOR_CONNECTED_STATUSES = [BusinessConnector.Statuses.CONNECTED, BusinessConnector.Statuses.SYNCING]
CONNECTOR_PENDING_STATUSES = [
    BusinessConnector.Statuses.PENDING_REQUEST,
    BusinessConnector.Statuses.PROVIDER_CONFIGURING,
    BusinessConnector.Statuses.SETUP_REQUIRED,
    BusinessConnector.Statuses.NEEDS_ATTENTION,
]
CONNECTOR_ERROR_STATUSES = [
    BusinessConnector.Statuses.ERROR,
    BusinessConnector.Statuses.FAILED,
    BusinessConnector.Statuses.EXPIRED_CREDENTIALS,
]


def build_crm_operational_metrics(business, *, user=None, start_date=None, end_date=None, now=None):
    now = now or timezone.now()
    leads = _date_filter(_scoped(Lead.objects.filter(business=business, is_archived=False), user, business, Resources.LEADS), "created_at", start_date, end_date)
    deals = _date_filter(_scoped(Deal.objects.filter(business=business, is_archived=False), user, business, Resources.DEALS), "created_at", start_date, end_date)
    appointments = _date_filter(
        _scoped(Appointment.objects.filter(business=business, is_archived=False), user, business, Resources.APPOINTMENTS),
        "created_at",
        start_date,
        end_date,
    )
    tasks = _date_filter(_scoped(Task.objects.filter(business=business, is_archived=False), user, business, Resources.TASKS), "created_at", start_date, end_date)
    conversations = _date_filter(
        _scoped(BotConversation.objects.filter(business=business, is_archived=False), user, business, Resources.CONVERSATIONS),
        "updated_at",
        start_date,
        end_date,
    )

    open_tasks = tasks.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
    overdue_tasks = overdue_tasks_queryset(queryset=open_tasks, now=now)
    unread_conversations = unread_conversations_queryset(queryset=conversations)
    handoff_conversations = handoff_conversations_queryset(queryset=conversations)
    unanswered_conversations = conversations.filter(
        status=BotConversation.Statuses.OPEN,
    ).filter(Q(unread_count__gt=0) | Q(handoff_required=True)).distinct()
    no_show_appointments = appointments.filter(status=Appointment.Statuses.NO_SHOW)
    completed_appointments = appointments.filter(status=Appointment.Statuses.COMPLETED)
    visible_lead_ids = leads.values("id")
    deals_from_leads = deals.filter(lead_id__in=visible_lead_ids).values("lead_id").distinct().count()
    total_leads = leads.count()
    total_appointments = appointments.count()

    crm_funnel = {
        "lead_counts": {
            "total": total_leads,
            "by_source": _group_count(leads, "source"),
            "by_status": _group_count(leads, "status"),
        },
        "conversion_to_deal": {
            "leads_total": total_leads,
            "deals_from_leads": deals_from_leads,
            "rate": _percent(deals_from_leads, total_leads),
        },
        "deal_outcomes": {
            "open_count": deals.filter(status=Deal.Statuses.OPEN).count(),
            "won_count": deals.filter(status=Deal.Statuses.WON).count(),
            "lost_count": deals.filter(status=Deal.Statuses.LOST).count(),
            "open_value": _decimal_str(_sum_amount(deals.filter(status=Deal.Statuses.OPEN))),
            "won_value": _decimal_str(_sum_amount(deals.filter(status=Deal.Statuses.WON))),
            "lost_value": _decimal_str(_sum_amount(deals.filter(status=Deal.Statuses.LOST))),
        },
        "appointments": {
            "total": total_appointments,
            "completed": completed_appointments.count(),
            "no_show": no_show_appointments.count(),
            "completion_rate": _percent(completed_appointments.count(), total_appointments),
            "no_show_rate": _percent(no_show_appointments.count(), total_appointments),
        },
        "tasks": {
            "open": open_tasks.count(),
            "overdue": overdue_tasks.count(),
        },
        "conversations": {
            "unanswered": unanswered_conversations.count(),
            "unread": unread_conversations.count(),
            "handoff_required": handoff_conversations.count(),
            "unread_sla_overdue": unread_sla_overdue_conversations_queryset(queryset=conversations, now=now).count(),
            "handoff_sla_overdue": overdue_handoff_conversations_queryset(queryset=conversations, now=now).count(),
        },
    }
    manager_performance = _manager_performance(business=business, user=user, start_date=start_date, end_date=end_date, now=now)
    connector_health = build_connector_health_metrics(business)
    source_ids = {
        "overdue_tasks": _source_ids("TASK", overdue_tasks.values_list("id", flat=True)[:5]),
        "unanswered_conversations": _source_ids("CONV", unanswered_conversations.values_list("id", flat=True)[:5]),
        "no_show_appointments": _source_ids("APPT", no_show_appointments.values_list("id", flat=True)[:5]),
        "failed_connectors": _source_ids(
            "CONNECTOR",
            BusinessConnector.objects.filter(business=business, status__in=CONNECTOR_ERROR_STATUSES).values_list("id", flat=True)[:5],
        ),
        "visible_leads": _source_ids("LEAD", leads.values_list("id", flat=True)[:5]),
    }
    return {
        "meta": {
            "business_id": business.id,
            "generated_at": now.isoformat(),
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "timezone": business.timezone,
            "currency": business.currency,
            "availability": {
                resource: (user is None or can(user, business, resource, Actions.VIEW).allowed)
                for resource in [
                    Resources.LEADS,
                    Resources.DEALS,
                    Resources.APPOINTMENTS,
                    Resources.TASKS,
                    Resources.CONVERSATIONS,
                ]
            },
        },
        "crm_funnel": crm_funnel,
        "manager_performance": manager_performance,
        "connector_health": connector_health,
        "ai_insight_cards": _ai_insight_cards(crm_funnel=crm_funnel, connector_health=connector_health, source_ids=source_ids),
    }


def build_connector_health_metrics(business):
    connectors = BusinessConnector.objects.filter(business=business)
    sync_runs = ConnectorSyncRun.objects.filter(business=business)
    latest_event = BusinessEvent.objects.filter(business=business).order_by("-occurred_at", "-created_at").first()
    latest_sync = sync_runs.order_by("-created_at").first()
    by_provider = [
        {
            "provider": row["provider"],
            "total": row["total"],
            "connected": row["connected"],
            "pending": row["pending"],
            "error": row["error"],
        }
        for row in connectors.values("provider")
        .annotate(
            total=Count("id"),
            connected=Count("id", filter=Q(status__in=CONNECTOR_CONNECTED_STATUSES)),
            pending=Count("id", filter=Q(status__in=CONNECTOR_PENDING_STATUSES)),
            error=Count("id", filter=Q(status__in=CONNECTOR_ERROR_STATUSES)),
        )
        .order_by("provider")
    ]
    return {
        "connected": connectors.filter(status__in=CONNECTOR_CONNECTED_STATUSES).count(),
        "pending": connectors.filter(status__in=CONNECTOR_PENDING_STATUSES).count(),
        "error": connectors.filter(status__in=CONNECTOR_ERROR_STATUSES).count(),
        "total": connectors.count(),
        "failed_sync_runs": sync_runs.filter(status=ConnectorSyncRun.Statuses.FAILED).count(),
        "latest_sync_at": latest_sync.created_at.isoformat() if latest_sync else None,
        "latest_event_at": latest_event.occurred_at.isoformat() if latest_event else None,
        "by_provider": by_provider,
    }


def _manager_performance(*, business, user, start_date, end_date, now):
    visible_members = _visible_performance_members(business=business, user=user)
    visible_user_ids = list(visible_members.values_list("user_id", flat=True))
    leads = _date_filter(Lead.objects.filter(business=business, is_archived=False, responsible_user_id__in=visible_user_ids), "created_at", start_date, end_date)
    deals = _date_filter(Deal.objects.filter(business=business, is_archived=False, owner_id__in=visible_user_ids), "created_at", start_date, end_date)
    appointments = _date_filter(
        Appointment.objects.filter(business=business, is_archived=False, lead__responsible_user_id__in=visible_user_ids),
        "created_at",
        start_date,
        end_date,
    )
    tasks = _date_filter(Task.objects.filter(business=business, is_archived=False, assignee_id__in=visible_user_ids), "created_at", start_date, end_date)
    lead_metrics = {
        row["responsible_user_id"]: row
        for row in leads.values("responsible_user_id").annotate(assigned_leads=Count("id"))
        if row["responsible_user_id"] is not None
    }
    deal_metrics = {
        row["owner_id"]: row
        for row in deals.values("owner_id").annotate(
            deals_from_leads=Count("lead_id", distinct=True, filter=Q(lead__responsible_user_id=F("owner_id"))),
            won_deals=Count("id", filter=Q(status=Deal.Statuses.WON)),
            lost_deals=Count("id", filter=Q(status=Deal.Statuses.LOST)),
            won_value=Sum("amount", filter=Q(status=Deal.Statuses.WON)),
            lost_value=Sum("amount", filter=Q(status=Deal.Statuses.LOST)),
        )
        if row["owner_id"] is not None
    }
    appointment_metrics = {
        row["lead__responsible_user_id"]: row
        for row in appointments.values("lead__responsible_user_id").annotate(
            appointments_completed=Count("id", filter=Q(status=Appointment.Statuses.COMPLETED)),
            appointments_no_show=Count("id", filter=Q(status=Appointment.Statuses.NO_SHOW)),
        )
        if row["lead__responsible_user_id"] is not None
    }
    task_metrics = {
        row["assignee_id"]: row
        for row in tasks.values("assignee_id").annotate(
            open_tasks=Count("id", filter=~Q(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])),
            overdue_tasks=Count(
                "id",
                filter=(
                    ~Q(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
                    & Q(is_archived=False, due_at__lt=now)
                    & (Q(snoozed_until__isnull=True) | Q(snoozed_until__lte=now))
                ),
            ),
        )
        if row["assignee_id"] is not None
    }
    rows = []
    for member in visible_members.select_related("user").order_by("user__email"):
        member_leads = lead_metrics.get(member.user_id, {})
        member_deals = deal_metrics.get(member.user_id, {})
        member_appointments = appointment_metrics.get(member.user_id, {})
        member_tasks = task_metrics.get(member.user_id, {})
        assigned_leads = member_leads.get("assigned_leads", 0)
        deals_from_leads = member_deals.get("deals_from_leads", 0)
        rows.append(
            {
                "user_id": member.user_id,
                "email": member.user.email,
                "full_name": member.user.full_name,
                "role": member.role,
                "assigned_leads": assigned_leads,
                "deals_from_leads": deals_from_leads,
                "lead_to_deal_rate": _percent(deals_from_leads, assigned_leads),
                "won_deals": member_deals.get("won_deals", 0),
                "lost_deals": member_deals.get("lost_deals", 0),
                "won_value": _decimal_str(member_deals.get("won_value")),
                "lost_value": _decimal_str(member_deals.get("lost_value")),
                "appointments_completed": member_appointments.get("appointments_completed", 0),
                "appointments_no_show": member_appointments.get("appointments_no_show", 0),
                "open_tasks": member_tasks.get("open_tasks", 0),
                "overdue_tasks": member_tasks.get("overdue_tasks", 0),
            }
        )
    totals = {
        "assigned_leads": sum(row["assigned_leads"] for row in rows),
        "deals_from_leads": sum(row["deals_from_leads"] for row in rows),
        "won_deals": sum(row["won_deals"] for row in rows),
        "lost_deals": sum(row["lost_deals"] for row in rows),
        "open_tasks": sum(row["open_tasks"] for row in rows),
        "overdue_tasks": sum(row["overdue_tasks"] for row in rows),
    }
    totals["lead_to_deal_rate"] = _percent(totals["deals_from_leads"], totals["assigned_leads"])
    return {
        "scope": _performance_scope(business=business, user=user),
        "totals": totals,
        "rows": rows,
    }


def _visible_performance_members(*, business, user):
    queryset = BusinessMember.objects.filter(business=business, is_active=True)
    if user is None or platform_admin_has_global_access(user) or is_platform_admin(user) or user_is_business_owner(user, business):
        return queryset
    membership = get_membership(user, business)
    if membership is None:
        return queryset.none()
    if membership.role in {BusinessMember.Roles.OWNER, BusinessMember.Roles.ADMIN}:
        return queryset
    lead_team_ids = list(membership.team_memberships.filter(is_lead=True).values_list("team_id", flat=True))
    if lead_team_ids:
        member_ids = TeamMember.objects.filter(team_id__in=lead_team_ids).values_list("member_id", flat=True)
        return queryset.filter(id__in=member_ids)
    if membership.role in {BusinessMember.Roles.MANAGER, BusinessMember.Roles.MARKETER, BusinessMember.Roles.ACCOUNTANT}:
        return queryset.filter(id=membership.id)
    return queryset.none()


def _performance_scope(*, business, user):
    if user is None or platform_admin_has_global_access(user) or is_platform_admin(user) or user_is_business_owner(user, business):
        return "business"
    membership = get_membership(user, business)
    if membership is None:
        return "none"
    if membership.role in {BusinessMember.Roles.OWNER, BusinessMember.Roles.ADMIN}:
        return "business"
    if membership.team_memberships.filter(is_lead=True).exists():
        return "team"
    if membership.role in {BusinessMember.Roles.MANAGER, BusinessMember.Roles.MARKETER, BusinessMember.Roles.ACCOUNTANT}:
        return "own"
    return "none"


def _ai_insight_cards(*, crm_funnel, connector_health, source_ids):
    cards = []
    overdue_tasks = crm_funnel["tasks"]["overdue"]
    unanswered = crm_funnel["conversations"]["unanswered"]
    no_show_rate = crm_funnel["appointments"]["no_show_rate"]
    total_appointments = crm_funnel["appointments"]["total"]
    conversion_to_deal = crm_funnel["conversion_to_deal"]["rate"]
    total_leads = crm_funnel["lead_counts"]["total"]

    if overdue_tasks:
        cards.append(_card("overdue_tasks", "critical", overdue_tasks, ["crm_funnel.tasks.overdue"], source_ids["overdue_tasks"], "/app/tasks"))
    if unanswered:
        cards.append(
            _card(
                "unanswered_conversations",
                "warning",
                unanswered,
                ["crm_funnel.conversations.unanswered"],
                source_ids["unanswered_conversations"],
                "/app/conversations?unread=true",
            )
        )
    if connector_health["error"]:
        cards.append(_card("failed_connectors", "critical", connector_health["error"], ["connector_health.error"], source_ids["failed_connectors"], "/app/integrations"))
    if total_appointments and no_show_rate >= 20:
        cards.append(
            _card(
                "appointment_no_show_rate",
                "warning",
                no_show_rate,
                ["crm_funnel.appointments.no_show_rate"],
                source_ids["no_show_appointments"],
                "/app/calendar",
            )
        )
    if total_leads and conversion_to_deal == 0:
        cards.append(
            _card(
                "lead_to_deal_missing",
                "info",
                total_leads,
                ["crm_funnel.conversion_to_deal.rate", "crm_funnel.lead_counts.total"],
                source_ids["visible_leads"],
                "/app/leads",
            )
        )
    if not cards:
        if total_leads or total_appointments or connector_health["total"]:
            cards.append(_card("crm_operating_norm", "good", 0, ["crm_funnel", "connector_health"], [], "/app/analytics"))
        else:
            cards.append(_card("no_operational_data", "info", 0, ["crm_funnel"], [], "/app/integrations", no_data=True))
    return cards[:5]


def _card(key, severity, metric_value, metric_keys, source_ids, href, *, no_data=False):
    return {
        "key": key,
        "severity": severity,
        "metric_value": metric_value,
        "source_metric_keys": metric_keys,
        "source_ids": list(source_ids),
        "href": href,
        "no_data": no_data,
    }


def _scoped(queryset, user, business, resource):
    if not resource_is_enabled(business, resource):
        return queryset.none()
    if user is None:
        return queryset
    return scope_queryset(queryset, user, business, resource, Actions.VIEW)


def _group_count(queryset, field):
    return [{"key": row[field] or "unknown", "count": row["count"]} for row in queryset.values(field).annotate(count=Count("id")).order_by("-count", field)]


def _sum_amount(queryset):
    return queryset.aggregate(total=Sum("amount"))["total"] or Decimal("0")


def _date_filter(queryset, field, start_date, end_date):
    if start_date:
        queryset = queryset.filter(**{f"{field}__date__gte": start_date})
    if end_date:
        queryset = queryset.filter(**{f"{field}__date__lte": end_date})
    return queryset


def _percent(value, total):
    return round((value / total) * 100) if total else 0


def _decimal_str(value):
    return str(value or Decimal("0"))


def _source_ids(prefix, values):
    return [f"{prefix}:{value}" for value in values]
