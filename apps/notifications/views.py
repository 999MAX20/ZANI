from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.viewsets import TenantModelViewSet
from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


class NotificationViewSet(TenantModelViewSet):
    queryset = Notification.objects.select_related("business", "client", "appointment")
    serializer_class = NotificationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        channel_filter = self.request.query_params.get("channel")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if channel_filter:
            queryset = queryset.filter(channel=channel_filter)
        return queryset

    @action(detail=True, methods=["post"], url_path="mark-sent")
    def mark_sent(self, request, pk=None):
        notification = self.get_object()
        notification.status = Notification.Statuses.SENT
        notification.save(update_fields=["status", "updated_at"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        notification = self.get_object()
        notification.status = Notification.Statuses.CANCELLED
        notification.save(update_fields=["status", "updated_at"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        now = timezone.now()
        return Response(
            {
                "pending": queryset.filter(status=Notification.Statuses.PENDING).count(),
                "failed": queryset.filter(status=Notification.Statuses.FAILED).count(),
                "due": queryset.filter(status=Notification.Statuses.PENDING, send_at__lte=now).count(),
            }
        )
