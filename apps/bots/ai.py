from apps.ai_core.models import AIRequestLog, AgentProfile
from apps.ai_core.services import run_ai_request
from apps.bots.models import BotMessage


def build_bot_conversation_context(conversation, limit=12):
    messages = conversation.messages.order_by("-created_at")[:limit]
    return [
        {
            "direction": message.direction,
            "text": message.text,
            "status": message.status,
            "created_at": message.created_at.isoformat(),
        }
        for message in reversed(list(messages))
    ]


def suggest_bot_reply(*, conversation, user=None):
    message_context = build_bot_conversation_context(conversation)
    agent_profile = (
        AgentProfile.objects.filter(business=conversation.business, bot=conversation.bot, is_active=True).order_by("-updated_at").first()
        or AgentProfile.objects.filter(business=conversation.business, bot__isnull=True, is_active=True).order_by("-updated_at").first()
    )
    last_inbound = next(
        (message for message in reversed(message_context) if message["direction"] == BotMessage.Directions.INBOUND),
        None,
    )
    agent_instruction = ""
    agent_payload = None
    if agent_profile:
        agent_payload = {
            "id": agent_profile.id,
            "name": agent_profile.name,
            "tone": agent_profile.tone,
            "language": agent_profile.language,
            "role_description": agent_profile.role_description,
            "rules_json": agent_profile.rules_json,
            "escalation_rules_json": agent_profile.escalation_rules_json,
        }
        agent_instruction = (
            f"Agent profile: {agent_profile.name}. "
            f"Role: {agent_profile.role_description or 'CRM assistant'}. "
            f"Tone: {agent_profile.tone}. Language: {agent_profile.language}. "
            f"System prompt: {agent_profile.system_prompt or 'Use concise helpful replies.'} "
        )
    user_input = (
        agent_instruction +
        "Generate a short, helpful CRM manager reply for this bot conversation. "
        "Do not send it automatically. "
        f"Last inbound message: {last_inbound['text'] if last_inbound else 'No inbound message'}"
    )
    crm_context = {}
    if conversation.client_id:
        crm_context["client"] = {
            "id": conversation.client_id,
            "full_name": conversation.client.full_name,
            "phone": conversation.client.phone,
            "email": conversation.client.email,
            "source": conversation.client.source,
            "notes": conversation.client.notes,
        }
    if conversation.lead_id:
        crm_context["lead"] = {
            "id": conversation.lead_id,
            "status": conversation.lead.status,
            "source": conversation.lead.source,
            "message": conversation.lead.message,
            "service_id": conversation.lead.service_id,
        }
    if crm_context:
        user_input += f" CRM context: {crm_context}"
    result, log = run_ai_request(
        business=conversation.business,
        user=user,
        source=AIRequestLog.Sources.BOT,
        prompt_type="bot_suggest_reply",
        user_input=user_input,
        input_json={
            "bot_id": conversation.bot_id,
            "conversation_id": conversation.id,
            "channel": conversation.channel,
            "messages": message_context,
            "agent_profile": agent_payload,
            "crm_context": crm_context,
        },
        allow_mock=True,
    )
    return result, log, message_context
