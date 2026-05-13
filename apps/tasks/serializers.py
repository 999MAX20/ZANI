from rest_framework import serializers

from apps.tasks.models import Task


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        related_fields = ["client", "lead", "deal", "appointment"]
        for field in related_fields:
            obj = attrs.get(field) if field in attrs else getattr(self.instance, field, None)
            if obj and business and obj.business_id != business.id:
                raise serializers.ValidationError(f"{field} must belong to the selected business.")
        return attrs
