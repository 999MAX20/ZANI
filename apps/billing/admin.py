from django.contrib import admin

from apps.billing.models import Subscription, SubscriptionPlan


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "monthly_price", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "code", "description")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("business", "plan", "status", "started_at", "next_payment_at", "cancelled_at")
    list_filter = ("status", "plan")
    search_fields = ("business__name", "plan__name", "plan__code")
