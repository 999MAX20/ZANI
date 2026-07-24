from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.activities.services import create_activity_event, write_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.businesses.access import Resources
from apps.businesses.assignment_notifications import create_assignment_notifications
from apps.businesses.assignment_policy import assert_assignment_allowed
from apps.businesses.capabilities import assert_resource_enabled
from apps.businesses.models import BusinessMember
from apps.core.audit import write_actor_audit_log, write_audit_log
from apps.core.domain_errors import InvalidTransition
from apps.core.models import AuditLog
from apps.notifications.models import Notification
from apps.notifications.routing import MANAGER_ROLES, filter_notification_recipients, resolve_notification_recipients
from apps.tasks.models import Task


OPEN_STATUSES = {Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS}
TASK_ASSIGNEE_NOTIFICATION_ROLES = {
    BusinessMember.Roles.OWNER,
    BusinessMember.Roles.ADMIN,
    BusinessMember.Roles.MANAGER,
    BusinessMember.Roles.OPERATOR,
    BusinessMember.Roles.MARKETER,
    BusinessMember.Roles.ACCOUNTANT,
    BusinessMember.Roles.SUPPORT,
    BusinessMember.Roles.STAFF,
}
TASK_ACTIVITY_DEFAULTS = {
    ActivityEvents.TASK_STARTED: {"kind": "lifecycle", "lifecycle_action": "task_started"},
    ActivityEvents.TASK_COMPLETED: {"kind": "lifecycle", "lifecycle_action": "task_completed"},
    ActivityEvents.TASK_CANCELLED: {"kind": "lifecycle", "lifecycle_action": "task_cancelled"},
    ActivityEvents.TASK_REOPENED: {"kind": "lifecycle", "lifecycle_action": "task_reopened"},
    ActivityEvents.TASK_SNOOZED: {"kind": "schedule", "lifecycle_action": "task_snoozed"},
    ActivityEvents.TASK_ASSIGNED: {"kind": "assignment", "lifecycle_action": "task_assigned"},
    ActivityEvents.TASK_ASSIGNED_TO_ME: {"kind": "assignment", "lifecycle_action": "task_assigned_to_me"},
    ActivityEvents.TASK_DUE_TODAY: {"kind": "schedule", "lifecycle_action": "task_due_today"},
    ActivityEvents.TASK_DUE_TOMORROW: {"kind": "schedule", "lifecycle_action": "task_due_tomorrow"},
    ActivityEvents.TASK_WATCHER_ADDED: {"kind": "watcher", "lifecycle_action": "task_watcher_added"},
}
TASK_AUDIT_EVENT_TYPES_BY_ACTION = {
    "task_cancelled": ActivityEvents.TASK_CANCELLED,
    "task_cancel_undone": ActivityEvents.TASK_REOPENED,
    "task_assigned": ActivityEvents.TASK_ASSIGNED,
    "task_assigned_to_me": ActivityEvents.TASK_ASSIGNED_TO_ME,
}


def assert_task_status(task: Task, allowed_statuses: set[str], action: str) -> None:
    if task.status not in allowed_statuses:
        raise InvalidTransition(
            errors={"status": f"Cannot {action} a task in its current status."}
        )


