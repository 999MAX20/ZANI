from django.utils import timezone

from apps.bots.models import BotConversation
from apps.businesses.access import Actions, Resources, can, scope_queryset
from apps.businesses.capabilities import resource_is_enabled
from apps.core.work_queues import (
    no_next_action_deals_queryset,
    overdue_handoff_conversations_queryset,
    overdue_tasks_queryset,
    sla_overdue_deals_queryset,
    stale_leads_queryset,
    unread_sla_overdue_conversations_queryset,
)
from apps.crm.models import Deal
from apps.integrations.models import BusinessConnector, BusinessEvent
from apps.integrations.sanitization import sanitize_error_text
from apps.leads.models import Lead
from apps.tasks.models import Task


NEXT_BEST_ACTION_CATEGORIES = [
    "stale_leads",
    "overdue_tasks",
    "unanswered_conversations",
    "stalled_deals",
    "failed_connectors",
]

FAILED_CONNECTOR_STATUSES = {
    BusinessConnector.Statuses.ERROR,
    BusinessConnector.Statuses.FAILED,
    BusinessConnector.Statuses.NEEDS_ATTENTION,
    BusinessConnector.Statuses.EXPIRED_CREDENTIALS,
}


def build_owner_daily_brief(*, business, user, limit=8):
    result = build_next_best_actions(business=business, user=user, limit=limit)
    no_data = not any(result["summary"]["categories"].values())
    return {
        "generated_at": result["generated_at"],
        "business": business.id,
        "is_mock": False,
        "provider": "zani_rules",
        "model": "crm_owner_brief_v1",
        "summary": {
            "attention_count": result["summary"]["attention_count"],
            "source_count": len(result["sources"]),
            "categories": result["summary"]["categories"],
            "no_data": no_data,
            "no_data_reason": "No CRM or connector records need attention in the visible scope." if no_data else "",
        },
        "sections": result["sections"],
        "recommendations": result["recommendations"],
        "sources": result["sources"],
    }


def build_next_best_actions(*, business, user, limit=8):
    now = timezone.now()
    limit = max(1, min(int(limit or 8), 20))
    sources_by_id = {}
    sections = _empty_sections()
    recommendations = []

    recommendations += _stale_lead_actions(business=business, user=user, limit=limit, now=now, sources_by_id=sources_by_id, sections=sections)
    recommendations += _overdue_task_actions(business=business, user=user, limit=limit, now=now, sources_by_id=sources_by_id, sections=sections)
    recommendations += _unanswered_conversation_actions(
        business=business,
        user=user,
        limit=limit,
        now=now,
        sources_by_id=sources_by_id,
        sections=sections,
    )
    recommendations += _stalled_deal_actions(business=business, user=user, limit=limit, now=now, sources_by_id=sources_by_id, sections=sections)
    recommendations += _failed_connector_actions(business=business, user=user, limit=limit, now=now, sources_by_id=sources_by_id, sections=sections)

    recommendations = sorted(recommendations, key=lambda item: (_priority_rank(item["priority"]), item["id"]))[:limit]
    categories = {section["id"]: section["count"] for section in sections}
    return {
        "generated_at": now.isoformat(),
        "summary": {
            "attention_count": sum(categories.values()),
            "categories": categories,
        },
        "sections": sections,
        "recommendations": recommendations,
        "sources": list(sources_by_id.values()),
    }


def _stale_lead_actions(*, business, user, limit, now, sources_by_id, sections):
    queryset = scope_queryset(
        Lead.objects.filter(business=business, is_archived=False).select_related("client", "service", "responsible_user"),
        user,
        business,
        Resources.LEADS,
        Actions.VIEW,
    )
    stale_leads = stale_leads_queryset(queryset=queryset, now=now)
    items = list(stale_leads[:limit])
    _set_section(sections, "stale_leads", stale_leads.count(), [_source_id("LEAD", item.id) for item in items])
    actions = []
    for lead in items:
        source = _lead_source(lead, now=now)
        sources_by_id[source["id"]] = source
        age_hours = source["metadata"].get("age_hours")
        priority = "high" if not lead.responsible_user_id or (age_hours is not None and age_hours >= 72) else "medium"
        actions.append(
            _recommendation(
                category="stale_leads",
                priority=priority,
                source=source,
                label=f"Contact stale lead #{lead.id}",
                description="Lead is unassigned or has not changed for the stale-lead SLA window.",
                href=f"/app/leads?lead={lead.id}",
            )
        )
    return actions


