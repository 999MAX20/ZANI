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


@admin.register(IntegrationEventLog)
class IntegrationEventLogAdmin(admin.ModelAdmin):
    list_display = ("business", "provider", "channel", "direction", "status", "created_at")
    list_filter = ("provider", "channel", "direction", "status", "business")
    search_fields = ("business__name", "provider", "channel", "error")
    readonly_fields = ("created_at",)


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
    search_fields = ("business__name", "name", "provider", "last_error", "created_by__email")
    readonly_fields = ("connected_at", "last_sync_at", "next_sync_at", "created_at", "updated_at")


@admin.register(ConnectorCredential)
class ConnectorCredentialAdmin(admin.ModelAdmin):
    list_display = ("business", "connector", "key", "masked_value", "expires_at", "rotated_at")
    list_filter = ("business", "connector__provider", "expires_at")
    search_fields = ("business__name", "connector__name", "key", "masked_value")
    readonly_fields = ("encrypted_value", "masked_value", "rotated_at", "created_at", "updated_at")


@admin.register(BusinessEvent)
class BusinessEventAdmin(admin.ModelAdmin):
    list_display = ("business", "source", "event_type", "status", "external_id", "occurred_at", "created_at")
    list_filter = ("business", "source", "event_type", "status")
    search_fields = ("business__name", "source", "event_type", "external_id", "deduplication_key", "error")
    readonly_fields = ("deduplication_key", "processed_at", "created_at")


@admin.register(ConnectorSyncRun)
class ConnectorSyncRunAdmin(admin.ModelAdmin):
    list_display = ("business", "connector", "mode", "status", "events_received", "events_processed", "created_at")
    list_filter = ("business", "mode", "status", "connector__provider")
    search_fields = ("business__name", "connector__name", "error")
    readonly_fields = ("started_at", "finished_at", "created_at")


@admin.register(WebhookEndpoint)
class WebhookEndpointAdmin(admin.ModelAdmin):
    list_display = ("business", "name", "url", "is_active", "created_at")
    list_filter = ("business", "is_active", "created_at")
    search_fields = ("business__name", "name", "url", "created_by__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(WebhookDeliveryLog)
class WebhookDeliveryLogAdmin(admin.ModelAdmin):
    list_display = ("business", "endpoint", "event_type", "status", "attempts", "response_status", "created_at")
    list_filter = ("business", "status", "event_type", "created_at")
    search_fields = ("business__name", "endpoint__name", "event_type", "idempotency_key", "error")
    readonly_fields = ("created_at", "delivered_at", "next_retry_at")
