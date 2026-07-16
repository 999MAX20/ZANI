from decimal import Decimal, InvalidOperation

from django.db.models import Count, Q, Sum
from django.utils.dateparse import parse_date
from django.utils import timezone

from apps.businesses.access import Actions, Resources, can, scope_queryset
from apps.ai_core.models import ApprovalRequest
from apps.ai_core.services import approval_resource_for_action
from apps.bots.models import BotConversation, BotMessage
from apps.clients.models import Client
from apps.crm.models import Deal
from apps.integrations.models import BusinessEvent
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment
from apps.tasks.models import Task


MOBILE_HOME_LIMIT = 5
SALES_REVENUE_EVENT_TYPES = [
    "sale.recorded",
    "sale_imported",
    "kaspi_order_imported",
    "kaspi_sale_detected",
    "moysklad_sale_imported",
]


def build_mobile_home(*, user, business, limit=MOBILE_HOME_LIMIT):
    now = timezone.now()
    today = timezone.localdate()
    limit = max(1, min(int(limit or MOBILE_HOME_LIMIT), 10))

    payload = {
        "business": business.id,
        "generated_at": now,
        "limit": limit,
        "sections": {},
        "kpis": [],
        "attention": {
            "total": 0,
            "items": [],
        },
        "quick_actions": [],
    }

    lead_queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.LEADS,
        queryset=Lead.objects.filter(business=business, is_archived=False).select_related("client", "service", "responsible_user"),
    )
    task_queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.TASKS,
        queryset=Task.objects.filter(business=business, is_archived=False).select_related("client", "lead", "deal", "assignee"),
    )
    appointment_queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.APPOINTMENTS,
        queryset=Appointment.objects.filter(business=business, is_archived=False).select_related("client", "lead", "service", "resource"),
    )
    conversation_queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.CONVERSATIONS,
        queryset=BotConversation.objects.filter(business=business, is_archived=False).select_related("client", "lead", "assigned_to", "bot"),
    )
    deal_queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.DEALS,
        queryset=Deal.objects.filter(business=business, is_archived=False).select_related("client", "stage", "owner"),
    )

    if lead_queryset is not None:
        _attach_leads(payload, lead_queryset, limit=limit)
    if task_queryset is not None:
        _attach_tasks(payload, task_queryset, now=now, limit=limit)
    if appointment_queryset is not None:
        _attach_appointments(payload, appointment_queryset, today=today, now=now, limit=limit)
    if conversation_queryset is not None:
        _attach_conversations(payload, conversation_queryset, limit=limit)
    if deal_queryset is not None:
        _attach_deals(payload, deal_queryset)
    if can(user, business, Resources.ANALYTICS, Actions.VIEW).allowed:
        _attach_revenue(payload, business=business, today=today)

    payload["attention"]["items"] = sorted(
        payload["attention"]["items"],
        key=lambda item: (item["priority"], item["created_at"] or ""),
    )[: limit * 2]
    payload["attention"]["total"] = sum(item["count"] for item in payload["attention"]["items"])
    payload["quick_actions"] = _quick_actions(user=user, business=business)
    payload["payload_budget"] = {
        "target_kb": 50,
        "max_items_per_section": limit,
    }
    return payload


def build_mobile_today(*, user, business, date_value=None, limit=20):
    today = parse_date(str(date_value or "")) or timezone.localdate()
    limit = max(1, min(int(limit or 20), 50))
    appointments = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.APPOINTMENTS,
        queryset=Appointment.objects.filter(business=business, is_archived=False).select_related("client", "lead", "service", "resource"),
    )
    tasks = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.TASKS,
        queryset=Task.objects.filter(business=business, is_archived=False).select_related("client", "lead", "deal", "assignee"),
    )
    sections = {}
    if appointments is not None:
        appointment_items = appointments.filter(start_at__date=today).order_by("start_at", "id")[:limit]
        sections["appointments"] = {
            "date": today.isoformat(),
            "total": appointments.filter(start_at__date=today).count(),
            "items": [_appointment_item(appointment) for appointment in appointment_items],
        }
    if tasks is not None:
        active_tasks = tasks.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        task_items = active_tasks.filter(due_at__date=today).order_by("due_at", "-priority", "-created_at")[:limit]
        overdue = active_tasks.filter(due_at__lt=timezone.now())
        sections["tasks"] = {
            "date": today.isoformat(),
            "total": active_tasks.filter(due_at__date=today).count(),
            "overdue": overdue.count(),
            "items": [_task_item(task) for task in task_items],
        }
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "date": today.isoformat(),
        "limit": limit,
        "sections": sections,
        "payload_budget": {
            "target_kb": 80,
            "max_items_per_section": limit,
        },
    }


