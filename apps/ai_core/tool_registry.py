import hashlib
import json
from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.ai_core.models import AIToolCallLog
from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.automations.engine import run_automations_for_event
from apps.automations.models import AutomationRule
from apps.businesses.access import Actions, Resources, assert_can
from apps.businesses.capabilities import assert_resource_enabled
from apps.clients.models import Client
from apps.crm.models import Deal, PipelineStage
from apps.crm.services import ensure_default_pipeline
from apps.leads.models import Lead
from apps.tasks.models import Task
from apps.integrations.sanitization import sanitize_error_text
from apps.leads.services import create_deal_from_lead
from apps.tasks.services import create_automation_task


@dataclass(frozen=True)
class AIToolDefinition:
    name: str
    description: str
    requires_confirmation: bool = True


TOOLS = {
    "create_lead": AIToolDefinition("create_lead", "Create a CRM lead from confirmed context."),
    "create_client": AIToolDefinition("create_client", "Create a client profile."),
    "create_task": AIToolDefinition("create_task", "Create an actionable task and calendar reminder from an AI recommendation."),
    "create_deal": AIToolDefinition("create_deal", "Create a deal in the default pipeline."),
    "summarize_conversation": AIToolDefinition("summarize_conversation", "Summarize the selected conversation.", requires_confirmation=False),
    "qualify_lead": AIToolDefinition("qualify_lead", "Score and qualify a lead or conversation.", requires_confirmation=False),
}


def registered_tools():
    return list(TOOLS.values())


def tool_requires_approval(tool_name):
    tool = TOOLS.get(tool_name)
    return bool(tool and tool.requires_confirmation)


def assert_tool_execution_allowed(log, user):
    permission = {
        "create_client": (Resources.CLIENTS, Actions.CREATE),
        "create_lead": (Resources.LEADS, Actions.CREATE),
        "create_task": (Resources.TASKS, Actions.CREATE),
        "create_deal": (Resources.DEALS, Actions.CREATE),
    }.get(log.tool_name)
    if permission is None:
        return None
    resource, action = permission
    assert_resource_enabled(log.business, resource)
    return assert_can(user, log.business, resource, action, obj=log)


def suggest_tool_calls(*, business, user, conversation=None, message=""):
    suggestions = [
        ("summarize_conversation", {"message": message}),
        ("qualify_lead", {"message": message}),
        (
            "create_task",
            {
                "title": f"Follow up: {conversation.client or conversation.external_user_id or 'AI suggestion'}"
                if conversation
                else "AI suggested follow-up",
                "priority": "normal",
            },
        ),
    ]
    if conversation and not conversation.lead_id:
        suggestions.append(("create_lead", {"message": message or _last_message_text(conversation)}))

    logs = [
        AIToolCallLog.objects.create(
            business=business,
            user=user,
            conversation=conversation,
            tool_name=tool_name,
            input_json={**payload, "requires_confirmation": TOOLS[tool_name].requires_confirmation},
        )
        for tool_name, payload in suggestions
    ]
    return logs


