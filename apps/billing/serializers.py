from rest_framework import serializers

from apps.billing.models import Subscription, SubscriptionPlan, UsageCounter


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "name",
            "code",
            "monthly_price",
            "description",
            "is_active",
            "limits_json",
            "features_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "business",
            "plan",
            "status",
            "billing_email",
            "payment_method",
            "invoice_details_json",
            "requested_plan",
            "plan_change_requested_at",
            "started_at",
            "next_payment_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "business",
            "plan",
            "status",
            "requested_plan",
            "plan_change_requested_at",
            "started_at",
            "next_payment_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]


class UsageCounterSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsageCounter
        fields = ["id", "business", "period_start", "period_end", "metric", "value"]
        read_only_fields = fields