def build_mobile_actions(*, user, business, limit=20):
    now = timezone.now()
    limit = max(1, min(int(limit or 20), 50))
    actions = []
    lead_queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.LEADS,
        queryset=Lead.objects.filter(business=business, is_archived=False).select_related("client", "service", "responsible_user"),
    )
    task_queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.TASKS,
        queryset=Task.objects.filter(business=business, is_archived=False).select_related("client", "lead", "deal", "assignee"),
    )
    appointment_queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.APPOINTMENTS,
        queryset=Appointment.objects.filter(business=business, is_archived=False).select_related("client", "lead", "service", "resource"),
    )
    conversation_queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.CONVERSATIONS,
        queryset=BotConversation.objects.filter(business=business, is_archived=False).select_related("client", "lead", "assigned_to", "bot"),
    )

    if task_queryset is not None:
        overdue_tasks = (
            task_queryset.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
            .filter(due_at__lt=now)
            .order_by("due_at", "-priority", "-created_at")[:limit]
        )
        actions.extend(_action_item("complete_task", "task", task.due_at, 10, _task_item(task)) for task in overdue_tasks)
    if conversation_queryset is not None:
        handoff_conversations = conversation_queryset.filter(
            status=BotConversation.Statuses.OPEN,
            handoff_required=True,
        ).order_by("-last_inbound_at", "-updated_at")[:limit]
        actions.extend(_action_item("reply_conversation", "conversation", item.last_inbound_at, 15, _conversation_item(item)) for item in handoff_conversations)
    if lead_queryset is not None:
        new_leads = lead_queryset.filter(status=Lead.Statuses.NEW).order_by("-created_at", "-id")[:limit]
        actions.extend(_action_item("process_lead", "lead", lead.created_at, 20, _lead_item(lead)) for lead in new_leads)
    if appointment_queryset is not None:
        confirmations = appointment_queryset.filter(
            status=Appointment.Statuses.CREATED,
            start_at__gte=now,
        ).order_by("start_at", "id")[:limit]
        actions.extend(_action_item("confirm_appointment", "appointment", appointment.start_at, 30, _appointment_item(appointment)) for appointment in confirmations)
    actions.extend(_approval_action_item(approval) for approval in _pending_approvals_for_mobile(user=user, business=business, limit=limit))

    actions = sorted(actions, key=lambda item: (item["priority"], item["sort_at"] or ""))[:limit]
    for item in actions:
        item.pop("sort_at", None)
    return {
        "business": business.id,
        "generated_at": now,
        "limit": limit,
        "total": len(actions),
        "items": actions,
        "payload_budget": {
            "target_kb": 50,
            "max_items": limit,
        },
    }


def build_mobile_inbox(*, user, business, limit=20):
    limit = max(1, min(int(limit or 20), 50))
    queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.CONVERSATIONS,
        queryset=BotConversation.objects.filter(business=business, is_archived=False).select_related("client", "lead", "assigned_to", "bot"),
    )
    if queryset is None:
        items = []
        total = 0
        unread = 0
        handoff = 0
    else:
        open_queryset = queryset.filter(status=BotConversation.Statuses.OPEN)
        conversations = open_queryset.order_by("-last_message_at", "-updated_at")[:limit]
        items = [_conversation_item_with_preview(conversation) for conversation in conversations]
        total = open_queryset.count()
        unread = open_queryset.filter(unread_count__gt=0).count()
        handoff = open_queryset.filter(handoff_required=True).count()
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "limit": limit,
        "summary": {
            "open": total,
            "unread": unread,
            "handoff_required": handoff,
        },
        "items": items,
        "payload_budget": {
            "target_kb": 100,
            "max_items": limit,
        },
    }


