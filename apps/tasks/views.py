from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.viewsets import TenantModelViewSet
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer


class TaskViewSet(TenantModelViewSet):
    queryset = Task.objects.select_related("business", "client", "lead", "deal", "appointment", "assignee", "created_by")
    serializer_class = TaskSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        priority_filter = self.request.query_params.get("priority")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        return queryset

    def perform_create(self, serializer):
        serializer.validated_data.setdefault("created_by", self.request.user)
        super().perform_create(serializer)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.status = Task.Statuses.DONE
        task.completed_at = timezone.now()
        task.save(update_fields=["status", "completed_at", "updated_at"])
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        task = self.get_object()
        task.status = Task.Statuses.IN_PROGRESS
        task.save(update_fields=["status", "updated_at"])
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        task = self.get_object()
        task.status = Task.Statuses.CANCELLED
        task.save(update_fields=["status", "updated_at"])
        return Response(TaskSerializer(task).data)
