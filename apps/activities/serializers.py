from rest_framework import serializers

from apps.activities.models import ActivityEvent, Note, Segment, SegmentFilter, Tag, TaggedObject
from apps.integrations.sanitization import sanitize_error_payload


class ActivityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityEvent
        fields = [
            "id",
            "business",
            "client",
            "actor",
            "category",
            "event_type",
            "source",
            "entity_type",
            "entity_id",
            "text",
            "metadata",
            "created_at",
        ]
        read_only_fields = ("created_at",)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["metadata"] = sanitize_error_payload(data.get("metadata") or {})
        return data


class ActivityTimelineSerializer(ActivityEventSerializer):
    """Labels for already-authorized event reads; no account emails or raw metadata UI."""
    actor_name = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()

    class Meta(ActivityEventSerializer.Meta):
        fields = [*ActivityEventSerializer.Meta.fields, "actor_name", "client_name"]

    def get_actor_name(self, event):
        if not event.actor or not (event.actor_id == event.business.owner_id or getattr(event, "actor_is_member", False)):
            return ""
        return event.actor.full_name or event.actor.get_full_name()

    def get_client_name(self, event):
        return event.client.full_name if event.client and event.client.business_id == event.business_id else ""


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = [
            "id",
            "business",
            "client",
            "author",
            "entity_type",
            "entity_id",
            "text",
            "created_at",
            "updated_at",
        ]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = [
            "id",
            "business",
            "name",
            "color",
            "source",
            "created_at",
            "updated_at",
        ]


class TaggedObjectSerializer(serializers.ModelSerializer):
    tag_name = serializers.CharField(source="tag.name", read_only=True)
    tag_color = serializers.CharField(source="tag.color", read_only=True)

    class Meta:
        model = TaggedObject
        fields = [
            "id",
            "business",
            "tag",
            "tag_name",
            "tag_color",
            "entity_type",
            "entity_id",
            "created_at",
        ]
        read_only_fields = ("created_at",)

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        tag = attrs.get("tag") or getattr(self.instance, "tag", None)
        if business and tag and tag.business_id != business.id:
            raise serializers.ValidationError("Tag must belong to the selected business.")
        return attrs


class SegmentFilterSerializer(serializers.ModelSerializer):
    class Meta:
        model = SegmentFilter
        fields = [
            "id",
            "business",
            "segment",
            "field",
            "operator",
            "value_json",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        segment = attrs.get("segment") or getattr(self.instance, "segment", None)
        if business and segment and segment.business_id != business.id:
            raise serializers.ValidationError("Segment must belong to the selected business.")
        if business is None and segment is not None:
            attrs["business"] = segment.business
        return attrs


class SegmentSerializer(serializers.ModelSerializer):
    filters = SegmentFilterSerializer(many=True, read_only=True)

    class Meta:
        model = Segment
        fields = [
            "id",
            "business",
            "name",
            "description",
            "entity_type",
            "is_active",
            "cached_count",
            "last_evaluated_at",
            "filters",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["cached_count", "last_evaluated_at", "created_at", "updated_at"]
