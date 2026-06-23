from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.activities.services import write_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.notifications.models import Notification
from apps.tasks.models import Task


OPEN_STATUSES = {Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS}


def assert_task_status(task: Task, allowed_statuses: set[str], action: str) -> None:
    if task.status not in allowed_statuses:
        raise ValidationError({"status": f"Cannot {action} task with status '{task.status}'."})


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
        raise ValidationError({"status": "Only cancelled tasks can be restored from cancellation."})

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
    previous_assignee_id = task.assignee_id
    task.assignee = assignee
    task.save(update_fields=["assignee", "updated_at"])
    write_task_activity(request, ActivityEvents.TASK_ASSIGNED, task, text=f"Задача назначена: {task.title}")
    create_task_notification(
        task,
        f"Задача назначена: {task.title}",
        priority=Notification.Priorities.HIGH if task.priority in {Task.Priorities.HIGH, Task.Priorities.URGENT} else Notification.Priorities.NORMAL,
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
    )
    return task


def assign_task_to_me(*, task: Task, actor, request=None) -> Task:
    assert_task_status(task, OPEN_STATUSES, "assign")
    if not task.business.members.filter(user=actor, is_active=True).exists():
        raise ValidationError({"user_id": "Current user must be an active business member."})
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


def create_task_notification(task: Task, text: str, *, priority: str | None = None) -> Notification:
    return Notification.objects.create(
        business=task.business,
        recipient=task.assignee,
        client=task.client,
        appointment=task.appointment,
        channel=Notification.Channels.SYSTEM,
        category=Notification.Categories.TASKS,
        priority=priority or Notification.Priorities.NORMAL,
        text=text,
        send_at=timezone.now(),
        action_url=f"/app/tasks?task={task.id}",
        action_label="Открыть задачу",
    )


def write_task_activity(request, event_type, task: Task, *, text: str) -> None:
    if request is None:
        return
    write_activity_event(request, event_type, task, text=text)


def write_task_audit(request, task: Task, metadata: dict) -> None:
    if request is None:
        return
    write_audit_log(request, AuditLog.Actions.UPDATE, task, metadata=metadata)


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
