from apps.activities.models import ActivityEvent, Note
from apps.activities.taxonomy import ActivityEvents, canonical_event_type, event_category, event_label


def create_activity_event(*, business, event_type, instance=None, client=None, actor=None, category=None, source="api", text="", metadata=None):
    if business is None:
        return None

    if instance is not None and client is None:
        client = _client_for(instance)

    normalized_event_type = canonical_event_type(event_type)
    return ActivityEvent.objects.create(
        business=business,
        client=client,
        actor=actor,
        category=category or event_category(normalized_event_type) or _category_for(instance),
        event_type=normalized_event_type,
        source=source,
        entity_type=instance.__class__.__name__ if instance is not None else "",
        entity_id=str(getattr(instance, "pk", "") or ""),
        text=text or _human_text(normalized_event_type, instance),
        metadata=metadata or {},
    )


def write_activity_event(request, event_type, instance, text="", metadata=None):
    if isinstance(instance, ActivityEvent):
        return

    business = getattr(instance, "business", None)
    client = _client_for(instance)
    if business is None and hasattr(instance, "conversation"):
        business = instance.conversation.business
        client = instance.conversation.client
    if business is None:
        return

    return create_activity_event(
        business=business,
        client=client,
        actor=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
        category=_category_for(instance),
        event_type=_canonical_event_type(event_type, instance),
        source="api",
        instance=instance,
        text=text,
        metadata=metadata,
    )


def activity_for_client(client):
    return ActivityEvent.objects.filter(business=client.business, client=client).select_related("business", "client", "actor")


def activity_for_entity(entity_type, entity_id):
    return ActivityEvent.objects.filter(entity_type=entity_type, entity_id=str(entity_id)).select_related("business", "client", "actor")


def create_note_for_entity(*, business, entity, text, author=None, source="api"):
    text = (text or "").strip()
    if not text:
        raise ValueError("Note text is required.")
    if business is None:
        raise ValueError("Business is required.")
    if entity is not None and getattr(entity, "business_id", business.id) != business.id:
        raise ValueError("Note entity must belong to the selected business.")

    client = _client_for(entity)
    note = Note.objects.create(
        business=business,
        client=client,
        author=author if getattr(author, "id", None) else None,
        entity_type=entity.__class__.__name__ if entity is not None else "",
        entity_id=str(getattr(entity, "pk", "") or ""),
        text=text,
    )
    event_type = ActivityEvents.LEAD_NOTE_ADDED if entity is not None and entity.__class__.__name__ == "Lead" else ActivityEvents.NOTE_CREATED
    create_activity_event(
        business=business,
        client=client,
        actor=author,
        event_type=event_type,
        instance=entity or note,
        source=source,
        text=text[:240],
        metadata={"note_id": note.id, "source": source},
    )
    return note


def _client_for(instance):
    if instance is None:
        return None
    if instance.__class__.__name__.lower() == "client":
        return instance
    client = getattr(instance, "client", None)
    conversation = getattr(instance, "conversation", None)
    if client is None and conversation is not None:
        client = conversation.client
    if client is None and hasattr(instance, "lead") and getattr(instance, "lead", None):
        client = instance.lead.client
    return client


def _category_for(instance):
    if instance is None:
        return ActivityEvent.Categories.SYSTEM
    model_name = instance.__class__.__name__.lower()
    if model_name in {"conversation", "message", "botconversation", "botmessage"}:
        return ActivityEvent.Categories.MESSAGE
    if model_name in {"appointment", "workinghours", "resource"}:
        return ActivityEvent.Categories.APPOINTMENT
    if model_name == "task":
        return ActivityEvent.Categories.TASK
    if "automation" in model_name:
        return ActivityEvent.Categories.AUTOMATION
    return ActivityEvent.Categories.CRM


def _canonical_event_type(event_type, instance):
    if "." not in event_type:
        return event_type

    model_name, action = event_type.split(".", 1)
    aliases = {
        "client": "client",
        "lead": "lead",
        "deal": "deal",
        "task": "task",
        "appointment": "appointment",
        "note": "note",
        "automationrun": "automation",
        "botmessage": "message",
    }
    base = aliases.get(model_name, model_name)
    if base == "message" and action == "created" and instance is not None:
        direction = getattr(instance, "direction", "")
        return "message_sent" if direction == "outbound" else "message_received"
    return f"{base}_{action}"


def _human_text(event_type, instance):
    label = event_label(event_type)
    if label:
        return label
    return str(instance) if instance is not None else event_type
