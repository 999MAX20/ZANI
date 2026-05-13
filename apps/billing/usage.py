from datetime import date

from django.db.models import F

from apps.billing.models import Subscription, UsageCounter


def current_period(today=None):
    today = today or date.today()
    start = today.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def increment_usage(business, metric, amount=1):
    period_start, period_end = current_period()
    counter, _ = UsageCounter.objects.get_or_create(
        business=business,
        period_start=period_start,
        period_end=period_end,
        metric=metric,
        defaults={"value": 0},
    )
    UsageCounter.objects.filter(id=counter.id).update(value=F("value") + amount)
    counter.refresh_from_db(fields=["value"])
    return counter


def check_limit(business, metric):
    period_start, period_end = current_period()
    counter = UsageCounter.objects.filter(
        business=business,
        period_start=period_start,
        period_end=period_end,
        metric=metric,
    ).first()
    value = counter.value if counter else 0
    subscription = Subscription.objects.select_related("plan").filter(business=business).first()
    limit = None
    if subscription:
        limit = (subscription.plan.limits_json or {}).get(metric)
    return {
        "metric": metric,
        "value": value,
        "limit": limit,
        "is_limited": limit is not None,
        "is_over_limit": bool(limit is not None and value >= int(limit)),
        "period_start": period_start,
        "period_end": period_end,
    }


def usage_summary(business):
    return [
        check_limit(business, metric)
        for metric in [
            UsageCounter.Metrics.AI_REQUESTS,
            UsageCounter.Metrics.BOT_MESSAGES,
            UsageCounter.Metrics.USERS,
            UsageCounter.Metrics.CONVERSATIONS,
        ]
    ]
