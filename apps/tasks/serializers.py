from rest_framework import serializers

from apps.tasks.models import Task, TaskComment


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = TaskComment
        fields = ["id", "task", "author", "author_name", "author_email", "text", "created_at"]
        read_only_fields = ["author", "author_name", "author_email", "created_at"]


class TaskSerializer(serializers.ModelSerializer):
    comments_count = serializers.IntegerField(read_only=True)
    watchers_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = ["archived_at", "archived_by", "completed_at", "completed_by", "comments_count", "watchers_count"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        related_fields = ["client", "lead", "deal", "appointment", "parent_task"]
        for field in related_fields:
            obj = attrs.get(field) if field in attrs else getattr(self.instance, field, None)
            if obj and business and obj.business_id != business.id:
                raise serializers.ValidationError(f"{field} must belong to the selected business.")
        return attrs
