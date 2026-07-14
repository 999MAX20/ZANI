from django.contrib import admin

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
from apps.integrations.sanitization import sanitize_config, sanitize_error_payload, sanitize_error_text


class SanitizedErrorAdminMixin:
    def has_add_permission(self, request):
        return False

    def safe_error(self, obj):
        return sanitize_error_text(getattr(obj, "error", ""))

    safe_error.short_description = "Error (safe)"

    def safe_last_error(self, obj):
        return sanitize_error_text(getattr(obj, "last_error", ""))

    safe_last_error.short_description = "Last error (safe)"

    def safe_payload_json(self, obj):
        return sanitize_error_payload(getattr(obj, "payload_json", {}))

    safe_payload_json.short_description = "Payload (safe)"

    def safe_response_body(self, obj):
        return sanitize_error_text(getattr(obj, "response_body", ""))

    safe_response_body.short_description = "Response body (safe)"


@admin.register(IntegrationEventLog)
class IntegrationEventLogAdmin(SanitizedErrorAdminMixin, admin.ModelAdmin):
    list_display = ("business", "provider", "channel", "direction", "status", "created_at")
    list_filter = ("provider", "channel", "direction", "status", "business")
    search_fields = ("business__name", "provider", "channel")
    exclude = ("payload_json", "error")
    readonly_fields = ("safe_payload_json", "safe_error", "created_at")


@admin.register(ApiToken)
class ApiTokenAdmin(admin.ModelAdmin):
    list_display = ("business", "name", "token_prefix", "is_active", "last_used_at", "expires_at", "created_at")
    list_filter = ("business", "is_active", "created_at")
    search_fields = ("business__name", "name", "token_prefix", "created_by__email")
    readonly_fields = ("token_prefix", "token_hash", "last_used_at", "created_at", "updated_at")


@admin.register(BusinessConnector)
class BusinessConnectorAdmin(admin.ModelAdmin):
    list_display = ("business", "provider", "name", "capability", "status", "auth_type", "last_sync_at", "created_at")
    list_filter = ("provider", "capability", "status", "auth_type", "business")
    search_fields = ("business__name", "name", "provider", "created_by__email")
    exclude = ("config_json", "last_error")
    readonly_fields = ("safe_config_json", "safe_last_error", "connected_at", "last_sync_at", "next_sync_at", "created_at", "updated_at")

    def safe_config_json(self, obj):
        return sanitize_config(getattr(obj, "config_json", {}))

    safe_config_json.short_description = "Config (safe)"

    def safe_last_error(self, obj):
        return sanitize_error_text(getattr(obj, "last_error", ""))

    safe_last_error.short_description = "Last error (safe)"


@admin.register(ConnectorCredential)
class ConnectorCredentialAdmin(admin.ModelAdmin):
    list_display = ("business", "connector", "key", "masked_value", "expires_at", "rotated_at")
    list_filter = ("business", "connector__provider", "expires_at")
    search_fields = ("business__name", "connector__name", "key", "masked_value")
    readonly_fields = ("encrypted_value", "masked_value", "rotated_at", "created_at", "updated_at")


@admin.register(BusinessEvent)
class BusinessEventAdmin(SanitizedErrorAdminMixin, admin.ModelAdmin):
    list_display = ("business", "source", "event_type", "status", "external_id", "occurred_at", "created_at")
    list_filter = ("business", "source", "event_type", "status")
    search_fields = ("business__name", "source", "event_type", "external_id", "deduplication_key")
    exclude = ("payload_json", "error")
    readonly_fields = ("deduplication_key", "safe_payload_json", "safe_error", "processed_at", "created_at")


@admin.register(ConnectorSyncRun)
class ConnectorSyncRunAdmin(SanitizedErrorAdminMixin, admin.ModelAdmin):
    list_display = ("business", "connector", "mode", "status", "events_received", "events_processed", "created_at")
    list_filter = ("business", "mode", "status", "connector__provider")
    search_fields = ("business__name", "connector__name")
    exclude = ("error",)
    readonly_fields = ("safe_error", "started_at", "finished_at", "created_at")


@admin.register(WebhookEndpoint)
class WebhookEndpointAdmin(admin.ModelAdmin):
    list_display = ("business", "name", "url", "is_active", "created_at")
    list_filter = ("business", "is_active", "created_at")
    search_fields = ("business__name", "name", "url", "created_by__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(WebhookDeliveryLog)
class WebhookDeliveryLogAdmin(SanitizedErrorAdminMixin, admin.ModelAdmin):
    list_display = ("business", "endpoint", "event_type", "status", "attempts", "response_status", "created_at")
    list_filter = ("business", "status", "event_type", "created_at")
    search_fields = ("business__name", "endpoint__name", "event_type", "idempotency_key")
    exclude = ("payload_json", "response_body", "error")
    readonly_fields = ("safe_payload_json", "safe_response_body", "safe_error", "created_at", "delivered_at", "next_retry_at")