def build_mobile_leads(*, user, business, limit=20, status="", search=""):
    limit = max(1, min(int(limit or 20), 50))
    queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.LEADS,
        queryset=Lead.objects.filter(business=business, is_archived=False).select_related("client", "service", "responsible_user"),
    )
    if queryset is None:
        filtered = Lead.objects.none()
    else:
        filtered = queryset
        if status:
            filtered = filtered.filter(status=status)
        query = (search or "").strip()
        if query:
            filtered = filtered.filter(
                Q(client__full_name__icontains=query)
                | Q(client__phone__icontains=query)
                | Q(client__email__icontains=query)
                | Q(message__icontains=query)
                | Q(service__name__icontains=query)
            )
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "limit": limit,
        "summary": {
            "total": filtered.count(),
            "new": filtered.filter(status=Lead.Statuses.NEW).count(),
            "unassigned": filtered.filter(responsible_user__isnull=True).count(),
            "in_progress": filtered.filter(status__in=[Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS]).count(),
        },
        "items": [_lead_item(lead) for lead in filtered.order_by("-created_at", "-id")[:limit]],
        "payload_budget": {
            "target_kb": 100,
            "max_items": limit,
        },
    }


def build_mobile_notifications(*, user, business, limit=20, unread_only=False):
    limit = max(1, min(int(limit or 20), 50))
    queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.NOTIFICATIONS,
        queryset=Notification.objects.filter(business=business).select_related("client", "appointment", "recipient"),
    )
    if queryset is None:
        filtered = Notification.objects.none()
    else:
        filtered = queryset.exclude(
            Q(action_url__startswith="/app/conversations")
            & Q(recipient__isnull=False)
            & ~Q(recipient=user)
        )
        if unread_only:
            filtered = filtered.filter(read_at__isnull=True)
    unread = filtered.filter(read_at__isnull=True)
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "limit": limit,
        "summary": {
            "total": filtered.count(),
            "unread": unread.count(),
            "urgent": unread.filter(priority=Notification.Priorities.URGENT).count(),
            "failed": filtered.filter(status=Notification.Statuses.FAILED).count(),
        },
        "items": [_notification_item(notification) for notification in filtered.order_by("read_at", "-send_at", "-id")[:limit]],
        "payload_budget": {
            "target_kb": 80,
            "max_items": limit,
        },
    }


def build_mobile_clients(*, user, business, limit=20, search=""):
    limit = max(1, min(int(limit or 20), 50))
    queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.CLIENTS,
        queryset=Client.objects.filter(business=business, is_archived=False),
    )
    if queryset is None:
        filtered = Client.objects.none()
    else:
        filtered = queryset
        query = (search or "").strip()
        if query:
            filtered = filtered.filter(
                Q(full_name__icontains=query)
                | Q(phone__icontains=query)
                | Q(email__icontains=query)
                | Q(notes__icontains=query)
            )
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "limit": limit,
        "summary": {
            "total": filtered.count(),
            "with_phone": filtered.exclude(phone="").count(),
            "with_email": filtered.exclude(email="").count(),
        },
        "items": [_client_item(client) for client in filtered.order_by("-updated_at", "-id")[:limit]],
        "payload_budget": {
            "target_kb": 100,
            "max_items": limit,
        },
    }


def build_mobile_tasks(*, user, business, limit=20, status="", due=""):
    now = timezone.now()
    today = timezone.localdate()
    limit = max(1, min(int(limit or 20), 50))
    queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.TASKS,
        queryset=Task.objects.filter(business=business, is_archived=False).select_related("client", "lead", "deal", "assignee"),
    )
    if queryset is None:
        filtered = Task.objects.none()
    else:
        filtered = queryset
        if status:
            filtered = filtered.filter(status=status)
        if due == "today":
            filtered = filtered.filter(due_at__date=today)
        elif due == "overdue":
            filtered = filtered.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED]).filter(due_at__lt=now)
    active = filtered.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
    return {
        "business": business.id,
        "generated_at": now,
        "limit": limit,
        "summary": {
            "total": filtered.count(),
            "open": active.count(),
            "overdue": active.filter(due_at__lt=now).count(),
            "today": active.filter(due_at__date=today).count(),
        },
        "items": [_task_item(task) for task in filtered.order_by("due_at", "-priority", "-created_at", "-id")[:limit]],
        "payload_budget": {
            "target_kb": 100,
            "max_items": limit,
        },
    }


