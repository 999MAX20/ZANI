from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.utils import timezone

from apps.activities.services import create_activity_event
from apps.bots.ai import suggest_bot_reply
from apps.bots.inbox_service import send_outbound_message
from apps.bots.models import BotChannel, BotConversation, BotMessage
from apps.conversations.ai_qualification import ConversationQualification, qualify_conversation
from apps.conversations.booking import BookingResult, maybe_create_appointment_from_reply, store_offered_slots
from apps.conversations.pipeline import PIPELINE_META_KEY, run_conversation_pipeline
from apps.integrations.sanitization import sanitize_error_text
from apps.notifications.models import Notification
from apps.notifications.routing import MANAGER_ROLES, create_role_notification


AUTO_PIPELINE_META_KEY = "auto_crm_pipeline"


@dataclass
class AutoPipelineConfig:
    enabled: bool = False
    mode: str = "off"
    min_lead_confidence: float = 0.7
    min_deal_confidence: float = 0.8
    allow_deal_intents: tuple[str, ...] = ("appointment_request", "purchase_interest", "price_question")
    require_review_on_fallback: bool = True
    create_appointment: bool = False
    auto_send_reply: bool = False
    max_auto_reply_chars: int = 900


@dataclass
class AutoPipelineDecision:
    status: str
    reason: str
    qualification: ConversationQualification | None = None
    ai_log_id: int | None = None
    result: Any = None
    reply_message: BotMessage | None = None
    reply_error: str = ""
    booking: BookingResult | None = None


def maybe_run_auto_pipeline(*, conversation: BotConversation, message: BotMessage, channel: BotChannel | None = None) -> AutoPipelineDecision:
    config = resolve_auto_pipeline_config(conversation=conversation, channel=channel)
    if not config.enabled or config.mode == "off":
        decision = AutoPipelineDecision(status="skipped_disabled", reason="Auto CRM pipeline is disabled.")
        _save_auto_pipeline_decision(conversation, message, config, decision)
        return decision

    qualification, ai_log = qualify_conversation(conversation=conversation, allow_mock=True)
    decision = _guard_auto_pipeline(config=config, conversation=conversation, message=message, qualification=qualification, ai_log_id=ai_log.id if ai_log else None)
    if decision.status in {"qualified_only", "needs_review", "blocked_low_confidence", "blocked_risky_intent", "blocked_fallback"}:
        _save_auto_pipeline_decision(conversation, message, config, decision)
        _write_decision_event(conversation, decision)
        return decision

    create_deal = decision.status == "created_draft_deal"
    result = run_conversation_pipeline(
        conversation=conversation,
        create_lead=True,
        create_deal=create_deal,
        create_task=True,
        use_ai_qualification=False,
        qualification_override=qualification,
        ai_log_id_override=ai_log.id if ai_log else None,
        source="auto_pipeline",
    )
    decision.result = result
    if config.create_appointment:
        decision.booking = maybe_create_appointment_from_reply(conversation=result.conversation, message=message)
    if decision.booking is None or decision.booking.status != "booked":
        if _can_auto_reply(config=config, conversation=result.conversation, decision=decision):
            _send_auto_reply(conversation=result.conversation, config=config, decision=decision)
    _notify_pipeline_result(result=result, decision=decision)
    _save_auto_pipeline_decision(result.conversation, message, config, decision)
    _write_decision_event(result.conversation, decision)
    return decision


def resolve_auto_pipeline_config(*, conversation: BotConversation, channel: BotChannel | None = None) -> AutoPipelineConfig:
    raw = {}
    if conversation.bot and isinstance(conversation.bot.settings_json, dict):
        raw.update(conversation.bot.settings_json.get(AUTO_PIPELINE_META_KEY) or {})
    if channel and isinstance(channel.config_json, dict):
        raw.update(channel.config_json.get(AUTO_PIPELINE_META_KEY) or {})

    mode = str(raw.get("mode") or "off")
    enabled = bool(raw.get("enabled", mode != "off"))
    return AutoPipelineConfig(
        enabled=enabled,
        mode=mode if mode in {"off", "triage", "lead_task", "draft_deal"} else "off",
        min_lead_confidence=_float(raw.get("min_lead_confidence"), 0.7),
        min_deal_confidence=_float(raw.get("min_deal_confidence"), 0.8),
        allow_deal_intents=tuple(raw.get("allow_deal_intents") or ("appointment_request", "purchase_interest", "price_question")),
        require_review_on_fallback=bool(raw.get("require_review_on_fallback", True)),
        create_appointment=bool(raw.get("create_appointment", False)),
        auto_send_reply=bool(raw.get("auto_send_reply", False)),
        max_auto_reply_chars=max(120, min(_int(raw.get("max_auto_reply_chars"), 900), 2000)),
    )


