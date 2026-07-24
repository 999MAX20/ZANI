import hashlib
import json

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from apps.activities.models import ActivityEvent
from apps.activities.services import create_activity_event, create_note_for_entity
from apps.activities.taxonomy import ActivityEvents
from apps.automations.models import AutomationAction, AutomationRule, AutomationRun
from apps.businesses.access import Resources
from apps.businesses.capabilities import assert_resource_enabled, is_module_enabled
from apps.core.domain_errors import ModuleDisabled
from apps.core.work_queues import overdue_tasks_queryset
from apps.crm.services import assign_deal_owner
from apps.integrations.sanitization import sanitize_error_text
from apps.leads.services import assign_lead
from apps.notifications.models import Notification
from apps.notifications.routing import create_role_notification
from apps.tasks.models import Task
from apps.tasks.services import assign_task, business_local_datetime, create_automation_task


DEFAULT_RULE_THROTTLE_LIMIT = 20
DEFAULT_RULE_THROTTLE_WINDOW_MINUTES = 10


def run_automations_for_event(*, business, trigger_type, entity=None, payload=None):
    payload = payload or {}
    if not is_module_enabled(business, "automations"):
        return []
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
    existing = AutomationRun.objects.filter(business=business, idempotency_key=idempotency_key).first()
    if existing is not None:
        return existing, False
    throttle = automation_throttle_state(business=business, rule=rule)
    if throttle["throttled"]:
        return _create_skipped_run(
            business=business,
            rule=rule,
            trigger_type=trigger_type,
            entity_type=entity_type,
            entity_id=entity_id,
            idempotency_key=idempotency_key,
            payload=payload,
            reason=(
                f"Rule throttled after {throttle['count']} runs "
                f"in {throttle['window_minutes']} minutes."
            ),
        ), True
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


def _create_skipped_run(*, business, rule, trigger_type, entity_type, entity_id, idempotency_key, payload, reason):
    now = timezone.now()
    try:
        with transaction.atomic():
            return AutomationRun.objects.create(
                business=business,
                rule=rule,
                trigger_type=trigger_type,
                entity_type=entity_type,
                entity_id=entity_id,
                idempotency_key=idempotency_key,
                payload=payload,
                status=AutomationRun.Statuses.SKIPPED,
                action_results=[{"status": "skipped", "reason": reason}],
                error=reason,
                started_at=now,
                finished_at=now,
            )
    except IntegrityError:
        return AutomationRun.objects.get(business=business, idempotency_key=idempotency_key)


def automation_throttle_state(*, business, rule):
    limit = int(getattr(settings, "AUTOMATION_RULE_RUN_LIMIT", DEFAULT_RULE_THROTTLE_LIMIT) or DEFAULT_RULE_THROTTLE_LIMIT)
    window_minutes = int(
        getattr(settings, "AUTOMATION_RULE_RUN_WINDOW_MINUTES", DEFAULT_RULE_THROTTLE_WINDOW_MINUTES)
        or DEFAULT_RULE_THROTTLE_WINDOW_MINUTES
    )
    if limit <= 0 or window_minutes <= 0:
        return {"throttled": False, "count": 0, "limit": limit, "window_minutes": window_minutes}
    window_start = timezone.now() - timezone.timedelta(minutes=window_minutes)
    count = (
        AutomationRun.objects.filter(business=business, rule=rule, created_at__gte=window_start)
        .exclude(status__in=[AutomationRun.Statuses.SKIPPED, AutomationRun.Statuses.CANCELLED])
        .count()
    )
    return {"throttled": count >= limit, "count": count, "limit": limit, "window_minutes": window_minutes}


def automation_idempotency_key(*, rule_id, trigger_type, entity_type, entity_id, payload):
    serialized_payload = json.dumps(payload or {}, sort_keys=True, default=str)
    raw = f"{rule_id}:{trigger_type}:{entity_type}:{entity_id}:{serialized_payload}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def schedule_automation_run(run):
    from apps.automations.tasks import process_automation_run_task

    if run.status != AutomationRun.Statuses.PENDING:
        return run
    run_after = run.run_after or timezone.now()
    inline = getattr(settings, "AUTOMATIONS_RUN_INLINE", True)
    if inline:
        if run_after <= timezone.now():
            process_automation_run(run.id)
        return run
    process_automation_run_task.apply_async(args=[run.id], eta=run_after)
    return run


