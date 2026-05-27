from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.utils import timezone

from apps.activities.services import create_activity_event
from apps.bots.models import BotChannel, BotConversation, BotMessage
from apps.conversations.ai_qualification import ConversationQualification, qualify_conversation
from apps.conversations.pipeline import PIPELINE_META_KEY, run_conversation_pipeline


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


@dataclass
class AutoPipelineDecision:
    status: str
    reason: str
    qualification: ConversationQualification | None = None
    ai_log_id: int | None = None
    result: Any = None


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

    if qualification.requires_human_review and not (_is_fallback(qualification) and not config.require_review_on_fallback):
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
        },
    )


def _is_fallback(qualification: ConversationQualification) -> bool:
    return "Fallback qualification used" in (qualification.reason or "")


def _float(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
