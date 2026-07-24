from django.db.models import Count, Q
from django.utils import timezone

from apps.bots.models import BotConversation
from apps.businesses.access import Actions, Resources, scope_queryset, user_scope_for
from apps.businesses.capabilities import is_module_enabled
from apps.businesses.models import BusinessMember, RolePermission
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.escalation import task_overdue_escalation
from apps.tasks.models import Task


OPEN_TASK_STATUSES = [Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS]
OPEN_LEAD_STATUSES = [Lead.Statuses.NEW, Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS]
UNREAD_RESPONSE_SLA_MINUTES = 30
HANDOFF_RESPONSE_SLA_MINUTES = 15


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

    task_scope, lead_scope, deal_scope, appointment_scope, conversation_scope = _scoped_work_querysets(
        business=business,
        user=user,
    )
    overdue_tasks = overdue_tasks_queryset(queryset=task_scope, now=now)
    stale_leads = stale_leads_queryset(queryset=lead_scope, now=now)
    open_deals = deal_scope.filter(status=Deal.Statuses.OPEN).select_related("client", "stage", "owner")
    sla_overdue_deals = sla_overdue_deals_queryset(open_deals, now=now)
    no_next_action_deals = no_next_action_deals_queryset(open_deals)
    upcoming_appointments = upcoming_appointments_queryset(queryset=appointment_scope, now=now)
    appointment_confirmations = appointment_confirmations_queryset(queryset=appointment_scope, now=now)
    unread_conversations = unread_conversations_queryset(queryset=conversation_scope)
    handoff_conversations = handoff_conversations_queryset(queryset=conversation_scope)
    unread_sla_overdue_conversations = unread_sla_overdue_conversations_queryset(queryset=conversation_scope, now=now)
    handoff_sla_overdue_conversations = overdue_handoff_conversations_queryset(queryset=conversation_scope, now=now)

    unassigned_tasks = task_scope.filter(assignee__isnull=True).order_by("due_at", "-priority")
    own_tasks = task_scope.filter(assignee=user).order_by("due_at", "-priority") if user else task_scope.none()
    team_tasks = task_scope.exclude(assignee__isnull=True).exclude(assignee=user).order_by("due_at", "-priority") if user else task_scope.none()
    unassigned_leads = lead_scope.filter(responsible_user__isnull=True).order_by("created_at")
    own_leads = lead_scope.filter(responsible_user=user).order_by("updated_at") if user else lead_scope.none()
    team_leads = lead_scope.exclude(responsible_user__isnull=True).exclude(responsible_user=user).order_by("updated_at") if user else lead_scope.none()
    unassigned_deals = open_deals.filter(owner__isnull=True).order_by("created_at")
    own_deals = open_deals.filter(owner=user).order_by("updated_at") if user else open_deals.none()
    team_deals = open_deals.exclude(owner__isnull=True).exclude(owner=user).order_by("updated_at") if user else open_deals.none()
    unassigned_conversations = conversation_scope.filter(
        assigned_to__isnull=True,
        status=BotConversation.Statuses.OPEN,
    ).order_by("-last_message_at", "-updated_at")
    own_conversations = conversation_scope.filter(
        assigned_to=user,
        status=BotConversation.Statuses.OPEN,
    ).order_by("-last_message_at", "-updated_at") if user else conversation_scope.none()
    team_conversations = conversation_scope.filter(status=BotConversation.Statuses.OPEN).exclude(
        assigned_to__isnull=True
    ).exclude(assigned_to=user).order_by("-last_message_at", "-updated_at") if user else conversation_scope.none()

    queues = {
        "overdue_tasks": [_task_item(task, now=now) for task in overdue_tasks[:limit]],
        "stale_leads": [_lead_item(lead, now=now) for lead in stale_leads[:limit]],
        "sla_overdue_deals": [_deal_item(deal, now=now, reason="sla_overdue") for deal in sla_overdue_deals[:limit]],
        "no_next_action_deals": [_deal_item(deal, now=now, reason="no_next_action") for deal in no_next_action_deals[:limit]],
        "upcoming_appointments": [_appointment_item(appointment) for appointment in upcoming_appointments[:limit]],
        "appointment_confirmations": [_appointment_item(appointment) for appointment in appointment_confirmations[:limit]],
        "unread_conversations": [_conversation_item(conversation, reason="unread", now=now) for conversation in unread_conversations[:limit]],
        "handoff_conversations": [_conversation_item(conversation, reason="handoff_required", now=now) for conversation in handoff_conversations[:limit]],
        "unread_sla_overdue_conversations": [
            _conversation_item(conversation, reason="unread_sla_overdue", now=now) for conversation in unread_sla_overdue_conversations[:limit]
        ],
        "handoff_sla_overdue_conversations": [
            _conversation_item(conversation, reason="handoff_sla_overdue", now=now) for conversation in handoff_sla_overdue_conversations[:limit]
        ],
        "unassigned_tasks": [_task_item(task, now=now) for task in unassigned_tasks[:limit]],
        "own_tasks": [_task_item(task, now=now) for task in own_tasks[:limit]],
        "team_tasks": [_task_item(task, now=now) for task in team_tasks[:limit]],
        "unassigned_leads": [_lead_item(lead, now=now) for lead in unassigned_leads[:limit]],
        "own_leads": [_lead_item(lead, now=now) for lead in own_leads[:limit]],
        "team_leads": [_lead_item(lead, now=now) for lead in team_leads[:limit]],
        "unassigned_deals": [_deal_item(deal, now=now, reason="unassigned") for deal in unassigned_deals[:limit]],
        "own_deals": [_deal_item(deal, now=now, reason="assigned_to_me") for deal in own_deals[:limit]],
        "team_deals": [_deal_item(deal, now=now, reason="team") for deal in team_deals[:limit]],
        "unassigned_conversations": [
            _conversation_item(conversation, reason="unassigned", now=now) for conversation in unassigned_conversations[:limit]
        ],
        "own_conversations": [
            _conversation_item(conversation, reason="assigned_to_me", now=now) for conversation in own_conversations[:limit]
        ],
        "team_conversations": [
            _conversation_item(conversation, reason="team", now=now) for conversation in team_conversations[:limit]
        ],
    }
    summary = _work_queue_summary(
        task_scope=task_scope,
        lead_scope=lead_scope,
        open_deals=open_deals,
        appointment_scope=appointment_scope,
        conversation_scope=conversation_scope,
        sla_overdue_deals=sla_overdue_deals,
        no_next_action_deals=no_next_action_deals,
        user=user,
        now=now,
    )
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
        "scope": {
            "tasks": user_scope_for(user, business, Resources.TASKS, Actions.VIEW) if user else RolePermission.Scopes.BUSINESS,
            "leads": user_scope_for(user, business, Resources.LEADS, Actions.VIEW) if user else RolePermission.Scopes.BUSINESS,
            "deals": user_scope_for(user, business, Resources.DEALS, Actions.VIEW) if user else RolePermission.Scopes.BUSINESS,
            "appointments": user_scope_for(user, business, Resources.APPOINTMENTS, Actions.VIEW) if user else RolePermission.Scopes.BUSINESS,
            "conversations": user_scope_for(user, business, Resources.CONVERSATIONS, Actions.VIEW) if user else RolePermission.Scopes.BUSINESS,
        },
        "summary": summary,
        "queues": queues,
    }


