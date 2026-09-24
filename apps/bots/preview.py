"""Agent setup rehearsal: saved configuration, shared AI policy, no CRM writes."""
from rest_framework.exceptions import ValidationError

from apps.bots.ai import suggest_bot_reply
from apps.bots.lifecycle import get_bot_readiness
from apps.bots.models import BotConversation
from apps.conversations.ai_qualification import qualify_conversation
from apps.conversations.auto_pipeline import (
    allows_automatic_reply, decide_qualified_pipeline, resolve_auto_pipeline_config,
)


def preview_agent_dialogue(*, bot, user, messages):
    readiness = get_bot_readiness(bot)
    if not readiness["profile_ready"]:
        raise ValidationError({"profile": "Save an active agent profile before testing."})
    # Deliberately unsaved. AI logs/usage are the only persisted preview effects.
    conversation = BotConversation(business=bot.business, bot=bot, channel="website")
    context = [{"id": None, **message} for message in messages]
    qualification, qualification_log = qualify_conversation(
        conversation=conversation, user=user, message_context=context,
    )
    config = resolve_auto_pipeline_config(conversation=conversation)
    decision = decide_qualified_pipeline(
        config=config, qualification=qualification, ai_log_id=qualification_log.id,
    )
    handoff = decision.status in {
        "needs_review", "blocked_low_confidence", "blocked_risky_intent", "blocked_fallback",
    }
    log = qualification_log
    reply = ""
    sources = []
    if not handoff:
        result, log, _, sources = suggest_bot_reply(
            conversation=conversation, user=user, auto_mode=True,
            qualification=qualification, message_context=context,
        )
        reply = result.output_text[:config.max_auto_reply_chars].rstrip()
    return {
        "reply": reply,
        "handoff_required": handoff,
        "decision": decision.status,
        "summary": qualification.summary,
        "automatic_reply_enabled": allows_automatic_reply(config=config, decision=decision),
        "automation_enabled": config.enabled and config.mode != "off",
        "readiness": readiness,
        "provider_state": log.input_json.get("provider_state", "mock"),
        "sources": sources,
        "log_id": log.id,
        "model": log.model,
        "provider": log.input_json.get("ai_provider", ""),
    }