def build_mobile_appointments(*, user, business, limit=20, date_value=None, status=""):
    today = parse_date(str(date_value or "")) or timezone.localdate()
    now = timezone.now()
    limit = max(1, min(int(limit or 20), 50))
    queryset = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.APPOINTMENTS,
        queryset=Appointment.objects.filter(business=business, is_archived=False).select_related("client", "lead", "service", "resource"),
    )
    if queryset is None:
        filtered = Appointment.objects.none()
    else:
        filtered = queryset
        if status:
            filtered = filtered.filter(status=status)
        if date_value:
            filtered = filtered.filter(start_at__date=today)
    upcoming = filtered.filter(
        status__in=[Appointment.Statuses.CREATED, Appointment.Statuses.CONFIRMED],
        start_at__gte=now,
    )
    return {
        "business": business.id,
        "generated_at": now,
        "limit": limit,
        "date": today.isoformat(),
        "summary": {
            "total": filtered.count(),
            "today": filtered.filter(start_at__date=today).count(),
            "upcoming": upcoming.count(),
            "needs_confirmation": upcoming.filter(status=Appointment.Statuses.CREATED).count(),
        },
        "items": [_appointment_item(appointment) for appointment in filtered.order_by("start_at", "id")[:limit]],
        "payload_budget": {
            "target_kb": 100,
            "max_items": limit,
        },
    }


def build_mobile_client_detail(*, user, business, client_id):
    client = _mobile_object_or_none(
        user=user,
        business=business,
        resource=Resources.CLIENTS,
        queryset=Client.objects.filter(business=business, is_archived=False),
        object_id=client_id,
    )
    if client is None:
        return None
    leads = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.LEADS,
        queryset=Lead.objects.filter(business=business, client=client, is_archived=False).select_related("client", "service", "responsible_user"),
    )
    tasks = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.TASKS,
        queryset=Task.objects.filter(business=business, client=client, is_archived=False).select_related("client", "lead", "deal", "assignee"),
    )
    appointments = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.APPOINTMENTS,
        queryset=Appointment.objects.filter(business=business, client=client, is_archived=False).select_related("client", "lead", "service", "resource"),
    )
    conversations = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.CONVERSATIONS,
        queryset=BotConversation.objects.filter(business=business, client=client, is_archived=False).select_related("client", "lead", "assigned_to", "bot"),
    )
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "client": _client_item(client),
        "details": {
            "notes": (client.notes or "")[:1000],
            "normalized_phone": client.normalized_phone,
            "normalized_email": client.normalized_email,
            "whatsapp_id": client.whatsapp_id,
            "telegram_id": client.telegram_id,
            "instagram_id": client.instagram_id,
        },
        "related": {
            "leads": [_lead_item(item) for item in (leads.order_by("-created_at", "-id")[:5] if leads is not None else [])],
            "tasks": [_task_item(item) for item in (tasks.order_by("due_at", "-priority", "-created_at")[:5] if tasks is not None else [])],
            "appointments": [_appointment_item(item) for item in (appointments.order_by("-start_at", "-id")[:5] if appointments is not None else [])],
            "conversations": [_conversation_item(item) for item in (conversations.order_by("-last_message_at", "-updated_at")[:5] if conversations is not None else [])],
        },
        "payload_budget": {
            "target_kb": 80,
            "max_related_per_section": 5,
        },
    }