def complete_task(*, task: Task, actor, request=None) -> Task:
    assert_task_status(task, OPEN_STATUSES, "complete")
    task.status = Task.Statuses.DONE
    task.completed_at = timezone.now()
    task.completed_by = actor
    task.snoozed_until = None
    task.save(update_fields=["status", "completed_at", "completed_by", "snoozed_until", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_COMPLETED, task, text=f"Задача закрыта: {task.title}")
    create_task_notification(task, f"Задача выполнена: {task.title}")
    return task


def start_task(*, task: Task, actor, request=None) -> Task:
    assert_task_status(task, {Task.Statuses.OPEN}, "start")
    task.status = Task.Statuses.IN_PROGRESS
    task.save(update_fields=["status", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_STARTED, task, text=f"Задача взята в работу: {task.title}")
    create_task_notification(task, f"Задача взята в работу: {task.title}")
    return task


def cancel_task(*, task: Task, actor, reason: str, request=None) -> Task:
    assert_task_status(task, OPEN_STATUSES, "cancel")
    previous_status = task.status
    task.status = Task.Statuses.CANCELLED
    task.cancelled_at = timezone.now()
    task.cancelled_by = actor
    task.cancel_reason = reason
    task.save(update_fields=["status", "cancelled_at", "cancelled_by", "cancel_reason", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_CANCELLED, task, text=f"Задача отменена: {task.title}. Причина: {reason}")
    create_task_notification(task, f"Задача отменена: {task.title}")
    write_task_audit(
        request,
        task,
        {
            "kind": "lifecycle",
            "lifecycle_action": "task_cancelled",
            "from": previous_status,
            "to": task.status,
            "reason": reason,
        },
        actor=actor,
    )
    return task


def reopen_task(*, task: Task, actor, request=None) -> Task:
    assert_task_status(task, {Task.Statuses.DONE, Task.Statuses.CANCELLED}, "reopen")
    task.status = Task.Statuses.OPEN
    task.completed_at = None
    task.completed_by = None
    task.cancelled_at = None
    task.cancelled_by = None
    task.cancel_reason = ""
    task.save(update_fields=["status", "completed_at", "completed_by", "cancelled_at", "cancelled_by", "cancel_reason", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_REOPENED, task, text=f"Задача переоткрыта: {task.title}")
    create_task_notification(task, f"Задача возвращена в работу: {task.title}")
    return task


def undo_cancel_task(*, task: Task, actor, request=None) -> Task:
    if task.status != Task.Statuses.CANCELLED:
        raise InvalidTransition(
            errors={"status": "Only cancelled tasks can be restored from cancellation."}
        )

    previous_cancel_log = (
        AuditLog.objects.filter(
            business=task.business,
            entity_type="Task",
            entity_id=str(task.id),
            metadata__kind="lifecycle",
            metadata__lifecycle_action="task_cancelled",
        )
        .order_by("-created_at")
        .first()
    )
    previous_status = (previous_cancel_log.metadata or {}).get("from") if previous_cancel_log else Task.Statuses.OPEN
    if previous_status not in {Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS, Task.Statuses.DONE}:
        previous_status = Task.Statuses.OPEN

    task.status = previous_status
    task.cancelled_at = None
    task.cancelled_by = None
    task.cancel_reason = ""
    task.save(update_fields=["status", "cancelled_at", "cancelled_by", "cancel_reason", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_REOPENED, task, text=f"Отмена задачи отменена: {task.title}")
    create_task_notification(task, f"Задача восстановлена: {task.title}")
    write_task_audit(
        request,
        task,
        {
            "kind": "lifecycle",
            "lifecycle_action": "task_cancel_undone",
            "from": Task.Statuses.CANCELLED,
            "to": task.status,
            "actor": actor.id if actor else None,
        },
        actor=actor,
    )
    return task


def snooze_task(*, task: Task, snoozed_until, request=None) -> Task:
    assert_task_status(task, OPEN_STATUSES, "snooze")
    task.snoozed_until = snoozed_until
    task.save(update_fields=["snoozed_until", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_SNOOZED, task, text=f"Задача отложена: {task.title}")
    create_task_notification(task, f"Задача отложена: {task.title}")
    return task


def assign_task(*, task: Task, actor, user_id=None, request=None) -> Task:
    assert_task_status(task, OPEN_STATUSES, "assign")
    if not user_id:
        raise ValidationError({"user_id": "This field is required."})
    assignee = resolve_active_business_user(task=task, user_id=user_id or actor.id, field_name="user_id")
    assert_assignment_allowed(
        actor=actor,
        business=task.business,
        target_user=assignee,
        resource=Resources.TASKS,
    )
    previous_assignee_id = task.assignee_id
    previous_assignee = task.assignee
    if previous_assignee_id == assignee.id:
        return task
    task.assignee = assignee
    task.save(update_fields=["assignee", "updated_at"])
    write_task_activity(
        request,
        ActivityEvents.TASK_ASSIGNED,
        task,
        text=f"Задача назначена: {task.title}",
        actor=actor,
        source="automation" if request is None else "api",
    )
    create_task_notification(
        task,
        f"Задача назначена: {task.title}",
        priority=Notification.Priorities.HIGH if task.priority in {Task.Priorities.HIGH, Task.Priorities.URGENT} else Notification.Priorities.NORMAL,
    )
    create_assignment_notifications(
        business=task.business,
        previous_user=previous_assignee,
        new_user=assignee,
        text=f"Task assigned: {task.title}",
        action_url=f"/app/tasks?task={task.id}",
        include_new=False,
    )
    write_task_audit(
        request,
        task,
        {
            "kind": "assignment",
            "lifecycle_action": "task_assigned",
            "from_assignee": previous_assignee_id,
            "to_assignee": assignee.id,
        },
        actor=actor,
    )
    return task


def assign_task_to_me(*, task: Task, actor, request=None) -> Task:
    assert_task_status(task, OPEN_STATUSES, "assign")
    if not task.business.members.filter(user=actor, is_active=True).exists():
        raise ValidationError({"user_id": "Current user must be an active business member."})
    assert_assignment_allowed(
        actor=actor,
        business=task.business,
        target_user=actor,
        resource=Resources.TASKS,
    )
    previous_status = task.status
    previous_assignee_id = task.assignee_id
    task.assignee = actor
    task.status = Task.Statuses.IN_PROGRESS if task.status == Task.Statuses.OPEN else task.status
    task.save(update_fields=["assignee", "status", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_ASSIGNED_TO_ME, task, text=f"Задача взята на себя: {task.title}")
    create_task_notification(task, f"Задача взята на себя: {task.title}")
    write_task_audit(
        request,
        task,
        {
            "kind": "assignment",
            "lifecycle_action": "task_assigned_to_me",
            "from": previous_status,
            "to": task.status,
            "from_assignee": previous_assignee_id,
            "to_assignee": actor.id,
        },
        actor=actor,
    )
    return task


def set_task_due_today(*, task: Task, request=None) -> Task:
    assert_task_status(task, OPEN_STATUSES, "schedule")
    task.due_at = business_local_datetime(task.business, days=0, hour=18)
    task.reminder_at = task.due_at - timezone.timedelta(hours=1)
    task.save(update_fields=["due_at", "reminder_at", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_DUE_TODAY, task, text=f"Задача поставлена на сегодня: {task.title}")
    create_task_notification(task, f"Задача запланирована на сегодня: {task.title}")
    return task


def set_task_due_tomorrow(*, task: Task, request=None) -> Task:
    assert_task_status(task, OPEN_STATUSES, "schedule")
    task.due_at = business_local_datetime(task.business, days=1, hour=10)
    task.reminder_at = task.due_at - timezone.timedelta(hours=1)
    task.save(update_fields=["due_at", "reminder_at", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_DUE_TOMORROW, task, text=f"Задача поставлена на завтра: {task.title}")
    create_task_notification(task, f"Задача запланирована на завтра: {task.title}")
    return task


def add_task_watcher(*, task: Task, actor, user_id=None, request=None) -> Task:
    assert_task_status(task, OPEN_STATUSES, "watch")
    watcher = resolve_active_business_user(task=task, user_id=user_id or actor.id, field_name="user_id", role_name="Watcher")
    task.watchers.add(watcher)
    write_task_activity(request, ActivityEvents.TASK_WATCHER_ADDED, task, text=f"Наблюдатель добавлен к задаче: {task.title}")
    return task


def resolve_active_business_user(*, task: Task, user_id, field_name: str, role_name="Assignee"):
    user = get_user_model().objects.filter(id=user_id).first()
    if user is None:
        raise ValidationError({field_name: "User was not found."})
    if not task.business.members.filter(user=user, is_active=True).exists():
        raise ValidationError({field_name: f"{role_name} must be an active business member."})
    return user


def create_task_notification(task: Task, text: str, *, priority: str | None = None) -> list[Notification]:
    return create_routed_task_notifications(task=task, text=text, priority=priority)


@transaction.atomic
def create_automation_task(
    *,
    business,
    title: str,
    description: str = "",
    priority: str = Task.Priorities.NORMAL,
    entity=None,
    actor=None,
    assignee=None,
    due_at=None,
    source_payload=None,
    source: str = "automation",
    activity_text: str | None = None,
    notification_text: str | None = None,
    notification_priority: str | None = None,
    client=None,
    lead=None,
    deal=None,
    appointment=None,
    conversation=None,
) -> Task:
    assert_resource_enabled(business, Resources.TASKS)
    title = (title or "").strip()
    if not title:
        raise ValidationError({"title": "This field is required."})
    if priority not in Task.Priorities.values:
        raise ValidationError({"priority": "Invalid priority."})
    if entity is not None and getattr(entity, "business_id", business.id) != business.id:
        raise ValidationError({"entity": "Task entity must belong to the selected business."})
    for field_name, related in {
        "client": client,
        "lead": lead,
        "deal": deal,
        "appointment": appointment,
        "conversation": conversation,
    }.items():
        if related is not None and getattr(related, "business_id", business.id) != business.id:
            raise ValidationError({field_name: f"Task {field_name} must belong to the selected business."})

    assignee = assignee or _entity_preferred_user(entity) or actor
    if assignee and not _is_active_business_user(business, assignee):
        assignee = None

    task = Task.objects.create(
        business=business,
        title=title,
        description=description or "",
        client=client or _linked_client(entity),
        lead=lead or (entity if _entity_type(entity, "Lead") else _entity_attr(entity, "lead")),
        deal=deal or (entity if _entity_type(entity, "Deal") else _entity_attr(entity, "deal")),
        appointment=appointment or (entity if _entity_type(entity, "Appointment") else _entity_attr(entity, "appointment")),
        conversation=conversation or (entity if _entity_type(entity, "BotConversation") else _entity_attr(entity, "conversation")),
        assignee=assignee,
        created_by=actor if actor and _is_active_business_user(business, actor) else None,
        due_at=due_at,
        priority=priority,
    )
    create_activity_event(
        business=business,
        client=task.client,
        actor=actor,
        event_type=ActivityEvents.TASK_CREATED,
        instance=task,
        category="task",
        source=source,
        text=activity_text or f"Automation created task: {task.title}",
        metadata={
            "event_type": ActivityEvents.TASK_CREATED,
            "source": source,
            "task_id": task.id,
            "conversation_id": task.conversation_id,
            "client_id": task.client_id,
            "lead_id": task.lead_id,
            "deal_id": task.deal_id,
            "appointment_id": task.appointment_id,
            "source_entity_type": entity.__class__.__name__ if entity is not None else "",
            "source_entity_id": str(getattr(entity, "pk", "") or ""),
            "trigger_type": (source_payload or {}).get("trigger_type", ""),
        },
    )
    write_actor_audit_log(
        actor=actor,
        action=AuditLog.Actions.CREATE,
        instance=task,
        metadata={
            "kind": "task_created",
            "event_type": ActivityEvents.TASK_CREATED,
            "source": source,
            "source_entity_type": entity.__class__.__name__ if entity is not None else "",
            "source_entity_id": str(getattr(entity, "pk", "") or ""),
            "trigger_type": (source_payload or {}).get("trigger_type", ""),
        },
    )
    create_task_notification(task, notification_text or f"Automation created task: {task.title}", priority=notification_priority)
    return task


def create_routed_task_notifications(*, task: Task, text: str, priority: str | None = None) -> list[Notification]:
    priority = priority or Notification.Priorities.NORMAL
    recipients = resolve_task_notification_recipients(task=task, priority=priority)
    notifications = [
        Notification(
            business=task.business,
            recipient=recipient,
            client=task.client,
            appointment=task.appointment,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.TASKS,
            priority=priority,
            text=text,
            send_at=timezone.now(),
            action_url=f"/app/tasks?task={task.id}",
            action_label="Открыть задачу",
        )
        for recipient in recipients
    ]
    return Notification.objects.bulk_create(notifications)


def resolve_task_notification_recipients(*, task: Task, priority: str) -> list:
    recipients = []
    if task.assignee_id:
        recipients = resolve_notification_recipients(
            business=task.business,
            preferred_user=task.assignee,
            roles=TASK_ASSIGNEE_NOTIFICATION_ROLES,
            exclude_owner=False,
            fallback_to_owner=False,
        )
    if not recipients:
        recipients = resolve_notification_recipients(
            business=task.business,
            roles=MANAGER_ROLES,
            exclude_owner=True,
            fallback_to_owner=True,
        )
    return filter_notification_recipients(
        business=task.business,
        users=recipients,
        category=Notification.Categories.TASKS,
        priority=priority,
    )


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


def _entity_attr(entity, attr):
    return getattr(entity, attr, None) if entity is not None else None


def _entity_type(entity, type_name):
    return entity is not None and entity.__class__.__name__ == type_name


def _is_active_business_user(business, user):
    if not user:
        return False
    if business.owner_id == user.id:
        return True
    return business.members.filter(user=user, is_active=True).exists()


def write_task_activity(
    request,
    event_type,
    task: Task,
    *,
    text: str,
    metadata: dict | None = None,
    actor=None,
    source="api",
) -> None:
    payload = {"event_type": event_type}
    payload.update(TASK_ACTIVITY_DEFAULTS.get(event_type, {}))
    payload.update(metadata or {})
    if request is not None:
        write_activity_event(request, event_type, task, text=text, metadata=payload)
        return
    create_activity_event(
        business=task.business,
        client=task.client,
        actor=actor,
        event_type=event_type,
        instance=task,
        source=source,
        text=text,
        metadata=payload,
    )


def write_task_audit(request, task: Task, metadata: dict, *, actor=None) -> None:
    payload = dict(metadata)
    lifecycle_action = payload.get("lifecycle_action")
    if lifecycle_action and "event_type" not in payload:
        payload["event_type"] = TASK_AUDIT_EVENT_TYPES_BY_ACTION.get(lifecycle_action, lifecycle_action)
    if request is not None:
        write_audit_log(request, AuditLog.Actions.UPDATE, task, metadata=payload)
        return
    write_actor_audit_log(
        actor=actor,
        action=AuditLog.Actions.UPDATE,
        instance=task,
        metadata=payload,
    )


def business_local_datetime(business, *, days: int, hour: int, minute: int = 0):
    now = timezone.localtime(timezone.now(), timezone=timezone.get_current_timezone())
    try:
        from zoneinfo import ZoneInfo

        now = timezone.localtime(timezone.now(), timezone=ZoneInfo(business.timezone or "Asia/Almaty"))
    except Exception:
        pass
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0) + timezone.timedelta(days=days)
    if target <= now:
        target = now + timezone.timedelta(hours=1)
    return target
