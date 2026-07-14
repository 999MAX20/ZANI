from django.utils import timezone

from apps.tasks.models import Task


TASK_ESCALATION_ESCALATE_MINUTES = 60
TASK_ESCALATION_CRITICAL_MINUTES = 24 * 60


def task_overdue_escalation(task: Task, *, now=None) -> dict:
    now = now or timezone.now()
    if not task.due_at or task.due_at >= now:
        return {
            "overdue_minutes": 0,
            "escalation_level": "none",
            "escalation_reason": "not_overdue",
        }

    overdue_seconds = max(0, (now - task.due_at).total_seconds())
    overdue_minutes = max(1, int(overdue_seconds // 60))

    if overdue_minutes >= TASK_ESCALATION_CRITICAL_MINUTES:
        level = "critical"
        reason = "overdue_24h"
    elif task.priority == Task.Priorities.URGENT:
        level = "critical"
        reason = "urgent_overdue"
    elif task.priority == Task.Priorities.HIGH:
        level = "escalate"
        reason = "high_priority_overdue"
    elif overdue_minutes >= TASK_ESCALATION_ESCALATE_MINUTES:
        level = "escalate"
        reason = "overdue_1h"
    else:
        level = "watch"
        reason = "recently_overdue"

    return {
        "overdue_minutes": overdue_minutes,
        "escalation_level": level,
        "escalation_reason": reason,
    }
