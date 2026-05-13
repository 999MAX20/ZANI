from django.db import models

from apps.businesses.models import Business
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
