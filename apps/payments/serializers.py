from decimal import Decimal

from rest_framework import serializers

from apps.businesses.access import Actions, Resources, can
from apps.businesses.capabilities import resource_is_enabled
from .models import Payment


class PaymentWriteSerializer(serializers.Serializer):
    business = serializers.IntegerField(min_value=1)
    submission_id = serializers.UUIDField()
    client = serializers.IntegerField(min_value=1, required=False)
    deal = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    appointment = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    original = serializers.IntegerField(min_value=1, required=False)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    currency = serializers.CharField(max_length=8, required=False)
    occurred_at = serializers.DateTimeField()
    method = serializers.ChoiceField(choices=Payment.Methods.choices)
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get("original"):
            if any(attrs.get(field) for field in ("client", "deal", "appointment", "currency")):
                raise serializers.ValidationError({"original": "Refund context is inherited from the receipt."})
            if not attrs.get("reason"):
                raise serializers.ValidationError({"reason": "A refund reason is required."})
        elif not attrs.get("client") or not attrs.get("currency"):
            raise serializers.ValidationError({"client": "Client and currency are required."})
        return attrs


class PaymentQuerySerializer(serializers.Serializer):
    client = serializers.IntegerField(min_value=1, required=False)
    kind = serializers.ChoiceField(choices=Payment.Kinds.choices, required=False, allow_blank=True)
    q = serializers.CharField(max_length=200, required=False, allow_blank=True)


class PaymentOptionQuerySerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["client", "deal", "appointment"])
    client = serializers.IntegerField(min_value=1, required=False)
    q = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["kind"] != "client" and not attrs.get("client"):
            raise serializers.ValidationError({"client": "Select a client first."})
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    actor_name = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    can_refund = serializers.SerializerMethodField()
    link = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ["id", "business", "client", "client_name", "kind", "original", "amount",
                  "currency", "refunded_amount", "remaining_amount", "occurred_at", "method",
                  "source", "note", "reason", "created_at", "actor_name", "can_refund", "link"]
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.created_by.full_name or obj.created_by.get_full_name() or obj.created_by.username if obj.created_by else ""

    def get_remaining_amount(self, obj):
        return str(obj.amount - obj.refunded_amount) if obj.kind == "receipt" else "0.00"

    def get_can_refund(self, obj):
        return (obj.kind == "receipt" and obj.source == "manual" and obj.refunded_amount < obj.amount
                and can(self.context["request"].user, obj.business, Resources.PAYMENTS, Actions.MANAGE, obj=obj).allowed)

    def get_link(self, obj):
        related, resource = (obj.deal, Resources.DEALS) if obj.deal_id else (obj.appointment, Resources.APPOINTMENTS)
        if not related or not resource_is_enabled(obj.business, resource):
            return None
        if not can(self.context["request"].user, obj.business, resource, Actions.VIEW, obj=related).allowed:
            return None
        return {"kind": "deal" if obj.deal_id else "appointment", "id": related.pk}
