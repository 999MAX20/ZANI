from django.contrib import admin

from apps.services.models import Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "duration_minutes", "price_from", "is_active")
    list_filter = ("is_active", "business")
    search_fields = ("name", "description", "business__name")
