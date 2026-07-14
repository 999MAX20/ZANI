from django.contrib import admin

from apps.automations.models import AutomationAction, AutomationCondition, AutomationRule, AutomationRun
from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text


class ReadOnlyLogAdminMixin:
    def has_add_permission(self, request):
        return False


class AutomationConditionInline(admin.TabularInline):
    model = AutomationCondition
    extra = 0


class AutomationActionInline(admin.TabularInline):
    model = AutomationAction
    extra = 0


@admin.register(AutomationRule)
class AutomationRuleAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "trigger_type", "is_active", "priority", "updated_at")
    list_filter = ("trigger_type", "is_active")
    search_fields = ("name", "business__name", "description")
    inlines = [AutomationConditionInline, AutomationActionInline]


@admin.register(AutomationRun)
class AutomationRunAdmin(ReadOnlyLogAdminMixin, admin.ModelAdmin):
    list_display = ("trigger_type", "business", "rule", "status", "created_at")
    list_filter = ("trigger_type", "status")
    search_fields = ("entity_type", "entity_id", "business__name")
    exclude = ("payload", "action_results", "error")
    readonly_fields = ("safe_payload", "safe_action_results", "safe_error")

    def safe_payload(self, obj):
        return sanitize_error_payload(getattr(obj, "payload", {}))

    safe_payload.short_description = "Payload (safe)"

    def safe_action_results(self, obj):
        return sanitize_error_payload(getattr(obj, "action_results", []))

    safe_action_results.short_description = "Action results (safe)"

    def safe_error(self, obj):
        return sanitize_error_text(getattr(obj, "error", ""))

    safe_error.short_description = "Error (safe)"
