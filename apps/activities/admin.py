from django.contrib import admin

from apps.activities.models import ActivityEvent, Note, Tag, TaggedObject


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
