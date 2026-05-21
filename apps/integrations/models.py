from django.conf import settings
from django.db import models
from django.utils import timezone
import hashlib
import secrets

from apps.businesses.models import Business


class IntegrationEventLog(models.Model):
    class Directions(models.TextChoices):
        INBOUND = "inbound", "Inbound"
        OUTBOUND = "outbound", "Outbound"

    class Statuses(models.TextChoices):
        RECEIVED = "received", "Received"
        PROCESSED = "processed", "Processed"
        SENT = "sent", "Sent"
        MOCKED = "mocked", "Mocked"
        FAILED = "failed", "Failed"

    business = models.ForeignKey(Business, on_delete=models.SET_NULL, null=True, blank=True, related_name="integration_event_logs")
    provider = models.CharField(max_length=64)
    channel = models.CharField(max_length=64, blank=True)
    direction = models.CharField(max_length=32, choices=Directions.choices)
    payload_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "provider", "status"]),
            models.Index(fields=["provider", "direction", "created_at"]),
        ]

    def __str__(self):
        return f"{self.provider}:{self.direction}:{self.status}"


class BusinessConnector(models.Model):
    class Providers(models.TextChoices):
        WEBSITE = "website", "Website"
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        INSTAGRAM = "instagram", "Instagram"
        EMAIL = "email", "Email"
        KASPI = "kaspi", "Kaspi"
        ONE_C = "1c", "1C"
        GOOGLE_CALENDAR = "google_calendar", "Google Calendar"
        CUSTOM = "custom", "Custom"

    class Capabilities(models.TextChoices):
        COMMUNICATIONS = "communications", "Communications"
        SALES = "sales", "Sales"
        CALENDAR = "calendar", "Calendar"
        FINANCE = "finance", "Finance"
        INVENTORY = "inventory", "Inventory"
        MARKETING = "marketing", "Marketing"
        CUSTOM = "custom", "Custom"

    class Statuses(models.TextChoices):
        DRAFT = "draft", "Draft"
        CONNECTED = "connected", "Connected"
        NEEDS_ATTENTION = "needs_attention", "Needs attention"
        SYNCING = "syncing", "Syncing"
        FAILED = "failed", "Failed"
        DISABLED = "disabled", "Disabled"
        EXPIRED_CREDENTIALS = "expired_credentials", "Expired credentials"

    class AuthTypes(models.TextChoices):
        NONE = "none", "None"
        TOKEN = "token", "Token"
        OAUTH = "oauth", "OAuth"
        QR = "qr", "QR"
        LOGIN = "login", "Login"
        CONNECTOR = "connector", "Connector"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="business_connectors")
    provider = models.CharField(max_length=64, choices=Providers.choices)
    capability = models.CharField(max_length=64, choices=Capabilities.choices, default=Capabilities.COMMUNICATIONS)
    name = models.CharField(max_length=128)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.DRAFT)
    auth_type = models.CharField(max_length=32, choices=AuthTypes.choices, default=AuthTypes.NONE)
    config_json = models.JSONField(default=dict, blank=True)
    scopes_json = models.JSONField(default=list, blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    next_sync_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    connected_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_business_connectors")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["provider", "name"]
        constraints = [
            models.UniqueConstraint(fields=["business", "provider", "name"], name="unique_business_connector_name"),
        ]
        indexes = [
            models.Index(fields=["business", "provider", "status"]),
            models.Index(fields=["business", "capability", "status"]),
        ]

    def __str__(self):
        return f"{self.business}: {self.provider} / {self.name}"


class ConnectorCredential(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="connector_credentials")
    connector = models.ForeignKey(BusinessConnector, on_delete=models.CASCADE, related_name="credentials")
    key = models.CharField(max_length=96)
    encrypted_value = models.TextField()
    masked_value = models.CharField(max_length=160, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    rotated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]
        constraints = [
            models.UniqueConstraint(fields=["connector", "key"], name="unique_connector_credential_key"),
        ]
        indexes = [
            models.Index(fields=["business", "connector", "key"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self):
        return f"{self.connector}: {self.key}"


class BusinessEvent(models.Model):
    class Statuses(models.TextChoices):
        RECEIVED = "received", "Received"
        PROCESSED = "processed", "Processed"
        FAILED = "failed", "Failed"
        IGNORED = "ignored", "Ignored"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="business_events")
    connector = models.ForeignKey(BusinessConnector, on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
    event_type = models.CharField(max_length=128)
    source = models.CharField(max_length=64)
    external_id = models.CharField(max_length=160, blank=True)
    deduplication_key = models.CharField(max_length=160)
    occurred_at = models.DateTimeField(default=timezone.now)
    processed_at = models.DateTimeField(null=True, blank=True)
    payload_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.RECEIVED)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["business", "source", "deduplication_key"], name="unique_business_event_deduplication_key"),
        ]
        indexes = [
            models.Index(fields=["business", "source", "event_type", "occurred_at"]),
            models.Index(fields=["business", "status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.business}: {self.source}.{self.event_type}"


class ConnectorSyncRun(models.Model):
    class Modes(models.TextChoices):
        WEBHOOK = "webhook", "Webhook"
        PULL = "pull", "Pull"
        MANUAL = "manual", "Manual"
        HEALTHCHECK = "healthcheck", "Healthcheck"

    class Statuses(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="connector_sync_runs")
    connector = models.ForeignKey(BusinessConnector, on_delete=models.CASCADE, related_name="sync_runs")
    mode = models.CharField(max_length=32, choices=Modes.choices, default=Modes.MANUAL)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.QUEUED)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    events_received = models.PositiveIntegerField(default=0)
    events_processed = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "connector", "status", "created_at"]),
            models.Index(fields=["mode", "status", "created_at"]),
        ]

    def __str__(self):
        return f"{self.connector}: {self.mode} {self.status}"


