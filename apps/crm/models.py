from django.conf import settings
from django.db import models

from apps.businesses.models import Business, TimeStampedModel
from apps.clients.models import Client
from apps.leads.models import Lead


class Pipeline(TimeStampedModel):
    class EntityTypes(models.TextChoices):
        DEAL = "deal", "Deal"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="pipelines")
    name = models.CharField(max_length=255)
    slug = models.SlugField()
    entity_type = models.CharField(max_length=32, choices=EntityTypes.choices, default=EntityTypes.DEAL)
    is_default = models.BooleanField(default=False)
    template_key = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["business", "slug"], name="unique_pipeline_slug_per_business"),
        ]

    def __str__(self):
        return self.name


class PipelineStage(TimeStampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="pipeline_stages")
    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name="stages")
    name = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    color = models.CharField(max_length=24, default="#2563eb")
    probability = models.PositiveSmallIntegerField(default=0)
    sla_minutes = models.PositiveIntegerField(null=True, blank=True)
    required_fields_json = models.JSONField(default=dict, blank=True)
    allowed_roles_json = models.JSONField(default=dict, blank=True)
    is_won = models.BooleanField(default=False)
    is_lost = models.BooleanField(default=False)

    class Meta:
        ordering = ["pipeline", "order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["pipeline", "name"], name="unique_stage_name_per_pipeline"),
        ]
        indexes = [
            models.Index(fields=["business", "pipeline", "order"]),
        ]

    def __str__(self):
        return f"{self.pipeline}: {self.name}"


class Deal(TimeStampedModel):
    class Statuses(models.TextChoices):
        OPEN = "open", "Open"
        WON = "won", "Won"
        LOST = "lost", "Lost"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="deals")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="deals")
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name="deals")
    pipeline = models.ForeignKey(Pipeline, on_delete=models.PROTECT, related_name="deals")
    stage = models.ForeignKey(PipelineStage, on_delete=models.PROTECT, related_name="deals")
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="KZT")
    probability = models.PositiveSmallIntegerField(default=0)
    expected_close_at = models.DateField(null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_deals",
    )
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.OPEN)
    source = models.CharField(max_length=64, blank=True)
    lost_reason = models.TextField(blank=True)
    lost_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lost_deals",
    )
    won_at = models.DateTimeField(null=True, blank=True)
    lost_at = models.DateTimeField(null=True, blank=True)
    previous_status = models.CharField(max_length=32, blank=True)
    previous_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="previous_deals",
    )
    stage_entered_at = models.DateTimeField(null=True, blank=True)
    next_action_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="archived_deals",
    )
    archive_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["business", "pipeline", "stage"]),
            models.Index(fields=["business", "status", "updated_at"]),
            models.Index(fields=["business", "is_archived", "updated_at"]),
            models.Index(fields=["owner", "updated_at"]),
        ]

    def __str__(self):
        return self.title


class StageTransition(TimeStampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="stage_transitions")
    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name="transitions")
    from_stage = models.ForeignKey(PipelineStage, on_delete=models.CASCADE, related_name="outgoing_transitions")
    to_stage = models.ForeignKey(PipelineStage, on_delete=models.CASCADE, related_name="incoming_transitions")
    required_permission = models.CharField(max_length=128, blank=True)
    conditions = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["pipeline", "from_stage__order", "to_stage__order"]
        constraints = [
            models.UniqueConstraint(fields=["pipeline", "from_stage", "to_stage"], name="unique_pipeline_transition"),
        ]

    def __str__(self):
        return f"{self.from_stage} -> {self.to_stage}"
