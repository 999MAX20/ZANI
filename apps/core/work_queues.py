from django.db.models import Q
from django.utils import timezone

from apps.bots.models import BotConversation
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


OPEN_TASK_STATUSES = [Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS]
OPEN_LEAD_STATUSES = [Lead.Statuses.NEW, Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS]


def lead_sla_overdue(lead, *, now=None):
    now = now or timezone.now()
    return bool(
        lead.status == Lead.Statuses.NEW
        and lead.first_responded_at is None
        and lead.response_due_at
        and lead.response_due_at < now
    )


def deal_sla_overdue(deal, *, now=None):
    now = now or timezone.now()
    if not deal.stage or not deal.stage.sla_minutes or not deal.stage_entered_at:
        return False
    return now > deal.stage_entered_at + timezone.timedelta(minutes=deal.stage.sla_minutes)


def deal_risk(deal, *, next_task=None, now=None):
    now = now or timezone.now()
    if deal_sla_overdue(deal, now=now):
        return "high", 86
    if deal.expected_close_at and deal.expected_close_at < now.date():
        return "high", 78
    if deal.status == Deal.Statuses.OPEN and next_task is None and not deal.next_action_at:
        return "medium", 62
    return "low", 24 if deal.status == Deal.Statuses.OPEN else 12


def build_work_queues(*, business, user=None, limit=10, now=None):
    now = now or timezone.now()
    limit = max(1, min(int(limit or 10), 50))

    overdue_tasks = overdue_tasks_queryset(business=business, now=now)
    stale_leads = stale_leads_queryset(business=business, now=now)
    open_deals = Deal.objects.filter(business=business, status=Deal.Statuses.OPEN, is_archived=False).select_related("client", "stage", "owner")
    sla_overdue_deals = sla_overdue_deals_queryset(open_deals, now=now)
    no_next_action_deals = no_next_action_deals_queryset(open_deals)
    upcoming_appointments = upcoming_appointments_queryset(business=business, now=now)
    appointment_confirmations = appointment_confirmations_queryset(business=business, now=now)
    unread_conversations = unread_conversations_queryset(business=business)
    handoff_conversations = handoff_conversations_queryset(business=business)

    queues = {
        "overdue_tasks": [_task_item(task) for task in overdue_tasks[:limit]],
        "stale_leads": [_lead_item(lead, now=now) for lead in stale_leads[:limit]],
        "sla_overdue_deals": [_deal_item(deal, now=now, reason="sla_overdue") for deal in sla_overdue_deals[:limit]],
        "no_next_action_deals": [_deal_item(deal, now=now, reason="no_next_action") for deal in no_next_action_deals[:limit]],
        "upcoming_appointments": [_appointment_item(appointment) for appointment in upcoming_appointments[:limit]],
        "appointment_confirmations": [_appointment_item(appointment) for appointment in appointment_confirmations[:limit]],
        "unread_conversations": [_conversation_item(conversation, reason="unread") for conversation in unread_conversations[:limit]],
        "handoff_conversations": [_conversation_item(conversation, reason="handoff_required") for conversation in handoff_conversations[:limit]],
    }
    summary = {key: query.count() for key, query in {
        "overdue_tasks": overdue_tasks,
        "stale_leads": stale_leads,
        "sla_overdue_deals": sla_overdue_deals,
        "no_next_action_deals": no_next_action_deals,
        "upcoming_appointments": upcoming_appointments,
        "appointment_confirmations": appointment_confirmations,
        "unread_conversations": unread_conversations,
        "handoff_conversations": handoff_conversations,
    }.items()}
    summary["total_attention"] = (
        summary["overdue_tasks"]
        + summary["stale_leads"]
        + summary["sla_overdue_deals"]
        + summary["no_next_action_deals"]
        + summary["appointment_confirmations"]
        + summary["unread_conversations"]
        + summary["handoff_conversations"]
    )
    return {
        "business": business.id,
        "generated_at": now.isoformat(),
        "limit": limit,
        "summary": summary,
        "queues": queues,
    }


