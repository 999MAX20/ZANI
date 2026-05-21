from django.contrib import admin

from apps.activities.models import ActivityEvent, Note, Segment, SegmentFilter, Tag, TaggedObject


@admin.register(ActivityEvent)
class ActivityEventAdmin(admin.ModelAdmin):
    list_display = ("event_type", "business", "client", "category", "source", "created_at")
    list_filter = ("category", "source", "event_type")
    search_fields = ("text", "event_type", "client__full_name", "business__name")


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("business", "client", "author", "created_at")
    list_filter = ("created_at",)
    search_fields = ("text", "client__full_name", "business__name")


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "source", "color")
    list_filter = ("source",)
    search_fields = ("name", "business__name")


@admin.register(TaggedObject)
class TaggedObjectAdmin(admin.ModelAdmin):
    list_display = ("tag", "business", "entity_type", "entity_id", "created_at")
    list_filter = ("entity_type",)
    search_fields = ("tag__name", "entity_type", "entity_id")


class SegmentFilterInline(admin.TabularInline):
    model = SegmentFilter
    extra = 0


@admin.register(Segment)
class SegmentAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "entity_type", "cached_count", "is_active", "last_evaluated_at")
    list_filter = ("entity_type", "is_active")
    search_fields = ("name", "description", "business__name")
    inlines = [SegmentFilterInline]


@admin.register(SegmentFilter)
class SegmentFilterAdmin(admin.ModelAdmin):
    list_display = ("segment", "business", "field", "operator", "sort_order")
    list_filter = ("field", "operator")
    search_fields = ("segment__name", "business__name")
