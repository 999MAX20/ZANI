from django.db.models import Count, Min, Q
from django.utils import timezone

from apps.businesses.models import BusinessMember
from apps.tasks.models import Task


ACTIVE_TASK_STATUSES = [Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS]


def task_workload_payload(*, business, queryset, now=None):
    now = now or timezone.now()
    today = timezone.localdate()
    active_queryset = queryset.filter(status__in=ACTIVE_TASK_STATUSES, is_archived=False)
    overdue_filter = Q(due_at__lt=now) & (Q(snoozed_until__isnull=True) | Q(snoozed_until__lte=now))
    rows = {
        row["assignee_id"]: row
        for row in active_queryset.values("assignee_id", "assignee__full_name", "assignee__email").annotate(
            total=Count("id"),
            open=Count("id", filter=Q(status=Task.Statuses.OPEN)),
            in_progress=Count("id", filter=Q(status=Task.Statuses.IN_PROGRESS)),
            overdue=Count("id", filter=overdue_filter),
            due_today=Count("id", filter=Q(due_at__date=today)),
            no_due=Count("id", filter=Q(due_at__isnull=True)),
            high_priority=Count("id", filter=Q(priority__in=[Task.Priorities.HIGH, Task.Priorities.URGENT])),
            urgent=Count("id", filter=Q(priority=Task.Priorities.URGENT)),
            oldest_due_at=Min("due_at"),
        )
    }

    items = []
    members = BusinessMember.objects.filter(business=business, is_active=True).select_related("user").order_by("user__full_name", "user__email")
    for member in members:
        row = rows.pop(member.user_id, None)
        items.append(_workload_item(row=row, member=member, user_id=member.user_id))

    for assignee_id, row in rows.items():
        items.append(_workload_item(row=row, member=None, user_id=assignee_id))

    items.sort(key=lambda item: (-item["load_score"], -item["overdue"], -item["total"], item["name"] or "zz"))
    totals = {
        "assignees": len(items),
        "active_tasks": sum(item["total"] for item in items),
        "open": sum(item["open"] for item in items),
        "in_progress": sum(item["in_progress"] for item in items),
        "overdue": sum(item["overdue"] for item in items),
        "due_today": sum(item["due_today"] for item in items),
        "unassigned": sum(item["total"] for item in items if item["type"] == "unassigned"),
        "high_priority": sum(item["high_priority"] for item in items),
    }
    return {
        "business": business.id,
        "generated_at": now.isoformat(),
        "totals": totals,
        "items": items,
    }


def _workload_item(*, row, member, user_id):
    row = row or {}
    total = int(row.get("total") or 0)
    open_count = int(row.get("open") or 0)
    in_progress = int(row.get("in_progress") or 0)
    overdue = int(row.get("overdue") or 0)
    due_today = int(row.get("due_today") or 0)
    high_priority = int(row.get("high_priority") or 0)
    load_score = overdue * 3 + due_today * 2 + high_priority + in_progress + open_count
    oldest_due_at = row.get("oldest_due_at")

    if member is not None:
        name = member.user.full_name or member.user.email
        email = member.user.email
        role = member.role
        member_id = member.id
        item_type = "member"
        is_active = member.is_active
    else:
        name = row.get("assignee__full_name") or ""
        email = row.get("assignee__email") or ""
        role = ""
        member_id = None
        item_type = "member" if user_id else "unassigned"
        is_active = False

    return {
        "type": item_type,
        "member_id": member_id,
        "user_id": user_id,
        "name": name,
        "email": email,
        "role": role,
        "is_active": is_active,
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "overdue": overdue,
        "due_today": due_today,
        "no_due": int(row.get("no_due") or 0),
        "high_priority": high_priority,
        "urgent": int(row.get("urgent") or 0),
        "oldest_due_at": oldest_due_at.isoformat() if oldest_due_at else None,
        "load_score": load_score,
        "capacity_status": _capacity_status(total=total, overdue=overdue, load_score=load_score),
    }


def _capacity_status(*, total, overdue, load_score):
    if total == 0:
        return "idle"
    if overdue >= 3 or load_score >= 14:
        return "overloaded"
    if overdue >= 1 or load_score >= 7:
        return "busy"
    return "balanced"