def _overdue_task_actions(*, business, user, limit, now, sources_by_id, sections):
    deals_enabled = resource_is_enabled(business, Resources.DEALS)
    related = ["client", "lead", "assignee"]
    if deals_enabled:
        related.append("deal")
    queryset = scope_queryset(
        Task.objects.filter(business=business, is_archived=False).select_related(*related),
        user,
        business,
        Resources.TASKS,
        Actions.VIEW,
    )
    overdue_tasks = overdue_tasks_queryset(queryset=queryset, now=now)
    items = list(overdue_tasks[:limit])
    _set_section(sections, "overdue_tasks", overdue_tasks.count(), [_source_id("TASK", item.id) for item in items])
    actions = []
    for task in items:
        source = _task_source(task, now=now, include_deal=deals_enabled)
        sources_by_id[source["id"]] = source
        overdue_minutes = source["metadata"].get("overdue_minutes") or 0
        priority = "high" if task.priority in {Task.Priorities.HIGH, Task.Priorities.URGENT} or overdue_minutes >= 1440 else "medium"
        actions.append(
            _recommendation(
                category="overdue_tasks",
                priority=priority,
                source=source,
                label=f"Close overdue task #{task.id}",
                description="Task due date is in the past and the task is still open.",
                href=f"/app/tasks?task={task.id}",
            )
        )
    return actions


def _unanswered_conversation_actions(*, business, user, limit, now, sources_by_id, sections):
    queryset = scope_queryset(
        BotConversation.objects.filter(business=business, is_archived=False).select_related("client", "lead", "assigned_to", "bot"),
        user,
        business,
        Resources.CONVERSATIONS,
        Actions.VIEW,
    )
    unread = list(unread_sla_overdue_conversations_queryset(queryset=queryset, now=now)[:limit])
    handoff = list(overdue_handoff_conversations_queryset(queryset=queryset, now=now)[:limit])
    by_id = {conversation.id: conversation for conversation in unread + handoff}
    unread_count = unread_sla_overdue_conversations_queryset(queryset=queryset, now=now).count()
    handoff_count = overdue_handoff_conversations_queryset(queryset=queryset, now=now).count()
    items = list(by_id.values())[:limit]
    _set_section(sections, "unanswered_conversations", unread_count + handoff_count, [_source_id("CONV", item.id) for item in items])
    actions = []
    for conversation in items:
        source = _conversation_source(conversation, now=now)
        sources_by_id[source["id"]] = source
        priority = "high" if conversation.handoff_required or source["metadata"].get("sla_overdue_minutes", 0) >= 60 else "medium"
        actions.append(
            _recommendation(
                category="unanswered_conversations",
                priority=priority,
                source=source,
                label=f"Answer conversation #{conversation.id}",
                description="Conversation has unread or handoff-required inbound messages past the response SLA.",
                href=f"/app/conversations?conversation={conversation.id}",
            )
        )
    return actions


def _stalled_deal_actions(*, business, user, limit, now, sources_by_id, sections):
    if not resource_is_enabled(business, Resources.DEALS):
        _set_section(sections, "stalled_deals", 0, [])
        return []
    queryset = scope_queryset(
        Deal.objects.filter(business=business, status=Deal.Statuses.OPEN, is_archived=False).select_related("client", "stage", "owner"),
        user,
        business,
        Resources.DEALS,
        Actions.VIEW,
    )
    sla_deals = list(sla_overdue_deals_queryset(queryset, now=now)[:limit])
    no_next_action_deals = list(no_next_action_deals_queryset(queryset)[:limit])
    by_id = {deal.id: deal for deal in sla_deals + no_next_action_deals}
    sla_count = sla_overdue_deals_queryset(queryset, now=now).count()
    no_next_action_count = no_next_action_deals_queryset(queryset).count()
    items = list(by_id.values())[:limit]
    _set_section(sections, "stalled_deals", sla_count + no_next_action_count, [_source_id("DEAL", item.id) for item in items])
    actions = []
    sla_ids = {deal.id for deal in sla_deals}
    for deal in items:
        source = _deal_source(deal, reason="sla_overdue" if deal.id in sla_ids else "no_next_action", now=now)
        sources_by_id[source["id"]] = source
        priority = "high" if deal.id in sla_ids else "medium"
        actions.append(
            _recommendation(
                category="stalled_deals",
                priority=priority,
                source=source,
                label=f"Set next step for deal #{deal.id}",
                description="Deal is open but stage SLA is overdue or no next action is scheduled.",
                href=f"/app/deals?deal={deal.id}",
            )
        )
    return actions