def process_due_automation_runs(limit=100):
    now = timezone.now()
    recover_stale_automation_runs(now=now)
    due_run_ids = list(
        AutomationRun.objects.filter(
            Q(status__in=[AutomationRun.Statuses.PENDING, AutomationRun.Statuses.WAITING], run_after__lte=now)
            | Q(status=AutomationRun.Statuses.RETRY_SCHEDULED, next_retry_at__lte=now)
        )
        .order_by("run_after", "next_retry_at", "created_at")
        .values_list("id", flat=True)[:limit]
    )
    return [process_automation_run(run_id) for run_id in due_run_ids]


def recover_stale_automation_runs(*, now=None):
    now = now or timezone.now()
    stale_before = now - timezone.timedelta(seconds=getattr(settings, "AUTOMATION_STALE_LOCK_SECONDS", 900))
    return AutomationRun.objects.filter(
        status=AutomationRun.Statuses.RUNNING,
        locked_at__lt=stale_before,
    ).update(
        status=AutomationRun.Statuses.RETRY_SCHEDULED,
        next_retry_at=now,
        run_after=None,
        locked_at=None,
        error="Recovered a stale automation worker claim.",
    )


def _claim_automation_run(run_id, *, now=None):
    now = now or timezone.now()
    claimed = (
        AutomationRun.objects.filter(id=run_id)
        .filter(
            Q(status__in=[AutomationRun.Statuses.PENDING, AutomationRun.Statuses.WAITING], run_after__lte=now)
            | Q(status=AutomationRun.Statuses.RETRY_SCHEDULED, next_retry_at__lte=now)
        )
        .update(
            status=AutomationRun.Statuses.RUNNING,
            started_at=now,
            locked_at=now,
            attempts=F("attempts") + 1,
            error="",
            finished_at=None,
            next_retry_at=None,
        )
    )
    if not claimed:
        return None
    return AutomationRun.objects.select_related("business", "rule").get(id=run_id)


