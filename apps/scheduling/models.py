from django.conf import settings
from django.db import models

from apps.businesses.models import Business, TimeStampedModel
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.services.models import Service


class Resource(TimeStampedModel):
    class ResourceTypes(models.TextChoices):
        STAFF = "staff", "Staff"
        ROOM = "room", "Room"
        HALL = "hall", "Hall"
        BOX = "box", "Box"
        EQUIPMENT = "equipment", "Equipment"
        OTHER = "other", "Other"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="resources")
    name = models.CharField(max_length=255)
    resource_type = models.CharField(max_length=32, choices=ResourceTypes.choices, default=ResourceTypes.STAFF)
    linked_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheduled_resources",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["business", "linked_user"], name="sched_res_bus_user_idx"),
        ]

    def __str__(self):
        return self.name


class WorkingHours(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="working_hours")
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, null=True, blank=True, related_name="working_hours")
    weekday = models.PositiveSmallIntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_day_off = models.BooleanField(default=False)

    class Meta:
        ordering = ["weekday", "start_time"]
        constraints = [
            models.UniqueConstraint(fields=["business", "resource", "weekday"], name="unique_working_hours_per_resource_day"),
        ]

    def __str__(self):
        target = self.resource or self.business
        return f"{target}: {self.weekday} {self.start_time}-{self.end_time}"


class Appointment(TimeStampedModel):
    class Statuses(models.TextChoices):
        CREATED = "created", "Created"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        RESCHEDULED = "rescheduled", "Rescheduled"
        COMPLETED = "completed", "Completed"
        NO_SHOW = "no_show", "No show"

    class Sources(models.TextChoices):
        WEBSITE = "website", "Website"
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        INSTAGRAM = "instagram", "Instagram"
        MANUAL = "manual", "Manual"
        BOT = "bot", "Bot"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="appointments")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="appointments")
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name="appointments")
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="appointments")
    resource = models.ForeignKey(Resource, on_delete=models.SET_NULL, null=True, blank=True, related_name="appointments")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.CREATED)
    source = models.CharField(max_length=32, choices=Sources.choices, default=Sources.MANUAL)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="archived_appointments",
    )
    archive_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-start_at"]
        indexes = [
            models.Index(fields=["business", "start_at", "end_at"]),
            models.Index(fields=["resource", "start_at", "end_at"]),
            models.Index(fields=["business", "is_archived", "start_at"]),
        ]

    def __str__(self):
        return f"{self.client} at {self.start_at}"


class AppointmentMessageSetting(TimeStampedModel):
    class Scenarios(models.TextChoices):
        CONFIRMATION = "confirmation", "Confirmation"
        REMINDER = "reminder", "Reminder"
        THANK_YOU = "thank_you", "Thank you"

    class ChannelPolicies(models.TextChoices):
        AUTO = "auto", "Auto"
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"
        SYSTEM = "system", "System"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="appointment_message_settings")
    scenario = models.CharField(max_length=32, choices=Scenarios.choices)
    label = models.CharField(max_length=120)
    is_enabled = models.BooleanField(default=True)
    offset_minutes = models.IntegerField()
    channel_policy = models.CharField(max_length=32, choices=ChannelPolicies.choices, default=ChannelPolicies.AUTO)
    template_text = models.TextField()

    class Meta:
        ordering = ["scenario"]
        constraints = [
            models.UniqueConstraint(fields=["business", "scenario"], name="unique_appointment_message_scenario"),
        ]

    def __str__(self):
        return f"{self.business}: {self.scenario}"
