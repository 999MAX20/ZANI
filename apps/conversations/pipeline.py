from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.bots.models import BotConversation
from apps.businesses.access import Resources
from apps.businesses.capabilities import assert_resource_enabled
from apps.clients.models import Client
from apps.conversations.ai_qualification import ConversationQualification, qualify_conversation
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.services.models import Service
from apps.tasks.models import Task


PIPELINE_META_KEY = "conversation_pipeline"


@dataclass
class ConversationPipelineResult:
    conversation: BotConversation
    client: Client
    lead: Lead | None
    deal: Deal | None
    task: Task | None
    created: dict[str, bool]
    qualification: ConversationQualification | None = None
    ai_log_id: int | None = None


def run_conversation_pipeline(
    *,
    conversation: BotConversation,
    actor=None,
    create_lead: bool = True,
    create_deal: bool = True,
    create_task: bool = True,
    lead_message: str = "",
    deal_title: str = "",
    deal_amount: Decimal | int | str = Decimal("0"),
    deal_currency: str = "KZT",
    task_title: str = "",
    task_description: str = "",
    task_priority: str = Task.Priorities.NORMAL,
    task_due_at=None,
    use_ai_qualification: bool = False,
    apply_ai_decisions: bool = True,
    qualification_override: ConversationQualification | None = None,
    ai_log_id_override: int | None = None,
    source: str = "api",
) -> ConversationPipelineResult:
    """Promote an inbox conversation into CRM entities.

    The function is intentionally idempotent for the active conversation:
    it reuses linked entities and stores created ids in metadata_json.
    """

    assert_resource_enabled(conversation.business, Resources.CLIENTS)
    if create_lead:
        assert_resource_enabled(conversation.business, Resources.LEADS)
    if create_deal:
        assert_resource_enabled(conversation.business, Resources.DEALS)
    if create_task:
        assert_resource_enabled(conversation.business, Resources.TASKS)

    qualification = qualification_override
    ai_log = None
    ai_log_id = ai_log_id_override
    if use_ai_qualification and qualification is None:
        qualification, ai_log = qualify_conversation(conversation=conversation, user=actor)
        ai_log_id = ai_log.id if ai_log else None
    if qualification is not None:
        lead_message = lead_message or qualification.summary
        deal_title = deal_title or _deal_title_from_qualification(qualification)
        task_title = task_title or qualification.next_action
        task_description = task_description or _task_description_from_qualification(qualification)
        task_priority = _priority_from_qualification(qualification)
        if apply_ai_decisions:
            create_lead = create_lead and qualification.should_create_lead
            create_deal = create_deal and qualification.should_create_deal
            create_task = create_task and qualification.should_create_task

    with transaction.atomic():
        conversation = (
            BotConversation.objects.select_for_update()
            .select_related("business", "client", "lead", "deal", "assigned_to")
            .get(pk=conversation.pk)
        )
        created = {"client": False, "lead": False, "deal": False, "task": False}
        client = _ensure_client(conversation=conversation, created=created, actor=actor, source=source, qualification=qualification)
        lead = _ensure_lead(
            conversation=conversation,
            client=client,
            created=created,
            actor=actor,
            message=lead_message,
            enabled=create_lead,
            source=source,
            qualification=qualification,
        )
        deal = _ensure_deal(
            conversation=conversation,
            client=client,
            lead=lead,
            created=created,
            actor=actor,
            title=deal_title,
            amount=deal_amount,
            currency=deal_currency,
            enabled=create_deal,
            source=source,
        )
        task = _ensure_task(
            conversation=conversation,
            client=client,
            lead=lead,
            deal=deal,
            created=created,
            actor=actor,
            title=task_title,
            description=task_description,
            priority=task_priority,
            due_at=task_due_at,
            enabled=create_task,
            source=source,
        )

        metadata = dict(conversation.metadata_json or {})
        pipeline_meta = dict(metadata.get(PIPELINE_META_KEY) or {})
        pipeline_meta.update(
            {
                "client_id": client.id,
                "lead_id": lead.id if lead else None,
                "deal_id": deal.id if deal else None,
                "task_id": task.id if task else None,
                "qualification": qualification.to_dict() if qualification else None,
                "ai_log_id": ai_log_id,
                "last_run_at": timezone.now().isoformat(),
                "last_run_by": actor.id if actor and getattr(actor, "is_authenticated", False) else None,
            }
        )
        metadata[PIPELINE_META_KEY] = pipeline_meta

        conversation.client = client
        if lead is not None:
            conversation.lead = lead
        if deal is not None:
            conversation.deal = deal
        conversation.metadata_json = metadata
        conversation.save(update_fields=["client", "lead", "deal", "metadata_json", "updated_at"])

    return ConversationPipelineResult(
        conversation=conversation,
        client=client,
        lead=lead,
        deal=deal,
        task=task,
        created=created,
        qualification=qualification,
        ai_log_id=ai_log_id,
    )


