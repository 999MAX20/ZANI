from django.db import models

from apps.businesses.models import Business, TimeStampedModel


class SubscriptionPlan(TimeStampedModel):
    name = models.CharField(max_length=128)
    code = models.SlugField(max_length=64, unique=True)
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    limits_json = models.JSONField(default=dict, blank=True)
    features_json = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["monthly_price", "name"]

    def __str__(self):
        return self.name


class Subscription(TimeStampedModel):
    class Statuses(models.TextChoices):
        TRIAL = "trial", "Trial"
        ACTIVE = "active", "Active"
        OVERDUE = "overdue", "Overdue"
        CANCELLED = "cancelled", "Cancelled"
        PAUSED = "paused", "Paused"

    business = models.OneToOneField(Business, on_delete=models.CASCADE, related_name="subscription")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.TRIAL)
    started_at = models.DateTimeField(null=True, blank=True)
    next_payment_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["business__name"]

    def __str__(self):
        return f"{self.business} - {self.plan} ({self.status})"
