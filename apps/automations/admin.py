from django.contrib import admin

from apps.automations.models import AutomationAction, AutomationCondition, AutomationRule, AutomationRun


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
class AutomationRunAdmin(admin.ModelAdmin):
    list_display = ("trigger_type", "business", "rule", "status", "created_at")
    list_filter = ("trigger_type", "status")
    search_fields = ("entity_type", "entity_id", "error", "business__name")
