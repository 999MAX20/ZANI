from django.conf import settings
from django.db import models

from apps.activities.models import Segment
from apps.businesses.models import Business, TimeStampedModel
from apps.clients.models import Client
from apps.notifications.models import Notification


class OutreachTemplate(TimeStampedModel):
    class Channels(models.TextChoices):
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="outreach_templates")
    name = models.CharField(max_length=160)
    channel = models.CharField(max_length=32, choices=Channels.choices)
    body = models.TextField()
    external_template_name = models.CharField(max_length=160, blank=True)
    language_code = models.CharField(max_length=16, default="ru")
    is_approved = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_outreach_templates")

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["business", "channel", "is_active"]),
        ]

    def __str__(self):
        return self.name


class OutreachCampaign(TimeStampedModel):
    class Channels(models.TextChoices):
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"

    class Statuses(models.TextChoices):
        DRAFT = "draft", "Draft"
        READY = "ready", "Ready"
        SCHEDULED = "scheduled", "Scheduled"
        RUNNING = "running", "Running"
        SENT = "sent", "Sent"
        CANCELLED = "cancelled", "Cancelled"

    class AudienceTypes(models.TextChoices):
        ALL_CLIENTS = "all_clients", "All clients"
        SEGMENT = "segment", "Segment"
        MANUAL = "manual", "Manual"

    class CampaignTypes(models.TextChoices):
        SERVICE = "service", "Service"
        MARKETING = "marketing", "Marketing"
        TRANSACTIONAL = "transactional", "Transactional"

    class TemplateStatuses(models.TextChoices):
        NOT_REQUIRED = "not_required", "Not required"
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="outreach_campaigns")
    name = models.CharField(max_length=180)
    channel = models.CharField(max_length=32, choices=Channels.choices)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.DRAFT)
    campaign_type = models.CharField(max_length=32, choices=CampaignTypes.choices, default=CampaignTypes.SERVICE)
    audience_type = models.CharField(max_length=32, choices=AudienceTypes.choices, default=AudienceTypes.ALL_CLIENTS)
    segment = models.ForeignKey(Segment, on_delete=models.SET_NULL, null=True, blank=True, related_name="outreach_campaigns")
    template = models.ForeignKey(OutreachTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name="campaigns")
    message_text = models.TextField()
    require_opt_in = models.BooleanField(default=True)
    whatsapp_template_name = models.CharField(max_length=160, blank=True)
    whatsapp_template_language = models.CharField(max_length=16, default="ru")
    whatsapp_template_status = models.CharField(max_length=32, choices=TemplateStatuses.choices, default=TemplateStatuses.NOT_REQUIRED)
    rate_limit_per_minute = models.PositiveIntegerField(default=60)
    batch_size = models.PositiveIntegerField(default=100)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_outreach_campaigns")
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["business", "status", "channel"]),
            models.Index(fields=["business", "audience_type"]),
            models.Index(fields=["business", "campaign_type"]),
        ]

    def __str__(self):
        return self.name


class OutreachRecipient(TimeStampedModel):
    class Statuses(models.TextChoices):
        QUEUED = "queued", "Queued"
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"
        CANCELLED = "cancelled", "Cancelled"

    campaign = models.ForeignKey(OutreachCampaign, on_delete=models.CASCADE, related_name="recipients")
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="outreach_recipients")
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="outreach_recipients")
    notification = models.ForeignKey(Notification, on_delete=models.SET_NULL, null=True, blank=True, related_name="outreach_recipients")
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.QUEUED)
    recipient_id = models.CharField(max_length=128, blank=True)
    personalized_text = models.TextField(blank=True)
    error = models.TextField(blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    provider_result = models.JSONField(default=dict, blank=True)
    skipped_reason = models.CharField(max_length=160, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["campaign", "client_id"]
        constraints = [
            models.UniqueConstraint(fields=["campaign", "client"], name="unique_outreach_recipient_per_campaign_client"),
        ]
        indexes = [
            models.Index(fields=["business", "status"]),
            models.Index(fields=["campaign", "status"]),
        ]

    def __str__(self):
        return f"{self.campaign_id}: {self.client_id}"


class OutreachConsent(TimeStampedModel):
    class Channels(models.TextChoices):
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"

    class Statuses(models.TextChoices):
        OPTED_IN = "opted_in", "Opted in"
        OPTED_OUT = "opted_out", "Opted out"
        UNKNOWN = "unknown", "Unknown"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="outreach_consents")
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="outreach_consents")
    channel = models.CharField(max_length=32, choices=Channels.choices)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.UNKNOWN)
    source = models.CharField(max_length=96, blank=True)
    note = models.TextField(blank=True)
    evidence_json = models.JSONField(default=dict, blank=True)
    opted_in_at = models.DateTimeField(null=True, blank=True)
    opted_out_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["client_id", "channel"]
        constraints = [
            models.UniqueConstraint(fields=["business", "client", "channel"], name="unique_outreach_consent_per_client_channel"),
        ]
        indexes = [
            models.Index(fields=["business", "channel", "status"]),
        ]

    def __str__(self):
        return f"{self.client_id}: {self.channel} {self.status}"
