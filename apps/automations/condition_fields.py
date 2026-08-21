from collections.abc import Mapping


UNRESOLVED_CONDITION_VALUE = object()


ENTITY_FIELDS_BY_TYPE = {
    "Lead": frozenset(
        {
            "id",
            "source",
            "status",
            "previous_status",
            "message",
            "lost_reason",
            "responsible_user_id",
            "service_id",
            "is_archived",
            "created_at",
            "updated_at",
        }
    ),
    "Client": frozenset(
        {
            "id",
            "full_name",
            "source",
            "source_detail",
            "is_archived",
            "created_at",
            "updated_at",
        }
    ),
    "Deal": frozenset(
        {
            "id",
            "title",
            "amount",
            "currency",
            "probability",
            "status",
            "source",
            "expected_close_at",
            "stage_id",
            "pipeline_id",
            "owner_id",
            "is_archived",
            "created_at",
            "updated_at",
        }
    ),
    "Appointment": frozenset(
        {
            "id",
            "status",
            "source",
            "start_at",
            "end_at",
            "service_id",
            "resource_id",
            "is_archived",
            "created_at",
            "updated_at",
        }
    ),
    "BotConversation": frozenset(
        {
            "id",
            "channel",
            "status",
            "priority",
            "unread_count",
            "assigned_to_id",
            "client_id",
            "lead_id",
            "deal_id",
            "is_archived",
            "created_at",
            "updated_at",
        }
    ),
    "Task": frozenset(
        {
            "id",
            "title",
            "status",
            "priority",
            "due_at",
            "assignee_id",
            "snoozed_until",
            "completed_at",
            "cancelled_at",
            "is_archived",
            "created_at",
            "updated_at",
        }
    ),
}


ENTITY_TYPE_BY_TRIGGER = {
    "lead_created": "Lead",
    "lead_status_changed": "Lead",
    "deal_created": "Deal",
    "deal_stage_changed": "Deal",
    "stage_changed": "Deal",
    "message_received": "BotConversation",
    "bot_message_received": "BotConversation",
    "conversation_unread": "BotConversation",
    "task_overdue": "Task",
    "appointment_created": "Appointment",
    "appointment_cancelled": "Appointment",
    "appointment_completed": "Appointment",
    "client_inactive": "Client",
}


PAYLOAD_FIELD_PATHS = {
    "payload.trigger_type": ("trigger_type",),
    "payload.event_type": ("event_type",),
    "payload.source": ("source",),
    "payload.source_event_id": ("source_event_id",),
    "payload.lead_id": ("lead_id",),
    "payload.client_id": ("client_id",),
    "payload.deal_id": ("deal_id",),
    "payload.appointment_id": ("appointment_id",),
    "payload.task_id": ("task_id",),
    "payload.conversation_id": ("conversation_id",),
    "payload.message_id": ("message_id",),
    "payload.text": ("text",),
    "payload.status": ("status",),
    "payload.due_at": ("due_at",),
    "payload.from_stage": ("from_stage",),
    "payload.to_stage": ("to_stage",),
    "payload.from_status": ("from_status",),
    "payload.to_status": ("to_status",),
    "payload.utm.source": ("utm", "source"),
    "payload.utm.medium": ("utm", "medium"),
    "payload.utm.campaign": ("utm", "campaign"),
    "payload.utm.content": ("utm", "content"),
    "payload.utm.term": ("utm", "term"),
}


def allowed_condition_fields(trigger_type):
    entity_type = ENTITY_TYPE_BY_TRIGGER.get(str(trigger_type or ""))
    return frozenset(PAYLOAD_FIELD_PATHS).union(ENTITY_FIELDS_BY_TYPE.get(entity_type, frozenset()))


def validate_condition_field(field, *, trigger_type):
    normalized = str(field or "").strip()
    if not normalized or normalized not in allowed_condition_fields(trigger_type):
        raise ValueError("Select a supported field for this automation trigger.")
    return normalized


def extract_condition_value(field, *, entity, payload):
    normalized = str(field or "").strip()
    payload_path = PAYLOAD_FIELD_PATHS.get(normalized)
    if payload_path is not None:
        value = payload if isinstance(payload, Mapping) else {}
        for part in payload_path:
            if not isinstance(value, Mapping) or part not in value:
                return UNRESOLVED_CONDITION_VALUE
            value = value[part]
        return value

    entity_type = entity.__class__.__name__ if entity is not None else ""
    if normalized not in ENTITY_FIELDS_BY_TYPE.get(entity_type, frozenset()):
        return UNRESOLVED_CONDITION_VALUE
    return getattr(entity, normalized, UNRESOLVED_CONDITION_VALUE)
