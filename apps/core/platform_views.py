from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.ai_core.models import AIRequestLog
from apps.billing.models import Subscription
from apps.billing.usage import usage_summary
from apps.bots.models import Bot, BotChannel, BotConversation
from apps.businesses.models import Business
from apps.core.permissions import IsPlatformUser


@api_view(["GET"])
@permission_classes([IsPlatformUser])
def platform_overview(request):
    since = timezone.now() - timedelta(days=30)
    active_subscriptions = Subscription.objects.filter(status=Subscription.Statuses.ACTIVE)
    mrr = active_subscriptions.aggregate(total=Sum("plan__monthly_price"))["total"] or 0

    return Response(
        {
            "total_businesses": Business.objects.count(),
            "active_businesses": Business.objects.filter(status=Business.Statuses.ACTIVE).count(),
            "trial_businesses": Business.objects.filter(status=Business.Statuses.TRIAL).count(),
            "active_subscriptions": active_subscriptions.count(),
            "mrr_estimate": str(mrr),
            "total_users": get_user_model().objects.count(),
            "bot_count": Bot.objects.count(),
            "active_bot_channels": BotChannel.objects.filter(status=BotChannel.Statuses.ACTIVE).count(),
            "ai_requests_30d": AIRequestLog.objects.filter(created_at__gte=since).count(),
            "conversations_30d": BotConversation.objects.filter(created_at__gte=since).count(),
            "errors": {"count": 0, "items": []},
        }
    )


@api_view(["GET"])
@permission_classes([IsPlatformUser])
def platform_merchants(request):
    businesses = (
        Business.objects.select_related("owner", "subscription", "subscription__plan")
        .order_by("-created_at", "name")
    )
    data = []

    for business in businesses:
        subscription = getattr(business, "subscription", None)
        plan = subscription.plan if subscription else None
        data.append(
            {
                "id": business.id,
                "name": business.name,
                "status": business.status,
                "created_at": business.created_at,
                "owner": {
                    "id": business.owner_id,
                    "email": business.owner.email,
                    "full_name": business.owner.full_name,
                },
                "plan": {
                    "id": plan.id,
                    "name": plan.name,
                    "code": plan.code,
                    "monthly_price": str(plan.monthly_price),
                }
                if plan
                else None,
                "subscription_status": subscription.status if subscription else None,
                "usage_summary": usage_summary(business),
            }
        )

    return Response(data)
