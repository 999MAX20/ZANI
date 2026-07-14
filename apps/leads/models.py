from django.conf import settings
from django.db import models
from django.db.models import Q
import uuid

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
        LANDING = "landing", "Landing"
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
    previous_status = models.CharField(max_length=32, blank=True)
    lost_reason = models.TextField(blank=True)
    lost_at = models.DateTimeField(null=True, blank=True)
    lost_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lost_leads",
    )
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_leads",
    )
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="archived_leads",
    )
    archive_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "status", "is_archived"]),
        ]

    def __str__(self):
        return f"Lead #{self.pk} - {self.client}"


class LeadForm(TimeStampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="lead_forms")
    name = models.CharField(max_length=255)
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    landing_id = models.CharField(max_length=128, blank=True, db_index=True)
    landing_domain = models.CharField(max_length=255, blank=True)
    preview_url = models.URLField(blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=32, choices=Lead.Sources.choices, default=Lead.Sources.WEBSITE)
    success_message = models.CharField(max_length=255, default="Спасибо! Мы скоро свяжемся с вами.")
    default_responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_lead_forms",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "is_active", "created_at"]),
            models.Index(fields=["public_id", "is_active"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["landing_id"],
                condition=~Q(landing_id=""),
                name="unique_active_lead_form_landing_id",
            ),
        ]

    def __str__(self):
        return f"{self.business}: {self.name}"


class LeadFormField(TimeStampedModel):
    class FieldTypes(models.TextChoices):
        TEXT = "text", "Text"
        TEXTAREA = "textarea", "Textarea"
        PHONE = "phone", "Phone"
        EMAIL = "email", "Email"
        SELECT = "select", "Select"

    form = models.ForeignKey(LeadForm, on_delete=models.CASCADE, related_name="fields")
    label = models.CharField(max_length=128)
    key = models.SlugField(max_length=64)
    field_type = models.CharField(max_length=32, choices=FieldTypes.choices, default=FieldTypes.TEXT)
    placeholder = models.CharField(max_length=255, blank=True)
    options_json = models.JSONField(default=dict, blank=True)
    is_required = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "label"]
        constraints = [
            models.UniqueConstraint(fields=["form", "key"], name="unique_lead_form_field_key"),
        ]

    def __str__(self):
        return f"{self.form}: {self.key}"


class LeadFormSubmission(models.Model):
    form = models.ForeignKey(LeadForm, on_delete=models.CASCADE, related_name="submissions")
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="lead_form_submissions")
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="lead_form_submissions")
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name="form_submissions")
    payload_json = models.JSONField(default=dict, blank=True)
    utm_json = models.JSONField(default=dict, blank=True)
    source_context_json = models.JSONField(default=dict, blank=True)
    duplicate_json = models.JSONField(default=dict, blank=True)
    landing_id = models.CharField(max_length=128, blank=True)
    page_url = models.URLField(blank=True)
    page_domain = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "form", "created_at"]),
            models.Index(fields=["lead", "created_at"]),
            models.Index(fields=["business", "landing_id", "created_at"]),
            models.Index(fields=["business", "page_domain", "created_at"]),
        ]

    def __str__(self):
        return f"{self.form} submission #{self.id}"


class LeadFormSubmissionError(models.Model):
    form = models.ForeignKey(LeadForm, on_delete=models.SET_NULL, null=True, blank=True, related_name="submission_errors")
    business = models.ForeignKey(Business, on_delete=models.SET_NULL, null=True, blank=True, related_name="lead_form_submission_errors")
    public_id = models.CharField(max_length=128, blank=True)
    landing_id = models.CharField(max_length=128, blank=True)
    page_url = models.URLField(blank=True)
    page_domain = models.CharField(max_length=255, blank=True)
    payload_json = models.JSONField(default=dict, blank=True)
    error_message = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "created_at"]),
            models.Index(fields=["public_id", "created_at"]),
            models.Index(fields=["landing_id", "created_at"]),
        ]

    def __str__(self):
        return f"Lead form error #{self.id}: {self.error_message[:64]}"
