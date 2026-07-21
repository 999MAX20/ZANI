import uuid

from django.db import models
from django.conf import settings

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

    class Priorities(models.TextChoices):
        LOW = "low", "Low"
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="bot_conversations")
    bot = models.ForeignKey(Bot, on_delete=models.CASCADE, related_name="conversations")
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    channel = models.CharField(max_length=32, choices=Channels.choices)
    external_user_id = models.CharField(max_length=255, blank=True)
    external_thread_id = models.CharField(max_length=255, blank=True)
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="bot_conversations")
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name="bot_conversations")
    deal = models.ForeignKey("crm.Deal", on_delete=models.SET_NULL, null=True, blank=True, related_name="bot_conversations")
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_bot_conversations")
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.OPEN)
    priority = models.CharField(max_length=32, choices=Priorities.choices, default=Priorities.NORMAL)
    bot_enabled = models.BooleanField(default=True)
    handoff_required = models.BooleanField(default=False)
    handoff_reason = models.TextField(blank=True)
    close_reason = models.TextField(blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    last_inbound_at = models.DateTimeField(null=True, blank=True)
    last_outbound_at = models.DateTimeField(null=True, blank=True)
    unread_count = models.PositiveIntegerField(default=0)
    metadata_json = models.JSONField(default=dict, blank=True)
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="archived_bot_conversations")
    archive_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["business", "status", "is_archived", "updated_at"]),
            models.Index(fields=["business", "assigned_to", "status", "updated_at"]),
            models.Index(fields=["business", "handoff_required", "last_inbound_at"]),
        ]

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

    class SenderTypes(models.TextChoices):
        CLIENT = "client", "Client"
        BOT = "bot", "Bot"
        MANAGER = "manager", "Manager"
        SYSTEM = "system", "System"
        AI = "ai", "AI"

    conversation = models.ForeignKey(BotConversation, on_delete=models.CASCADE, related_name="messages")
    direction = models.CharField(max_length=32, choices=Directions.choices)
    sender_type = models.CharField(max_length=32, choices=SenderTypes.choices, default=SenderTypes.CLIENT)
    text = models.TextField(blank=True)
    external_message_id = models.CharField(max_length=255, blank=True)
    payload_json = models.JSONField(default=dict, blank=True)
    error_text = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.RECEIVED)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["conversation", "created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "direction", "external_message_id"],
                condition=~models.Q(external_message_id=""),
                name="unique_bot_message_external_delivery",
            ),
        ]

    def __str__(self):
        return f"{self.direction}: {self.text[:50]}"
