from django.contrib import admin

from apps.integrations.sanitization import sanitize_error_payload, sanitize_error_text
from apps.pricing.models import KaspiCompetitorOffer, KaspiPriceChangeLog, KaspiPricingAlert, KaspiPricingControl, KaspiPricingRecommendation, KaspiPricingRule, PricingCatalogItem


class ReadOnlyLogAdminMixin:
    def has_add_permission(self, request):
        return False


@admin.register(PricingCatalogItem)
class PricingCatalogItemAdmin(admin.ModelAdmin):
    list_display = ("business", "source", "sku", "name", "current_price", "stock_quantity", "last_seen_at")
    list_filter = ("business", "source")
    search_fields = ("business__name", "source", "sku", "name", "external_id")
    readonly_fields = ("created_at", "updated_at")


@admin.register(KaspiPricingRule)
class KaspiPricingRuleAdmin(admin.ModelAdmin):
    list_display = ("business", "product_sku", "product_name", "current_price", "min_price", "mode", "status", "autopilot_confirmed_at", "updated_at")
    list_filter = ("business", "mode", "status")
    search_fields = ("business__name", "product_sku", "product_name", "kaspi_product_id")
    readonly_fields = ("last_checked_at", "last_recommended_price", "last_applied_price", "autopilot_confirmed_at", "autopilot_confirmed_by", "created_at", "updated_at")


@admin.register(KaspiPricingControl)
class KaspiPricingControlAdmin(admin.ModelAdmin):
    list_display = ("business", "emergency_stop_enabled", "stopped_at", "stopped_by", "updated_at")
    list_filter = ("emergency_stop_enabled",)
    search_fields = ("business__name", "emergency_stop_reason")
    readonly_fields = ("created_at", "updated_at")


@admin.register(KaspiCompetitorOffer)
class KaspiCompetitorOfferAdmin(admin.ModelAdmin):
    list_display = ("business", "rule", "competitor_name", "price", "position", "observed_at")
    list_filter = ("business", "available", "observed_at")
    search_fields = ("business__name", "rule__product_sku", "competitor_name")


@admin.register(KaspiPricingRecommendation)
class KaspiPricingRecommendationAdmin(admin.ModelAdmin):
    list_display = ("business", "rule", "current_price", "competitor_price", "target_price", "min_price", "status", "created_at")
    list_filter = ("business", "status", "created_at")
    search_fields = ("business__name", "rule__product_sku", "reason")
    readonly_fields = ("created_at", "updated_at")


@admin.register(KaspiPriceChangeLog)
class KaspiPriceChangeLogAdmin(ReadOnlyLogAdminMixin, admin.ModelAdmin):
    list_display = ("business", "rule", "old_price", "new_price", "status", "mode", "created_at")
    list_filter = ("business", "status", "mode", "created_at")
    search_fields = ("business__name", "rule__product_sku")
    exclude = ("provider_response_json", "error")
    readonly_fields = ("safe_provider_response_json", "safe_error", "created_at")

    def safe_provider_response_json(self, obj):
        return sanitize_error_payload(getattr(obj, "provider_response_json", {}))

    safe_provider_response_json.short_description = "Provider response (safe)"

    def safe_error(self, obj):
        return sanitize_error_text(getattr(obj, "error", ""))

    safe_error.short_description = "Error (safe)"


@admin.register(KaspiPricingAlert)
class KaspiPricingAlertAdmin(admin.ModelAdmin):
    list_display = ("business", "alert_type", "severity", "status", "title", "created_at")
    list_filter = ("alert_type", "severity", "status")
    search_fields = ("business__name", "title", "message", "rule__product_sku")
    readonly_fields = ("created_at",)
