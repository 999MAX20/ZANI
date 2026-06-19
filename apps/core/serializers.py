from rest_framework import serializers

from apps.core.custom_fields import validate_custom_field_value
from apps.core.file_validation import validate_file_upload
from apps.core.models import (
    AuditLog,
    CustomFieldDefinition,
    CustomFieldValue,
    FileAttachment,
    ImportJob,
    LoginHistory,
    SupportAccessGrant,
    safe_original_filename,
)
from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text


class CustomFieldDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldDefinition
        fields = [
            "id",
            "business",
            "entity_type",
            "key",
            "label",
            "field_type",
            "options_json",
            "permissions_json",
            "is_required",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_permissions_json(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("permissions_json must be an object.")
        normalized = {}
        for key in ("view_roles", "edit_roles"):
            roles = value.get(key) or []
            if not isinstance(roles, list):
                raise serializers.ValidationError(f"{key} must be a list.")
            normalized[key] = [str(role).strip() for role in roles if str(role).strip()]
        return normalized


class CustomFieldValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldValue
        fields = [
            "id",
            "business",
            "definition",
            "entity_type",
            "entity_id",
            "value_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        definition = attrs.get("definition") or getattr(self.instance, "definition", None)
        entity_type = attrs.get("entity_type") or getattr(self.instance, "entity_type", None)
        if definition and business and definition.business_id != business.id:
            raise serializers.ValidationError("Definition must belong to the selected business.")
        if definition and entity_type and definition.entity_type != entity_type:
            raise serializers.ValidationError("Definition entity_type must match value entity_type.")
        if definition and "value_json" in attrs:
            attrs["value_json"] = validate_custom_field_value(definition=definition, value_json=attrs.get("value_json"))
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
    summary_json = serializers.SerializerMethodField()

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
            "errors_json",
            "summary_json",
            "total_rows",
            "imported_count",
            "error",
            "created_at",
            "updated_at",
            "imported_at",
        ]

    def get_summary_json(self, obj):
        summary = ((obj.preview_json or {}).get("import_summary") or {}).copy()
        summary.setdefault("total_rows", obj.total_rows)
        summary.setdefault("imported", obj.imported_count)
        summary.setdefault("errors", len((obj.errors_json or {}).get("rows") or []))
        summary.setdefault("duplicates", len((obj.duplicates_json or {}).get("rows") or []))
        summary.setdefault("created", 0)
        summary.setdefault("updated", 0)
        summary.setdefault("skipped", 0)
        summary["status"] = obj.status
        return summary


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "business",
            "business_name",
            "actor",
            "actor_email",
            "action",
            "category",
            "risk_level",
            "entity_type",
            "entity_id",
            "metadata",
            "ip_address",
            "user_agent",
            "created_at",
        ]
        read_only_fields = ["business_name", "actor_email", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["metadata"] = sanitize_error_payload(data.get("metadata") or {})
        data["user_agent"] = sanitize_error_text(data.get("user_agent") or "")
        return data


class LoginHistorySerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = LoginHistory
        fields = [
            "id",
            "business",
            "business_name",
            "user",
            "user_email",
            "email",
            "status",
            "ip_address",
            "user_agent",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["business_name", "user_email", "created_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["metadata"] = sanitize_error_payload(data.get("metadata") or {})
        data["user_agent"] = sanitize_error_text(data.get("user_agent") or "")
        return data


class SupportAccessGrantSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    is_valid_now = serializers.SerializerMethodField()

    class Meta:
        model = SupportAccessGrant
        fields = [
            "id",
            "business",
            "user",
            "user_email",
            "reason",
            "is_active",
            "expires_at",
            "created_at",
            "created_by",
            "created_by_email",
            "is_valid_now",
        ]
        read_only_fields = ["user_email", "created_at", "created_by", "created_by_email", "is_valid_now"]

    def get_is_valid_now(self, obj):
        return obj.is_valid()

    def validate_reason(self, value):
        return sanitize_error_text(value, max_length=1000)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["reason"] = sanitize_error_text(data.get("reason") or "")
        return data


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
        validated_data["original_name"] = safe_original_filename(getattr(uploaded_file, "name", ""))
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
