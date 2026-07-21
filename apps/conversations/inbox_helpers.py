from django.db.models import Count, Max, Q, Sum
from rest_framework.exceptions import ValidationError

from apps.bots.models import BotConversation
from apps.core.work_queues import (
    handoff_conversations_queryset,
    overdue_handoff_conversations_queryset,
    unread_conversations_queryset,
    unread_sla_overdue_conversations_queryset,
)


QUALIFICATION_PREVIEW_META_KEY = "conversation_qualification_preview"


def _parse_id_list(params, key):
    raw_values = list(params.getlist(key)) if hasattr(params, "getlist") else []
    if hasattr(params, "getlist"):
        raw_values.extend(params.getlist(f"{key}[]"))
    if not raw_values:
        value = params.get(key)
        if value:
            raw_values = [value]

    values = []
    for item in raw_values:
        for chunk in str(item).split(","):
            value = chunk.strip()
            if not value:
                continue
            try:
                values.append(int(value))
            except (TypeError, ValueError):
                continue
    return values


def build_inbox_summary_payload(queryset, user):
    total = queryset.count()
    unread = unread_conversations_queryset(queryset=queryset).count()
    unread_messages = queryset.aggregate(total=Sum("unread_count"))["total"] or 0
    handoff_required = handoff_conversations_queryset(queryset=queryset).count()
    unread_sla_overdue = unread_sla_overdue_conversations_queryset(queryset=queryset).count()
    handoff_sla_overdue = overdue_handoff_conversations_queryset(queryset=queryset).count()
    assigned_to_me = queryset.filter(assigned_to=user).count()
    unassigned = queryset.filter(assigned_to__isnull=True).count()
    urgent = queryset.filter(priority=BotConversation.Priorities.URGENT).count()
    high_priority = queryset.filter(priority__in=[BotConversation.Priorities.HIGH, BotConversation.Priorities.URGENT]).count()
    bot_paused = queryset.filter(bot_enabled=False).count()

    channel_rows = queryset.values("channel").annotate(
        total=Count("id"),
        unread=Sum("unread_count"),
        handoff_required=Count("id", filter=Q(handoff_required=True)),
        last_message_at=Max("last_message_at"),
    )
    channel_map = {row["channel"]: row for row in channel_rows}
    channels = []
    for item in _channel_catalog():
        row = channel_map.get(item["key"], {})
        channels.append(
            {
                **item,
                "total": row.get("total", 0) or 0,
                "unread": row.get("unread", 0) or 0,
                "handoff_required": row.get("handoff_required", 0) or 0,
                "last_message_at": row.get("last_message_at"),
                "is_connected": bool(row.get("total")) or item["status"] == "available",
            }
        )

    next_actions = []
    if handoff_sla_overdue:
        next_actions.append({"label": "Handoff SLA overdue", "href": "/app/inbox?handoff_required=true", "priority": "urgent"})
    if unread_sla_overdue:
        next_actions.append({"label": "Unread SLA overdue", "href": "/app/inbox?unread=true", "priority": "urgent"})
    if unread:
        next_actions.append({"label": "Разобрать непрочитанные", "href": "/app/inbox?unread=true", "priority": "high"})
    if handoff_required:
        next_actions.append({"label": "Забрать диалоги у бота", "href": "/app/inbox?handoff_required=true", "priority": "high"})
    if unassigned:
        next_actions.append({"label": "Назначить ответственных", "href": "/app/inbox?assigned_to=unassigned", "priority": "normal"})
    if total == 0:
        next_actions.append({"label": "Подключить website chat", "href": "/app/integrations", "priority": "normal"})

    return {
        "total": total,
        "unread": unread,
        "unread_messages": unread_messages,
        "handoff_required": handoff_required,
        "unread_sla_overdue": unread_sla_overdue,
        "handoff_sla_overdue": handoff_sla_overdue,
        "assigned_to_me": assigned_to_me,
        "unassigned": unassigned,
        "urgent": urgent,
        "high_priority": high_priority,
        "bot_paused": bot_paused,
        "channels": channels,
        "next_actions": next_actions,
        "pilot_positioning": (
            "Unified Inbox собирает обращения с сайта/лендинга и beta-каналов в одном месте. "
            "WhatsApp/Instagram отмечены как roadmap, чтобы маркетинг не обещал production раньше времени."
        ),
    }