def _guard_auto_pipeline(
    *,
    config: AutoPipelineConfig,
    conversation: BotConversation,
    message: BotMessage,
    qualification: ConversationQualification,
    ai_log_id: int | None,
) -> AutoPipelineDecision:
    if config.mode == "triage":
        return AutoPipelineDecision(status="qualified_only", reason="Triage mode stores qualification without CRM mutations.", qualification=qualification, ai_log_id=ai_log_id)

    if _is_fallback(qualification) and config.require_review_on_fallback:
        return AutoPipelineDecision(status="blocked_fallback", reason="Fallback qualification requires manager review.", qualification=qualification, ai_log_id=ai_log_id)

    if qualification.intent in {"spam", "support", "complaint"}:
        return AutoPipelineDecision(status="blocked_risky_intent", reason=f"Risky/non-sales intent: {qualification.intent}.", qualification=qualification, ai_log_id=ai_log_id)

    if qualification.requires_human_review and not _can_continue_with_review_flag(config, qualification):
        return AutoPipelineDecision(status="needs_review", reason="AI marked the conversation for human review.", qualification=qualification, ai_log_id=ai_log_id)

    if qualification.confidence < config.min_lead_confidence:
        return AutoPipelineDecision(status="blocked_low_confidence", reason="Confidence is below lead/task threshold.", qualification=qualification, ai_log_id=ai_log_id)

    if config.mode == "draft_deal":
        if qualification.intent not in config.allow_deal_intents:
            return AutoPipelineDecision(status="created_lead_task", reason="Intent is not allowed for automatic deal creation.", qualification=qualification, ai_log_id=ai_log_id)
        if qualification.confidence < config.min_deal_confidence:
            return AutoPipelineDecision(status="created_lead_task", reason="Confidence is below deal threshold; creating lead/task only.", qualification=qualification, ai_log_id=ai_log_id)
        return AutoPipelineDecision(status="created_draft_deal", reason="Commercial high-confidence conversation can create a draft deal.", qualification=qualification, ai_log_id=ai_log_id)

    return AutoPipelineDecision(status="created_lead_task", reason="Lead/task mode creates low-risk CRM work.", qualification=qualification, ai_log_id=ai_log_id)


def _save_auto_pipeline_decision(conversation: BotConversation, message: BotMessage, config: AutoPipelineConfig, decision: AutoPipelineDecision) -> None:
    metadata = dict(conversation.metadata_json or {})
    metadata[AUTO_PIPELINE_META_KEY] = {
        "status": decision.status,
        "reason": decision.reason,
        "mode": config.mode,
        "message_id": message.id,
        "ai_log_id": decision.ai_log_id,
        "qualification": decision.qualification.to_dict() if decision.qualification else None,
        "pipeline": metadata.get(PIPELINE_META_KEY),
        "auto_reply": _auto_reply_meta(decision),
        "booking": _booking_meta(decision),
        "decided_at": timezone.now().isoformat(),
    }
    conversation.metadata_json = metadata
    conversation.save(update_fields=["metadata_json", "updated_at"])


def _write_decision_event(conversation: BotConversation, decision: AutoPipelineDecision) -> None:
    create_activity_event(
        business=conversation.business,
        instance=conversation,
        client=conversation.client,
        source="auto_pipeline",
        event_type=f"auto_pipeline_{decision.status}",
        text=f"Auto CRM pipeline: {decision.status}",
        metadata={
            "conversation_id": conversation.id,
            "status": decision.status,
            "reason": decision.reason,
            "qualification": decision.qualification.to_dict() if decision.qualification else None,
            "ai_log_id": decision.ai_log_id,
            "auto_reply_message_id": decision.reply_message.id if decision.reply_message else None,
            "auto_reply_error": decision.reply_error,
        },
    )


