from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import re
from typing import Any

from apps.ai_core.models import AIRequestLog
from apps.ai_core.services import run_ai_request
from apps.bots.ai import build_bot_conversation_context
from apps.bots.models import BotConversation
from apps.services.models import Service


@dataclass
class ConversationQualification:
    intent: str
    confidence: float
    summary: str
    client_name: str = ""
    phone: str = ""
    service_name: str = ""
    preferred_time_text: str = ""
    urgency: str = "normal"
    estimated_value: float | None = None
    should_create_client: bool = True
    should_create_lead: bool = True
    should_create_deal: bool = False
    should_create_task: bool = True
    should_create_appointment: bool = False
    next_action: str = "Связаться с клиентом"
    reason: str = ""
    requires_human_review: bool = False

    def to_dict(self):
        return asdict(self)


def qualify_conversation(*, conversation: BotConversation, user=None, allow_mock=True) -> tuple[ConversationQualification, AIRequestLog | None]:
    message_context = build_bot_conversation_context(conversation, limit=16)
    services = list(Service.objects.filter(business=conversation.business, is_active=True).order_by("name")[:30])
    service_catalog = [{"id": service.id, "name": service.name, "price_from": str(service.price_from or "")} for service in services]
    user_input = (
        "Квалифицируй входящий CRM-диалог и верни только JSON без markdown. "
        "Нужно определить, какие CRM-действия безопасно предложить или выполнить. "
        "Схема JSON: {"
        '"intent":"appointment_request|price_question|purchase_interest|support|complaint|spam|other",'
        '"confidence":0.0,'
        '"summary":"short russian summary",'
        '"client_name":"",'
        '"phone":"",'
        '"service_name":"",'
        '"preferred_time_text":"",'
        '"urgency":"low|normal|high|urgent",'
        '"estimated_value":null,'
        '"should_create_client":true,'
        '"should_create_lead":true,'
        '"should_create_deal":false,'
        '"should_create_task":true,'
        '"should_create_appointment":false,'
        '"next_action":"short russian action",'
        '"reason":"why",'
        '"requires_human_review":false'
        "}. "
        "Сделку создавай только если есть коммерческий интерес, запись, покупка или вопрос о цене. "
        "Запись в календарь не создавай без конкретной услуги и времени. "
        "requires_human_review=true ставь только если автоматизацию нужно остановить: жалоба, спам, опасный запрос, явная просьба оператора, финальное подтверждение оплаты/скидки/записи без достаточных данных. "
        "Обычный вопрос о цене, записи, услуге или времени не требует human review: бот должен задать следующий уточняющий вопрос."
    )
    result, log = run_ai_request(
        business=conversation.business,
        user=user,
        source=AIRequestLog.Sources.BOT,
        prompt_type="conversation_qualification",
        user_input=user_input,
        input_json={
            "conversation_id": conversation.id,
            "bot_id": conversation.bot_id,
            "channel": conversation.channel,
            "external_user_id": conversation.external_user_id,
            "messages": message_context,
            "services": service_catalog,
        },
        allow_mock=allow_mock,
        model_tier="smart",
    )
    qualification = _parse_qualification(result.output_text)
    if qualification is None:
        qualification = _fallback_qualification(conversation=conversation, messages=message_context, services=services)
        qualification.reason = f"Fallback qualification used because AI output was not valid JSON. Provider={result.provider}."
    return qualification, log


def _parse_qualification(output_text: str) -> ConversationQualification | None:
    raw = (output_text or "").strip()
    if not raw:
        return None
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw).strip()
        raw = re.sub(r"```$", "", raw).strip()
    if "{" in raw and "}" in raw:
        raw = raw[raw.find("{") : raw.rfind("}") + 1]
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return _qualification_from_payload(payload)


def _qualification_from_payload(payload: dict[str, Any]) -> ConversationQualification:
    confidence = _float_between(payload.get("confidence"), minimum=0.0, maximum=1.0, default=0.5)
    urgency = str(payload.get("urgency") or "normal").lower()
    if urgency not in {"low", "normal", "high", "urgent"}:
        urgency = "normal"
    intent = str(payload.get("intent") or "other").strip() or "other"
    estimated_value = payload.get("estimated_value")
    try:
        estimated_value = float(estimated_value) if estimated_value not in {None, ""} else None
    except (TypeError, ValueError):
        estimated_value = None
    return ConversationQualification(
        intent=intent[:64],
        confidence=confidence,
        summary=str(payload.get("summary") or "")[:500],
        client_name=str(payload.get("client_name") or "")[:255],
        phone=str(payload.get("phone") or "")[:64],
        service_name=str(payload.get("service_name") or "")[:255],
        preferred_time_text=str(payload.get("preferred_time_text") or "")[:255],
        urgency=urgency,
        estimated_value=estimated_value,
        should_create_client=bool(payload.get("should_create_client", True)),
        should_create_lead=bool(payload.get("should_create_lead", True)),
        should_create_deal=bool(payload.get("should_create_deal", False)),
        should_create_task=bool(payload.get("should_create_task", True)),
        should_create_appointment=bool(payload.get("should_create_appointment", False)),
        next_action=str(payload.get("next_action") or "Связаться с клиентом")[:255],
        reason=str(payload.get("reason") or "")[:500],
        requires_human_review=bool(payload.get("requires_human_review", confidence < 0.6)),
    )


def _fallback_qualification(*, conversation: BotConversation, messages: list[dict[str, Any]], services: list[Service]) -> ConversationQualification:
    text = " ".join(str(message.get("text") or "") for message in messages).lower()
    commercial_keywords = [
        "цена",
        "стоимость",
        "купить",
        "заказать",
        "запис",
        "бронь",
        "консультац",
        "когда",
        "свобод",
        "прайс",
        "оплат",
    ]
    support_keywords = ["ошибка", "не работает", "жалоб", "проблем", "возврат"]
    has_commercial_intent = any(keyword in text for keyword in commercial_keywords)
    has_support_intent = any(keyword in text for keyword in support_keywords)
    matched_service = next((service.name for service in services if service.name.lower() in text), "")
    if has_commercial_intent:
        intent = "appointment_request" if any(keyword in text for keyword in ["запис", "бронь", "свобод"]) else "purchase_interest"
        confidence = 0.72
        next_action = "Уточнить услугу и удобное время"
    elif has_support_intent:
        intent = "support"
        confidence = 0.68
        next_action = "Передать диалог оператору"
    else:
        intent = "other"
        confidence = 0.45
        next_action = "Уточнить потребность клиента"
    return ConversationQualification(
        intent=intent,
        confidence=confidence,
        summary=_short_summary(messages),
        service_name=matched_service,
        urgency="high" if "срочно" in text else "normal",
        should_create_client=True,
        should_create_lead=not has_support_intent,
        should_create_deal=has_commercial_intent,
        should_create_task=True,
        should_create_appointment=False,
        next_action=next_action,
        requires_human_review=confidence < 0.75,
    )


def _short_summary(messages: list[dict[str, Any]]) -> str:
    last_inbound = next((message for message in reversed(messages) if message.get("direction") == "inbound"), None)
    text = str(last_inbound.get("text") if last_inbound else "").strip()
    return text[:300] or "Диалог требует квалификации"


def _float_between(value, *, minimum: float, maximum: float, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, number))
