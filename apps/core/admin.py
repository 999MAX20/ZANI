from django.contrib import admin

from apps.core.models import AuditLog, SupportAccessGrant


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "business", "actor", "action", "entity_type", "entity_id")
    list_filter = ("action", "entity_type", "business")
    search_fields = ("business__name", "actor__email", "entity_type", "entity_id")
    readonly_fields = ("created_at",)


@admin.register(SupportAccessGrant)
class SupportAccessGrantAdmin(admin.ModelAdmin):
    list_display = ("business", "user", "is_active", "expires_at", "created_at", "created_by")
    list_filter = ("is_active", "business")
    search_fields = ("business__name", "user__email", "reason")