def _channel_catalog():
    return [
        {
            "key": BotConversation.Channels.WEBSITE,
            "label": "Website / landing chat",
            "status": "available",
            "pilot_note": "Готово для пилота: сообщения с сайта/лендинга попадают в единый inbox.",
        },
        {
            "key": BotConversation.Channels.TELEGRAM,
            "label": "Telegram",
            "status": "beta",
            "pilot_note": "Beta: можно проверять через подключенный bot token/staging.",
        },
        {
            "key": BotConversation.Channels.WHATSAPP,
            "label": "WhatsApp",
            "status": "roadmap",
            "pilot_note": "На пилоте используем WhatsApp-кнопку. Production API подключается отдельно.",
        },
        {
            "key": BotConversation.Channels.INSTAGRAM,
            "label": "Instagram Direct",
            "status": "roadmap",
            "pilot_note": "Показываем как следующий модуль, не обещаем как готовую production-интеграцию.",
        },
    ]


def apply_inbox_filters(queryset, params, user):
    for field in ["channel", "status", "priority"]:
        value = params.get(field)
        if value:
            queryset = queryset.filter(**{field: value})

    bot = params.get("bot")
    if bot:
        queryset = queryset.filter(bot_id=bot)

    for key, field in [
        ("client_ids", "client_id"),
        ("lead_ids", "lead_id"),
        ("deal_ids", "deal_id"),
    ]:
        values = _parse_id_list(params, key)
        if values:
            queryset = queryset.filter(**{f"{field}__in": values})

    assigned_to = params.get("assigned_to")
    if assigned_to == "me":
        queryset = queryset.filter(assigned_to=user)
    elif assigned_to == "unassigned":
        queryset = queryset.filter(assigned_to__isnull=True)
    elif assigned_to:
        queryset = queryset.filter(assigned_to_id=assigned_to)

    bot_enabled = params.get("bot_enabled")
    if bot_enabled in {"true", "false"}:
        queryset = queryset.filter(bot_enabled=bot_enabled == "true")

    unread = params.get("unread")
    if unread == "true":
        queryset = queryset.filter(unread_count__gt=0)
    elif unread == "false":
        queryset = queryset.filter(unread_count=0)

    handoff_required = params.get("handoff_required")
    if handoff_required == "true":
        queryset = queryset.filter(handoff_required=True)
    elif handoff_required == "false":
        queryset = queryset.filter(handoff_required=False)

    search = (params.get("search") or params.get("q") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(external_user_id__icontains=search)
            | Q(external_thread_id__icontains=search)
            | Q(client__full_name__icontains=search)
            | Q(client__phone__icontains=search)
            | Q(client__email__icontains=search)
            | Q(messages__text__icontains=search)
        ).distinct()

    return queryset


def build_message_page(conversation, params, *, default_limit, max_limit):
    limit_param = params.get("limit", default_limit)
    try:
        limit = int(limit_param)
    except (TypeError, ValueError) as exc:
        raise ValidationError({"detail": "Invalid limit parameter. Expected integer."}) from exc
    if limit < 1 or limit > max_limit:
        raise ValidationError({"detail": f"Invalid limit parameter. Must be between 1 and {max_limit}."})

    before_id_param = params.get("before_id")
    if before_id_param is not None:
        try:
            before_id = int(before_id_param)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"detail": "Invalid before_id parameter. Expected integer."}) from exc
        if before_id < 1:
            raise ValidationError({"detail": "Invalid before_id parameter. Must be greater than 0."})
        message_query = conversation.messages.filter(id__lt=before_id)
    else:
        message_query = conversation.messages.all()

    message_window = list(message_query.order_by("-created_at", "-id")[: limit + 1])
    has_more = len(message_window) > limit
    page_messages = message_window[:limit]
    next_before_id = message_window[limit].id if has_more else None

    return {
        "count": conversation.messages.count(),
        "next": str(next_before_id) if next_before_id else None,
        "previous": None,
        "messages": list(reversed(page_messages)),
        "next_before_id": next_before_id,
        "has_more": has_more,
    }


def last_message_id(conversation):
    return conversation.messages.order_by("-created_at").values_list("id", flat=True).first()


def qualification_preview_for_execution(conversation):
    metadata = conversation.metadata_json or {}
    preview_payload = metadata.get(QUALIFICATION_PREVIEW_META_KEY)
    if not isinstance(preview_payload, dict):
        raise ValidationError({"detail": "Run AI qualification preview before CRM pipeline execution."})
    qualification_payload = preview_payload.get("qualification")
    if not isinstance(qualification_payload, dict):
        raise ValidationError({"detail": "Run AI qualification preview before CRM pipeline execution."})
    if preview_payload.get("last_message_id") != last_message_id(conversation):
        raise ValidationError({"detail": "AI qualification preview is stale. Run preview again before CRM pipeline execution."})
    return preview_payload
