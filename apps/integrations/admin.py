from django.contrib import admin

from apps.integrations.models import IntegrationEventLog


@admin.register(IntegrationEventLog)
class IntegrationEventLogAdmin(admin.ModelAdmin):
    list_display = ("business", "provider", "channel", "direction", "status", "created_at")
    list_filter = ("provider", "channel", "direction", "status", "business")
    search_fields = ("business__name", "provider", "channel", "error")
    readonly_fields = ("created_at",)
