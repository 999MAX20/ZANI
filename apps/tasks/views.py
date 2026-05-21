from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.activities.services import write_activity_event
from apps.businesses.access import Actions, Resources, assert_can
from apps.core.viewsets import TenantModelViewSet
from apps.tasks.models import Task, TaskComment
from apps.tasks.serializers import TaskCommentSerializer, TaskSerializer


class TaskViewSet(TenantModelViewSet):
    queryset = Task.objects.select_related(
        "business",
        "client",
        "lead",
        "deal",
        "appointment",
        "parent_task",
        "assignee",
        "created_by",
        "completed_by",
    ).prefetch_related("watchers")
    serializer_class = TaskSerializer

    def get_queryset(self):
        queryset = super().get_queryset().annotate(comments_count=Count("comments", distinct=True), watchers_count=Count("watchers", distinct=True))
        status_filter = self.request.query_params.get("status")
        priority_filter = self.request.query_params.get("priority")
        tab = self.request.query_params.get("tab")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        if tab == "my":
            queryset = queryset.filter(Q(assignee=self.request.user) | Q(watchers=self.request.user)).distinct()
        elif tab == "today":
            today = timezone.localdate()
            queryset = queryset.filter(due_at__date=today).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        elif tab == "overdue":
            queryset = queryset.filter(due_at__lt=timezone.now()).exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        return queryset

    def perform_create(self, serializer):
        serializer.validated_data.setdefault("created_by", self.request.user)
        super().perform_create(serializer)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task.status = Task.Statuses.DONE
        task.completed_at = timezone.now()
        task.completed_by = request.user
        task.snoozed_until = None
        task.save(update_fields=["status", "completed_at", "completed_by", "snoozed_until", "updated_at"])
        write_activity_event(request, "task_completed", task, text=f"Задача закрыта: {task.title}")
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task.status = Task.Statuses.IN_PROGRESS
        task.save(update_fields=["status", "updated_at"])
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task.status = Task.Statuses.CANCELLED
        task.save(update_fields=["status", "updated_at"])
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        task.status = Task.Statuses.OPEN
        task.completed_at = None
        task.completed_by = None
        task.save(update_fields=["status", "completed_at", "completed_by", "updated_at"])
        write_activity_event(request, "task_reopened", task, text=f"Задача переоткрыта: {task.title}")
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def snooze(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        snoozed_until = request.data.get("snoozed_until")
        if not snoozed_until:
            raise ValidationError({"snoozed_until": "This field is required."})
        serializer = TaskSerializer(task, data={"snoozed_until": snoozed_until}, partial=True)
        serializer.is_valid(raise_exception=True)
        task.snoozed_until = serializer.validated_data["snoozed_until"]
        task.save(update_fields=["snoozed_until", "updated_at"])
        write_activity_event(request, "task_snoozed", task, text=f"Задача отложена: {task.title}")
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        user_id = request.data.get("user_id") or request.user.id
        assignee = get_user_model().objects.filter(id=user_id).first()
        if assignee is None:
            raise ValidationError({"user_id": "User was not found."})
        if not task.business.members.filter(user=assignee, is_active=True).exists():
            raise ValidationError({"user_id": "Assignee must be an active business member."})
        task.assignee = assignee
        task.save(update_fields=["assignee", "updated_at"])
        write_activity_event(request, "task_assigned", task, text=f"Задача назначена: {task.title}")
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="add-watcher")
    def add_watcher(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        user_id = request.data.get("user_id") or request.user.id
        watcher = get_user_model().objects.filter(id=user_id).first()
        if watcher is None:
            raise ValidationError({"user_id": "User was not found."})
        if not task.business.members.filter(user=watcher, is_active=True).exists():
            raise ValidationError({"user_id": "Watcher must be an active business member."})
        task.watchers.add(watcher)
        write_activity_event(request, "task_watcher_added", task, text=f"Наблюдатель добавлен к задаче: {task.title}")
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="add-comment")
    def add_comment(self, request, pk=None):
        task = self.get_object()
        assert_can(request.user, task.business, Resources.TASKS, Actions.UPDATE, obj=task)
        text = (request.data.get("text") or "").strip()
        if not text:
            raise ValidationError({"text": "This field is required."})
        comment = TaskComment.objects.create(task=task, author=request.user, text=text)
        write_activity_event(request, "task_comment_added", task, text=f"Комментарий к задаче: {task.title}")
        return Response(TaskCommentSerializer(comment).data, status=201)

    @action(detail=True, methods=["get"])
    def comments(self, request, pk=None):
        task = self.get_object()
        comments = task.comments.select_related("author")
        return Response(TaskCommentSerializer(comments, many=True).data)
