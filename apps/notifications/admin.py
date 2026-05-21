from django.contrib import admin

from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("business", "client", "category", "priority", "channel", "status", "read_at", "send_at", "updated_at")
    list_filter = ("category", "priority", "channel", "status", "business", "read_at", "send_at")
    search_fields = ("client__full_name", "client__phone", "text", "business__name")