class ApiToken(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="api_tokens")
    name = models.CharField(max_length=128)
    token_prefix = models.CharField(max_length=16, db_index=True)
    token_hash = models.CharField(max_length=128)
    scopes_json = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_api_tokens")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "is_active", "created_at"]),
            models.Index(fields=["token_prefix", "is_active"]),
        ]

    @staticmethod
    def hash_token(raw_token):
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @classmethod
    def generate_raw_token(cls):
        return f"zani_{secrets.token_urlsafe(32)}"

    def set_raw_token(self, raw_token):
        self.token_prefix = raw_token[:16]
        self.token_hash = self.hash_token(raw_token)

    def matches(self, raw_token):
        return secrets.compare_digest(self.token_hash, self.hash_token(raw_token))

    def has_scope(self, scope):
        return scope in (self.scopes_json or [])

    def is_usable(self):
        return self.is_active and (self.expires_at is None or self.expires_at > timezone.now())

    def __str__(self):
        return f"{self.business}: {self.name}"


class WebhookEndpoint(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="webhook_endpoints")
    name = models.CharField(max_length=128)
    url = models.URLField()
    secret = models.CharField(max_length=128, blank=True)
    events_json = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_webhook_endpoints")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "is_active", "created_at"]),
        ]

    def __str__(self):
        return f"{self.business}: {self.name}"


class WebhookDeliveryLog(models.Model):
    class Statuses(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="webhook_delivery_logs")
    endpoint = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name="delivery_logs")
    event_type = models.CharField(max_length=128)
    idempotency_key = models.CharField(max_length=128)
    payload_json = models.JSONField(default=dict, blank=True)
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.PENDING)
    error = models.TextField(blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["endpoint", "idempotency_key"], name="unique_webhook_delivery_idempotency_key"),
        ]
        indexes = [
            models.Index(fields=["business", "status", "created_at"]),
            models.Index(fields=["endpoint", "event_type", "created_at"]),
        ]

    def __str__(self):
        return f"{self.endpoint}: {self.event_type} {self.status}"
