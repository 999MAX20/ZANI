from django.db import transaction
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.activities.services import write_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.businesses.access import Actions, Resources, assert_can
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.core.viewsets import TenantModelViewSet
from apps.core.work_queues import overdue_tasks_queryset
from apps.tasks.models import Task, TaskComment
from apps.tasks.serializers import TaskCancelSerializer, TaskCommentSerializer, TaskDetailsUpdateSerializer, TaskSerializer, TaskSnoozeSerializer
from apps.tasks.services import (
    add_task_watcher,
    assign_task,
    assign_task_to_me,
    cancel_task,
    complete_task,
    reopen_task,
    set_task_due_today,
    set_task_due_tomorrow,
    snooze_task,
    start_task,
    undo_cancel_task,
)


class TaskViewSet(TenantModelViewSet):
    queryset = Task.objects.select_related(
        "business",
        "client",
        "lead",
        "lead__client",
        "deal",
        "appointment",
        "appointment__service",
        "parent_task",
        "assignee",
        "created_by",
        "completed_by",
    ).prefetch_related("watchers")
    serializer_class = TaskSerializer

    def get_queryset(self):
        return self._apply_ordering(self._build_queryset(apply_bucket=True))

    def _build_queryset(self, apply_bucket=False):
        queryset = super().get_queryset().annotate(
            comments_count=Count("comments", distinct=True),
            watchers_count=Count("watchers", distinct=True),
            priority_rank=Case(
                When(priority=Task.Priorities.URGENT, then=Value(0)),
                When(priority=Task.Priorities.HIGH, then=Value(1)),
                When(priority=Task.Priorities.NORMAL, then=Value(2)),
                When(priority=Task.Priorities.LOW, then=Value(3)),
                default=Value(4),
                output_field=IntegerField(),
            ),
            due_missing=Case(
                When(due_at__isnull=True, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            ),
        )
        client_ids = self.parse_query_id_list("client_ids")
        if client_ids:
            queryset = queryset.filter(client_id__in=client_ids)
        status_filter = self.request.query_params.get("status")
        priority_filter = self.request.query_params.get("priority")
        assignee_filter = self.request.query_params.get("assignee")
        search = (self.request.query_params.get("search") or "").strip()
        due_filter = self.request.query_params.get("due")
        relation_filter = self.request.query_params.get("relation")
        due_from = self.request.query_params.get("due_from")
        due_to = self.request.query_params.get("due_to")
        tab = self.request.query_params.get("tab")
        bucket = self.request.query_params.get("bucket")
        if status_filter == "active":
            queryset = queryset.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        elif status_filter:
            queryset = queryset.filter(status=status_filter)
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        if assignee_filter == "unassigned":
            queryset = queryset.filter(assignee__isnull=True)
        elif assignee_filter:
            queryset = queryset.filter(assignee_id=assignee_filter)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(client__full_name__icontains=search)
                | Q(deal__title__icontains=search)
                | Q(assignee__full_name__icontains=search)
                | Q(assignee__email__icontains=search)
            )
        if due_filter:
            today = timezone.localdate()
            now = timezone.now()
            if due_filter == "past":
                queryset = queryset.filter(due_at__lt=now).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
            elif due_filter == "today":
                queryset = queryset.filter(due_at__date=today)
            elif due_filter == "none":
                queryset = queryset.filter(due_at__isnull=True)
            elif due_filter == "future":
                queryset = queryset.filter(due_at__date__gt=today)
            else:
                raise ValidationError({"due": "Invalid due filter."})
        if relation_filter:
            relation_filters = {
                "client": Q(client__isnull=False),
                "lead": Q(lead__isnull=False),
                "deal": Q(deal__isnull=False),
                "appointment": Q(appointment__isnull=False),
                "none": Q(client__isnull=True, lead__isnull=True, deal__isnull=True, appointment__isnull=True),
            }
            if relation_filter not in relation_filters:
                raise ValidationError({"relation": "Invalid relation filter."})
            queryset = queryset.filter(relation_filters[relation_filter])
        if due_from:
            parsed_due_from = parse_datetime(due_from)
            if not parsed_due_from:
                raise ValidationError({"due_from": "Invalid datetime."})
            queryset = queryset.filter(due_at__gte=parsed_due_from)
        if due_to:
            parsed_due_to = parse_datetime(due_to)
            if not parsed_due_to:
                raise ValidationError({"due_to": "Invalid datetime."})
            queryset = queryset.filter(due_at__lte=parsed_due_to)
        if tab == "my":
            queryset = queryset.filter(Q(created_by=self.request.user) | Q(assignee=self.request.user) | Q(watchers=self.request.user)).distinct()
        elif tab == "today":
            today = timezone.localdate()
            queryset = queryset.filter(due_at__date=today).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        elif tab == "overdue":
            queryset = overdue_tasks_queryset(queryset=queryset)
        if apply_bucket and bucket:
            queryset = self._apply_bucket_filter(queryset, bucket)
        return queryset

    def _active_queryset(self, queryset):
        return queryset.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])

    def _apply_bucket_filter(self, queryset, bucket):
        now = timezone.now()
        today = timezone.localdate()
        active_queryset = self._active_queryset(queryset)
        bucket_filters = {
            "overdue": lambda qs: active_queryset.filter(due_at__lt=now),
            "today": lambda qs: active_queryset.filter(due_at__date=today),
            "later": lambda qs: active_queryset.filter(due_at__date__gt=today),
            "noDue": lambda qs: active_queryset.filter(due_at__isnull=True),
            "unassigned": lambda qs: active_queryset.filter(assignee__isnull=True),
            "inProgress": lambda qs: queryset.filter(status=Task.Statuses.IN_PROGRESS),
            "open": lambda qs: queryset.filter(status=Task.Statuses.OPEN),
            "closed": lambda qs: queryset.filter(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED]),
        }
        if bucket not in bucket_filters:
            raise ValidationError({"bucket": "Invalid bucket."})
        return bucket_filters[bucket](queryset)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self._build_queryset(apply_bucket=False)
        return Response(
            {
                "overdue": self._apply_bucket_filter(queryset, "overdue").count(),
                "today": self._apply_bucket_filter(queryset, "today").count(),
                "later": self._apply_bucket_filter(queryset, "later").count(),
                "noDue": self._apply_bucket_filter(queryset, "noDue").count(),
                "unassigned": self._apply_bucket_filter(queryset, "unassigned").count(),
                "inProgress": self._apply_bucket_filter(queryset, "inProgress").count(),
                "open": self._apply_bucket_filter(queryset, "open").count(),
                "closed": self._apply_bucket_filter(queryset, "closed").count(),
            }
        )

    def _apply_ordering(self, queryset):
        ordering = self.request.query_params.get("ordering") or "smart"
        ordering_map = {
            "smart": ("priority_rank", "due_missing", "due_at", "-updated_at", "-created_at"),
            "priority": ("priority_rank", "due_missing", "due_at", "-updated_at", "-created_at"),
            "-priority": ("-priority_rank", "due_missing", "due_at", "-updated_at", "-created_at"),
            "due_at": ("due_missing", "due_at", "priority_rank", "-updated_at", "-created_at"),
            "-due_at": ("-due_missing", "-due_at", "priority_rank", "-updated_at", "-created_at"),
            "updated_at": ("updated_at",),
            "-updated_at": ("-updated_at",),
            "created_at": ("created_at",),
            "-created_at": ("-created_at",),
        }
        if ordering not in ordering_map:
            raise ValidationError({"ordering": "Invalid ordering."})
        return queryset.order_by(*ordering_map[ordering])

    def perform_create(self, serializer):
        serializer.validated_data.setdefault("created_by", self.request.user)
        super().perform_create(serializer)

    @action(detail=True, methods=["patch"], url_path="update-details")
    def update_details(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        if task.status not in {Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS}:
            raise ValidationError({"status": f"Cannot update task details with status '{task.status}'."})
        serializer = TaskDetailsUpdateSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            changed_fields = self._task_details_changes(task, serializer.validated_data)
            task = serializer.save()
            if changed_fields:
                write_audit_log(
                    request,
                    AuditLog.Actions.UPDATE,
                    task,
                    metadata={
                        "kind": "task_details_update",
                        "fields": changed_fields,
                    },
                )
                write_activity_event(
                    request,
                    ActivityEvents.TASK_UPDATED,
                    task,
                    text=f"Задача обновлена: {task.title}",
                    metadata={
                        "kind": "task_details_update",
                        "fields": changed_fields,
                    },
                )
        return Response(TaskSerializer(task).data)

    def _task_details_changes(self, task, validated_data):
        related_fields = {"client", "lead", "deal", "appointment", "parent_task", "assignee"}
        changes = {}
        for field, value in validated_data.items():
            if field in related_fields:
                previous_value = getattr(task, f"{field}_id")
                next_value = getattr(value, "id", None)
            else:
                previous_value = getattr(task, field)
                next_value = value
            if previous_value != next_value:
                changes[field] = {
                    "from": self._audit_value(previous_value),
                    "to": self._audit_value(next_value),
                }
        return changes

    def _audit_value(self, value):
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return value

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task = complete_task(task=task, actor=request.user, request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task = start_task(task=task, actor=request.user, request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        serializer = TaskCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = cancel_task(task=task, actor=request.user, reason=serializer.validated_data["reason"], request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="undo-cancel")
    def undo_cancel(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task = undo_cancel_task(task=task, actor=request.user, request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task = reopen_task(task=task, actor=request.user, request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def snooze(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        snoozed_until = request.data.get("snoozed_until")
        if not snoozed_until:
            raise ValidationError({"snoozed_until": "This field is required."})
        serializer = TaskSnoozeSerializer(data={"snoozed_until": snoozed_until})
        serializer.is_valid(raise_exception=True)
        task = snooze_task(task=task, snoozed_until=serializer.validated_data["snoozed_until"], request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task = assign_task(task=task, actor=request.user, user_id=request.data.get("user_id"), request=request)
        return Response(TaskSerializer(task).data)


    @action(detail=True, methods=["post"], url_path="assign-to-me")
    def assign_to_me(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task = assign_task_to_me(task=task, actor=request.user, request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="due-today")
    def due_today(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task = set_task_due_today(task=task, request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="due-tomorrow")
    def due_tomorrow(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task = set_task_due_tomorrow(task=task, request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="add-watcher")
    def add_watcher(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task = add_task_watcher(task=task, actor=request.user, user_id=request.data.get("user_id"), request=request)
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="add-comment")
    def add_comment(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        text = (request.data.get("text") or "").strip()
        if not text:
            raise ValidationError({"text": "This field is required."})
        comment = TaskComment.objects.create(task=task, author=request.user, text=text)
        write_activity_event(request, ActivityEvents.TASK_COMMENT_ADDED, task, text=f"Комментарий к задаче: {task.title}")
        return Response(TaskCommentSerializer(comment).data, status=201)

    @action(detail=True, methods=["get"])
    def comments(self, request, pk=None):
        task = self.get_object()
        comments = task.comments.select_related("author")
        return Response(TaskCommentSerializer(comments, many=True).data)

    @action(detail=True, methods=["delete"], url_path=r"comments/(?P<comment_id>[^/.]+)")
    def delete_comment(self, request, pk=None, comment_id=None):
        task = self.get_object()
        comment = task.comments.select_related("author").filter(id=comment_id).first()
        if comment is None:
            raise ValidationError({"comment": "Comment was not found for this task."})
        if comment.author_id != request.user.id:
            assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        deleted_comment_id = comment.id
        comment.delete()
        write_activity_event(
            request,
            ActivityEvents.TASK_COMMENT_DELETED,
            task,
            text=f"Комментарий удалён из задачи: {task.title}",
            metadata={
                "kind": "task_comment_deleted",
                "comment_id": deleted_comment_id,
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
