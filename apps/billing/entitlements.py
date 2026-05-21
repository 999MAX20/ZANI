from dataclasses import dataclass
from datetime import date

from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from apps.billing.models import Subscription, UsageCounter


class EntitlementMetrics:
    AI_REQUESTS = "ai_requests"
    BOT_MESSAGES = "bot_messages"
    CONVERSATIONS = "conversations"
    USERS = "users"
    BOTS = "bots"
    AUTOMATIONS = "automations"
    STORAGE_MB = "storage_mb"


DEFAULT_PLAN_LIMITS = {
    "start": {
        EntitlementMetrics.USERS: 3,
        EntitlementMetrics.BOTS: 1,
        EntitlementMetrics.AUTOMATIONS: 3,
        EntitlementMetrics.AI_REQUESTS: 0,
        EntitlementMetrics.BOT_MESSAGES: 100,
        EntitlementMetrics.CONVERSATIONS: 50,
        EntitlementMetrics.STORAGE_MB: 100,
    },
    "growth": {
        EntitlementMetrics.USERS: 10,
        EntitlementMetrics.BOTS: 5,
        EntitlementMetrics.AUTOMATIONS: 25,
        EntitlementMetrics.AI_REQUESTS: 1000,
        EntitlementMetrics.BOT_MESSAGES: 5000,
        EntitlementMetrics.CONVERSATIONS: 1500,
        EntitlementMetrics.STORAGE_MB: 2048,
    },
    "platform": {
        EntitlementMetrics.USERS: 50,
        EntitlementMetrics.BOTS: 25,
        EntitlementMetrics.AUTOMATIONS: 250,
        EntitlementMetrics.AI_REQUESTS: 10000,
        EntitlementMetrics.BOT_MESSAGES: 50000,
        EntitlementMetrics.CONVERSATIONS: 15000,
        EntitlementMetrics.STORAGE_MB: 10240,
    },
}


def current_usage_period(today=None):
    today = today or date.today()
    start = today.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


@dataclass(frozen=True)
class EntitlementResult:
    metric: str
    value: float
    limit: int | None
    requested: float = 1
    is_limited: bool = False
    is_over_limit: bool = False
    plan_code: str | None = None

    @property
    def remaining(self):
        if self.limit is None:
            return None
        return max(0, self.limit - self.value)


def get_subscription(business):
    return Subscription.objects.select_related("plan").filter(business=business).first()


def get_plan_limits(business):
    subscription = get_subscription(business)
    if not subscription:
        return {}, None
    defaults = DEFAULT_PLAN_LIMITS.get(subscription.plan.code, {})
    return {**defaults, **(subscription.plan.limits_json or {})}, subscription.plan.code


def get_metric_limit(business, metric):
    limits, plan_code = get_plan_limits(business)
    limit = limits.get(metric)
    return (int(limit) if limit is not None else None), plan_code


def get_metric_value(business, metric):
    if metric == EntitlementMetrics.USERS:
        return business.members.filter(is_active=True).count()
    if metric == EntitlementMetrics.BOTS:
        return business.bots.count()
    if metric == EntitlementMetrics.AUTOMATIONS:
        return business.automation_rules.count()
    if metric == EntitlementMetrics.STORAGE_MB:
        from apps.billing.storage import get_storage_usage_bytes

        return round(get_storage_usage_bytes(business) / 1024 / 1024, 2)

    period_start, period_end = current_usage_period()
    value = (
        UsageCounter.objects.filter(
            business=business,
            period_start=period_start,
            period_end=period_end,
            metric=metric,
        ).aggregate(total=Sum("value")).get("total")
        or 0
    )
    return value


def check_entitlement(business, metric, requested=1):
    value = get_metric_value(business, metric)
    limit, plan_code = get_metric_limit(business, metric)
    is_limited = limit is not None
    is_over_limit = bool(is_limited and value + requested > limit)
    return EntitlementResult(
        metric=metric,
        value=value,
        limit=limit,
        requested=requested,
        is_limited=is_limited,
        is_over_limit=is_over_limit,
        plan_code=plan_code,
    )


def assert_entitlement_allows(business, metric, requested=1):
    result = check_entitlement(business, metric, requested=requested)
    if result.is_over_limit:
        raise ValidationError(
            {
                "entitlement": (
                    f"Plan limit exceeded for {metric}. "
                    f"Current usage: {result.value}, requested: {requested}, limit: {result.limit}."
                ),
                "metric": metric,
                "value": result.value,
                "limit": result.limit,
                "plan_code": result.plan_code,
            }
        )
    return result


def entitlement_summary(business):
    return [
        {
            "metric": metric,
            "value": result.value,
            "limit": result.limit,
            "remaining": result.remaining,
            "is_limited": result.is_limited,
            "is_over_limit": result.is_over_limit,
            "plan_code": result.plan_code,
        }
        for metric in [
            EntitlementMetrics.USERS,
            EntitlementMetrics.BOTS,
            EntitlementMetrics.AUTOMATIONS,
            EntitlementMetrics.AI_REQUESTS,
            EntitlementMetrics.BOT_MESSAGES,
            EntitlementMetrics.CONVERSATIONS,
            EntitlementMetrics.STORAGE_MB,
        ]
        for result in [check_entitlement(business, metric, requested=0)]
    ]