def tool_call_fingerprint(log):
    payload = {
        "business_id": log.business_id,
        "user_id": log.user_id,
        "conversation_id": log.conversation_id,
        "tool_name": log.tool_name,
        "input_json": log.input_json or {},
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def execute_tool_call_once(log_id, user):
    try:
        with transaction.atomic():
            log = AIToolCallLog.objects.select_for_update().select_related("business", "conversation").get(id=log_id)
            if log.status == AIToolCallLog.Statuses.EXECUTED:
                return log, True
            if log.status != AIToolCallLog.Statuses.SUGGESTED:
                return log, False
            log.status = AIToolCallLog.Statuses.EXECUTING
            log.locked_at = timezone.now()
            log.attempts += 1
            log.error = ""
            log.save(update_fields=["status", "locked_at", "attempts", "error"])
            output = _tool_handler(log.tool_name)(log, user)
            log.status = AIToolCallLog.Statuses.EXECUTED
            log.output_json = output
            log.error = ""
            log.locked_at = None
            log.executed_at = timezone.now()
            log.save(update_fields=["status", "output_json", "error", "locked_at", "executed_at"])
            return log, False
    except Exception as exc:
        log = AIToolCallLog.objects.get(id=log_id)
        log.status = AIToolCallLog.Statuses.FAILED
        log.error = sanitize_error_text(exc)
        log.locked_at = None
        log.save(update_fields=["status", "error", "locked_at"])
        return log, False


def execute_tool_call(log, user):
    executed_log, _ = execute_tool_call_once(log.id, user)
    return executed_log


def _tool_handler(tool_name):
    return {
        "create_client": _execute_create_client,
        "create_lead": _execute_create_lead,
        "create_task": _execute_create_task,
        "create_deal": _execute_create_deal,
        "summarize_conversation": _execute_summarize_conversation,
        "qualify_lead": _execute_qualify_lead,
    }[tool_name]


def _execute_create_client(log, user):
    client = Client.objects.create(
        business=log.business,
        full_name=log.input_json.get("full_name") or "AI suggested client",
        phone=log.input_json.get("phone", ""),
        email=log.input_json.get("email", ""),
        source=Client.Sources.MANUAL,
        source_detail="ai_tool",
        source_context_json={"tool_call_id": log.id, "tool_name": log.tool_name},
    )
    create_activity_event(
        business=log.business,
        client=client,
        actor=user if user and user.is_authenticated else None,
        event_type=ActivityEvents.CLIENT_CREATED,
        instance=client,
        source="ai_tool",
        text="Client created from approved AI tool.",
        metadata={"tool_call_id": log.id, "tool_name": log.tool_name},
    )
    return {"client_id": client.id}


def _execute_create_lead(log, user):
    conversation = log.conversation
    client = None
    if log.input_json.get("client_id"):
        client = Client.objects.filter(id=log.input_json["client_id"], business=log.business).first()
    if client is None and conversation:
        client = conversation.client
    if client is None:
        client = Client.objects.create(
            business=log.business,
            full_name=conversation.external_user_id if conversation else "AI suggested client",
            source=Client.Sources.MANUAL,
            source_detail="ai_tool",
            source_context_json={"tool_call_id": log.id, "tool_name": log.tool_name},
        )
        create_activity_event(
            business=log.business,
            client=client,
            actor=user if user and user.is_authenticated else None,
            event_type=ActivityEvents.CLIENT_CREATED,
            instance=client,
            source="ai_tool",
            text="Client created from approved AI tool.",
            metadata={"tool_call_id": log.id, "tool_name": log.tool_name},
        )
    lead = Lead.objects.create(
        business=log.business,
        client=client,
        source=_source_from_conversation(conversation),
        message=log.input_json.get("message") or _last_message_text(conversation),
        responsible_user=user if user and user.is_authenticated else None,
    )
    create_activity_event(
        business=log.business,
        client=client,
        actor=user if user and user.is_authenticated else None,
        event_type=ActivityEvents.LEAD_CREATED,
        instance=lead,
        source="ai_tool",
        text="Lead created from approved AI tool.",
        metadata={"tool_call_id": log.id, "tool_name": log.tool_name},
    )
    run_automations_for_event(
        business=log.business,
        trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
        entity=lead,
        payload={"trigger_type": AutomationRule.TriggerTypes.LEAD_CREATED, "lead_id": lead.id, "source": "ai_tool"},
    )
    if conversation and not conversation.lead_id:
        conversation.lead = lead
        if conversation.client_id is None:
            conversation.client = client
        conversation.save(update_fields=["lead", "client", "updated_at"])
    return {"lead_id": lead.id, "client_id": client.id}


def _execute_create_task(log, user):
    conversation = log.conversation
    assignee = _resolve_task_assignee(log, user)
    due_at = _parse_optional_datetime(log.input_json.get("due_at")) or timezone.now()
    reminder_at = _parse_optional_datetime(log.input_json.get("reminder_at"))
    description = log.input_json.get("description", "")
    recommendation = log.input_json.get("recommendation") or log.input_json.get("reason")
    if recommendation and recommendation not in description:
        description = f"{description}\n\nAI recommendation: {recommendation}".strip()
    title = log.input_json.get("title") or "AI suggested follow-up"
    task = create_automation_task(
        business=log.business,
        title=title,
        description=description,
        entity=conversation,
        assignee=assignee,
        priority=log.input_json.get("priority") or Task.Priorities.NORMAL,
        actor=user if user and user.is_authenticated else None,
        due_at=due_at,
        source_payload={"trigger_type": "ai_tool", "tool_call_id": log.id, "tool_name": log.tool_name},
        source="ai_tool",
        activity_text=f"AI created task: {title}",
        notification_text=f"AI создал задачу: {title}",
        notification_priority=(
            "high"
            if (log.input_json.get("priority") or Task.Priorities.NORMAL) in {Task.Priorities.HIGH, Task.Priorities.URGENT}
            else None
        ),
    )
    if reminder_at:
        task.reminder_at = reminder_at
        task.save(update_fields=["reminder_at", "updated_at"])
    return {
        "task_id": task.id,
        "assignee_id": task.assignee_id,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "reminder_at": task.reminder_at.isoformat() if task.reminder_at else None,
        "calendar_status": "scheduled" if task.due_at else "unscheduled",
        "notification_created": True,
    }


def _execute_create_deal(log, user):
    conversation = log.conversation
    client = conversation.client if conversation else None
    if client is None:
        raise ValueError("A client is required to create a deal.")
    if conversation and conversation.lead_id:
        result = create_deal_from_lead(
            lead=conversation.lead,
            actor=user,
            amount=log.input_json.get("amount") or 0,
            title=log.input_json.get("title") or "",
        )
        return {"deal_id": result.deal.id, "created": result.created}
    pipeline = ensure_default_pipeline(log.business)
    stage = PipelineStage.objects.filter(business=log.business, pipeline=pipeline, is_won=False, is_lost=False).order_by("order", "id").first()
    if stage is None:
        raise ValueError("A pipeline stage is required to create a deal.")
    deal = Deal.objects.create(
        business=log.business,
        client=client,
        lead=None,
        pipeline=stage.pipeline,
        stage=stage,
        title=log.input_json.get("title") or f"Deal: {client.full_name}",
        amount=log.input_json.get("amount") or 0,
        owner=user if user and user.is_authenticated else None,
        source="ai_tool",
        probability=stage.probability,
        stage_entered_at=timezone.now(),
    )
    create_activity_event(
        business=log.business,
        client=client,
        actor=user if user and user.is_authenticated else None,
        event_type=ActivityEvents.DEAL_CREATED,
        instance=deal,
        source="ai_tool",
        text="Deal created from approved AI tool.",
        metadata={"tool_call_id": log.id, "tool_name": log.tool_name},
    )
    return {"deal_id": deal.id}


def _execute_summarize_conversation(log, user):
    conversation = log.conversation
    if conversation is None:
        return {"summary": log.input_json.get("message", "No conversation selected.")}
    messages = list(conversation.messages.order_by("-created_at")[:5])
    text = " ".join(message.text for message in reversed(messages) if message.text)
    return {"summary": text[:500] or "No messages yet."}


def _execute_qualify_lead(log, user):
    conversation = log.conversation
    has_client = bool(conversation and conversation.client_id)
    has_lead = bool(conversation and conversation.lead_id)
    score = 80 if has_lead else 60 if has_client else 40
    return {"score": score, "label": "hot" if score >= 70 else "warm", "reason": "Based on linked CRM context."}


def _source_from_conversation(conversation):
    if conversation and conversation.channel in {choice[0] for choice in Lead.Sources.choices}:
        return conversation.channel
    return Lead.Sources.OTHER


def _last_message_text(conversation):
    if conversation is None:
        return ""
    message = conversation.messages.order_by("-created_at").first()
    return message.text if message else ""


def _parse_optional_datetime(value):
    if not value:
        return None
    if hasattr(value, "isoformat"):
        return value
    parsed = parse_datetime(str(value))
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _resolve_task_assignee(log, user):
    assignee_id = log.input_json.get("assignee_id") or log.input_json.get("responsible_user_id")
    if assignee_id:
        member = log.business.members.filter(user_id=assignee_id, is_active=True).select_related("user").first()
        if member:
            return member.user
    if log.conversation and log.conversation.assigned_to_id:
        return log.conversation.assigned_to
    if user and user.is_authenticated and log.business.members.filter(user=user, is_active=True).exists():
        return user
    return log.business.owner
