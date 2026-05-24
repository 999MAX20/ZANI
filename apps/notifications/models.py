from django.conf import settings
from django.db import models
from django.utils import timezone

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

    class Categories(models.TextChoices):
        SALES = "sales", "Sales"
        FINANCE = "finance", "Finance"
        SYSTEM = "system", "System"
        AI_ALERTS = "ai_alerts", "AI alerts"
        OUTREACH = "outreach", "Outreach"
        TASKS = "tasks", "Tasks"

    class Priorities(models.TextChoices):
        LOW = "low", "Low"
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="notifications")
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
        help_text="Empty recipient means a business-wide notification.",
    )
    client = models.ForeignKey(Client, on_delete=models.PROTECT, null=True, blank=True, related_name="notifications")
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    channel = models.CharField(max_length=32, choices=Channels.choices, default=Channels.SYSTEM)
    category = models.CharField(max_length=32, choices=Categories.choices, default=Categories.SYSTEM)
    priority = models.CharField(max_length=32, choices=Priorities.choices, default=Priorities.NORMAL)
    text = models.TextField()
    send_at = models.DateTimeField()
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.PENDING)
    action_url = models.CharField(max_length=255, blank=True)
    action_label = models.CharField(max_length=64, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["read_at", "-send_at"]
        indexes = [
            models.Index(fields=["business", "status", "read_at", "send_at"]),
            models.Index(fields=["business", "category", "priority"]),
            models.Index(fields=["business", "recipient", "read_at"]),
        ]

    def __str__(self):
        return f"{self.channel} notification for {self.client or self.business}"

    @property
    def is_read(self):
        return self.read_at is not None

    def mark_read(self):
        if self.read_at is None:
            self.read_at = timezone.now()
            self.save(update_fields=["read_at", "updated_at"])

    def mark_unread(self):
        if self.read_at is not None:
            self.read_at = None
            self.save(update_fields=["read_at", "updated_at"])
