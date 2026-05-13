import uuid

from django.db import models

from apps.businesses.models import Business, TimeStampedModel
from apps.clients.models import Client
from apps.leads.models import Lead


class Bot(TimeStampedModel):
    class Statuses(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="bots")
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.DRAFT)
    default_language = models.CharField(max_length=16, default="ru")
    settings_json = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.business})"


class BotChannel(TimeStampedModel):
    class Channels(models.TextChoices):
        WEBSITE = "website", "Website"
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        INSTAGRAM = "instagram", "Instagram"

    class Statuses(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        ERROR = "error", "Error"

    bot = models.ForeignKey(Bot, on_delete=models.CASCADE, related_name="channels")
    channel = models.CharField(max_length=32, choices=Channels.choices)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.DRAFT)
    external_id = models.CharField(max_length=255, blank=True)
    public_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    config_json = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["bot__name", "channel"]
        constraints = [
            models.UniqueConstraint(fields=["bot", "channel"], name="unique_bot_channel"),
        ]

    def __str__(self):
        return f"{self.bot} / {self.channel}"


class BotConversation(TimeStampedModel):
    class Channels(models.TextChoices):
        WEBSITE = "website", "Website"
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        INSTAGRAM = "instagram", "Instagram"

    class Statuses(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"
        ARCHIVED = "archived", "Archived"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="bot_conversations")
    bot = models.ForeignKey(Bot, on_delete=models.CASCADE, related_name="conversations")
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    channel = models.CharField(max_length=32, choices=Channels.choices)
    external_user_id = models.CharField(max_length=255, blank=True)
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="bot_conversations")
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name="bot_conversations")
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.OPEN)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.bot} conversation via {self.channel}"


class BotMessage(models.Model):
    class Directions(models.TextChoices):
        INBOUND = "inbound", "Inbound"
        OUTBOUND = "outbound", "Outbound"

    class Statuses(models.TextChoices):
        RECEIVED = "received", "Received"
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    conversation = models.ForeignKey(BotConversation, on_delete=models.CASCADE, related_name="messages")
    direction = models.CharField(max_length=32, choices=Directions.choices)
    text = models.TextField(blank=True)
    payload_json = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.RECEIVED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.direction}: {self.text[:50]}"
