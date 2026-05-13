from django.contrib import admin

from apps.ai_core.models import AIRequestLog, BusinessKnowledgeItem


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
