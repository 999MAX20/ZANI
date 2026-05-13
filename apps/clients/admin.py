from django.contrib import admin

from apps.clients.models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "business", "phone", "email", "source", "created_at")
    list_filter = ("source", "business")
    search_fields = ("full_name", "phone", "email", "whatsapp_id", "telegram_id", "instagram_id")