def source_from_channel(channel: str) -> str:
    allowed_sources = {choice[0] for choice in Lead.Sources.choices}
    return channel if channel in allowed_sources else Lead.Sources.OTHER


def default_pipeline_and_stage(business):
    pipeline = Pipeline.objects.filter(business=business, is_default=True).first() or Pipeline.objects.filter(business=business).first()
    if pipeline is None:
        pipeline = Pipeline.objects.create(business=business, name="Sales Pipeline", slug="sales", is_default=True)
    stage = PipelineStage.objects.filter(business=business, pipeline=pipeline).order_by("order", "id").first()
    if stage is None:
        stage = PipelineStage.objects.create(business=business, pipeline=pipeline, name="New", order=1, probability=10)
    return pipeline, stage


def last_message_text(conversation: BotConversation) -> str:
    message = conversation.messages.order_by("-created_at").first()
    return message.text if message else ""


def _ensure_client(*, conversation: BotConversation, created: dict[str, bool], actor, source: str, qualification: ConversationQualification | None = None) -> Client:
    if conversation.client_id:
        return conversation.client

    client = _find_existing_client(conversation, qualification=qualification)
    if client is not None:
        return client

    full_name = qualification.client_name if qualification and qualification.client_name else _client_name(conversation)
    client = Client.objects.create(
        business=conversation.business,
        full_name=full_name,
        phone=_phone_from_conversation(conversation, qualification=qualification),
        whatsapp_id=conversation.external_user_id if conversation.channel == BotConversation.Channels.WHATSAPP else "",
        telegram_id=conversation.external_user_id if conversation.channel == BotConversation.Channels.TELEGRAM else "",
        instagram_id=conversation.external_user_id if conversation.channel == BotConversation.Channels.INSTAGRAM else "",
        source=source_from_channel(conversation.channel),
        notes=f"Создан из диалога #{conversation.id}" if conversation.id else "",
    )
    created["client"] = True
    create_activity_event(
        business=conversation.business,
        instance=client,
        client=client,
        actor=actor,
        source=source,
        event_type=ActivityEvents.CLIENT_CREATED,
        metadata={"event_type": ActivityEvents.CLIENT_CREATED, "conversation_id": conversation.id, "channel": conversation.channel},
    )
    return client


