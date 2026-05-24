from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.businesses.access import Actions, assert_can
from apps.core.viewsets import TenantModelViewSet
from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


class NotificationViewSet(TenantModelViewSet):
    queryset = Notification.objects.select_related("business", "client", "appointment", "recipient")
    serializer_class = NotificationSerializer
    action_permission_map = {
        **TenantModelViewSet.action_permission_map,
        "mark_read": Actions.UPDATE,
        "mark_unread": Actions.UPDATE,
        "mark_all_read": Actions.UPDATE,
        "mark_sent": Actions.MANAGE,
        "cancel": Actions.MANAGE,
        "summary": Actions.VIEW,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        channel_filter = self.request.query_params.get("channel")
        category_filter = self.request.query_params.get("category")
        priority_filter = self.request.query_params.get("priority")
        unread_filter = self.request.query_params.get("unread")
        due_filter = self.request.query_params.get("due")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if channel_filter:
            queryset = queryset.filter(channel=channel_filter)
        if category_filter:
            queryset = queryset.filter(category=category_filter)
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        if unread_filter in {"1", "true", "yes"}:
            queryset = queryset.filter(read_at__isnull=True)
        if unread_filter in {"0", "false", "no"}:
            queryset = queryset.filter(read_at__isnull=False)
        if due_filter in {"1", "true", "yes"}:
            queryset = queryset.filter(status=Notification.Statuses.PENDING, send_at__lte=timezone.now())
        return queryset

    @action(detail=True, methods=["post"], url_path="mark-sent")
    def mark_sent(self, request, pk=None):
        notification = self.get_object()
        assert_can(request.user, notification.business, self.get_access_resource(), Actions.MANAGE, obj=notification)
        notification.status = Notification.Statuses.SENT
        notification.save(update_fields=["status", "updated_at"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        notification = self.get_object()
        assert_can(request.user, notification.business, self.get_access_resource(), Actions.MANAGE, obj=notification)
        notification.status = Notification.Statuses.CANCELLED
        notification.save(update_fields=["status", "updated_at"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        assert_can(request.user, notification.business, self.get_access_resource(), Actions.UPDATE, obj=notification)
        notification.mark_read()
        return Response(NotificationSerializer(notification).data)

    @action(detail=True, methods=["post"], url_path="mark-unread")
    def mark_unread(self, request, pk=None):
        notification = self.get_object()
        assert_can(request.user, notification.business, self.get_access_resource(), Actions.UPDATE, obj=notification)
        notification.mark_unread()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        queryset = self.get_queryset().filter(read_at__isnull=True)
        now = timezone.now()
        updated = queryset.update(read_at=now, updated_at=now)
        return Response({"updated": updated})

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        now = timezone.now()
        unread = queryset.filter(read_at__isnull=True)
        return Response(
            {
                "pending": queryset.filter(status=Notification.Statuses.PENDING).count(),
                "failed": queryset.filter(status=Notification.Statuses.FAILED).count(),
                "due": queryset.filter(status=Notification.Statuses.PENDING, send_at__lte=now).count(),
                "unread": unread.count(),
                "urgent": unread.filter(priority=Notification.Priorities.URGENT).count(),
                "by_category": {
                    category: unread.filter(category=category).count()
                    for category in Notification.Categories.values
                },
            }
        )
