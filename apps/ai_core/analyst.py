import json
import re
from collections import Counter

from django.utils import timezone

from apps.ai_core.models import AIRequestLog
from apps.ai_core.services import run_ai_request
from apps.businesses.access import Actions, Resources, can
from apps.integrations.models import BusinessEvent

SENSITIVE_PAYLOAD_KEYS = {
    "api_key",
    "access_token",
    "refresh_token",
    "token",
    "secret",
    "webhook_secret",
    "password",
}


def build_business_event_sources(business, *, user=None, limit=24):
    if not _can_read_business_events(user, business):
        return []
    events = (
        BusinessEvent.objects.select_related("connector")
        .filter(business=business)
        .order_by("-occurred_at", "-created_at")[:limit]
    )
    return [_event_source(event) for event in events]


def build_event_analyst_brief(*, business, user=None, limit=24):
    sources = build_business_event_sources(business, user=user, limit=limit)
    user_input = (
        "Ты AI Analyst для CRM ZANI. Проанализируй BusinessEvent текущего бизнеса. "
        "Верни только JSON без markdown. Формат: "
        '{"insights":[{"id":"short_id","severity":"critical|warning|info|good","title":"...","summary":"...",'
        '"source_ids":["BE-1"]}],"actions":[{"id":"short_id","priority":"high|medium|low","label":"...",'
        '"description":"...","href":"/app/...","source_ids":["BE-1"]}]}. '
        "Каждый insight и action обязан ссылаться на source_ids из списка. "
        "Не придумывай факты вне источников. Если данных мало, верни insight с severity=info."
    )
    result, log = run_ai_request(
        business=business,
        user=user,
        source=AIRequestLog.Sources.CRM,
        prompt_type="business_event_analyst",
        user_input=user_input,
        input_json={
            "business_event_sources": sources,
            "source_policy": "Use only listed BusinessEvent sources. Cite source_ids in every insight and action.",
        },
        allow_mock=True,
        model_tier="smart",
    )
    parsed = _parse_analyst_json(result.output_text, sources)
    if parsed is None:
        parsed = _fallback_analyst_output(sources)

    return {
        "generated_at": timezone.now().isoformat(),
        "is_mock": result.is_mock,
        "provider": result.provider,
        "model": result.model,
        "tokens_used": result.tokens_used,
        "log_id": log.id,
        "sources": sources,
        "insights": parsed["insights"],
        "actions": parsed["actions"],
        "raw_answer": result.output_text,
    }


def _event_source(event):
    source_id = f"BE-{event.id}"
    payload = _safe_payload(event.payload_json)
    return {
        "id": source_id,
        "event_id": event.id,
        "label": f"{event.source}.{event.event_type}",
        "source": event.source,
        "event_type": event.event_type,
        "status": event.status,
        "occurred_at": event.occurred_at.isoformat(),
        "connector": event.connector.name if event.connector else None,
        "external_id": event.external_id,
        "summary": _payload_summary(payload),
        "payload": payload,
    }


def _can_read_business_events(user, business):
    return bool(user and user.is_authenticated and can(user, business, Resources.INTEGRATIONS, Actions.VIEW).allowed)


def _safe_payload(payload):
    if not isinstance(payload, dict):
        return {}
    safe = {}
    for key, value in payload.items():
        if key.lower() in SENSITIVE_PAYLOAD_KEYS:
            safe[key] = "***"
        elif isinstance(value, dict):
            safe[key] = _safe_payload(value)
        elif isinstance(value, list):
            safe[key] = value[:5]
        else:
            safe[key] = value
    return safe


def _payload_summary(payload):
    if not payload:
        return "No payload details."
    parts = []
    for key, value in list(payload.items())[:5]:
        if value in (None, ""):
            continue
        if isinstance(value, (dict, list)):
            parts.append(f"{key}: object")
        else:
            parts.append(f"{key}: {str(value)[:80]}")
    return " · ".join(parts) or "Payload exists."


def _parse_analyst_json(text, sources):
    source_ids = {source["id"] for source in sources}
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text or "", re.DOTALL)
        if not match:
            return None
        try:
            payload = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None

    insights = [
        _normalize_insight(item, source_ids, index)
        for index, item in enumerate(payload.get("insights", []), start=1)
        if isinstance(item, dict)
    ]
    actions = [
        _normalize_action(item, source_ids, index)
        for index, item in enumerate(payload.get("actions", []), start=1)
        if isinstance(item, dict)
    ]
    insights = [item for item in insights if item]
    actions = [item for item in actions if item]
    if not insights and not actions:
        return None
    return {"insights": insights[:6], "actions": actions[:6]}