def _ensure_lead(
    *,
    conversation: BotConversation,
    client: Client,
    created: dict[str, bool],
    actor,
    message: str,
    enabled: bool,
    source: str,
    qualification: ConversationQualification | None = None,
) -> Lead | None:
    if conversation.lead_id:
        return conversation.lead
    if not enabled:
        return None

    meta_lead_id = _pipeline_meta(conversation).get("lead_id")
    if meta_lead_id:
        lead = Lead.objects.filter(id=meta_lead_id, business=conversation.business, client=client).first()
        if lead is not None:
            return lead

    lead = Lead.objects.create(
        business=conversation.business,
        client=client,
        service=_service_from_qualification(conversation.business, qualification),
        source=source_from_channel(conversation.channel),
        message=message or last_message_text(conversation),
        responsible_user=conversation.assigned_to or actor if actor and getattr(actor, "is_authenticated", False) else conversation.assigned_to,
    )
    created["lead"] = True
    create_activity_event(
        business=conversation.business,
        instance=lead,
        client=client,
        actor=actor,
        source=source,
        event_type=ActivityEvents.LEAD_CREATED,
        metadata={"event_type": ActivityEvents.LEAD_CREATED, "conversation_id": conversation.id, "channel": conversation.channel},
    )
    return lead


def _ensure_deal(
    *,
    conversation: BotConversation,
    client: Client,
    lead: Lead | None,
    created: dict[str, bool],
    actor,
    title: str,
    amount,
    currency: str,
    enabled: bool,
    source: str,
) -> Deal | None:
    if conversation.deal_id:
        return conversation.deal
    if not enabled:
        return None

    meta_deal_id = _pipeline_meta(conversation).get("deal_id")
    if meta_deal_id:
        deal = Deal.objects.filter(id=meta_deal_id, business=conversation.business, client=client).first()
        if deal is not None:
            return deal

    pipeline, stage = default_pipeline_and_stage(conversation.business)
    deal = Deal.objects.create(
        business=conversation.business,
        client=client,
        lead=lead,
        pipeline=pipeline,
        stage=stage,
        title=title or f"Сделка: {client.full_name}",
        amount=amount or Decimal("0"),
        currency=currency or "KZT",
        owner=conversation.assigned_to or actor if actor and getattr(actor, "is_authenticated", False) else conversation.assigned_to,
        probability=stage.probability,
        source=source_from_channel(conversation.channel),
        next_action_at=timezone.now() + timedelta(hours=2),
    )
    created["deal"] = True
    create_activity_event(
        business=conversation.business,
        instance=deal,
        client=client,
        actor=actor,
        source=source,
        event_type=ActivityEvents.DEAL_CREATED,
        metadata={
            "event_type": ActivityEvents.DEAL_CREATED,
            "conversation_id": conversation.id,
            "lead_id": lead.id if lead else None,
            "channel": conversation.channel,
        },
    )
    return deal


def _ensure_task(
    *,
    conversation: BotConversation,
    client: Client,
    lead: Lead | None,
    deal: Deal | None,
    created: dict[str, bool],
    actor,
    title: str,
    description: str,
    priority: str,
    due_at,
    enabled: bool,
    source: str,
) -> Task | None:
    if not enabled:
        return None

    meta_task_id = _pipeline_meta(conversation).get("task_id")
    if meta_task_id:
        task = Task.objects.filter(id=meta_task_id, business=conversation.business).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED]).first()
        if task is not None:
            return task

    default_title = f"Связаться: {client.full_name}"
    existing = Task.objects.filter(
        business=conversation.business,
        client=client,
        lead=lead,
        deal=deal,
        conversation=conversation,
        title=title or default_title,
    ).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED]).first()
    if existing is not None:
        return existing

    assignee = conversation.assigned_to or actor if actor and getattr(actor, "is_authenticated", False) else conversation.assigned_to
    task = Task.objects.create(
        business=conversation.business,
        title=title or default_title,
        description=description or f"Диалог #{conversation.id}: {last_message_text(conversation)}",
        client=client,
        lead=lead,
        deal=deal,
        conversation=conversation,
        assignee=assignee,
        created_by=actor if actor and getattr(actor, "is_authenticated", False) else None,
        priority=priority or Task.Priorities.NORMAL,
        due_at=due_at or timezone.now() + timedelta(hours=2),
    )
    created["task"] = True
    create_activity_event(
        business=conversation.business,
        instance=task,
        client=client,
        actor=actor,
        source=source,
        event_type=ActivityEvents.TASK_CREATED,
        metadata={
            "event_type": ActivityEvents.TASK_CREATED,
            "conversation_id": conversation.id,
            "lead_id": lead.id if lead else None,
            "deal_id": deal.id if deal else None,
            "channel": conversation.channel,
        },
    )
    return task