def _work_queue_summary(
    *,
    task_scope,
    lead_scope,
    open_deals,
    appointment_scope,
    conversation_scope,
    sla_overdue_deals,
    no_next_action_deals,
    user,
    now,
):
    empty = Q(pk__in=[])
    own_task = Q(assignee=user) if user else empty
    team_task = Q(assignee__isnull=False) & ~Q(assignee=user) if user else empty
    task_counts = task_scope.aggregate(
        overdue_tasks=Count(
            "id",
            filter=Q(due_at__lt=now)
            & (Q(snoozed_until__isnull=True) | Q(snoozed_until__lte=now)),
            distinct=True,
        ),
        unassigned_tasks=Count("id", filter=Q(assignee__isnull=True), distinct=True),
        own_tasks=Count("id", filter=own_task, distinct=True),
        team_tasks=Count("id", filter=team_task, distinct=True),
    )

    stale_before = now - timezone.timedelta(days=3)
    own_lead = Q(responsible_user=user) if user else empty
    team_lead = Q(responsible_user__isnull=False) & ~Q(responsible_user=user) if user else empty
    lead_counts = lead_scope.aggregate(
        stale_leads=Count(
            "id",
            filter=Q(status__in=OPEN_LEAD_STATUSES)
            & (Q(responsible_user__isnull=True) | Q(updated_at__lte=stale_before)),
            distinct=True,
        ),
        unassigned_leads=Count("id", filter=Q(responsible_user__isnull=True), distinct=True),
        own_leads=Count("id", filter=own_lead, distinct=True),
        team_leads=Count("id", filter=team_lead, distinct=True),
    )

    own_deal = Q(owner=user) if user else empty
    team_deal = Q(owner__isnull=False) & ~Q(owner=user) if user else empty
    deal_counts = open_deals.aggregate(
        unassigned_deals=Count("id", filter=Q(owner__isnull=True), distinct=True),
        own_deals=Count("id", filter=own_deal, distinct=True),
        team_deals=Count("id", filter=team_deal, distinct=True),
    )
    deal_counts.update(
        {
            "sla_overdue_deals": sla_overdue_deals.count(),
            "no_next_action_deals": no_next_action_deals.count(),
        }
    )

    appointment_counts = appointment_scope.aggregate(
        upcoming_appointments=Count(
            "id",
            filter=Q(
                status__in=[Appointment.Statuses.CREATED, Appointment.Statuses.CONFIRMED],
                start_at__gte=now,
                start_at__lte=now + timezone.timedelta(hours=24),
            ),
            distinct=True,
        ),
        appointment_confirmations=Count(
            "id",
            filter=Q(status=Appointment.Statuses.CREATED, start_at__gte=now),
            distinct=True,
        ),
    )

    open_conversation = Q(status=BotConversation.Statuses.OPEN)
    own_conversation = (
        open_conversation & Q(assigned_to=user)
        if user
        else empty
    )
    team_conversation = (
        open_conversation & Q(assigned_to__isnull=False) & ~Q(assigned_to=user)
        if user
        else empty
    )
    conversation_counts = conversation_scope.aggregate(
        unread_conversations=Count(
            "id",
            filter=open_conversation & Q(unread_count__gt=0),
            distinct=True,
        ),
        handoff_conversations=Count(
            "id",
            filter=open_conversation & Q(handoff_required=True),
            distinct=True,
        ),
        unread_sla_overdue_conversations=Count(
            "id",
            filter=(
                open_conversation
                & Q(unread_count__gt=0)
                & Q(
                    last_inbound_at__lt=now
                    - timezone.timedelta(minutes=UNREAD_RESPONSE_SLA_MINUTES)
                )
            ),
            distinct=True,
        ),
        handoff_sla_overdue_conversations=Count(
            "id",
            filter=(
                open_conversation
                & Q(handoff_required=True)
                & Q(
                    last_inbound_at__lt=now
                    - timezone.timedelta(minutes=HANDOFF_RESPONSE_SLA_MINUTES)
                )
            ),
            distinct=True,
        ),
        unassigned_conversations=Count(
            "id",
            filter=open_conversation & Q(assigned_to__isnull=True),
            distinct=True,
        ),
        own_conversations=Count("id", filter=own_conversation, distinct=True),
        team_conversations=Count("id", filter=team_conversation, distinct=True),
    )

    return {
        **task_counts,
        **lead_counts,
        **deal_counts,
        **appointment_counts,
        **conversation_counts,
    }


