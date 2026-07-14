from django.contrib import admin

from apps.tasks.models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "business", "client", "lead", "appointment", "assignee", "priority", "status", "due_at", "updated_at")
    list_filter = ("priority", "status", "due_at")
    search_fields = ("title", "description", "client__full_name", "lead__message", "business__name")
