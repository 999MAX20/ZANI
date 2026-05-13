from django.contrib import admin

from apps.ai_core.models import AIToolCallLog, AIRequestLog, AgentProfile, BusinessKnowledgeItem


@admin.register(AIRequestLog)
class AIRequestLogAdmin(admin.ModelAdmin):
    list_display = ("business", "user", "source", "prompt_type", "model", "tokens_used", "created_at")
    list_filter = ("source", "prompt_type", "model", "business")
    search_fields = ("business__name", "user__email", "prompt_type", "output_text")
    readonly_fields = ("created_at",)


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
class AIToolCallLogAdmin(admin.ModelAdmin):
    list_display = ("business", "user", "conversation", "tool_name", "status", "created_at")
    list_filter = ("tool_name", "status", "business")
    search_fields = ("business__name", "user__email", "tool_name", "error")
    readonly_fields = ("created_at",)
