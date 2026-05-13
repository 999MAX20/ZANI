from django.contrib import admin

from apps.analytics.models import AnalyticsEvent


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ("business", "client", "event_type", "source", "created_at")
    list_filter = ("event_type", "source", "business")
    search_fields = ("business__name", "client__full_name", "source")