def _failed_connector_actions(*, business, user, limit, now, sources_by_id, sections):
    if not can(user, business, Resources.INTEGRATIONS, Actions.VIEW).allowed:
        _set_section(sections, "failed_connectors", 0, [])
        return []

    connectors = list(
        BusinessConnector.objects.filter(business=business, status__in=FAILED_CONNECTOR_STATUSES)
        .order_by("-updated_at", "provider")[:limit]
    )
    events = list(
        BusinessEvent.objects.select_related("connector")
        .filter(business=business, status=BusinessEvent.Statuses.FAILED)
        .order_by("-occurred_at", "-created_at")[:limit]
    )
    connector_count = BusinessConnector.objects.filter(business=business, status__in=FAILED_CONNECTOR_STATUSES).count()
    event_count = BusinessEvent.objects.filter(business=business, status=BusinessEvent.Statuses.FAILED).count()
    source_ids = [_source_id("CONNECTOR", item.id) for item in connectors] + [_source_id("BE", item.id) for item in events]
    _set_section(sections, "failed_connectors", connector_count + event_count, source_ids[:limit])

    actions = []
    for connector in connectors:
        source = _connector_source(connector)
        sources_by_id[source["id"]] = source
        actions.append(
            _recommendation(
                category="failed_connectors",
                priority="high",
                source=source,
                label=f"Fix connector {connector.name}",
                description="Connector status requires attention before CRM can trust incoming data.",
                href="/app/integrations",
            )
        )
    for event in events:
        source = _business_event_source(event)
        sources_by_id[source["id"]] = source
        actions.append(
            _recommendation(
                category="failed_connectors",
                priority="high",
                source=source,
                label=f"Review failed event #{event.id}",
                description="A connector BusinessEvent failed and may need retry or reconciliation.",
                href="/app/integrations",
            )
        )
    return actions[:limit]


def _empty_sections():
    return [
        {"id": category, "count": 0, "source_ids": []}
        for category in NEXT_BEST_ACTION_CATEGORIES
    ]


def _set_section(sections, category, count, source_ids):
    for section in sections:
        if section["id"] == category:
            section["count"] = count
            section["source_ids"] = source_ids[:5]
            return


def _recommendation(*, category, priority, source, label, description, href):
    return {
        "id": f"{category}_{source['id'].lower()}",
        "category": category,
        "priority": priority,
        "label": label,
        "description": description,
        "href": href,
        "source_ids": [source["id"]],
    }


def _source_id(prefix, entity_id):
    return f"{prefix}-{entity_id}"


def _source(*, prefix, entity_type, entity_id, label, summary, href, occurred_at=None, metadata=None):
    return {
        "id": _source_id(prefix, entity_id),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "label": label,
        "summary": summary,
        "href": href,
        "occurred_at": occurred_at.isoformat() if occurred_at else None,
        "metadata": metadata or {},
    }


def _lead_source(lead, *, now):
    age_hours = _hours_since(lead.updated_at or lead.created_at, now=now)
    client_name = str(lead.client) if lead.client_id else f"Lead #{lead.id}"
    return _source(
        prefix="LEAD",
        entity_type="lead",
        entity_id=lead.id,
        label=f"Lead #{lead.id}",
        summary=f"{client_name}; status {lead.status}; source {lead.source}.",
        href=f"/app/leads?lead={lead.id}",
        occurred_at=lead.updated_at or lead.created_at,
        metadata={
            "status": lead.status,
            "source": lead.source,
            "client_id": lead.client_id,
            "responsible_user_id": lead.responsible_user_id,
            "age_hours": age_hours,
        },
    )


