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