def _active_tasks():
    return Task.objects.filter(is_archived=False).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])


def overdue_tasks_queryset(*, business=None, queryset=None, now=None):
    now = now or timezone.now()
    queryset = queryset if queryset is not None else _active_tasks()
    queryset = _without_archived(queryset)
    if business is not None:
        queryset = queryset.filter(business=business)
    return (
        queryset.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        .filter(due_at__lt=now)
        .filter(Q(snoozed_until__isnull=True) | Q(snoozed_until__lte=now))
        .select_related("client", "lead", "deal", "appointment", "assignee")
        .order_by("due_at", "-priority", "-created_at")
    )


def stale_leads_queryset(*, business=None, queryset=None, now=None):
    now = now or timezone.now()
    stale_before = now - timezone.timedelta(days=3)
    queryset = queryset if queryset is not None else Lead.objects.filter(is_archived=False)
    queryset = _without_archived(queryset)
    if business is not None:
        queryset = queryset.filter(business=business)
    return (
        queryset.filter(status__in=OPEN_LEAD_STATUSES)
        .filter(
            Q(responsible_user__isnull=True)
            | Q(updated_at__lte=stale_before)
            | Q(status=Lead.Statuses.NEW, first_responded_at__isnull=True, response_due_at__lt=now)
        )
        .select_related("client", "service", "responsible_user")
        .order_by("updated_at", "-created_at")
    )


def sla_overdue_deals_queryset(queryset, *, now=None):
    now = now or timezone.now()
    overdue_ids = []
    for deal in queryset.filter(stage__sla_minutes__isnull=False, stage_entered_at__isnull=False).select_related("stage"):
        if deal_sla_overdue(deal, now=now):
            overdue_ids.append(deal.id)
    return queryset.filter(id__in=overdue_ids).order_by("stage_entered_at", "-updated_at")


def no_next_action_deals_queryset(queryset):
    return (
        queryset.filter(next_action_at__isnull=True)
        .exclude(tasks__status__in=OPEN_TASK_STATUSES, tasks__is_archived=False)
        .distinct()
        .order_by("expected_close_at", "-updated_at")
    )


def upcoming_appointments_queryset(*, business=None, queryset=None, now=None):
    now = now or timezone.now()
    queryset = queryset if queryset is not None else Appointment.objects.filter(is_archived=False)
    queryset = _without_archived(queryset)
    if business is not None:
        queryset = queryset.filter(business=business)
    return (
        queryset.filter(
            status__in=[Appointment.Statuses.CREATED, Appointment.Statuses.CONFIRMED],
            start_at__gte=now,
            start_at__lte=now + timezone.timedelta(hours=24),
        )
        .select_related("client", "lead", "service", "resource")
        .order_by("start_at")
    )


def appointment_confirmations_queryset(*, business=None, queryset=None, now=None):
    now = now or timezone.now()
    queryset = queryset if queryset is not None else Appointment.objects.filter(is_archived=False)
    queryset = _without_archived(queryset)
    if business is not None:
        queryset = queryset.filter(business=business)
    return (
        queryset.filter(
            status=Appointment.Statuses.CREATED,
            start_at__gte=now,
        )
        .select_related("client", "lead", "service", "resource")
        .order_by("start_at")
    )


def unread_conversations_queryset(*, business=None, queryset=None):
    queryset = queryset if queryset is not None else BotConversation.objects.filter(is_archived=False)
    queryset = _without_archived(queryset)
    if business is not None:
        queryset = queryset.filter(business=business)
    return (
        queryset.filter(status=BotConversation.Statuses.OPEN, unread_count__gt=0)
        .select_related("client", "lead", "deal", "assigned_to", "bot")
        .order_by("-last_message_at", "-updated_at")
    )


