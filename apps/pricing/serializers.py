from rest_framework import serializers

from apps.businesses.models import Business
from apps.integrations.sanitization import sanitize_config, sanitize_error_text
from apps.pricing.models import KaspiCompetitorOffer, KaspiPriceChangeLog, KaspiPricingAlert, KaspiPricingControl, KaspiPricingRecommendation, KaspiPricingRule, PricingCatalogItem


class PricingCatalogItemSerializer(serializers.ModelSerializer):
    rule_id = serializers.SerializerMethodField()
    rule_mode = serializers.SerializerMethodField()

    class Meta:
        model = PricingCatalogItem
        fields = [
            "id",
            "business",
            "source",
            "external_id",
            "sku",
            "name",
            "current_price",
            "stock_quantity",
            "payload_json",
            "last_seen_at",
            "rule_id",
            "rule_mode",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_rule_id(self, obj):
        rule = getattr(obj, "_pricing_rule", None)
        if rule is None:
            rule = KaspiPricingRule.objects.filter(business=obj.business, product_sku=obj.sku).first()
        return rule.id if rule else None

    def get_rule_mode(self, obj):
        rule = getattr(obj, "_pricing_rule", None)
        if rule is None:
            rule = KaspiPricingRule.objects.filter(business=obj.business, product_sku=obj.sku).first()
        return rule.mode if rule else ""


class KaspiPricingRuleSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source="business.name", read_only=True)

    class Meta:
        model = KaspiPricingRule
        fields = [
            "id",
            "business",
            "business_name",
            "product_sku",
            "product_name",
            "kaspi_product_id",
            "current_price",
            "min_price",
            "step_amount",
            "mode",
            "status",
            "max_changes_per_day",
            "config_json",
            "last_checked_at",
            "last_recommended_price",
            "last_applied_price",
            "last_error",
            "autopilot_confirmed_at",
            "autopilot_confirmed_by",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_by",
            "last_checked_at",
            "last_recommended_price",
            "last_applied_price",
            "last_error",
            "autopilot_confirmed_at",
            "autopilot_confirmed_by",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["config_json"] = sanitize_config(data.get("config_json") or {})
        data["last_error"] = sanitize_error_text(data.get("last_error"))
        return data

    def validate(self, attrs):
        min_price = attrs.get("min_price", getattr(self.instance, "min_price", None))
        current_price = attrs.get("current_price", getattr(self.instance, "current_price", None))
        step_amount = attrs.get("step_amount", getattr(self.instance, "step_amount", None))
        if min_price is not None and min_price < 0:
            raise serializers.ValidationError("Minimum price must be positive.")
        if current_price is not None and current_price < 0:
            raise serializers.ValidationError("Current price must be positive.")
        if step_amount is not None and step_amount <= 0:
            raise serializers.ValidationError("Step amount must be greater than zero.")
        mode = attrs.get("mode", getattr(self.instance, "mode", KaspiPricingRule.Modes.RECOMMEND))
        previous_mode = getattr(self.instance, "mode", None)
        if mode == KaspiPricingRule.Modes.AUTOPILOT and previous_mode != KaspiPricingRule.Modes.AUTOPILOT:
            raise serializers.ValidationError("Autopilot must be enabled through the safety confirmation action.")
        return attrs


class KaspiCompetitorOfferSerializer(serializers.ModelSerializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all(), required=False)

    class Meta:
        model = KaspiCompetitorOffer
        fields = ["id", "business", "rule", "competitor_name", "competitor_merchant_id", "price", "position", "available", "payload_json", "observed_at", "created_at"]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        rule = attrs.get("rule") or getattr(self.instance, "rule", None)
        business = attrs.get("business")
        if rule and business and rule.business_id != business.id:
            raise serializers.ValidationError("Offer business must match pricing rule business.")
        return attrs


class KaspiPricingRecommendationSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="rule.product_sku", read_only=True)
    product_name = serializers.CharField(source="rule.product_name", read_only=True)

    class Meta:
        model = KaspiPricingRecommendation
        fields = [
            "id",
            "business",
            "rule",
            "product_sku",
            "product_name",
            "current_price",
            "competitor_price",
            "target_price",
            "min_price",
            "delta",
            "reason",
            "status",
            "decision_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class KaspiPriceChangeLogSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="rule.product_sku", read_only=True)
    product_name = serializers.CharField(source="rule.product_name", read_only=True)

    class Meta:
        model = KaspiPriceChangeLog
        fields = [
            "id",
            "business",
            "rule",
            "product_sku",
            "product_name",
            "recommendation",
            "old_price",
            "new_price",
            "status",
            "mode",
            "provider_response_json",
            "error",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class KaspiPricingControlSerializer(serializers.ModelSerializer):
    stopped_by_name = serializers.CharField(source="stopped_by.full_name", read_only=True)

    class Meta:
        model = KaspiPricingControl
        fields = [
            "id",
            "business",
            "emergency_stop_enabled",
            "emergency_stop_reason",
            "stopped_at",
            "stopped_by",
            "stopped_by_name",
            "resumed_at",
            "resumed_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class KaspiPricingAlertSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="rule.product_sku", read_only=True)

    class Meta:
        model = KaspiPricingAlert
        fields = [
            "id",
            "business",
            "rule",
            "product_sku",
            "change_log",
            "alert_type",
            "severity",
            "status",
            "title",
            "message",
            "payload_json",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = fields


class KaspiEmergencyStopSerializer(serializers.Serializer):
    business = serializers.IntegerField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True)


class KaspiRecommendationCreateSerializer(serializers.Serializer):
    competitor_price = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    competitor_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    observed_payload = serializers.JSONField(required=False)


class KaspiRecommendationApplySerializer(serializers.Serializer):
    force = serializers.BooleanField(default=False, required=False)


class KaspiPricingRuleBulkUpdateSerializer(serializers.Serializer):
    rule_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1, max_length=500)
    status = serializers.ChoiceField(choices=KaspiPricingRule.Statuses.values, required=False)
    min_price = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    step_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    max_changes_per_day = serializers.IntegerField(min_value=1, required=False)
    disable_autopilot = serializers.BooleanField(default=False, required=False)

    def validate(self, attrs):
        if not any(key in attrs for key in ["status", "min_price", "step_amount", "max_changes_per_day"]) and not attrs.get("disable_autopilot"):
            raise serializers.ValidationError("At least one bulk update field is required.")
        return attrs


class KaspiAutopilotEnableSerializer(serializers.Serializer):
    confirm_min_price = serializers.BooleanField()
    confirm_daily_limit = serializers.BooleanField()
    confirm_monitoring = serializers.BooleanField()
    confirm_writeback_risk = serializers.BooleanField()

    def validate(self, attrs):
        missing = [key for key, value in attrs.items() if value is not True]
        if missing:
            raise serializers.ValidationError("All autopilot safety confirmations are required.")
        return attrs


class PricingCatalogRuleCreateSerializer(serializers.Serializer):
    min_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    current_price = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    step_amount = serializers.DecimalField(max_digits=10, decimal_places=2, default="1.00", required=False)
    mode = serializers.ChoiceField(choices=[KaspiPricingRule.Modes.RECOMMEND, KaspiPricingRule.Modes.APPROVAL], default=KaspiPricingRule.Modes.APPROVAL, required=False)
    max_changes_per_day = serializers.IntegerField(min_value=1, default=3, required=False)


class PricingCatalogBulkRuleCreateSerializer(serializers.Serializer):
    item_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1, max_length=500)
    min_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    step_amount = serializers.DecimalField(max_digits=10, decimal_places=2, default="1.00", required=False)
    mode = serializers.ChoiceField(choices=[KaspiPricingRule.Modes.RECOMMEND, KaspiPricingRule.Modes.APPROVAL], default=KaspiPricingRule.Modes.APPROVAL, required=False)
    max_changes_per_day = serializers.IntegerField(min_value=1, default=3, required=False)
