from rest_framework import serializers

from apps.core.file_validation import validate_file_upload
from apps.core.models import AuditLog, CustomFieldDefinition, CustomFieldValue, FileAttachment, ImportJob, LoginHistory, SupportAccessGrant


class CustomFieldDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldDefinition
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class CustomFieldValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldValue
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        definition = attrs.get("definition") or getattr(self.instance, "definition", None)
        entity_type = attrs.get("entity_type") or getattr(self.instance, "entity_type", None)
        if definition and business and definition.business_id != business.id:
            raise serializers.ValidationError("Definition must belong to the selected business.")
        if definition and entity_type and definition.entity_type != entity_type:
            raise serializers.ValidationError("Definition entity_type must match value entity_type.")
        return attrs


class BulkCustomFieldValueItemSerializer(serializers.Serializer):
    definition = serializers.PrimaryKeyRelatedField(queryset=CustomFieldDefinition.objects.all())
    value_json = serializers.JSONField(required=False)


class BulkCustomFieldValueSerializer(serializers.Serializer):
    business = serializers.IntegerField()
    entity_type = serializers.ChoiceField(choices=CustomFieldDefinition.EntityTypes.choices)
    entity_id = serializers.CharField(max_length=64)
    values = BulkCustomFieldValueItemSerializer(many=True)


class ImportJobSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = ImportJob
        fields = [
            "id",
            "business",
            "actor",
            "actor_email",
            "entity_type",
            "source_file",
            "original_filename",
            "status",
            "mapping_json",
            "preview_json",
            "duplicates_json",
            "total_rows",
            "imported_count",
            "error",
            "created_at",
            "updated_at",
            "imported_at",
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = AuditLog
        fields = "__all__"
        read_only_fields = ["created_at"]


class LoginHistorySerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = LoginHistory
        fields = "__all__"
        read_only_fields = ["created_at"]


class SupportAccessGrantSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    is_valid_now = serializers.SerializerMethodField()

    class Meta:
        model = SupportAccessGrant
        fields = "__all__"
        read_only_fields = ["created_at", "created_by"]

    def get_is_valid_now(self, obj):
        return obj.is_valid()


class FileAttachmentSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    download_url = serializers.SerializerMethodField()
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True)

    class Meta:
        model = FileAttachment
        fields = [
            "id",
            "business",
            "uploaded_by",
            "uploaded_by_email",
            "file",
            "original_name",
            "content_type",
            "size",
            "entity_type",
            "entity_id",
            "visibility",
            "download_url",
            "created_at",
        ]
        read_only_fields = ["uploaded_by", "original_name", "content_type", "size", "visibility", "download_url", "created_at"]

    def validate_file(self, uploaded_file):
        return validate_file_upload(uploaded_file)

    def create(self, validated_data):
        uploaded_file = validated_data["file"]
        validated_data["original_name"] = getattr(uploaded_file, "name", "")
        validated_data["content_type"] = getattr(uploaded_file, "content_type", "")
        validated_data["size"] = getattr(uploaded_file, "size", 0) or 0
        validated_data["visibility"] = FileAttachment.Visibility.PRIVATE
        return super().create(validated_data)

    def get_download_url(self, obj):
        request = self.context.get("request")
        url = f"/api/file-attachments/{obj.id}/download/"
        return request.build_absolute_uri(url) if request else url
        read_only_fields = [
            "actor",
            "actor_email",
            "original_filename",
            "status",
            "mapping_json",
            "preview_json",
            "duplicates_json",
            "total_rows",
            "imported_count",
            "error",
            "created_at",
            "updated_at",
            "imported_at",
        ]