def build_mobile_lead_detail(*, user, business, lead_id):
    lead = _mobile_object_or_none(
        user=user,
        business=business,
        resource=Resources.LEADS,
        queryset=Lead.objects.filter(business=business, is_archived=False).select_related("client", "service", "responsible_user"),
        object_id=lead_id,
    )
    if lead is None:
        return None
    tasks = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.TASKS,
        queryset=Task.objects.filter(business=business, lead=lead, is_archived=False).select_related("client", "lead", "deal", "assignee"),
    )
    appointments = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.APPOINTMENTS,
        queryset=Appointment.objects.filter(business=business, lead=lead, is_archived=False).select_related("client", "lead", "service", "resource"),
    )
    conversations = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.CONVERSATIONS,
        queryset=BotConversation.objects.filter(business=business, lead=lead, is_archived=False).select_related("client", "lead", "assigned_to", "bot"),
    )
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "lead": _lead_item(lead),
        "details": {
            "message": (lead.message or "")[:1000],
            "lost_reason": lead.lost_reason,
            "lost_at": lead.lost_at,
            "responsible_user_id": lead.responsible_user_id,
            "responsible_user": _user_item(lead.responsible_user),
        },
        "related": {
            "tasks": [_task_item(item) for item in (tasks.order_by("due_at", "-priority", "-created_at")[:5] if tasks is not None else [])],
            "appointments": [_appointment_item(item) for item in (appointments.order_by("-start_at", "-id")[:5] if appointments is not None else [])],
            "conversations": [_conversation_item(item) for item in (conversations.order_by("-last_message_at", "-updated_at")[:5] if conversations is not None else [])],
        },
        "payload_budget": {
            "target_kb": 80,
            "max_related_per_section": 5,
        },
    }


def build_mobile_task_detail(*, user, business, task_id):
    task = _mobile_object_or_none(
        user=user,
        business=business,
        resource=Resources.TASKS,
        queryset=Task.objects.filter(business=business, is_archived=False).select_related("client", "lead", "deal", "appointment", "assignee", "created_by"),
        object_id=task_id,
    )
    if task is None:
        return None
    comments = task.comments.select_related("author").order_by("-created_at")[:5]
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "task": _task_item(task),
        "details": {
            "description": (task.description or "")[:1000],
            "reminder_at": task.reminder_at,
            "snoozed_until": task.snoozed_until,
            "completed_at": task.completed_at,
            "cancelled_at": task.cancelled_at,
            "cancel_reason": task.cancel_reason,
            "created_by": _user_item(task.created_by),
            "assignee": _user_item(task.assignee),
            "appointment_id": task.appointment_id,
        },
        "comments": [
            {
                "id": comment.id,
                "text": (comment.text or "")[:500],
                "author": _user_item(comment.author),
                "created_at": comment.created_at,
            }
            for comment in comments
        ],
        "payload_budget": {
            "target_kb": 60,
            "max_comments": 5,
        },
    }


def build_mobile_appointment_detail(*, user, business, appointment_id):
    appointment = _mobile_object_or_none(
        user=user,
        business=business,
        resource=Resources.APPOINTMENTS,
        queryset=Appointment.objects.filter(business=business, is_archived=False).select_related("client", "lead", "service", "resource"),
        object_id=appointment_id,
    )
    if appointment is None:
        return None
    tasks = _permitted_queryset(
        user=user,
        business=business,
        resource=Resources.TASKS,
        queryset=Task.objects.filter(business=business, appointment=appointment, is_archived=False).select_related("client", "lead", "deal", "assignee"),
    )
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "appointment": _appointment_item(appointment),
        "details": {
            "notes": (appointment.notes or "")[:1000],
            "source": appointment.source,
            "client": _client_item(appointment.client),
            "service": {
                "id": appointment.service_id,
                "name": appointment.service.name if appointment.service_id else "",
                "duration_minutes": appointment.service.duration_minutes if appointment.service_id else None,
                "price_from": str(appointment.service.price_from) if appointment.service_id else "",
            },
            "resource": {
                "id": appointment.resource_id,
                "name": appointment.resource.name if appointment.resource_id else "",
                "type": appointment.resource.resource_type if appointment.resource_id else "",
            },
        },
        "related": {
            "tasks": [_task_item(item) for item in (tasks.order_by("due_at", "-priority", "-created_at")[:5] if tasks is not None else [])],
        },
        "payload_budget": {
            "target_kb": 60,
            "max_related_per_section": 5,
        },
    }


