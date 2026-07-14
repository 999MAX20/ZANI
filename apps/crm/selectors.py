from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.core.work_queues import no_next_action_deals_queryset, sla_overdue_deals_queryset
from apps.crm.models import Deal


MONEY_QUANT = Decimal("0.01")


def stale_deals_queryset(queryset, *, now=None):
    now = now or timezone.now()
    open_deals = queryset.filter(status=Deal.Statuses.OPEN)
    sla_overdue_ids = sla_overdue_deals_queryset(open_deals, now=now).values_list("id", flat=True)
    no_next_action_ids = no_next_action_deals_queryset(open_deals).values_list("id", flat=True)
    return (
        open_deals.filter(
            Q(id__in=sla_overdue_ids)
            | Q(id__in=no_next_action_ids)
            | Q(expected_close_at__lt=now.date())
        )
        .distinct()
        .order_by("expected_close_at", "stage_entered_at", "-updated_at")
    )


def build_deal_summary(queryset, *, user=None, now=None):
    now = now or timezone.now()
    open_deals = queryset.filter(status=Deal.Statuses.OPEN)
    won_deals = queryset.filter(status=Deal.Statuses.WON)
    lost_deals = queryset.filter(status=Deal.Statuses.LOST)
    overdue_deals = sla_overdue_deals_queryset(open_deals, now=now)
    no_task_deals = no_next_action_deals_queryset(open_deals)
    stale_deals = stale_deals_queryset(queryset, now=now)

    total_count = queryset.count()
    open_count = open_deals.count()
    won_count = won_deals.count()
    lost_count = lost_deals.count()
    closed_count = won_count + lost_count

    open_value = _money(open_deals.aggregate(value=Sum("amount"))["value"])
    won_value = _money(won_deals.aggregate(value=Sum("amount"))["value"])
    lost_value = _money(lost_deals.aggregate(value=Sum("amount"))["value"])

    aggregate_queryset = queryset.order_by()
    by_status = {status: 0 for status, _label in Deal.Statuses.choices}
    by_status.update({item["status"]: item["count"] for item in aggregate_queryset.values("status").annotate(count=Count("id", distinct=True))})

    return {
        "total": total_count,
        "open": open_count,
        "won": won_count,
        "lost": lost_count,
        "open_value": open_value,
        "won_value": won_value,
        "lost_value": lost_value,
        "lost_count": lost_count,
        "conversion_rate": _rate(won_count, closed_count),
        "stale_deals": stale_deals.count(),
        "pipeline_value": open_value,
        "expected_revenue": _expected_revenue(open_deals),
        "overdue": overdue_deals.count(),
        "no_tasks": no_task_deals.distinct().count(),
        "hot": stale_deals.count(),
        "mine": queryset.filter(owner=user).count() if user and getattr(user, "is_authenticated", False) else 0,
        "by_status": by_status,
        "by_source": {item["source"] or "manual": item["count"] for item in aggregate_queryset.values("source").annotate(count=Count("id", distinct=True))},
        "by_stage": {str(item["stage"]): item["count"] for item in aggregate_queryset.values("stage").annotate(count=Count("id", distinct=True))},
    }


def _money(value):
    value = value or Decimal("0")
    return str(value.quantize(MONEY_QUANT))


def _rate(numerator, denominator):
    if not denominator:
        return 0
    return round((numerator / denominator) * 100, 2)


def _expected_revenue(open_deals):
    total = Decimal("0")
    for deal in open_deals.select_related("stage"):
        probability = deal.probability or getattr(deal.stage, "probability", 0) or 0
        total += (deal.amount or Decimal("0")) * Decimal(probability) / Decimal("100")
    return _money(total)
