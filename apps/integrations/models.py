from django.db import models

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
