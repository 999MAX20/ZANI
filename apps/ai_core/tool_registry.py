from dataclasses import dataclass

from django.utils import timezone

from apps.ai_core.models import AIToolCallLog
from apps.clients.models import Client
from apps.crm.models import Deal, PipelineStage
from apps.leads.models import Lead
from apps.tasks.models import Task


@dataclass(frozen=True)
class AIToolDefinition:
    name: str
    description: str
    requires_confirmation: bool = True


TOOLS = {
    "create_lead": AIToolDefinition("create_lead", "Create a CRM lead from confirmed context."),
    "create_client": AIToolDefinition("create_client", "Create a client profile."),
    "create_task": AIToolDefinition("create_task", "Create a follow-up task for a manager."),
    "create_deal": AIToolDefinition("create_deal", "Create a deal in the default pipeline."),
    "summarize_conversation": AIToolDefinition("summarize_conversation", "Summarize the selected conversation."),
    "qualify_lead": AIToolDefinition("qualify_lead", "Score and qualify a lead or conversation."),
}


def registered_tools():
    return list(TOOLS.values())


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


def execute_tool_call(log, user):
    try:
        handler = {
            "create_client": _execute_create_client,
            "create_lead": _execute_create_lead,
            "create_task": _execute_create_task,
            "create_deal": _execute_create_deal,
            "summarize_conversation": _execute_summarize_conversation,
            "qualify_lead": _execute_qualify_lead,
        }[log.tool_name]
        output = handler(log, user)
        log.status = AIToolCallLog.Statuses.EXECUTED
        log.output_json = output
        log.error = ""
        log.save(update_fields=["status", "output_json", "error"])
        return log
    except Exception as exc:  # Keep tool execution controlled and logged.
        log.status = AIToolCallLog.Statuses.FAILED
        log.error = str(exc)
        log.save(update_fields=["status", "error"])
        return log


def _execute_create_client(log, user):
    client = Client.objects.create(
        business=log.business,
        full_name=log.input_json.get("full_name") or "AI suggested client",
        phone=log.input_json.get("phone", ""),
        email=log.input_json.get("email", ""),
        source=Client.Sources.MANUAL,
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
        )
    lead = Lead.objects.create(
        business=log.business,
        client=client,
        source=_source_from_conversation(conversation),
        message=log.input_json.get("message") or _last_message_text(conversation),
        responsible_user=user if user and user.is_authenticated else None,
    )
    if conversation and not conversation.lead_id:
        conversation.lead = lead
        if conversation.client_id is None:
            conversation.client = client
        conversation.save(update_fields=["lead", "client", "updated_at"])
    return {"lead_id": lead.id, "client_id": client.id}


def _execute_create_task(log, user):
    conversation = log.conversation
    task = Task.objects.create(
        business=log.business,
        title=log.input_json.get("title") or "AI suggested follow-up",
        description=log.input_json.get("description", ""),
        client=conversation.client if conversation else None,
        lead=conversation.lead if conversation else None,
        assignee=user if user and user.is_authenticated else None,
        created_by=user if user and user.is_authenticated else None,
        priority=log.input_json.get("priority") or Task.Priorities.NORMAL,
        due_at=log.input_json.get("due_at") or timezone.now(),
    )
    return {"task_id": task.id}


def _execute_create_deal(log, user):
    conversation = log.conversation
    client = conversation.client if conversation else None
    if client is None:
        raise ValueError("A client is required to create a deal.")
    stage = PipelineStage.objects.filter(business=log.business).order_by("pipeline_id", "order").first()
    if stage is None:
        raise ValueError("A pipeline stage is required to create a deal.")
    deal = Deal.objects.create(
        business=log.business,
        client=client,
        lead=conversation.lead if conversation else None,
        pipeline=stage.pipeline,
        stage=stage,
        title=log.input_json.get("title") or f"Deal: {client.full_name}",
        amount=log.input_json.get("amount") or 0,
        owner=user if user and user.is_authenticated else None,
        source="ai_tool",
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
