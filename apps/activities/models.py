from django.conf import settings
from django.db import models

from apps.businesses.models import Business, TimeStampedModel
from apps.clients.models import Client


class ActivityEvent(models.Model):
    class Categories(models.TextChoices):
        CRM = "crm", "CRM"
        MESSAGE = "message", "Message"
        APPOINTMENT = "appointment", "Appointment"
        TASK = "task", "Task"
        AUTOMATION = "automation", "Automation"
        SYSTEM = "system", "System"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="activity_events")
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="activity_events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="activity_events")
    category = models.CharField(max_length=32, choices=Categories.choices, default=Categories.CRM)
    event_type = models.CharField(max_length=96)
    source = models.CharField(max_length=64, blank=True)
    entity_type = models.CharField(max_length=96, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    text = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "created_at"]),
            models.Index(fields=["business", "client", "created_at"]),
            models.Index(fields=["business", "category", "created_at"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.event_type} at {self.created_at:%Y-%m-%d %H:%M}"


class Note(TimeStampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="notes")
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name="client_notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="notes")
    entity_type = models.CharField(max_length=96, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    text = models.TextField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "client", "created_at"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return self.text[:80]


class Tag(TimeStampedModel):
    class Sources(models.TextChoices):
        MANUAL = "manual", "Manual"
        AI = "ai", "AI"
        BEHAVIOR = "behavior", "Behavior"
        AUTOMATION = "automation", "Automation"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="tags")
    name = models.CharField(max_length=64)
    color = models.CharField(max_length=24, default="#2563eb")
    source = models.CharField(max_length=32, choices=Sources.choices, default=Sources.MANUAL)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["business", "name"], name="unique_tag_name_per_business"),
        ]

    def __str__(self):
        return self.name


class TaggedObject(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="tagged_objects")
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="tagged_objects")
    entity_type = models.CharField(max_length=96)
    entity_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tag", "entity_type", "entity_id"], name="unique_tagged_object"),
        ]
        indexes = [
            models.Index(fields=["business", "entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.tag} -> {self.entity_type}#{self.entity_id}"
