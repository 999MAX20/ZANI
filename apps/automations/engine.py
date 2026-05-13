from django.utils import timezone

from apps.automations.models import AutomationAction, AutomationRule, AutomationRun
from apps.notifications.models import Notification
from apps.tasks.models import Task


def run_automations_for_event(*, business, trigger_type, entity=None, payload=None):
    payload = payload or {}
    runs = []
    rules = (
        AutomationRule.objects.prefetch_related("conditions", "actions")
        .filter(business=business, trigger_type=trigger_type, is_active=True)
        .order_by("priority", "name")
    )
    for rule in rules:
        run = AutomationRun.objects.create(
            business=business,
            rule=rule,
            trigger_type=trigger_type,
            entity_type=entity.__class__.__name__ if entity else "",
            entity_id=str(getattr(entity, "id", "")) if entity else "",
            payload=payload,
            status=AutomationRun.Statuses.RUNNING,
            started_at=timezone.now(),
        )
        try:
            if not _conditions_match(rule, entity=entity, payload=payload):
                run.status = AutomationRun.Statuses.SKIPPED
            else:
                for action in rule.actions.all():
                    _execute_action(action, business=business, entity=entity, payload=payload)
                run.status = AutomationRun.Statuses.SUCCESS
        except Exception as exc:
            run.status = AutomationRun.Statuses.FAILED
            run.error = str(exc)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error", "finished_at"])
        runs.append(run)
    return runs


def _conditions_match(rule, *, entity, payload):
    for condition in rule.conditions.all():
        actual = _resolve_value(condition.field, entity=entity, payload=payload)
        expected = _expected_value(condition.value)
        if not _compare(actual, condition.operator, expected):
            return False
    return True


def _resolve_value(field, *, entity, payload):
    if field.startswith("payload."):
        value = payload
        for part in field.removeprefix("payload.").split("."):
            value = value.get(part) if isinstance(value, dict) else None
        return value
    value = entity
    for part in field.split("."):
        value = getattr(value, part, None)
        if value is None:
            return None
    return value


def _expected_value(value):
    if isinstance(value, dict) and "value" in value:
        return value["value"]
    return value


def _compare(actual, operator, expected):
    if operator == "eq":
        return actual == expected
    if operator == "contains":
        return str(expected).lower() in str(actual or "").lower()
    if operator == "in":
        return actual in (expected if isinstance(expected, list) else [expected])
    if operator in {"gt", "lt"}:
        try:
            actual_number = float(actual)
            expected_number = float(expected)
        except (TypeError, ValueError):
            return False
        return actual_number > expected_number if operator == "gt" else actual_number < expected_number
    return False


def _execute_action(action, *, business, entity, payload):
    if action.action_type == AutomationAction.ActionTypes.CREATE_TASK:
        return _create_task(action, business=business, entity=entity, payload=payload)
    if action.action_type == AutomationAction.ActionTypes.CREATE_NOTIFICATION:
        return _create_notification(action, business=business, entity=entity, payload=payload)
    return None


def _create_task(action, *, business, entity, payload):
    config = action.config or {}
    return Task.objects.create(
        business=business,
        title=config.get("title") or f"Automation task: {payload.get('trigger_type', action.rule.trigger_type)}",
        description=config.get("description", ""),
        client=_entity_attr(entity, "client"),
        lead=entity if _entity_type(entity, "Lead") else _entity_attr(entity, "lead"),
        assignee=_entity_attr(entity, "responsible_user"),
        priority=config.get("priority", Task.Priorities.NORMAL),
    )


def _create_notification(action, *, business, entity, payload):
    config = action.config or {}
    client = _entity_attr(entity, "client")
    if not client:
        raise ValueError("Notification action requires entity.client.")
    return Notification.objects.create(
        business=business,
        client=client,
        appointment=entity if _entity_type(entity, "Appointment") else _entity_attr(entity, "appointment"),
        channel=config.get("channel", Notification.Channels.SYSTEM),
        text=config.get("text") or f"Automation notification: {payload.get('trigger_type', action.rule.trigger_type)}",
        send_at=timezone.now(),
    )


def _entity_attr(entity, attr):
    return getattr(entity, attr, None) if entity is not None else None


def _entity_type(entity, type_name):
    return entity is not None and entity.__class__.__name__ == type_name