def _normalize_insight(item, source_ids, index):
    cited = _valid_source_ids(item.get("source_ids"), source_ids)
    if not cited:
        return None
    severity = item.get("severity") if item.get("severity") in {"critical", "warning", "info", "good"} else "info"
    return {
        "id": str(item.get("id") or f"insight_{index}")[:64],
        "severity": severity,
        "title": str(item.get("title") or "Инсайт по событиям")[:180],
        "summary": str(item.get("summary") or "")[:800],
        "source_ids": cited,
    }


def _normalize_action(item, source_ids, index):
    cited = _valid_source_ids(item.get("source_ids"), source_ids)
    if not cited:
        return None
    priority = item.get("priority") if item.get("priority") in {"high", "medium", "low"} else "medium"
    href = str(item.get("href") or "/app/integrations")
    if href.startswith("/dashboard"):
        href = href.replace("/dashboard", "/app", 1)
    if not href.startswith("/app"):
        href = "/app/integrations"
    return {
        "id": str(item.get("id") or f"action_{index}")[:64],
        "priority": priority,
        "label": str(item.get("label") or "Проверить событие")[:120],
        "description": str(item.get("description") or "")[:800],
        "href": href,
        "source_ids": cited,
    }


def _valid_source_ids(value, source_ids):
    if not isinstance(value, list):
        return []
    return [item for item in value if item in source_ids][:5]


def _fallback_analyst_output(sources):
    if not sources:
        return {
            "insights": [
                {
                    "id": "no_business_events",
                    "severity": "info",
                    "title": "Недостаточно событий для анализа",
                    "summary": "AI Analyst пока не видит BusinessEvent от интеграций. Подключите канал или сделайте импорт, чтобы появились проверяемые факты.",
                    "source_ids": [],
                }
            ],
            "actions": [
                {
                    "id": "connect_first_source",
                    "priority": "medium",
                    "label": "Подключить источник данных",
                    "description": "Начните с Telegram, сайта, Excel/CSV, Kaspi или 1C, чтобы аналитик получил реальные события.",
                    "href": "/app/integrations",
                    "source_ids": [],
                }
            ],
        }

    failed = [source for source in sources if source["status"] == BusinessEvent.Statuses.FAILED]
    received = [source for source in sources if source["status"] == BusinessEvent.Statuses.RECEIVED]
    by_source = Counter(source["source"] for source in sources)
    latest = sources[0]
    insights = []
    actions = []

    if failed:
        cited = [source["id"] for source in failed[:5]]
        insights.append(
            {
                "id": "failed_events",
                "severity": "critical" if len(failed) >= 3 else "warning",
                "title": f"Есть необработанные ошибки интеграций: {len(failed)}",
                "summary": "Часть BusinessEvent пришла со статусом failed. Это может означать, что CRM не получила важные факты по заказам, сообщениям или складу.",
                "source_ids": cited,
            }
        )
        actions.append(
            {
                "id": "fix_failed_events",
                "priority": "high",
                "label": "Разобрать ошибки интеграций",
                "description": "Откройте подключения, проверьте health check и последние sync runs по источникам с failed-событиями.",
                "href": "/app/integrations",
                "source_ids": cited,
            }
        )

    if received:
        cited = [source["id"] for source in received[:5]]
        insights.append(
            {
                "id": "unprocessed_events",
                "severity": "warning",
                "title": f"Есть события, ожидающие обработки: {len(received)}",
                "summary": "События получены, но еще не отмечены как processed. Для production нужно контролировать очередь обработки и повторы.",
                "source_ids": cited,
            }
        )
        actions.append(
            {
                "id": "process_received_events",
                "priority": "medium",
                "label": "Проверить обработку событий",
                "description": "Проверьте, почему received-события не стали processed, и нужен ли retry/reconciliation.",
                "href": "/app/integrations",
                "source_ids": cited,
            }
        )

    if not insights:
        insights.append(
            {
                "id": "events_flowing",
                "severity": "good",
                "title": "BusinessEvent поступают без критичных ошибок",
                "summary": f"Последний источник: {latest['label']}. Активные источники в выборке: {', '.join(sorted(by_source.keys()))}.",
                "source_ids": [latest["id"]],
            }
        )
        actions.append(
            {
                "id": "review_latest_events",
                "priority": "low",
                "label": "Посмотреть последние события",
                "description": "Проверьте свежие события и убедитесь, что они превращаются в CRM-действия: лиды, сделки, задачи или записи.",
                "href": "/app/integrations",
                "source_ids": [latest["id"]],
            }
        )

    return {"insights": insights[:6], "actions": actions[:6]}