def process_automation_run(run_id):
    run = _claim_automation_run(run_id)
    if run is None:
        return AutomationRun.objects.select_related("business", "rule").filter(id=run_id).first()

    capability_denied = False
    try:
        rule = run.rule
        if rule is None or not rule.is_active:
            run.status = AutomationRun.Statuses.SKIPPED
            run.action_results = [{"status": "skipped", "reason": "Rule is missing or inactive."}]
        else:
            entity = _resolve_entity(run.entity_type, run.entity_id)
            _assert_entity_resource_enabled(run.business, entity)
            if run.current_action_index == 0 and not _conditions_match(rule, entity=entity, payload=run.payload):
                run.status = AutomationRun.Statuses.SKIPPED
                run.action_results = [{"status": "skipped", "reason": "Conditions did not match."}]
            else:
                actions = list(rule.actions.all())
                while run.current_action_index < len(actions):
                    action = actions[run.current_action_index]
                    if action.action_type == AutomationAction.ActionTypes.WAIT:
                        run.action_results = [
                            *(run.action_results or []),
                            {
                                "action_id": action.id,
                                "action_index": run.current_action_index,
                                "action": action.action_type,
                                "status": "delayed",
                                "delay_seconds": action.delay_seconds,
                            },
                        ]
                        run.current_action_index += 1
                        run.status = AutomationRun.Statuses.WAITING
                        run.run_after = timezone.now() + timezone.timedelta(seconds=action.delay_seconds)
                        run.locked_at = None
                        run.save(
                            update_fields=[
                                "action_results", "current_action_index", "status", "run_after", "locked_at"
                            ]
                        )
                        _write_run_activity(run)
                        return run
                    if action.delay_seconds and not _action_delay_scheduled(run, action):
                        run.action_results = [
                            *(run.action_results or []),
                            {
                                "action_id": action.id,
                                "action_index": run.current_action_index,
                                "action": action.action_type,
                                "status": "scheduled",
                                "delay_seconds": action.delay_seconds,
                            },
                        ]
                        run.status = AutomationRun.Statuses.WAITING
                        run.run_after = timezone.now() + timezone.timedelta(seconds=action.delay_seconds)
                        run.locked_at = None
                        run.save(update_fields=["action_results", "status", "run_after", "locked_at"])
                        _write_run_activity(run)
                        return run
                    with transaction.atomic():
                        current = AutomationRun.objects.select_for_update().get(id=run.id)
                        result = _execute_action(action, business=run.business, entity=entity, payload=run.payload)
                        current.action_results = [
                            *(current.action_results or []),
                            {
                                **result,
                                "action_id": action.id,
                                "action_index": current.current_action_index,
                            },
                        ]
                        current.current_action_index += 1
                        current.save(update_fields=["action_results", "current_action_index"])
                        run = current
                run.status = AutomationRun.Statuses.SUCCESS
    except ModuleDisabled as exc:
        capability_denied = True
        run.error = sanitize_error_text(exc)
        run.next_retry_at = None
        run.status = AutomationRun.Statuses.FAILED
    except Exception as exc:
        run.error = sanitize_error_text(exc)
        if run.attempts < run.max_attempts:
            delay_seconds = min(3600, 60 * (2 ** (run.attempts - 1)))
            run.next_retry_at = timezone.now() + timezone.timedelta(seconds=delay_seconds)
            run.status = AutomationRun.Statuses.RETRY_SCHEDULED
        else:
            run.status = AutomationRun.Statuses.FAILED
    run.finished_at = timezone.now() if run.status in {
        AutomationRun.Statuses.SUCCESS,
        AutomationRun.Statuses.FAILED,
        AutomationRun.Statuses.SKIPPED,
    } else None
    run.locked_at = None
    run.run_after = None
    run.save(update_fields=["status", "error", "action_results", "next_retry_at", "finished_at", "locked_at", "run_after"])
    if not capability_denied:
        _write_run_activity(run)
    return run


def _action_delay_scheduled(run, action):
    return any(
        result.get("action_id") == action.id and result.get("status") == "scheduled"
        for result in (run.action_results or [])
    )


def retry_automation_run(run):
    if run.status not in {AutomationRun.Statuses.FAILED, AutomationRun.Statuses.CANCELLED, AutomationRun.Statuses.RETRY_SCHEDULED}:
        return run
    run.status = AutomationRun.Statuses.PENDING
    run.error = ""
    run.run_after = timezone.now()
    run.next_retry_at = None
    run.finished_at = None
    run.locked_at = None
    run.save(update_fields=["status", "error", "run_after", "next_retry_at", "finished_at", "locked_at"])
    return schedule_automation_run(run)


def cancel_automation_run(run):
    if run.status in {AutomationRun.Statuses.SUCCESS, AutomationRun.Statuses.SKIPPED, AutomationRun.Statuses.CANCELLED}:
        return run
    run.status = AutomationRun.Statuses.CANCELLED
    run.error = ""
    run.run_after = None
    run.next_retry_at = None
    run.finished_at = timezone.now()
    run.locked_at = None
    run.action_results = [*(run.action_results or []), {"status": "cancelled", "reason": "Cancelled by user."}]
    run.save(update_fields=["status", "error", "run_after", "next_retry_at", "finished_at", "locked_at", "action_results"])
    _write_run_activity(run)
    return run


def run_task_overdue_automations(*, business=None, now=None, limit=100):
    now = now or timezone.now()
    queryset = Task.objects.select_related("business", "client", "lead", "deal", "appointment", "conversation", "assignee").filter(
        is_archived=False,
        status__in=[Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS],
    )
    if business is not None:
        queryset = queryset.filter(business=business)
    overdue_tasks = overdue_tasks_queryset(queryset=queryset, now=now)[:limit]
    runs = []
    for task in overdue_tasks:
        runs.extend(
            run_automations_for_event(
                business=task.business,
                trigger_type=AutomationRule.TriggerTypes.TASK_OVERDUE,
                entity=task,
                payload={
                    "trigger_type": AutomationRule.TriggerTypes.TASK_OVERDUE,
                    "task_id": task.id,
                    "due_at": task.due_at.isoformat() if task.due_at else "",
                    "status": task.status,
                },
            )
        )
    return runs


