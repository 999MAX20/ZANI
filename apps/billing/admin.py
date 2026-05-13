from django.contrib import admin

from apps.billing.models import Subscription, SubscriptionPlan, UsageCounter


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


@admin.register(UsageCounter)
class UsageCounterAdmin(admin.ModelAdmin):
    list_display = ("business", "metric", "value", "period_start", "period_end")
    list_filter = ("metric", "period_start", "period_end")
    search_fields = ("business__name",)
