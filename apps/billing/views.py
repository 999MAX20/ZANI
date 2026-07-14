from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet, ViewSet

from apps.billing.models import Subscription, SubscriptionPlan
from apps.billing.serializers import SubscriptionPlanSerializer, SubscriptionSerializer
from apps.billing.entitlements import entitlement_summary
from apps.billing.usage import usage_summary
from apps.businesses.access import Actions, Resources, assert_can
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
        assert_can(request.user, business, Resources.BILLING, Actions.VIEW)

        subscription = (
            Subscription.objects.select_related("business", "plan")
            .filter(business=business)
            .first()
        )
        if not subscription:
            return Response(None)

        return Response(SubscriptionSerializer(subscription).data)

    def _business(self, request, action=Actions.VIEW):
        business = accessible_businesses(request.user).first()
        if not business:
            raise ValidationError("Business is required.")
        assert_can(request.user, business, Resources.BILLING, action)
        return business

    def _subscription(self, request, action=Actions.MANAGE):
        business = self._business(request, action=action)
        subscription = Subscription.objects.select_related("business", "plan", "requested_plan").filter(business=business).first()
        if not subscription:
            raise ValidationError("Subscription is required.")
        return subscription

    @action(detail=False, methods=["patch"], url_path="settings")
    def update_settings(self, request):
        subscription = self._subscription(request, action=Actions.MANAGE)
        payload = {}
        if "billing_email" in request.data:
            payload["billing_email"] = str(request.data.get("billing_email") or "").strip()
        if "payment_method" in request.data:
            payload["payment_method"] = str(request.data.get("payment_method") or "").strip()
        if "invoice_details_json" in request.data:
            details = request.data.get("invoice_details_json") or {}
            if not isinstance(details, dict):
                raise ValidationError({"invoice_details_json": "Must be an object."})
            payload["invoice_details_json"] = details
        for field, value in payload.items():
            setattr(subscription, field, value)
        if payload:
            payload["updated_at"] = timezone.now()
            subscription.save(update_fields=list(payload.keys()))
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=False, methods=["post"], url_path="change-plan")
    def change_plan(self, request):
        subscription = self._subscription(request, action=Actions.MANAGE)
        plan_id = request.data.get("plan")
        plan = SubscriptionPlan.objects.filter(id=plan_id, is_active=True).first()
        if plan is None:
            raise ValidationError({"plan": "Active plan is required."})
        subscription.requested_plan = plan
        subscription.plan_change_requested_at = timezone.now()
        subscription.save(update_fields=["requested_plan", "plan_change_requested_at", "updated_at"])
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=False, methods=["post"])
    def pause(self, request):
        subscription = self._subscription(request, action=Actions.MANAGE)
        subscription.status = Subscription.Statuses.PAUSED
        subscription.save(update_fields=["status", "updated_at"])
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=False, methods=["post"])
    def resume(self, request):
        subscription = self._subscription(request, action=Actions.MANAGE)
        subscription.status = Subscription.Statuses.ACTIVE
        subscription.cancelled_at = None
        subscription.save(update_fields=["status", "cancelled_at", "updated_at"])
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=False, methods=["post"])
    def cancel(self, request):
        subscription = self._subscription(request, action=Actions.MANAGE)
        subscription.status = Subscription.Statuses.CANCELLED
        subscription.cancelled_at = timezone.now()
        subscription.save(update_fields=["status", "cancelled_at", "updated_at"])
        return Response(SubscriptionSerializer(subscription).data)


class UsageSummaryViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        business = accessible_businesses(request.user).first()
        if not business:
            return Response([])
        assert_can(request.user, business, Resources.BILLING, Actions.VIEW)
        return Response(usage_summary(business))


class EntitlementSummaryViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        business = accessible_businesses(request.user).first()
        if not business:
            return Response([])
        assert_can(request.user, business, Resources.BILLING, Actions.VIEW)
        return Response(entitlement_summary(business))