def build_mobile_conversation_detail(*, user, business, conversation_id, limit=30):
    limit = max(1, min(int(limit or 30), 50))
    conversation = _mobile_object_or_none(
        user=user,
        business=business,
        resource=Resources.CONVERSATIONS,
        queryset=BotConversation.objects.filter(business=business, is_archived=False).select_related("client", "lead", "assigned_to", "bot"),
        object_id=conversation_id,
    )
    if conversation is None:
        return None
    messages = BotMessage.objects.filter(conversation=conversation).order_by("-created_at", "-id")[:limit]
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "conversation": _conversation_item(conversation),
        "details": {
            "status": conversation.status,
            "priority": conversation.priority,
            "channel": conversation.channel,
            "bot_enabled": conversation.bot_enabled,
            "handoff_reason": conversation.handoff_reason,
            "client": _client_item(conversation.client) if conversation.client_id else None,
            "lead": _lead_item(conversation.lead) if conversation.lead_id else None,
            "assigned_to": _user_item(conversation.assigned_to),
        },
        "messages": [mobile_message_item(message) for message in reversed(list(messages))],
        "payload_budget": {
            "target_kb": 100,
            "max_messages": limit,
        },
    }


def _permitted_queryset(*, user, business, resource, queryset):
    if not can(user, business, resource, Actions.VIEW).allowed:
        return None
    return scope_queryset(queryset, user, business, resource, Actions.VIEW)


def _mobile_object_or_none(*, user, business, resource, queryset, object_id):
    scoped = _permitted_queryset(user=user, business=business, resource=resource, queryset=queryset)
    if scoped is None:
        return None
    return scoped.filter(id=object_id).first()


def _attach_leads(payload, queryset, *, limit):
    by_status = dict(queryset.values_list("status").annotate(count=Count("id")))
    new_count = by_status.get(Lead.Statuses.NEW, 0)
    unassigned_count = queryset.filter(responsible_user__isnull=True).count()
    payload["sections"]["leads"] = {
        "total": queryset.count(),
        "new": new_count,
        "unassigned": unassigned_count,
        "latest": [_lead_item(lead) for lead in queryset.order_by("-created_at", "-id")[:limit]],
    }
    payload["kpis"].append({"key": "new_leads", "value": new_count, "href": "/app/leads"})
    if new_count:
        payload["attention"]["items"].append(
            {
                "key": "new_leads",
                "type": "lead",
                "count": new_count,
                "priority": 20,
                "created_at": "",
                "href": "/app/leads?status=new",
            }
        )


def _attach_tasks(payload, queryset, *, now, limit):
    active = queryset.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
    overdue = active.filter(due_at__lt=now)
    due_today = active.filter(due_at__date=timezone.localdate())
    payload["sections"]["tasks"] = {
        "open": active.count(),
        "overdue": overdue.count(),
        "today": due_today.count(),
        "next": [_task_item(task) for task in active.order_by("due_at", "-priority", "-created_at")[:limit]],
    }
    payload["kpis"].append({"key": "open_tasks", "value": active.count(), "href": "/app/tasks"})
    if overdue.exists():
        payload["attention"]["items"].append(
            {
                "key": "overdue_tasks",
                "type": "task",
                "count": overdue.count(),
                "priority": 10,
                "created_at": "",
                "href": "/app/tasks?tab=overdue",
            }
        )


def _attach_appointments(payload, queryset, *, today, now, limit):
    upcoming = queryset.filter(
        status__in=[Appointment.Statuses.CREATED, Appointment.Statuses.CONFIRMED],
        start_at__gte=now,
    ).order_by("start_at")
    today_items = queryset.filter(start_at__date=today).order_by("start_at")
    needs_confirmation = upcoming.filter(status=Appointment.Statuses.CREATED)
    payload["sections"]["appointments"] = {
        "today": today_items.count(),
        "needs_confirmation": needs_confirmation.count(),
        "upcoming": [_appointment_item(appointment) for appointment in upcoming[:limit]],
    }
    payload["kpis"].append({"key": "appointments_today", "value": today_items.count(), "href": "/app/calendar"})
    if needs_confirmation.exists():
        payload["attention"]["items"].append(
            {
                "key": "appointment_confirmations",
                "type": "appointment",
                "count": needs_confirmation.count(),
                "priority": 30,
                "created_at": "",
                "href": "/app/calendar?status=created",
            }
        )