def _task_source(task, *, now, include_deal=True):
    overdue_minutes = _minutes_since(task.due_at, now=now) if task.due_at else 0
    metadata = {
        "status": task.status,
        "priority": task.priority,
        "assignee_id": task.assignee_id,
        "client_id": task.client_id,
        "lead_id": task.lead_id,
        "overdue_minutes": overdue_minutes,
    }
    if include_deal:
        metadata["deal_id"] = task.deal_id
    return _source(
        prefix="TASK",
        entity_type="task",
        entity_id=task.id,
        label=f"Task #{task.id}",
        summary=f"{task.title}; priority {task.priority}; status {task.status}.",
        href=f"/app/tasks?task={task.id}",
        occurred_at=task.due_at or task.updated_at,
        metadata=metadata,
    )


def _conversation_source(conversation, *, now):
    sla_minutes = 15 if conversation.handoff_required else 30
    sla_due_at = conversation.last_inbound_at + timezone.timedelta(minutes=sla_minutes) if conversation.last_inbound_at else None
    sla_overdue_minutes = max(0, _minutes_since(sla_due_at, now=now)) if sla_due_at else 0
    title = str(conversation.client) if conversation.client_id else conversation.external_user_id or f"Conversation #{conversation.id}"
    return _source(
        prefix="CONV",
        entity_type="conversation",
        entity_id=conversation.id,
        label=f"Conversation #{conversation.id}",
        summary=f"{title}; unread {conversation.unread_count}; handoff {conversation.handoff_required}.",
        href=f"/app/conversations?conversation={conversation.id}",
        occurred_at=conversation.last_inbound_at or conversation.updated_at,
        metadata={
            "channel": conversation.channel,
            "priority": conversation.priority,
            "unread_count": conversation.unread_count,
            "handoff_required": conversation.handoff_required,
            "assigned_to_id": conversation.assigned_to_id,
            "sla_overdue_minutes": sla_overdue_minutes,
        },
    )


def _deal_source(deal, *, reason, now):
    stage_entered_hours = _hours_since(deal.stage_entered_at, now=now) if deal.stage_entered_at else None
    return _source(
        prefix="DEAL",
        entity_type="deal",
        entity_id=deal.id,
        label=f"Deal #{deal.id}",
        summary=f"{deal.title}; stage {deal.stage.name if deal.stage else 'none'}; reason {reason}.",
        href=f"/app/deals?deal={deal.id}",
        occurred_at=deal.stage_entered_at or deal.updated_at,
        metadata={
            "status": deal.status,
            "stage_id": deal.stage_id,
            "stage_name": deal.stage.name if deal.stage else "",
            "owner_id": deal.owner_id,
            "amount": str(deal.amount),
            "reason": reason,
            "stage_entered_hours": stage_entered_hours,
        },
    )


def _connector_source(connector):
    return _source(
        prefix="CONNECTOR",
        entity_type="connector",
        entity_id=connector.id,
        label=connector.name,
        summary=f"{connector.provider}; status {connector.status}; last error {sanitize_error_text(connector.last_error) or 'none'}.",
        href="/app/integrations",
        occurred_at=connector.updated_at,
        metadata={
            "provider": connector.provider,
            "capability": connector.capability,
            "status": connector.status,
        },
    )


def _business_event_source(event):
    connector_name = event.connector.name if event.connector else ""
    return _source(
        prefix="BE",
        entity_type="business_event",
        entity_id=event.id,
        label=f"{event.source}.{event.event_type}",
        summary=f"Failed event from {connector_name or event.source}; external id {event.external_id or 'none'}.",
        href="/app/integrations",
        occurred_at=event.occurred_at,
        metadata={
            "source": event.source,
            "event_type": event.event_type,
            "status": event.status,
            "connector_id": event.connector_id,
            "error": sanitize_error_text(event.error),
        },
    )


def _priority_rank(priority):
    return {"high": 0, "medium": 1, "low": 2}.get(priority, 3)


def _hours_since(value, *, now):
    if not value:
        return None
    return round((now - value).total_seconds() / 3600, 1)


def _minutes_since(value, *, now):
    if not value:
        return 0
    return max(0, round((now - value).total_seconds() / 60))
