from django.contrib import admin

from apps.ai_core.models import AIToolCallLog, AIRequestLog, AgentProfile, BusinessKnowledgeItem
from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text


class ReadOnlyLogAdminMixin:
    def has_add_permission(self, request):
        return False


@admin.register(AIRequestLog)
class AIRequestLogAdmin(ReadOnlyLogAdminMixin, admin.ModelAdmin):
    list_display = ("business", "user", "source", "prompt_type", "model", "tokens_used", "created_at")
    list_filter = ("source", "prompt_type", "model", "business")
    search_fields = ("business__name", "user__email", "prompt_type")
    exclude = ("input_json", "output_text")
    readonly_fields = ("safe_input_json", "safe_output_text", "created_at")

    def safe_input_json(self, obj):
        return sanitize_error_payload(getattr(obj, "input_json", {}))

    safe_input_json.short_description = "Input (safe)"

    def safe_output_text(self, obj):
        return sanitize_error_text(getattr(obj, "output_text", ""))

    safe_output_text.short_description = "Output (safe)"


@admin.register(BusinessKnowledgeItem)
class BusinessKnowledgeItemAdmin(admin.ModelAdmin):
    list_display = ("title", "business", "category", "is_active", "updated_at")
    list_filter = ("category", "is_active", "business")
    search_fields = ("title", "content", "business__name")


@admin.register(AgentProfile)
class AgentProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "bot", "tone", "language", "is_active", "updated_at")
    list_filter = ("tone", "language", "is_active", "business")
    search_fields = ("name", "role_description", "system_prompt", "business__name", "bot__name")


@admin.register(AIToolCallLog)
class AIToolCallLogAdmin(ReadOnlyLogAdminMixin, admin.ModelAdmin):
    list_display = ("business", "user", "conversation", "tool_name", "status", "created_at")
    list_filter = ("tool_name", "status", "business")
    search_fields = ("business__name", "user__email", "tool_name")
    exclude = ("input_json", "output_json", "error")
    readonly_fields = ("safe_input_json", "safe_output_json", "safe_error", "created_at")

    def safe_input_json(self, obj):
        return sanitize_error_payload(getattr(obj, "input_json", {}))

    safe_input_json.short_description = "Input (safe)"

    def safe_output_json(self, obj):
        return sanitize_error_payload(getattr(obj, "output_json", {}))

    safe_output_json.short_description = "Output (safe)"

    def safe_error(self, obj):
        return sanitize_error_text(getattr(obj, "error", ""))

    safe_error.short_description = "Error (safe)"
