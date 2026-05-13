from django.db import models

from apps.businesses.models import Business, TimeStampedModel
from apps.clients.models import Client


class Conversation(TimeStampedModel):
    class Channels(models.TextChoices):
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        INSTAGRAM = "instagram", "Instagram"
        WEBSITE = "website", "Website"
        MANUAL = "manual", "Manual"

    class Statuses(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"
        ARCHIVED = "archived", "Archived"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="conversations")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="conversations")
    channel = models.CharField(max_length=32, choices=Channels.choices)
    external_chat_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.OPEN)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.client} via {self.channel}"


class Message(models.Model):
    class SenderTypes(models.TextChoices):
        CLIENT = "client", "Client"
        BOT = "bot", "Bot"
        MANAGER = "manager", "Manager"
        SYSTEM = "system", "System"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender_type = models.CharField(max_length=32, choices=SenderTypes.choices)
    text = models.TextField()
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender_type}: {self.text[:50]}"
