from apps.ai_core.models import AIRequestLog, AgentProfile
from apps.ai_core.services import run_ai_request
from apps.bots.models import BotMessage
from apps.bots.sales_playbooks import build_sales_playbook_context
from apps.bots.scheduling_context import build_bot_scheduling_context


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


def suggest_bot_reply(*, conversation, user=None, auto_mode=False, qualification=None):
    message_context = build_bot_conversation_context(conversation)
    scheduling_context = build_bot_scheduling_context(conversation, qualification=qualification) if auto_mode else {}
    sales_playbook = build_sales_playbook_context(conversation.business) if auto_mode else {}
    bot_settings = conversation.bot.settings_json if isinstance(conversation.bot.settings_json, dict) else {}
    model = bot_settings.get("model") if isinstance(bot_settings.get("model"), str) else None
    model_tier = bot_settings.get("model_tier") if isinstance(bot_settings.get("model_tier"), str) else None
    temperature = _float_or_none(bot_settings.get("temperature"))
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
            "allowed_tools_json": agent_profile.allowed_tools_json,
            "escalation_rules_json": agent_profile.escalation_rules_json,
        }
        agent_instruction = (
            f"Agent profile: {agent_profile.name}. "
            f"Role: {agent_profile.role_description or 'CRM assistant'}. "
            f"Tone: {agent_profile.tone}. Language: {agent_profile.language}. "
            f"System prompt: {agent_profile.system_prompt or 'Use concise helpful replies.'} "
            f"Allowed tools: {agent_profile.allowed_tools_json or {}}. "
            f"Escalation rules: {agent_profile.escalation_rules_json or {}}. "
        )
    if auto_mode:
        reply_instruction = (
            "Generate a short, sales-oriented bot reply for this conversation. "
            "The reply may be sent automatically, so do not promise discounts, final booking, delivery, payment, or availability unless it is explicitly confirmed in context. "
            "Follow sales_playbook exactly for this business type. "
            "Use available scheduling context when present. Offer only real slots from next_available_slots. "
            "Use service prices from services.price_from and explain them as 'от' when price_from is present. "
            "If service, preferred master/resource, day, or exact slot is missing, ask one clear next question instead of inventing details. "
        )
    else:
        reply_instruction = "Generate a short, helpful CRM manager reply for this bot conversation. Do not send it automatically. "

    user_input = agent_instruction + reply_instruction + f"Last inbound message: {last_inbound['text'] if last_inbound else 'No inbound message'}"
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
    if scheduling_context:
        user_input += f" Scheduling context: {scheduling_context}"
    if sales_playbook:
        user_input += f" Sales playbook: {sales_playbook}"
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
            "scheduling_context": scheduling_context,
            "sales_playbook": sales_playbook,
            "bot_settings": {
                "model": model,
                "model_tier": model_tier,
                "temperature": temperature,
            },
        },
        allow_mock=True,
        model=model,
        model_tier=model_tier,
        temperature=temperature,
    )
    return result, log, message_context


def _float_or_none(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None
