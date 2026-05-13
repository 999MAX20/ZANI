from django.conf import settings
from django.db import models

from apps.businesses.models import Business, TimeStampedModel
from apps.clients.models import Client
from apps.services.models import Service


class Lead(TimeStampedModel):
    class Statuses(models.TextChoices):
        NEW = "new", "New"
        IN_PROGRESS = "in_progress", "In progress"
        APPOINTMENT_CREATED = "appointment_created", "Appointment created"
        CONTACTED = "contacted", "Contacted"
        CLOSED = "closed", "Closed"
        LOST = "lost", "Lost"

    class Sources(models.TextChoices):
        WEBSITE = "website", "Website"
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        INSTAGRAM = "instagram", "Instagram"
        MANUAL = "manual", "Manual"
        PARSER = "parser", "Parser"
        OTHER = "other", "Other"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="leads")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="leads")
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name="leads")
    source = models.CharField(max_length=32, choices=Sources.choices, default=Sources.MANUAL)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.NEW)
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_leads",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Lead #{self.pk} - {self.client}"
