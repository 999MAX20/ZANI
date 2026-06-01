from rest_framework import serializers

from apps.activities.models import ActivityEvent, Note, Segment, SegmentFilter, Tag, TaggedObject
from apps.integrations.sanitization import sanitize_error_payload


class ActivityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityEvent
        fields = "__all__"
        read_only_fields = ("created_at",)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["metadata"] = sanitize_error_payload(data.get("metadata") or {})
        return data


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = "__all__"


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = "__all__"


class TaggedObjectSerializer(serializers.ModelSerializer):
    tag_name = serializers.CharField(source="tag.name", read_only=True)
    tag_color = serializers.CharField(source="tag.color", read_only=True)

    class Meta:
        model = TaggedObject
        fields = "__all__"
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
        fields = "__all__"
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
        fields = "__all__"
        read_only_fields = ["cached_count", "last_evaluated_at", "created_at", "updated_at"]