def _scoped_work_querysets(*, business, user):
    task_scope = _active_tasks().filter(business=business)
    lead_scope = Lead.objects.filter(business=business, is_archived=False)
    deal_scope = Deal.objects.filter(business=business, is_archived=False)
    appointment_scope = Appointment.objects.filter(business=business, is_archived=False)
    conversation_scope = BotConversation.objects.filter(business=business, is_archived=False)
    if not is_module_enabled(business, "tasks"):
        task_scope = task_scope.none()
    if not is_module_enabled(business, "leads"):
        lead_scope = lead_scope.none()
    if not is_module_enabled(business, "deals"):
        deal_scope = deal_scope.none()
    if not is_module_enabled(business, "appointments"):
        appointment_scope = appointment_scope.none()
    if not is_module_enabled(business, "inbox"):
        conversation_scope = conversation_scope.none()
    if user is None:
        return task_scope, lead_scope, deal_scope, appointment_scope, conversation_scope

    task_scope = scope_queryset(task_scope, user, business, Resources.TASKS)
    lead_scope = scope_queryset(lead_scope, user, business, Resources.LEADS)
    deal_scope = scope_queryset(deal_scope, user, business, Resources.DEALS)
    appointment_scope = scope_queryset(appointment_scope, user, business, Resources.APPOINTMENTS)
    conversation_scope = scope_queryset(conversation_scope, user, business, Resources.CONVERSATIONS)

    membership = business.members.filter(user=user, is_active=True).first()
    if business.owner_id == user.id or (membership and membership.role in {BusinessMember.Roles.ADMIN, BusinessMember.Roles.MANAGER}):
        task_scope = _active_tasks().filter(business=business).filter(
            Q(id__in=task_scope.values("id")) | Q(assignee__isnull=True)
        )
        lead_scope = Lead.objects.filter(business=business, is_archived=False).filter(
            Q(id__in=lead_scope.values("id")) | Q(responsible_user__isnull=True)
        )
        deal_scope = Deal.objects.filter(business=business, is_archived=False).filter(
            Q(id__in=deal_scope.values("id")) | Q(owner__isnull=True)
        )
        conversation_scope = BotConversation.objects.filter(business=business, is_archived=False).filter(
            Q(id__in=conversation_scope.values("id")) | Q(assigned_to__isnull=True)
        )
    return task_scope, lead_scope, deal_scope, appointment_scope, conversation_scope


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
        .select_related("client", "lead", "deal", "appointment", "conversation", "assignee")
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
        .filter(Q(responsible_user__isnull=True) | Q(updated_at__lte=stale_before))
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