def handoff_conversations_queryset(*, business=None, queryset=None):
    queryset = queryset if queryset is not None else BotConversation.objects.filter(is_archived=False)
    queryset = _without_archived(queryset)
    if business is not None:
        queryset = queryset.filter(business=business)
    return (
        queryset.filter(status=BotConversation.Statuses.OPEN, handoff_required=True)
        .select_related("client", "lead", "deal", "assigned_to", "bot")
        .order_by("-last_inbound_at", "-updated_at")
    )


def overdue_handoff_conversations_queryset(*, business=None, queryset=None, now=None, minutes=15):
    now = now or timezone.now()
    return handoff_conversations_queryset(business=business, queryset=queryset).filter(
        last_inbound_at__lt=now - timezone.timedelta(minutes=minutes)
    )


def missed_chat_handoffs_queryset(*, business=None, queryset=None):
    return handoff_conversations_queryset(business=business, queryset=queryset).filter(
        assigned_to__isnull=False,
        last_outbound_at__isnull=True,
    )


def _task_item(task):
    return {
        "type": "task",
        "id": task.id,
        "title": task.title,
        "priority": task.priority,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "client_id": task.client_id,
        "lead_id": task.lead_id,
        "deal_id": task.deal_id,
        "appointment_id": task.appointment_id,
        "assignee_id": task.assignee_id,
        "href": f"/app/tasks?task={task.id}",
    }


def _lead_item(lead, *, now):
    return {
        "type": "lead",
        "id": lead.id,
        "title": str(lead.client),
        "status": lead.status,
        "source": lead.source,
        "client_id": lead.client_id,
        "responsible_user_id": lead.responsible_user_id,
        "age_hours": _hours_since(lead.updated_at, now=now),
        "response_due_at": lead.response_due_at.isoformat() if lead.response_due_at else None,
        "sla_overdue": lead_sla_overdue(lead, now=now),
        "href": f"/app/leads?lead={lead.id}",
    }


def _deal_item(deal, *, now, reason):
    risk_level, risk_percent = deal_risk(deal, now=now)
    return {
        "type": "deal",
        "id": deal.id,
        "title": deal.title,
        "reason": reason,
        "status": deal.status,
        "stage_id": deal.stage_id,
        "stage_name": deal.stage.name if deal.stage else "",
        "client_id": deal.client_id,
        "owner_id": deal.owner_id,
        "amount": str(deal.amount),
        "currency": deal.currency,
        "risk_level": risk_level,
        "risk_percent": risk_percent,
        "href": f"/app/deals?deal={deal.id}",
    }


def _appointment_item(appointment):
    return {
        "type": "appointment",
        "id": appointment.id,
        "title": str(appointment.client),
        "status": appointment.status,
        "client_id": appointment.client_id,
        "lead_id": appointment.lead_id,
        "service_id": appointment.service_id,
        "resource_id": appointment.resource_id,
        "start_at": appointment.start_at.isoformat(),
        "end_at": appointment.end_at.isoformat(),
        "href": f"/app/calendar?appointment={appointment.id}",
    }


def _conversation_item(conversation, *, reason):
    return {
        "type": "conversation",
        "id": conversation.id,
        "title": str(conversation.client) if conversation.client else conversation.external_user_id or f"Conversation #{conversation.id}",
        "reason": reason,
        "channel": conversation.channel,
        "priority": conversation.priority,
        "unread_count": conversation.unread_count,
        "handoff_required": conversation.handoff_required,
        "handoff_reason": conversation.handoff_reason,
        "client_id": conversation.client_id,
        "lead_id": conversation.lead_id,
        "deal_id": conversation.deal_id,
        "assigned_to_id": conversation.assigned_to_id,
        "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
        "last_inbound_at": conversation.last_inbound_at.isoformat() if conversation.last_inbound_at else None,
        "href": f"/app/conversations?conversation={conversation.id}",
    }


def _hours_since(value, *, now):
    if not value:
        return None
    return round((now - value).total_seconds() / 3600, 1)


def _without_archived(queryset):
    if any(field.name == "is_archived" for field in queryset.model._meta.fields):
        return queryset.filter(is_archived=False)
    return queryset
