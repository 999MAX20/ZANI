from django.contrib import admin

from apps.leads.models import Lead


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("id", "business", "client", "service", "source", "status", "responsible_user", "created_at")
    list_filter = ("status", "source", "business")
    search_fields = ("client__full_name", "client__phone", "message", "business__name")
