from rest_framework import serializers

from apps.integrations.connectors import available_connector_capabilities, create_or_update_credential, defaults_for_provider
from apps.integrations.models import (
    ApiToken,
    BusinessConnector,
    BusinessEvent,
    ConnectorCredential,
    ConnectorSyncRun,
    IntegrationEventLog,
    WebhookDeliveryLog,
    WebhookEndpoint,
)


class IntegrationEventLogSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = IntegrationEventLog
        fields = [
            "id",
            "business",
            "business_name",
            "provider",
            "channel",
            "direction",
            "payload_json",
            "status",
            "error",
            "created_at",
        ]
        read_only_fields = fields


class BusinessConnectorSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    credentials_count = serializers.SerializerMethodField()

    class Meta:
        model = BusinessConnector
        fields = [
            "id",
            "business",
            "business_name",
            "provider",
            "capability",
            "name",
            "status",
            "auth_type",
            "config_json",
            "scopes_json",
            "last_sync_at",
            "next_sync_at",
            "last_error",
            "connected_at",
            "created_by",
            "created_by_email",
            "credentials_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "last_sync_at",
            "next_sync_at",
            "last_error",
            "connected_at",
            "created_by",
            "created_by_email",
            "credentials_count",
            "created_at",
            "updated_at",
        ]

    def validate_scopes_json(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Scopes must be a list.")
        return value

    def get_credentials_count(self, obj):
        value = getattr(obj, "credentials_count", None)
        if value is not None:
            return value
        return obj.credentials.count()

    def validate_config_json(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Connector config must be an object.")
        return value

    def validate(self, attrs):
        provider = attrs.get("provider") or getattr(self.instance, "provider", None)
        defaults = defaults_for_provider(provider)
        attrs.setdefault("capability", defaults["capability"])
        attrs.setdefault("auth_type", defaults["auth_type"])
        return attrs


class ConnectorCapabilitySerializer(serializers.Serializer):
    provider = serializers.CharField()
    label = serializers.CharField()
    capability = serializers.CharField()
    auth_type = serializers.CharField()

    @classmethod
    def data_list(cls):
        return cls(available_connector_capabilities(), many=True).data


class ConnectorCredentialSerializer(serializers.ModelSerializer):
    value = serializers.CharField(write_only=True, required=True, allow_blank=False)
    connector_name = serializers.CharField(source="connector.name", read_only=True)
    provider = serializers.CharField(source="connector.provider", read_only=True)

    class Meta:
        model = ConnectorCredential
        fields = [
            "id",
            "business",
            "connector",
            "connector_name",
            "provider",
            "key",
            "value",
            "masked_value",
            "expires_at",
            "rotated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["business", "connector_name", "provider", "masked_value", "rotated_at", "created_at", "updated_at"]

    def validate(self, attrs):
        connector = attrs.get("connector") or getattr(self.instance, "connector", None)
        if connector is None:
            raise serializers.ValidationError({"connector": "Connector is required."})
        attrs["business"] = connector.business
        return attrs

    def create(self, validated_data):
        value = validated_data.pop("value")
        connector = validated_data["connector"]
        key = validated_data["key"]
        expires_at = validated_data.get("expires_at")
        return create_or_update_credential(connector, key, value, expires_at=expires_at)

    def update(self, instance, validated_data):
        value = validated_data.pop("value", None)
        expires_at = validated_data.get("expires_at", instance.expires_at)
        if value:
            return create_or_update_credential(instance.connector, instance.key, value, expires_at=expires_at)
        instance.expires_at = expires_at
        instance.save(update_fields=["expires_at", "updated_at"])
        return instance


class BusinessEventSerializer(serializers.ModelSerializer):
    connector_name = serializers.CharField(source="connector.name", read_only=True)

    class Meta:
        model = BusinessEvent
        fields = [
            "id",
            "business",
            "connector",
            "connector_name",
            "event_type",
            "source",
            "external_id",
            "deduplication_key",
            "occurred_at",
            "processed_at",
            "payload_json",
            "status",
            "error",
            "created_at",
        ]
        read_only_fields = fields


class ConnectorSyncRunSerializer(serializers.ModelSerializer):
    connector_name = serializers.CharField(source="connector.name", read_only=True)

    class Meta:
        model = ConnectorSyncRun
        fields = [
            "id",
            "business",
            "connector",
            "connector_name",
            "mode",
            "status",
            "started_at",
            "finished_at",
            "events_received",
            "events_processed",
            "error",
            "created_at",
        ]
        read_only_fields = fields


class ApiTokenSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = ApiToken
        fields = [
            "id",
            "business",
            "name",
            "token_prefix",
            "scopes_json",
            "is_active",
            "expires_at",
            "last_used_at",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["token_prefix", "is_active", "last_used_at", "created_by", "created_at", "updated_at"]

    def validate_scopes_json(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("At least one API token scope is required.")
        if any(not isinstance(scope, str) or not scope.strip() for scope in value):
            raise serializers.ValidationError("API token scopes must be non-empty strings.")
        return [scope.strip() for scope in value]


class WebhookEndpointSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    url = serializers.CharField(max_length=512)

    class Meta:
        model = WebhookEndpoint
        fields = [
            "id",
            "business",
            "name",
            "url",
            "secret",
            "events_json",
            "is_active",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]
        extra_kwargs = {"secret": {"write_only": True, "required": False, "allow_blank": True}}


class WebhookDeliveryLogSerializer(serializers.ModelSerializer):
    endpoint_name = serializers.CharField(source="endpoint.name", read_only=True)

    class Meta:
        model = WebhookDeliveryLog
        fields = [
            "id",
            "business",
            "endpoint",
            "endpoint_name",
            "event_type",
            "idempotency_key",
            "payload_json",
            "response_status",
            "response_body",
            "status",
            "error",
            "attempts",
            "next_retry_at",
            "delivered_at",
            "created_at",
        ]
        read_only_fields = fields
