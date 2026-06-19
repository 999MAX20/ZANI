from django.conf import settings
from django.db import models

from apps.businesses.models import Business, TimeStampedModel


class Client(TimeStampedModel):
    class Sources(models.TextChoices):
        WEBSITE = "website", "Website"
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        INSTAGRAM = "instagram", "Instagram"
        MANUAL = "manual", "Manual"
        PARSER = "parser", "Parser"
        OTHER = "other", "Other"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="clients")
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    whatsapp_id = models.CharField(max_length=128, blank=True)
    telegram_id = models.CharField(max_length=128, blank=True)
    instagram_id = models.CharField(max_length=128, blank=True)
    source = models.CharField(max_length=32, choices=Sources.choices, default=Sources.MANUAL)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="archived_clients",
    )
    archive_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "phone"]),
            models.Index(fields=["business", "is_archived", "created_at"]),
        ]

    def __str__(self):
        return self.full_name


class ClientMergeLog(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="client_merge_logs")
    target_client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="merge_logs_as_target")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="client_merge_logs")
    duplicate_snapshot = models.JSONField(default=dict)
    transferred_counts = models.JSONField(default=dict)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "target_client", "created_at"]),
            models.Index(fields=["business", "created_at"]),
        ]

    def __str__(self):
        duplicate_id = self.duplicate_snapshot.get("id", "unknown")
        return f"Client merge {duplicate_id} -> {self.target_client_id}"
