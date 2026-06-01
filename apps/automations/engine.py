import hashlib
import json

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.activities.models import ActivityEvent
from apps.activities.services import create_activity_event
from apps.automations.models import AutomationAction, AutomationRule, AutomationRun
from apps.integrations.sanitization import sanitize_error_text
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
        run, created = create_automation_run(
            business=business,
            rule=rule,
            trigger_type=trigger_type,
            entity=entity,
            payload=payload,
        )
        if created:
            schedule_automation_run(run)
        runs.append(run)
    return runs


def create_automation_run(*, business, rule, trigger_type, entity=None, payload=None):
    payload = payload or {}
    entity_type = entity.__class__.__name__ if entity else ""
    entity_id = str(getattr(entity, "id", "")) if entity else ""
    run_after = _run_after_for_rule(rule)
    idempotency_key = automation_idempotency_key(
        rule_id=rule.id,
        trigger_type=trigger_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload,
    )
    try:
        with transaction.atomic():
            return AutomationRun.objects.get_or_create(
                business=business,
                idempotency_key=idempotency_key,
                defaults={
                    "rule": rule,
                    "trigger_type": trigger_type,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "payload": payload,
                    "status": AutomationRun.Statuses.PENDING,
                    "run_after": run_after,
                },
            )
    except IntegrityError:
        return AutomationRun.objects.get(business=business, idempotency_key=idempotency_key), False


def automation_idempotency_key(*, rule_id, trigger_type, entity_type, entity_id, payload):
    serialized_payload = json.dumps(payload or {}, sort_keys=True, default=str)
    raw = f"{rule_id}:{trigger_type}:{entity_type}:{entity_id}:{serialized_payload}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def schedule_automation_run(run):
    from apps.automations.tasks import process_automation_run_task

    run_after = run.run_after or timezone.now()
    inline = getattr(settings, "AUTOMATIONS_RUN_INLINE", True)
    if inline:
        if run_after <= timezone.now():
            process_automation_run(run.id)
        return run
    process_automation_run_task.apply_async(args=[run.id], eta=run_after)
    return run


def process_due_automation_runs(limit=100):
    due_runs = (
        AutomationRun.objects.filter(status=AutomationRun.Statuses.PENDING, run_after__lte=timezone.now())
        .order_by("run_after", "created_at")[:limit]
    )
    return [process_automation_run(run.id) for run in due_runs]


def process_automation_run(run_id):
    run = AutomationRun.objects.select_related("business", "rule").filter(id=run_id).first()
    if run is None:
        return None
    if run.status in {AutomationRun.Statuses.SUCCESS, AutomationRun.Statuses.SKIPPED}:
        return run
    if run.run_after and run.run_after > timezone.now():
        return run

    run.status = AutomationRun.Statuses.RUNNING
    run.started_at = run.started_at or timezone.now()
    run.locked_at = timezone.now()
    run.attempts += 1
    run.error = ""
    run.finished_at = None
    run.save(update_fields=["status", "started_at", "locked_at", "attempts", "error", "finished_at"])

    try:
        rule = run.rule
        if rule is None or not rule.is_active:
            run.status = AutomationRun.Statuses.SKIPPED
            run.action_results = [{"status": "skipped", "reason": "Rule is missing or inactive."}]
        else:
            entity = _resolve_entity(run.entity_type, run.entity_id)
            if not _conditions_match(rule, entity=entity, payload=run.payload):
                run.status = AutomationRun.Statuses.SKIPPED
                run.action_results = [{"status": "skipped", "reason": "Conditions did not match."}]
            else:
                results = []
                for action in rule.actions.all():
                    results.append(_execute_action(action, business=run.business, entity=entity, payload=run.payload))
                run.action_results = results
                run.status = AutomationRun.Statuses.SUCCESS
    except Exception as exc:
        run.status = AutomationRun.Statuses.FAILED
        run.error = sanitize_error_text(exc)
        if run.attempts < run.max_attempts:
            delay_seconds = min(3600, 60 * (2 ** (run.attempts - 1)))
            run.next_retry_at = timezone.now() + timezone.timedelta(seconds=delay_seconds)
    run.finished_at = timezone.now()
    run.locked_at = None
    run.save(update_fields=["status", "error", "action_results", "next_retry_at", "finished_at", "locked_at"])
    _write_run_activity(run)
    return run


def retry_automation_run(run):
    if run.status != AutomationRun.Statuses.FAILED:
        return run
    run.status = AutomationRun.Statuses.PENDING
    run.error = ""
    run.run_after = timezone.now()
    run.next_retry_at = None
    run.finished_at = None
    run.locked_at = None
    run.save(update_fields=["status", "error", "run_after", "next_retry_at", "finished_at", "locked_at"])
    return schedule_automation_run(run)


def _run_after_for_rule(rule):
    delays = [action.delay_seconds for action in rule.actions.all() if action.delay_seconds]
    wait_delays = [action.delay_seconds for action in rule.actions.all() if action.action_type == AutomationAction.ActionTypes.WAIT]
    delay_seconds = max(delays + wait_delays, default=0)
    if not delay_seconds:
        return timezone.now()
    return timezone.now() + timezone.timedelta(seconds=delay_seconds)


def _write_run_activity(run):
    if run.rule is None:
        return
    create_activity_event(
        business=run.business,
        event_type="automation_run",
        instance=run,
        category=ActivityEvent.Categories.AUTOMATION,
        source="automation",
        text=f"Автоматизация «{run.rule.name}»: {run.status}",
        metadata={"trigger_type": run.trigger_type, "entity_type": run.entity_type, "entity_id": run.entity_id, "attempts": run.attempts},
    )


def _resolve_entity(entity_type, entity_id):
    if not entity_type or not entity_id:
        return None
    model_map = {
        "Lead": "apps.leads.models.Lead",
        "Appointment": "apps.scheduling.models.Appointment",
        "BotConversation": "apps.bots.models.BotConversation",
        "Deal": "apps.crm.models.Deal",
        "Task": "apps.tasks.models.Task",
    }
    dotted_path = model_map.get(entity_type)
    if not dotted_path:
        return None
    module_path, class_name = dotted_path.rsplit(".", 1)
    module = __import__(module_path, fromlist=[class_name])
    model = getattr(module, class_name)
    return model.objects.filter(id=entity_id).first()


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
    if action.action_type == AutomationAction.ActionTypes.WAIT:
        return {"action": action.action_type, "status": "delayed", "delay_seconds": action.delay_seconds}
    if action.action_type == AutomationAction.ActionTypes.CREATE_TASK:
        task = _create_task(action, business=business, entity=entity, payload=payload)
        return {"action": action.action_type, "status": "success", "task_id": task.id}
    if action.action_type == AutomationAction.ActionTypes.CREATE_NOTIFICATION:
        notification = _create_notification(action, business=business, entity=entity, payload=payload)
        return {"action": action.action_type, "status": "success", "notification_id": notification.id}
    return {"action": action.action_type, "status": "unsupported"}


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
        recipient=_entity_attr(entity, "responsible_user") or _entity_attr(entity, "owner") or _entity_attr(entity, "assignee"),
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
