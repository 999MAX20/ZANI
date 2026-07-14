from django.contrib import admin

from apps.analytics.models import AnalyticsEvent, ReportWidget, ScheduledReport


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ("business", "client", "event_type", "source", "created_at")
    list_filter = ("event_type", "source", "business")
    search_fields = ("business__name", "client__full_name", "source")


@admin.register(ReportWidget)
class ReportWidgetAdmin(admin.ModelAdmin):
    list_display = ("business", "title", "key", "widget_type", "sort_order", "is_active")
    list_filter = ("widget_type", "is_active", "business")
    search_fields = ("business__name", "title", "key")


@admin.register(ScheduledReport)
class ScheduledReportAdmin(admin.ModelAdmin):
    list_display = ("business", "name", "frequency", "is_active", "next_run_at", "last_run_at")
    list_filter = ("frequency", "is_active", "business")
    search_fields = ("business__name", "name", "recipients_json")
