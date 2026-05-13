from apps.activities.models import ActivityEvent


def write_activity_event(request, event_type, instance, text=""):
    if isinstance(instance, ActivityEvent):
        return

    business = getattr(instance, "business", None)
    client = getattr(instance, "client", None)
    if business is None and hasattr(instance, "conversation"):
        business = instance.conversation.business
        client = instance.conversation.client
    if business is None:
        return

    ActivityEvent.objects.create(
        business=business,
        client=client,
        actor=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
        category=_category_for(instance),
        event_type=event_type,
        source="api",
        entity_type=instance.__class__.__name__,
        entity_id=str(instance.pk or ""),
        text=text or str(instance),
    )


def _category_for(instance):
    model_name = instance.__class__.__name__.lower()
    if model_name in {"conversation", "message"}:
        return ActivityEvent.Categories.MESSAGE
    if model_name in {"appointment", "workinghours", "resource"}:
        return ActivityEvent.Categories.APPOINTMENT
    if model_name == "task":
        return ActivityEvent.Categories.TASK
    if "automation" in model_name:
        return ActivityEvent.Categories.AUTOMATION
    return ActivityEvent.Categories.CRM

