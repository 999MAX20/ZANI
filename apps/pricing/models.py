from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.businesses.models import Business


class PricingCatalogItem(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="pricing_catalog_items")
    source = models.CharField(max_length=64)
    external_id = models.CharField(max_length=160, blank=True)
    sku = models.CharField(max_length=160)
    name = models.CharField(max_length=255, blank=True)
    current_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    stock_quantity = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    payload_json = models.JSONField(default=dict, blank=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["source", "sku", "id"]
        constraints = [
            models.UniqueConstraint(fields=["business", "source", "sku"], name="unique_business_pricing_catalog_source_sku"),
        ]
        indexes = [
            models.Index(fields=["business", "source", "sku"]),
            models.Index(fields=["business", "last_seen_at"]),
        ]

    def __str__(self):
        return f"{self.business}: {self.source}/{self.sku}"


class KaspiPricingControl(models.Model):
    business = models.OneToOneField(Business, on_delete=models.CASCADE, related_name="kaspi_pricing_control")
    emergency_stop_enabled = models.BooleanField(default=False)
    emergency_stop_reason = models.TextField(blank=True)
    stopped_at = models.DateTimeField(null=True, blank=True)
    stopped_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="stopped_kaspi_pricing_controls")
    resumed_at = models.DateTimeField(null=True, blank=True)
    resumed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="resumed_kaspi_pricing_controls")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["business_id"]

    def __str__(self):
        return f"{self.business}: emergency_stop={self.emergency_stop_enabled}"


class KaspiPricingRule(models.Model):
    class Modes(models.TextChoices):
        RECOMMEND = "recommend", "Recommend"
        APPROVAL = "approval", "Approval"
        AUTOPILOT = "autopilot", "Autopilot"

    class Statuses(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        ARCHIVED = "archived", "Archived"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="kaspi_pricing_rules")
    product_sku = models.CharField(max_length=160)
    product_name = models.CharField(max_length=255, blank=True)
    kaspi_product_id = models.CharField(max_length=160, blank=True)
    current_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    min_price = models.DecimalField(max_digits=14, decimal_places=2)
    step_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    mode = models.CharField(max_length=32, choices=Modes.choices, default=Modes.RECOMMEND)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.ACTIVE)
    max_changes_per_day = models.PositiveIntegerField(default=3)
    config_json = models.JSONField(default=dict, blank=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_recommended_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    last_applied_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    last_error = models.TextField(blank=True)
    autopilot_confirmed_at = models.DateTimeField(null=True, blank=True)
    autopilot_confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="confirmed_kaspi_autopilot_rules")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_kaspi_pricing_rules")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product_sku", "id"]
        constraints = [
            models.UniqueConstraint(fields=["business", "product_sku"], name="unique_business_kaspi_pricing_sku"),
        ]
        indexes = [
            models.Index(fields=["business", "status", "mode"]),
            models.Index(fields=["business", "product_sku"]),
        ]

    def __str__(self):
        return f"{self.business}: {self.product_sku}"


class KaspiCompetitorOffer(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="kaspi_competitor_offers")
    rule = models.ForeignKey(KaspiPricingRule, on_delete=models.CASCADE, related_name="competitor_offers")
    competitor_name = models.CharField(max_length=255)
    competitor_merchant_id = models.CharField(max_length=160, blank=True)
    price = models.DecimalField(max_digits=14, decimal_places=2)
    position = models.PositiveIntegerField(default=0)
    available = models.BooleanField(default=True)
    payload_json = models.JSONField(default=dict, blank=True)
    observed_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["price", "position", "id"]
        indexes = [
            models.Index(fields=["business", "rule", "observed_at"]),
            models.Index(fields=["rule", "price"]),
        ]

    def __str__(self):
        return f"{self.rule.product_sku}: {self.competitor_name} {self.price}"


class KaspiPricingRecommendation(models.Model):
    class Statuses(models.TextChoices):
        PROPOSED = "proposed", "Proposed"
        BLOCKED = "blocked", "Blocked"
        APPROVED = "approved", "Approved"
        APPLIED = "applied", "Applied"
        SKIPPED = "skipped", "Skipped"
        FAILED = "failed", "Failed"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="kaspi_pricing_recommendations")
    rule = models.ForeignKey(KaspiPricingRule, on_delete=models.CASCADE, related_name="recommendations")
    current_price = models.DecimalField(max_digits=14, decimal_places=2)
    competitor_price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    target_price = models.DecimalField(max_digits=14, decimal_places=2)
    min_price = models.DecimalField(max_digits=14, decimal_places=2)
    delta = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.PROPOSED)
    decision_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "status", "created_at"]),
            models.Index(fields=["rule", "status"]),
        ]

    def __str__(self):
        return f"{self.rule.product_sku}: {self.current_price} -> {self.target_price}"


class KaspiPriceChangeLog(models.Model):
    class Statuses(models.TextChoices):
        SIMULATED = "simulated", "Simulated"
        QUEUED = "queued", "Queued"
        APPLIED = "applied", "Applied"
        BLOCKED = "blocked", "Blocked"
        FAILED = "failed", "Failed"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="kaspi_price_change_logs")
    rule = models.ForeignKey(KaspiPricingRule, on_delete=models.CASCADE, related_name="price_change_logs")
    recommendation = models.ForeignKey(KaspiPricingRecommendation, on_delete=models.SET_NULL, null=True, blank=True, related_name="change_logs")
    old_price = models.DecimalField(max_digits=14, decimal_places=2)
    new_price = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.SIMULATED)
    mode = models.CharField(max_length=32, blank=True)
    provider_response_json = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="kaspi_price_changes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "status", "created_at"]),
            models.Index(fields=["rule", "created_at"]),
        ]

    def __str__(self):
        return f"{self.rule.product_sku}: {self.old_price} -> {self.new_price} [{self.status}]"


class KaspiPricingAlert(models.Model):
    class Types(models.TextChoices):
        EMERGENCY_STOP = "emergency_stop", "Emergency stop"
        WRITE_FAILED = "write_failed", "Write failed"
        CHANGE_BLOCKED = "change_blocked", "Change blocked"
        MONITOR_FAILED = "monitor_failed", "Monitor failed"
        FREQUENT_CHANGES = "frequent_changes", "Frequent changes"

    class Severities(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    class Statuses(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="kaspi_pricing_alerts")
    rule = models.ForeignKey(KaspiPricingRule, on_delete=models.CASCADE, null=True, blank=True, related_name="alerts")
    change_log = models.ForeignKey(KaspiPriceChangeLog, on_delete=models.SET_NULL, null=True, blank=True, related_name="alerts")
    alert_type = models.CharField(max_length=64, choices=Types.choices)
    severity = models.CharField(max_length=32, choices=Severities.choices, default=Severities.WARNING)
    status = models.CharField(max_length=32, choices=Statuses.choices, default=Statuses.OPEN)
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    payload_json = models.JSONField(default=dict, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["status", "-created_at"]
        indexes = [
            models.Index(fields=["business", "status", "severity"]),
            models.Index(fields=["business", "alert_type", "created_at"]),
        ]

    def __str__(self):
        return f"{self.business}: {self.alert_type} [{self.status}]"
