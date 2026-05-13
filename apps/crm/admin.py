from django.contrib import admin

from apps.crm.models import Deal, Pipeline, PipelineStage, StageTransition


@admin.register(Pipeline)
class PipelineAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "entity_type", "is_default", "template_key")
    list_filter = ("entity_type", "is_default")
    search_fields = ("name", "business__name", "slug")


@admin.register(PipelineStage)
class PipelineStageAdmin(admin.ModelAdmin):
    list_display = ("name", "pipeline", "business", "order", "probability", "sla_minutes", "is_won", "is_lost")
    list_filter = ("pipeline", "is_won", "is_lost")
    search_fields = ("name", "pipeline__name", "business__name")


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ("title", "business", "client", "pipeline", "stage", "amount", "status", "owner", "updated_at")
    list_filter = ("status", "pipeline", "stage", "currency")
    search_fields = ("title", "client__full_name", "client__phone", "business__name")


@admin.register(StageTransition)
class StageTransitionAdmin(admin.ModelAdmin):
    list_display = ("pipeline", "from_stage", "to_stage", "required_permission", "is_active")
    list_filter = ("pipeline", "is_active")
    search_fields = ("pipeline__name", "from_stage__name", "to_stage__name")
