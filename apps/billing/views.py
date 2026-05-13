from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet, ViewSet

from apps.billing.models import Subscription, SubscriptionPlan
from apps.billing.serializers import SubscriptionPlanSerializer, SubscriptionSerializer
from apps.billing.usage import usage_summary
from apps.core.permissions import accessible_businesses


class SubscriptionPlanViewSet(ReadOnlyModelViewSet):
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return SubscriptionPlan.objects.filter(is_active=True)


class CurrentSubscriptionViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        business = accessible_businesses(request.user).first()
        if not business:
            return Response(None)

        subscription = (
            Subscription.objects.select_related("business", "plan")
            .filter(business=business)
            .first()
        )
        if not subscription:
            return Response(None)

        return Response(SubscriptionSerializer(subscription).data)


class UsageSummaryViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        business = accessible_businesses(request.user).first()
        if not business:
            return Response([])
        return Response(usage_summary(business))
