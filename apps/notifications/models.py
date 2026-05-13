from django.db import models

from apps.businesses.models import Business, TimeStampedModel
from apps.clients.models import Client
from apps.scheduling.models import Appointment


class Notification(TimeStampedModel):
    class Channels(models.TextChoices):
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"
        SYSTEM = "system", "System"

    class Statuses(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="notifications")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="notifications")
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    channel = models.CharField(max_length=32, choices=Channels.choices, default=Channels.SYSTEM)
    text = models.TextField()
    send_at = models.DateTimeField()
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.PENDING)

    class Meta:
        ordering = ["send_at"]

    def __str__(self):
        return f"{self.channel} notification for {self.client}"
