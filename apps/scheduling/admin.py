from django.contrib import admin

from apps.scheduling.models import Appointment, Resource, WorkingHours


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "resource_type", "is_active", "created_at")
    list_filter = ("resource_type", "is_active", "business")
    search_fields = ("name", "business__name")


@admin.register(WorkingHours)
class WorkingHoursAdmin(admin.ModelAdmin):
    list_display = ("business", "resource", "weekday", "start_time", "end_time", "is_day_off")
    list_filter = ("weekday", "is_day_off", "business")
    search_fields = ("business__name", "resource__name")


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("id", "business", "client", "service", "resource", "start_at", "end_at", "status", "source")
    list_filter = ("status", "source", "business", "resource")
    search_fields = ("client__full_name", "client__phone", "service__name", "resource__name", "notes")
