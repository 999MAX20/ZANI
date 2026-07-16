import hashlib
import hmac

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.businesses.models import Business, TimeStampedModel


def hash_mobile_secret(value: str, *, namespace: str) -> str:
    normalized = str(value or "").strip()
    return hmac.new(
        str(settings.SECRET_KEY).encode("utf-8"),
        f"{namespace}:{normalized}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


class MobileDevice(TimeStampedModel):
    class Platforms(models.TextChoices):
        IOS = "ios", "iOS"
        ANDROID = "android", "Android"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="mobile_devices")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mobile_devices")
    device_id_hash = models.CharField(max_length=64)
    platform = models.CharField(max_length=16, choices=Platforms.choices)
    app_version = models.CharField(max_length=32, blank=True)
    build_number = models.CharField(max_length=32, blank=True)
    os_version = models.CharField(max_length=64, blank=True)
    device_model = models.CharField(max_length=128, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    last_ip = models.GenericIPAddressField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-last_seen_at", "-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["business", "user", "device_id_hash"], name="unique_mobile_device_per_user_business"),
        ]
        indexes = [
            models.Index(fields=["business", "user", "revoked_at"]),
            models.Index(fields=["business", "platform", "last_seen_at"]),
            models.Index(fields=["device_id_hash"]),
        ]

    def __str__(self):
        return f"{self.platform} device for {self.user_id}/{self.business_id}"

    @property
    def is_revoked(self):
        return self.revoked_at is not None

    def mark_seen(self, *, ip_address=""):
        self.last_seen_at = timezone.now()
        if ip_address:
            self.last_ip = ip_address
        self.save(update_fields=["last_seen_at", "last_ip", "updated_at"])

    def revoke(self, reason=""):
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.revoked_reason = reason
            self.save(update_fields=["revoked_at", "revoked_reason", "updated_at"])


class MobileSession(TimeStampedModel):
    class Statuses(models.TextChoices):
        ACTIVE = "active", "Active"
        REVOKED = "revoked", "Revoked"
        EXPIRED = "expired", "Expired"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="mobile_sessions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mobile_sessions")
    device = models.ForeignKey(MobileDevice, on_delete=models.CASCADE, related_name="sessions")
    refresh_jti = models.CharField(max_length=255, db_index=True)
    status = models.CharField(max_length=16, choices=Statuses.choices, default=Statuses.ACTIVE)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_reason = models.CharField(max_length=255, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_seen_at", "-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["business", "user", "refresh_jti"], name="unique_mobile_session_refresh_jti"),
        ]
        indexes = [
            models.Index(fields=["business", "user", "status"]),
            models.Index(fields=["business", "device", "status"]),
            models.Index(fields=["expires_at", "status"]),
        ]

    def __str__(self):
        return f"{self.status} mobile session for {self.user_id}/{self.business_id}"

    def mark_seen(self):
        self.last_seen_at = timezone.now()
        self.save(update_fields=["last_seen_at", "updated_at"])

    def revoke(self, reason=""):
        if self.status != self.Statuses.REVOKED:
            self.status = self.Statuses.REVOKED
            self.revoked_at = timezone.now()
            self.revoked_reason = reason
            self.save(update_fields=["status", "revoked_at", "revoked_reason", "updated_at"])


class MobilePushToken(TimeStampedModel):
    class Providers(models.TextChoices):
        APNS = "apns", "APNs"
        FCM = "fcm", "FCM"
        EXPO = "expo", "Expo"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="mobile_push_tokens")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mobile_push_tokens")
    device = models.ForeignKey(MobileDevice, on_delete=models.CASCADE, related_name="push_tokens")
    provider = models.CharField(max_length=16, choices=Providers.choices)
    token_hash = models.CharField(max_length=64)
    encrypted_token = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-last_seen_at", "-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["business", "provider", "token_hash"], name="unique_mobile_push_token_per_business"),
        ]
        indexes = [
            models.Index(fields=["business", "user", "is_active"]),
            models.Index(fields=["business", "device", "is_active"]),
            models.Index(fields=["provider", "token_hash"]),
        ]

    def __str__(self):
        return f"{self.provider} push token for {self.user_id}/{self.business_id}"

    def mark_seen(self):
        self.last_seen_at = timezone.now()
        self.is_active = True
        self.revoked_at = None
        self.revoked_reason = ""
        self.save(update_fields=["last_seen_at", "is_active", "revoked_at", "revoked_reason", "updated_at"])

    def revoke(self, reason=""):
        self.is_active = False
        self.revoked_at = timezone.now()
        self.revoked_reason = reason
        self.save(update_fields=["is_active", "revoked_at", "revoked_reason", "updated_at"])


class MobileIdempotencyKey(TimeStampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="mobile_idempotency_keys")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mobile_idempotency_keys")
    endpoint = models.CharField(max_length=255)
    key_hash = models.CharField(max_length=64)
    request_hash = models.CharField(max_length=64, blank=True)
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_json = models.JSONField(default=dict, blank=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["business", "user", "endpoint", "key_hash"], name="unique_mobile_idempotency_key"),
        ]
        indexes = [
            models.Index(fields=["business", "user", "expires_at"]),
            models.Index(fields=["endpoint", "key_hash"]),
        ]

    def __str__(self):
        return f"mobile idempotency key for {self.user_id}/{self.business_id}"
