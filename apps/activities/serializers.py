from rest_framework import serializers

from apps.activities.models import ActivityEvent, Note, Tag, TaggedObject


class ActivityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityEvent
        fields = "__all__"
        read_only_fields = ("created_at",)


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = "__all__"


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = "__all__"


class TaggedObjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaggedObject
        fields = "__all__"
        read_only_fields = ("created_at",)

