from django.conf import settings
from django.db import models


class Payment(models.Model):
    class Kinds(models.TextChoices):
        RECEIPT = "receipt", "Receipt"
        REFUND = "refund", "Refund"

    class Methods(models.TextChoices):
        CASH = "cash", "Cash"
        CARD = "card", "Card"
        TRANSFER = "transfer", "Bank transfer"
        OTHER = "other", "Other"

    business = models.ForeignKey("businesses.Business", on_delete=models.PROTECT, related_name="client_payments")
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="payments")
    deal = models.ForeignKey("crm.Deal", null=True, blank=True, on_delete=models.PROTECT, related_name="payments")
    appointment = models.ForeignKey("scheduling.Appointment", null=True, blank=True, on_delete=models.PROTECT, related_name="payments")
    original = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="refunds")
    kind = models.CharField(max_length=16, choices=Kinds.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    refunded_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=8)
    occurred_at = models.DateTimeField()
    method = models.CharField(max_length=16, choices=Methods.choices)
    source = models.CharField(max_length=24, default="manual", editable=False)
    note = models.CharField(max_length=1000, blank=True)
    reason = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="recorded_client_payments")
    created_at = models.DateTimeField(auto_now_add=True)
    submission_id = models.UUIDField()
    request_hash = models.CharField(max_length=64, editable=False)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        indexes = [
            models.Index(fields=["business", "occurred_at", "id"]),
            models.Index(fields=["business", "client", "occurred_at"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["business", "submission_id"], name="payment_submission_unique"),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="payment_amount_positive"),
            models.CheckConstraint(condition=models.Q(refunded_amount__gte=0, refunded_amount__lte=models.F("amount")), name="payment_refund_bounded"),
            models.CheckConstraint(condition=(models.Q(kind="receipt", original__isnull=True) | models.Q(kind="refund", original__isnull=False, refunded_amount=0)), name="payment_original_matches_kind"),
            models.CheckConstraint(condition=(models.Q(deal__isnull=True) | models.Q(appointment__isnull=True)), name="payment_single_link"),
        ]
