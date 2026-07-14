from django.conf import settings
from django.db import models

from apps.businesses.models import Business, TimeStampedModel
from apps.clients.models import Client


class AnalyticsEvent(models.Model):
    class EventTypes(models.TextChoices):
        LEAD_CREATED = "lead_created", "Lead created"
        APPOINTMENT_CREATED = "appointment_created", "Appointment created"
        APPOINTMENT_CANCELLED = "appointment_cancelled", "Appointment cancelled"
        APPOINTMENT_COMPLETED = "appointment_completed", "Appointment completed"
        MESSAGE_RECEIVED = "message_received", "Message received"
        MESSAGE_SENT = "message_sent", "Message sent"
        FORM_SUBMITTED = "form_submitted", "Form submitted"
        WHATSAPP_CLICKED = "whatsapp_clicked", "WhatsApp clicked"
        TELEGRAM_CLICKED = "telegram_clicked", "Telegram clicked"
        PHONE_CLICKED = "phone_clicked", "Phone clicked"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="analytics_events")
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="analytics_events")
    event_type = models.CharField(max_length=64, choices=EventTypes.choices)
    source = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_type} for {self.business}"


class ReportWidget(TimeStampedModel):
    class WidgetTypes(models.TextChoices):
        KPI = "kpi", "KPI"
        TABLE = "table", "Table"
        FUNNEL = "funnel", "Funnel"
        LIST = "list", "List"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="report_widgets")
    key = models.SlugField(max_length=64)
    title = models.CharField(max_length=128)
    widget_type = models.CharField(max_length=32, choices=WidgetTypes.choices, default=WidgetTypes.KPI)
    config_json = models.JSONField(default=dict, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "title"]
        constraints = [
            models.UniqueConstraint(fields=["business", "key"], name="unique_report_widget_key_per_business"),
        ]

    def __str__(self):
        return f"{self.business}: {self.title}"


class ScheduledReport(TimeStampedModel):
    class Frequencies(models.TextChoices):
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="scheduled_reports")
    name = models.CharField(max_length=128)
    frequency = models.CharField(max_length=32, choices=Frequencies.choices, default=Frequencies.WEEKLY)
    recipients_json = models.JSONField(default=list, blank=True)
    report_config_json = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    next_run_at = models.DateTimeField(null=True, blank=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="scheduled_reports")

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["business", "is_active", "next_run_at"]),
        ]

    def __str__(self):
        return f"{self.business}: {self.name}"