def _attach_conversations(payload, queryset, *, limit):
    open_queryset = queryset.filter(status=BotConversation.Statuses.OPEN)
    unread = open_queryset.filter(unread_count__gt=0)
    handoff = open_queryset.filter(handoff_required=True)
    payload["sections"]["conversations"] = {
        "open": open_queryset.count(),
        "unread": unread.count(),
        "handoff_required": handoff.count(),
        "latest": [_conversation_item(conversation) for conversation in open_queryset.order_by("-last_message_at", "-updated_at")[:limit]],
    }
    payload["kpis"].append({"key": "unread_conversations", "value": unread.count(), "href": "/app/conversations"})
    if handoff.exists():
        payload["attention"]["items"].append(
            {
                "key": "conversation_handoff",
                "type": "conversation",
                "count": handoff.count(),
                "priority": 15,
                "created_at": "",
                "href": "/app/conversations?handoff=true",
            }
        )


def _attach_deals(payload, queryset):
    open_queryset = queryset.filter(status=Deal.Statuses.OPEN)
    payload["sections"]["deals"] = {
        "open": open_queryset.count(),
        "amount_open": str(open_queryset.aggregate(total=Sum("amount"))["total"] or Decimal("0")),
    }
    payload["kpis"].append({"key": "open_deals", "value": open_queryset.count(), "href": "/app/deals"})


def _attach_revenue(payload, *, business, today):
    events = BusinessEvent.objects.filter(business=business, event_type__in=SALES_REVENUE_EVENT_TYPES)
    today_revenue = sum((_payload_amount(event.payload_json) for event in events.filter(occurred_at__date=today)), Decimal("0"))
    total_revenue = sum((_payload_amount(event.payload_json) for event in events), Decimal("0"))
    payload["sections"]["revenue"] = {
        "today": str(today_revenue),
        "total_estimate": str(total_revenue),
        "events": events.count(),
    }
    payload["kpis"].append({"key": "revenue_today", "value": str(today_revenue), "href": "/app/analytics"})


def _quick_actions(*, user, business):
    actions = []
    if can(user, business, Resources.LEADS, Actions.CREATE).allowed:
        actions.append({"key": "create_lead", "href": "/app/leads?action=create"})
    if can(user, business, Resources.TASKS, Actions.CREATE).allowed:
        actions.append({"key": "create_task", "href": "/app/tasks?action=create"})
    if can(user, business, Resources.APPOINTMENTS, Actions.CREATE).allowed:
        actions.append({"key": "create_appointment", "href": "/app/calendar?action=create"})
    if can(user, business, Resources.CONVERSATIONS, Actions.VIEW).allowed:
        actions.append({"key": "open_inbox", "href": "/app/conversations"})
    return actions


def _lead_item(lead):
    return {
        "id": lead.id,
        "client_id": lead.client_id,
        "title": str(lead.client) if lead.client_id else f"Lead #{lead.id}",
        "client": {
            "id": lead.client_id,
            "name": lead.client.full_name if lead.client_id else "",
            "phone": lead.client.phone if lead.client_id else "",
            "email": lead.client.email if lead.client_id else "",
        },
        "service": {
            "id": lead.service_id,
            "name": lead.service.name if lead.service_id else "",
        },
        "status": lead.status,
        "source": lead.source,
        "message": (lead.message or "")[:200],
        "responsible_user_id": lead.responsible_user_id,
        "created_at": lead.created_at,
        "href": f"/app/leads?lead={lead.id}",
    }


def _client_item(client):
    return {
        "id": client.id,
        "title": client.full_name,
        "phone": client.phone,
        "email": client.email,
        "source": client.source,
        "notes": (client.notes or "")[:160],
        "created_at": client.created_at,
        "updated_at": client.updated_at,
        "href": f"/app/clients?client={client.id}",
    }


