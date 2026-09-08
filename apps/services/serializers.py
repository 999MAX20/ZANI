from rest_framework import serializers

from apps.services.models import Service


class ServiceSerializer(serializers.ModelSerializer):
    lifecycle_update_fields = {"is_active"}
    archive_update_fields = {"is_archived", "archive_reason", "archived_at", "archived_by"}

    class Meta:
        model = Service
        fields = "__all__"
        read_only_fields = [
            "is_active",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        submitted_fields = set((self.initial_data or {}).keys())
        attempted_lifecycle_fields = sorted(self.lifecycle_update_fields.intersection(submitted_fields))
        if attempted_lifecycle_fields:
            raise serializers.ValidationError(
                {
                    "detail": "Use service lifecycle action endpoints for protected state changes.",
                    "fields": attempted_lifecycle_fields,
                }
            )
        attempted_archive_fields = sorted(self.archive_update_fields.intersection(submitted_fields))
        if attempted_archive_fields:
            raise serializers.ValidationError(
                {
                    "detail": "Use service archive action endpoints for archive state changes.",
                    "fields": attempted_archive_fields,
                }
            )
        return attrs
