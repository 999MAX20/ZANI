from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.activities.services import write_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.businesses.access import Actions, Resources, assert_can
from apps.core.viewsets import TenantModelViewSet
from apps.core.work_queues import overdue_tasks_queryset
from apps.tasks.models import Task, TaskComment
from apps.tasks.serializers import TaskCommentSerializer, TaskSerializer, TaskSnoozeSerializer
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
        queryset = super().get_queryset().annotate(comments_count=Count("comments", distinct=True), watchers_count=Count("watchers", distinct=True))
        client_ids = self.parse_query_id_list("client_ids")
        if client_ids:
            queryset = queryset.filter(client_id__in=client_ids)
        status_filter = self.request.query_params.get("status")
        priority_filter = self.request.query_params.get("priority")
        tab = self.request.query_params.get("tab")
        if status_filter == "active":
            queryset = queryset.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        elif status_filter:
            queryset = queryset.filter(status=status_filter)
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        if tab == "my":
            queryset = queryset.filter(Q(assignee=self.request.user) | Q(watchers=self.request.user)).distinct()
        elif tab == "today":
            today = timezone.localdate()
            queryset = queryset.filter(due_at__date=today).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        elif tab == "overdue":
            queryset = overdue_tasks_queryset(queryset=queryset)
        return queryset

    def perform_create(self, serializer):
        serializer.validated_data.setdefault("created_by", self.request.user)
        super().perform_create(serializer)

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
        task = cancel_task(task=task, actor=request.user, request=request)
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