def run_conversation_unread_automations(conversation, *, message=None):
    return run_automations_for_event(
        business=conversation.business,
        trigger_type=AutomationRule.TriggerTypes.CONVERSATION_UNREAD,
        entity=conversation,
        payload={
            "trigger_type": AutomationRule.TriggerTypes.CONVERSATION_UNREAD,
            "conversation_id": conversation.id,
            "message_id": getattr(message, "id", None),
            "unread_count": conversation.unread_count,
            "text": getattr(message, "text", ""),
        },
    )


def _run_after_for_rule(rule):
    return timezone.now()


def _write_run_activity(run):
    if run.rule is None:
        return
    create_activity_event(
        business=run.business,
        event_type=ActivityEvents.AUTOMATION_RUN,
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
        "Client": "apps.clients.models.Client",
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


def _assert_entity_resource_enabled(business, entity):
    resource = {
        "Lead": Resources.LEADS,
        "Client": Resources.CLIENTS,
        "Appointment": Resources.APPOINTMENTS,
        "BotConversation": Resources.CONVERSATIONS,
        "Deal": Resources.DEALS,
        "Task": Resources.TASKS,
    }.get(entity.__class__.__name__ if entity else "")
    if resource:
        assert_resource_enabled(business, resource)


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
        assert_resource_enabled(business, Resources.TASKS)
        task = _create_task(action, business=business, entity=entity, payload=payload)
        return {"action": action.action_type, "status": "success", "task_id": task.id}
    if action.action_type == AutomationAction.ActionTypes.CREATE_FOLLOW_UP:
        assert_resource_enabled(business, Resources.TASKS)
        task = _create_follow_up(action, business=business, entity=entity, payload=payload)
        return {"action": action.action_type, "status": "success", "task_id": task.id}
    if action.action_type == AutomationAction.ActionTypes.CREATE_NOTIFICATION:
        notifications = _create_notification(action, business=business, entity=entity, payload=payload)
        return {"action": action.action_type, "status": "success", "notification_ids": [item.id for item in notifications]}
    if action.action_type in {AutomationAction.ActionTypes.ASSIGN_USER, AutomationAction.ActionTypes.ASSIGN_MANAGER}:
        resource = {
            "Lead": Resources.LEADS,
            "Deal": Resources.DEALS,
            "Task": Resources.TASKS,
            "BotConversation": Resources.CONVERSATIONS,
        }.get(entity.__class__.__name__ if entity else "")
        if resource:
            assert_resource_enabled(business, resource)
        target = _assign_user(action, business=business, entity=entity)
        return {"action": action.action_type, "status": "success", "entity_type": target.__class__.__name__, "entity_id": target.id}
    if action.action_type == AutomationAction.ActionTypes.ADD_NOTE:
        note = _add_note(action, business=business, entity=entity)
        return {"action": action.action_type, "status": "success", "note_id": note.id}
    return {"action": action.action_type, "status": "unsupported"}


def _create_task(action, *, business, entity, payload):
    config = action.config or {}
    return create_automation_task(
        business=business,
        title=config.get("title") or f"Automation task: {payload.get('trigger_type', action.rule.trigger_type)}",
        description=config.get("description", ""),
        priority=config.get("priority", Task.Priorities.NORMAL),
        entity=entity,
        actor=_automation_actor(business),
        assignee=_resolve_user(business, config.get("assignee_id") or config.get("user_id")),
        due_at=_parse_due_at(config.get("due_at")),
        source_payload=payload,
    )


def _create_follow_up(action, *, business, entity, payload):
    config = action.config or {}
    due_at = _parse_due_at(config.get("due_at")) or business_local_datetime(
        business,
        days=int(config.get("due_in_days", 1) or 1),
        hour=10,
    )
    return create_automation_task(
        business=business,
        title=config.get("title") or f"Follow up: {payload.get('trigger_type', action.rule.trigger_type)}",
        description=config.get("description", ""),
        priority=config.get("priority", Task.Priorities.NORMAL),
        entity=entity,
        actor=_automation_actor(business),
        assignee=_resolve_user(business, config.get("assignee_id") or config.get("user_id")),
        due_at=due_at,
        source_payload=payload,
    )


def _create_notification(action, *, business, entity, payload):
    config = action.config or {}
    preferred_user = _resolve_user(business, config.get("recipient_id") or config.get("user_id")) or _entity_preferred_user(entity)
    return create_role_notification(
        business=business,
        preferred_user=preferred_user,
        client=_linked_client(entity),
        appointment=entity if _entity_type(entity, "Appointment") else _entity_attr(entity, "appointment"),
        channel=config.get("channel", Notification.Channels.SYSTEM),
        category=config.get("category", Notification.Categories.SALES),
        priority=config.get("priority", Notification.Priorities.NORMAL),
        text=config.get("text") or f"Automation notification: {payload.get('trigger_type', action.rule.trigger_type)}",
        action_url=config.get("action_url") or _entity_action_url(entity),
        action_label=config.get("action_label") or "Open",
        exclude_owner=not bool(config.get("include_owner", False)),
        fallback_to_owner=True,
    )


def _assign_user(action, *, business, entity):
    if entity is None:
        raise ValueError("Assign user action requires an entity.")
    config = action.config or {}
    user_id = config.get("user_id") or config.get("assignee_id") or config.get("owner_id")
    if not user_id:
        raise ValueError("Assign user action requires user_id.")
    actor = _automation_actor(business)
    if _entity_type(entity, "Lead"):
        return assign_lead(lead=entity, actor=actor, user_id=user_id)
    if _entity_type(entity, "Task"):
        return assign_task(task=entity, actor=actor, user_id=user_id)
    if _entity_type(entity, "Deal"):
        return assign_deal_owner(deal=entity, actor=actor, user_id=user_id, source="automation")
    if _entity_type(entity, "BotConversation"):
        from apps.bots.inbox_service import assign_conversation

        user = _resolve_user(business, user_id)
        if user is None:
            raise ValueError("Assigned user must be an active business member.")
        return assign_conversation(entity, user, actor=actor)
    raise ValueError(f"Assign user is not supported for {entity.__class__.__name__}.")


def _add_note(action, *, business, entity):
    config = action.config or {}
    return create_note_for_entity(
        business=business,
        entity=entity,
        text=config.get("text") or "Automation note",
        author=_automation_actor(business),
        source="automation",
    )


def _parse_due_at(value):
    if not value:
        return None
    if hasattr(value, "isoformat"):
        return value
    return parse_datetime(str(value))


def _automation_actor(business):
    return business.owner if getattr(business, "owner_id", None) else None


def _resolve_user(business, user_id):
    if not user_id:
        return None
    if business.owner_id and str(user_id) == str(business.owner_id):
        return business.owner
    membership = business.members.select_related("user").filter(user_id=user_id, is_active=True).first()
    return membership.user if membership else None


def _linked_client(entity):
    if entity is None:
        return None
    if _entity_type(entity, "Client"):
        return entity
    client = _entity_attr(entity, "client")
    if client is None and _entity_attr(entity, "lead") is not None:
        client = entity.lead.client
    return client


def _entity_preferred_user(entity):
    for field in ["responsible_user", "assigned_to", "owner", "assignee"]:
        user = _entity_attr(entity, field)
        if user is not None:
            return user
    return None


def _entity_action_url(entity):
    if entity is None:
        return ""
    if _entity_type(entity, "Lead"):
        return f"/app/leads?lead={entity.id}"
    if _entity_type(entity, "Deal"):
        return f"/app/deals?deal={entity.id}"
    if _entity_type(entity, "Appointment"):
        return f"/app/calendar?appointment={entity.id}"
    if _entity_type(entity, "Task"):
        return f"/app/tasks?task={entity.id}"
    if _entity_type(entity, "BotConversation"):
        return f"/app/conversations?conversation={entity.id}"
    return ""


def _entity_attr(entity, attr):
    return getattr(entity, attr, None) if entity is not None else None


def _entity_type(entity, type_name):
    return entity is not None and entity.__class__.__name__ == type_name
