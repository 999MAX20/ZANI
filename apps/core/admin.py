from django.contrib import admin

from apps.core.models import AuditLog, CustomFieldDefinition, CustomFieldValue, FileAttachment, ImportJob, LoginHistory, SupportAccessGrant


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "business", "actor", "action", "category", "risk_level", "entity_type", "entity_id")
    list_filter = ("action", "category", "risk_level", "entity_type", "business")
    search_fields = ("business__name", "actor__email", "entity_type", "entity_id")
    readonly_fields = ("created_at",)


@admin.register(SupportAccessGrant)
class SupportAccessGrantAdmin(admin.ModelAdmin):
    list_display = ("business", "user", "is_active", "expires_at", "created_at", "created_by")
    list_filter = ("is_active", "business")
    search_fields = ("business__name", "user__email", "reason")


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = ("created_at", "business", "user", "email", "status", "ip_address")
    list_filter = ("status", "business", "created_at")
    search_fields = ("email", "user__email", "business__name", "ip_address")
    readonly_fields = ("created_at",)


@admin.register(CustomFieldDefinition)
class CustomFieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ("label", "business", "entity_type", "key", "field_type", "is_active", "sort_order")
    list_filter = ("entity_type", "field_type", "is_active", "business")
    search_fields = ("label", "key", "business__name")


@admin.register(CustomFieldValue)
class CustomFieldValueAdmin(admin.ModelAdmin):
    list_display = ("definition", "business", "entity_type", "entity_id", "updated_at")
    list_filter = ("entity_type", "business")
    search_fields = ("definition__label", "definition__key", "entity_id", "business__name")


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = ("id", "business", "entity_type", "status", "total_rows", "imported_count", "actor", "created_at")
    list_filter = ("entity_type", "status", "business")
    search_fields = ("business__name", "actor__email", "original_filename")
    readonly_fields = ("created_at", "updated_at", "imported_at")


@admin.register(FileAttachment)
class FileAttachmentAdmin(admin.ModelAdmin):
    list_display = ("original_name", "business", "entity_type", "entity_id", "content_type", "size", "uploaded_by", "created_at")
    list_filter = ("business", "entity_type", "content_type", "created_at")
    search_fields = ("original_name", "business__name", "entity_type", "entity_id", "uploaded_by__email")
    readonly_fields = ("created_at",)