def unread_sla_overdue_conversations_queryset(*, business=None, queryset=None, now=None, minutes=UNREAD_RESPONSE_SLA_MINUTES):
    now = now or timezone.now()
    return unread_conversations_queryset(business=business, queryset=queryset).filter(
        last_inbound_at__lt=now - timezone.timedelta(minutes=minutes)
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


def overdue_handoff_conversations_queryset(*, business=None, queryset=None, now=None, minutes=HANDOFF_RESPONSE_SLA_MINUTES):
    now = now or timezone.now()
    return handoff_conversations_queryset(business=business, queryset=queryset).filter(
        last_inbound_at__lt=now - timezone.timedelta(minutes=minutes)
    )


def missed_chat_handoffs_queryset(*, business=None, queryset=None):
    return handoff_conversations_queryset(business=business, queryset=queryset).filter(
        assigned_to__isnull=False,
        last_outbound_at__isnull=True,
    )


def _task_item(task, *, now):
    escalation = task_overdue_escalation(task, now=now)
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
        "conversation_id": task.conversation_id,
        "assignee_id": task.assignee_id,
        "overdue_minutes": escalation["overdue_minutes"],
        "escalation_level": escalation["escalation_level"],
        "escalation_reason": escalation["escalation_reason"],
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


def _conversation_item(conversation, *, reason, now=None):
    now = now or timezone.now()
    sla_minutes = HANDOFF_RESPONSE_SLA_MINUTES if reason in {"handoff_required", "handoff_sla_overdue"} else UNREAD_RESPONSE_SLA_MINUTES
    sla_due_at = conversation.last_inbound_at + timezone.timedelta(minutes=sla_minutes) if conversation.last_inbound_at else None
    sla_overdue_minutes = max(0, round((now - sla_due_at).total_seconds() / 60)) if sla_due_at and now > sla_due_at else 0
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
        "sla_minutes": sla_minutes,
        "sla_due_at": sla_due_at.isoformat() if sla_due_at else None,
        "sla_overdue_minutes": sla_overdue_minutes,
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