def _find_existing_client(conversation: BotConversation, qualification: ConversationQualification | None = None) -> Client | None:
    filters = Q()
    external_id = conversation.external_user_id or ""
    if external_id and conversation.channel == BotConversation.Channels.WHATSAPP:
        filters |= Q(whatsapp_id=external_id)
    if external_id and conversation.channel == BotConversation.Channels.TELEGRAM:
        filters |= Q(telegram_id=external_id)
    if external_id and conversation.channel == BotConversation.Channels.INSTAGRAM:
        filters |= Q(instagram_id=external_id)

    phone = _phone_from_conversation(conversation, qualification=qualification)
    if phone:
        filters |= Q(phone=phone)

    if not filters:
        return None
    return Client.objects.filter(filters, business=conversation.business, is_archived=False).order_by("-updated_at").first()


def _client_name(conversation: BotConversation) -> str:
    payload = _last_payload(conversation)
    for key in ["full_name", "name", "username", "telegram_username", "whatsapp_profile_name"]:
        value = str(payload.get(key) or "").strip()
        if value:
            return value
    return conversation.external_user_id or conversation.external_thread_id or f"Inbox visitor #{conversation.id}"


def _phone_from_conversation(conversation: BotConversation, qualification: ConversationQualification | None = None) -> str:
    if qualification and qualification.phone:
        cleaned_qualification_phone = "".join(char for char in qualification.phone if char.isdigit() or char == "+")
        if cleaned_qualification_phone:
            return cleaned_qualification_phone[:32]
    payload = _last_payload(conversation)
    value = str(payload.get("phone") or payload.get("whatsapp_sender_id") or "").strip()
    if not value and conversation.channel == BotConversation.Channels.WHATSAPP:
        value = conversation.external_user_id or ""
    if not value:
        return ""
    cleaned = "".join(char for char in value if char.isdigit() or char == "+")
    return cleaned[:32]


def _last_payload(conversation: BotConversation) -> dict[str, Any]:
    message = conversation.messages.order_by("-created_at").first()
    if message is None or not isinstance(message.payload_json, dict):
        return {}
    return message.payload_json


def _pipeline_meta(conversation: BotConversation) -> dict[str, Any]:
    metadata = conversation.metadata_json or {}
    return metadata.get(PIPELINE_META_KEY) or {}


def _service_from_qualification(business, qualification: ConversationQualification | None) -> Service | None:
    if not qualification or not qualification.service_name:
        return None
    return Service.objects.filter(business=business, is_active=True, name__iexact=qualification.service_name).first()


def _deal_title_from_qualification(qualification: ConversationQualification) -> str:
    if qualification.service_name:
        return f"Сделка: {qualification.service_name}"
    if qualification.intent == "appointment_request":
        return "Сделка: запись клиента"
    if qualification.intent in {"price_question", "purchase_interest"}:
        return "Сделка: интерес клиента"
    return ""


def _task_description_from_qualification(qualification: ConversationQualification) -> str:
    details = [qualification.summary]
    if qualification.reason:
        details.append(f"AI reason: {qualification.reason}")
    if qualification.preferred_time_text:
        details.append(f"Желаемое время: {qualification.preferred_time_text}")
    return "\n".join(item for item in details if item)


def _priority_from_qualification(qualification: ConversationQualification) -> str:
    if qualification.urgency in {Task.Priorities.LOW, Task.Priorities.NORMAL, Task.Priorities.HIGH, Task.Priorities.URGENT}:
        return qualification.urgency
    if qualification.confidence < 0.6:
        return Task.Priorities.HIGH
    return Task.Priorities.NORMAL