def _task_item(task):
    return {
        "id": task.id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "due_at": task.due_at,
        "client_id": task.client_id,
        "lead_id": task.lead_id,
        "deal_id": task.deal_id,
        "assignee_id": task.assignee_id,
        "href": f"/app/tasks?task={task.id}",
    }


def mobile_task_item(task):
    return _task_item(task)


def mobile_lead_item(lead):
    return _lead_item(lead)


def mobile_notification_item(notification):
    return _notification_item(notification)


def mobile_appointment_item(appointment):
    return _appointment_item(appointment)


def mobile_approval_item(approval):
    return _approval_item(approval)


def _appointment_item(appointment):
    return {
        "id": appointment.id,
        "title": str(appointment.client) if appointment.client_id else f"Appointment #{appointment.id}",
        "status": appointment.status,
        "client_id": appointment.client_id,
        "lead_id": appointment.lead_id,
        "service_id": appointment.service_id,
        "start_at": appointment.start_at,
        "end_at": appointment.end_at,
        "href": f"/app/calendar?appointment={appointment.id}",
    }


def _conversation_item(conversation):
    return {
        "id": conversation.id,
        "title": str(conversation.client) if conversation.client_id else conversation.external_user_id or f"Conversation #{conversation.id}",
        "channel": conversation.channel,
        "unread_count": conversation.unread_count,
        "handoff_required": conversation.handoff_required,
        "assigned_to_id": conversation.assigned_to_id,
        "last_message_at": conversation.last_message_at,
        "href": f"/app/conversations?conversation={conversation.id}",
    }


def _user_item(user):
    if not user:
        return None
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.get_full_name() or user.email,
    }


def _conversation_item_with_preview(conversation):
    item = _conversation_item(conversation)
    message = (
        BotMessage.objects.filter(conversation=conversation)
        .only("direction", "sender_type", "text", "created_at")
        .order_by("-created_at", "-id")
        .first()
    )
    item["last_message_preview"] = {
        "direction": message.direction if message else "",
        "sender_type": message.sender_type if message else "",
        "text": (message.text or "")[:160] if message else "",
        "created_at": message.created_at if message else None,
    }
    return item


def mobile_conversation_item(conversation):
    return _conversation_item(conversation)


def mobile_message_item(message):
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "direction": message.direction,
        "sender_type": message.sender_type,
        "text": (message.text or "")[:500],
        "status": message.status,
        "created_at": message.created_at,
        "sent_at": message.sent_at,
        "error_text": message.error_text,
    }


def _action_item(key, item_type, sort_at, priority, entity):
    return {
        "key": key,
        "type": item_type,
        "priority": priority,
        "sort_at": sort_at.isoformat() if sort_at else "",
        "entity": entity,
    }


def _notification_item(notification):
    return {
        "id": notification.id,
        "category": notification.category,
        "priority": notification.priority,
        "status": notification.status,
        "channel": notification.channel,
        "text": (notification.text or "")[:220],
        "action_url": notification.action_url,
        "action_label": notification.action_label,
        "send_at": notification.send_at,
        "read_at": notification.read_at,
        "client_id": notification.client_id,
        "appointment_id": notification.appointment_id,
    }


def _pending_approvals_for_mobile(*, user, business, limit):
    queryset = ApprovalRequest.objects.filter(
        business=business,
        status=ApprovalRequest.Statuses.PENDING,
    ).select_related("requested_by").order_by("-created_at", "-id")
    items = []
    for approval in queryset[: limit * 3]:
        resource = approval_resource_for_action(approval.action_type)
        if can(user, business, resource, Actions.APPROVE, obj=approval).allowed:
            items.append(approval)
        if len(items) >= limit:
            break
    return items


def _approval_action_item(approval):
    return _action_item("approve_ai_request", "approval", approval.created_at, 5, _approval_item(approval))


def _approval_item(approval):
    return {
        "id": approval.id,
        "title": approval.get_action_type_display(),
        "status": approval.status,
        "source": approval.action_type,
        "message": approval.source_object_type or approval.required_role or "",
        "created_at": approval.created_at,
        "href": f"/app/ai-assistant?approval={approval.id}",
    }


def _payload_amount(payload):
    try:
        return Decimal(str((payload or {}).get("amount", "0")).replace(",", "."))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")