def _can_auto_reply(*, config: AutoPipelineConfig, conversation: BotConversation, decision: AutoPipelineDecision) -> bool:
    if not config.auto_send_reply:
        return False
    if not conversation.bot_enabled or conversation.handoff_required or conversation.status != BotConversation.Statuses.OPEN:
        return False
    if decision.status not in {"created_lead_task", "created_draft_deal", "qualified_only"}:
        return False
    return True


def _send_auto_reply(*, conversation: BotConversation, config: AutoPipelineConfig, decision: AutoPipelineDecision) -> None:
    try:
        result, log, _message_context = suggest_bot_reply(conversation=conversation, user=None, auto_mode=True, qualification=decision.qualification)
        text = (result.output_text or "").strip()
        if not text:
            decision.reply_error = "AI returned an empty auto reply."
            return
        if len(text) > config.max_auto_reply_chars:
            text = text[: config.max_auto_reply_chars].rstrip()
        message = send_outbound_message(conversation, text, user=None, sender_type=BotMessage.SenderTypes.BOT)
        payload = dict(message.payload_json or {})
        payload.update(
            {
                "auto_crm_pipeline": True,
                "auto_reply_ai_log_id": log.id if log else None,
                "auto_pipeline_status": decision.status,
            }
        )
        message.payload_json = payload
        message.save(update_fields=["payload_json"])
        decision.reply_message = message
        scheduling_context = (log.input_json or {}).get("scheduling_context") if log else {}
        if scheduling_context:
            store_offered_slots(conversation=conversation, scheduling_context=scheduling_context, ai_log_id=log.id if log else None)
    except Exception as exc:
        decision.reply_error = sanitize_error_text(exc)


def _auto_reply_meta(decision: AutoPipelineDecision) -> dict[str, Any] | None:
    if not decision.reply_message and not decision.reply_error:
        return None
    return {
        "message_id": decision.reply_message.id if decision.reply_message else None,
        "status": decision.reply_message.status if decision.reply_message else "failed",
        "error": decision.reply_error or decision.reply_message.error_text,
    }


def _booking_meta(decision: AutoPipelineDecision) -> dict[str, Any] | None:
    if decision.booking is None:
        return None
    return {
        "status": decision.booking.status,
        "reason": decision.booking.reason,
        "appointment_id": decision.booking.appointment.id if decision.booking.appointment else None,
        "confirmation_message_id": decision.booking.confirmation_message.id if decision.booking.confirmation_message else None,
    }


def _notify_pipeline_result(*, result, decision: AutoPipelineDecision) -> None:
    if not any(result.created.values()):
        return
    created = [label for label, was_created in result.created.items() if was_created]
    if not created:
        return
    text = f"AI CRM pipeline создал: {', '.join(created)}. Следующий шаг: {decision.qualification.next_action if decision.qualification else 'проверить диалог'}"
    create_role_notification(
        business=result.conversation.business,
        preferred_user=result.conversation.assigned_to or (result.lead.responsible_user if result.lead and result.lead.responsible_user_id else None),
        roles=MANAGER_ROLES,
        client=result.client,
        category=Notification.Categories.SALES,
        priority=Notification.Priorities.HIGH if result.deal else Notification.Priorities.NORMAL,
        text=text,
        action_url=f"/dashboard/conversations?conversation={result.conversation.id}",
        action_label="Открыть чат",
    )


def _is_fallback(qualification: ConversationQualification) -> bool:
    return "Fallback qualification used" in (qualification.reason or "")


def _can_continue_with_review_flag(config: AutoPipelineConfig, qualification: ConversationQualification) -> bool:
    if _is_fallback(qualification) and not config.require_review_on_fallback:
        return True
    if qualification.intent not in config.allow_deal_intents:
        return False
    if qualification.confidence < config.min_lead_confidence:
        return False
    return True


def _float(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
