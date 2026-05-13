from apps.ai_core.models import AIRequestLog
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
    last_inbound = next(
        (message for message in reversed(message_context) if message["direction"] == BotMessage.Directions.INBOUND),
        None,
    )
    user_input = (
        "Generate a short, helpful CRM manager reply for this bot conversation. "
        "Do not send it automatically. "
        f"Last inbound message: {last_inbound['text'] if last_inbound else 'No inbound message'}"
    )
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
        },
        allow_mock=True,
    )
    return result, log, message_context
