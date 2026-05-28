from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Exists, OuterRef, Q
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.businesses.access import Actions, Resources, assert_can
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.core.viewsets import TenantModelViewSet
from apps.pricing.models import KaspiCompetitorOffer, KaspiPriceChangeLog, KaspiPricingAlert, KaspiPricingControl, KaspiPricingRecommendation, KaspiPricingRule
from apps.pricing.models import PricingCatalogItem
from apps.pricing.serializers import (
    KaspiAutopilotEnableSerializer,
    KaspiCompetitorOfferSerializer,
    KaspiEmergencyStopSerializer,
    KaspiPriceChangeLogSerializer,
    KaspiPricingAlertSerializer,
    KaspiPricingControlSerializer,
    KaspiPricingRecommendationSerializer,
    KaspiPricingRuleBulkUpdateSerializer,
    KaspiPricingRuleSerializer,
    KaspiRecommendationApplySerializer,
    KaspiRecommendationCreateSerializer,
    PricingCatalogItemSerializer,
    PricingCatalogBulkRuleCreateSerializer,
    PricingCatalogRuleCreateSerializer,
)
from apps.pricing.services import apply_kaspi_recommendation, create_kaspi_recommendation, create_pricing_rule_from_catalog_item, sync_pricing_catalog_from_events
from apps.pricing.services import get_pricing_control, set_pricing_emergency_stop
from apps.pricing.services import collect_kaspi_competitor_offers


class PricingCatalogItemViewSet(TenantModelViewSet):
    queryset = PricingCatalogItem.objects.select_related("business")
    serializer_class = PricingCatalogItemSerializer
    access_resource = Resources.INTEGRATIONS

    def get_queryset(self):
        queryset = super().get_queryset()
        search = (self.request.query_params.get("search") or "").strip()
        source = (self.request.query_params.get("source") or "").strip()
        rule_state = (self.request.query_params.get("rule_state") or "").strip()
        if search:
            queryset = queryset.filter(Q(sku__icontains=search) | Q(name__icontains=search) | Q(external_id__icontains=search))
        if source:
            queryset = queryset.filter(source=source)
        if rule_state in {"connected", "missing"}:
            rule_exists = KaspiPricingRule.objects.filter(business=OuterRef("business"), product_sku=OuterRef("sku"))
            queryset = queryset.annotate(has_rule=Exists(rule_exists)).filter(has_rule=(rule_state == "connected"))
        return queryset

    @action(detail=False, methods=["post"], url_path="sync")
    def sync(self, request):
        business_id = request.data.get("business")
        if not business_id:
            raise ValidationError("Business is required.")
        from apps.businesses.models import Business

        business = get_object_or_404(Business, id=business_id)
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        sources = request.data.get("sources") or None
        if isinstance(sources, str):
            sources = [sources]
        result = sync_pricing_catalog_from_events(business, sources=sources)
        write_audit_log(request, AuditLog.Actions.UPDATE, business, business=business, metadata={"kind": "pricing_catalog_synced", **result})
        return Response(result)

    @action(detail=True, methods=["post"], url_path="create-rule")
    def create_rule(self, request, pk=None):
        item = self.get_object()
        assert_can(request.user, item.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=item)
        serializer = PricingCatalogRuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule, created = create_pricing_rule_from_catalog_item(
            item,
            min_price=serializer.validated_data["min_price"],
            current_price=serializer.validated_data.get("current_price"),
            step_amount=serializer.validated_data.get("step_amount"),
            mode=serializer.validated_data.get("mode"),
            max_changes_per_day=serializer.validated_data.get("max_changes_per_day"),
            user=request.user,
        )
        write_audit_log(
            request,
            AuditLog.Actions.CREATE if created else AuditLog.Actions.UPDATE,
            rule,
            business=rule.business,
            metadata={"kind": "kaspi_pricing_rule_created_from_catalog", "catalog_item_id": item.id, "created": created},
        )
        status_code = 201 if created else 200
        return Response(KaspiPricingRuleSerializer(rule).data, status=status_code)

    @action(detail=False, methods=["post"], url_path="bulk-create-rules")
    def bulk_create_rules(self, request):
        serializer = PricingCatalogBulkRuleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = list(self.get_queryset().filter(id__in=serializer.validated_data["item_ids"]))
        if not items:
            raise ValidationError("No catalog items found.")
        business_ids = {item.business_id for item in items}
        if len(business_ids) != 1:
            raise ValidationError("All catalog items must belong to the same business.")
        business = items[0].business
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)

        created_count = 0
        updated_count = 0
        rules = []
        for item in items:
            rule, created = create_pricing_rule_from_catalog_item(
                item,
                min_price=serializer.validated_data["min_price"],
                step_amount=serializer.validated_data.get("step_amount"),
                mode=serializer.validated_data.get("mode"),
                max_changes_per_day=serializer.validated_data.get("max_changes_per_day"),
                user=request.user,
            )
            created_count += 1 if created else 0
            updated_count += 0 if created else 1
            rules.append(rule)
        write_audit_log(
            request,
            AuditLog.Actions.CREATE,
            business,
            business=business,
            metadata={"kind": "kaspi_pricing_rules_bulk_created_from_catalog", "created": created_count, "updated": updated_count, "items": len(items)},
        )
        return Response(
            {
                "created": created_count,
                "updated": updated_count,
                "rules": KaspiPricingRuleSerializer(rules, many=True).data,
            },
            status=201 if created_count else 200,
        )


class KaspiPricingControlViewSet(TenantModelViewSet):
    queryset = KaspiPricingControl.objects.select_related("business", "stopped_by", "resumed_by")
    serializer_class = KaspiPricingControlSerializer
    access_resource = Resources.INTEGRATIONS

    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request):
        business_id = request.query_params.get("business")
        if not business_id:
            raise ValidationError("Business is required.")
        from apps.businesses.models import Business

        business = get_object_or_404(Business, id=business_id)
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.VIEW)
        return Response(KaspiPricingControlSerializer(get_pricing_control(business)).data)

    @action(detail=False, methods=["post"], url_path="emergency-stop")
    def emergency_stop(self, request):
        serializer = KaspiEmergencyStopSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from apps.businesses.models import Business

        business = get_object_or_404(Business, id=serializer.validated_data.get("business"))
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        control = set_pricing_emergency_stop(business, True, reason=serializer.validated_data.get("reason", ""), user=request.user)
        write_audit_log(request, AuditLog.Actions.UPDATE, control, business=business, metadata={"kind": "kaspi_pricing_emergency_stop"})
        return Response(KaspiPricingControlSerializer(control).data)

    @action(detail=False, methods=["post"], url_path="resume")
    def resume(self, request):
        serializer = KaspiEmergencyStopSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from apps.businesses.models import Business

        business = get_object_or_404(Business, id=serializer.validated_data.get("business"))
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)
        control = set_pricing_emergency_stop(business, False, user=request.user)
        write_audit_log(request, AuditLog.Actions.UPDATE, control, business=business, metadata={"kind": "kaspi_pricing_resumed"})
        return Response(KaspiPricingControlSerializer(control).data)


class KaspiPricingRuleViewSet(TenantModelViewSet):
    queryset = KaspiPricingRule.objects.select_related("business", "created_by")
    serializer_class = KaspiPricingRuleSerializer
    access_resource = Resources.INTEGRATIONS

    def perform_create(self, serializer):
        self._enforce_business_access(serializer)
        rule = serializer.save(created_by=self.request.user)
        write_audit_log(self.request, AuditLog.Actions.CREATE, rule, business=rule.business, metadata={"kind": "kaspi_pricing_rule_created"})

    def perform_update(self, serializer):
        self._enforce_business_access(serializer)
        rule = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.UPDATE, rule, business=rule.business, metadata={"kind": "kaspi_pricing_rule_updated"})

    @action(detail=False, methods=["post"], url_path="bulk-update")
    def bulk_update(self, request):
        serializer = KaspiPricingRuleBulkUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rules = list(self.get_queryset().filter(id__in=serializer.validated_data["rule_ids"]))
        if not rules:
            raise ValidationError("No pricing rules found.")
        business_ids = {rule.business_id for rule in rules}
        if len(business_ids) != 1:
            raise ValidationError("All pricing rules must belong to the same business.")
        business = rules[0].business
        assert_can(request.user, business, Resources.INTEGRATIONS, Actions.MANAGE)

        updated = 0
        for rule in rules:
            update_fields = ["updated_at"]
            if "status" in serializer.validated_data:
                rule.status = serializer.validated_data["status"]
                update_fields.append("status")
            if "min_price" in serializer.validated_data:
                rule.min_price = serializer.validated_data["min_price"]
                update_fields.append("min_price")
            if "step_amount" in serializer.validated_data:
                rule.step_amount = serializer.validated_data["step_amount"]
                update_fields.append("step_amount")
            if "max_changes_per_day" in serializer.validated_data:
                rule.max_changes_per_day = serializer.validated_data["max_changes_per_day"]
                update_fields.append("max_changes_per_day")
            if serializer.validated_data.get("disable_autopilot") and rule.mode == KaspiPricingRule.Modes.AUTOPILOT:
                rule.mode = KaspiPricingRule.Modes.APPROVAL
                rule.autopilot_confirmed_at = None
                rule.autopilot_confirmed_by = None
                update_fields.extend(["mode", "autopilot_confirmed_at", "autopilot_confirmed_by"])
            rule.save(update_fields=sorted(set(update_fields)))
            updated += 1
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            business,
            business=business,
            metadata={"kind": "kaspi_pricing_rules_bulk_updated", "updated": updated, "fields": sorted(serializer.validated_data.keys())},
        )
        return Response({"updated": updated, "rules": KaspiPricingRuleSerializer(rules, many=True).data})

    @action(detail=True, methods=["post"], url_path="recommend")
    def recommend(self, request, pk=None):
        rule = self.get_object()
        assert_can(request.user, rule.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=rule)
        serializer = KaspiRecommendationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recommendation = create_kaspi_recommendation(
            rule,
            competitor_price=serializer.validated_data.get("competitor_price"),
            competitor_name=serializer.validated_data.get("competitor_name", ""),
            observed_payload=serializer.validated_data.get("observed_payload") or {},
        )
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            rule,
            business=rule.business,
            metadata={"kind": "kaspi_pricing_recommendation_created", "recommendation_id": recommendation.id, "target_price": str(recommendation.target_price)},
        )
        return Response(KaspiPricingRecommendationSerializer(recommendation).data)

    @action(detail=True, methods=["post"], url_path="collect-offers")
    def collect_offers(self, request, pk=None):
        rule = self.get_object()
        assert_can(request.user, rule.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=rule)
        result = collect_kaspi_competitor_offers(rule, provider_key=request.data.get("provider"))
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            rule,
            business=rule.business,
            metadata={"kind": "kaspi_competitor_offers_collected", **result},
        )
        return Response(result)

    @action(detail=True, methods=["post"], url_path="enable-autopilot")
    def enable_autopilot(self, request, pk=None):
        rule = self.get_object()
        assert_can(request.user, rule.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=rule)
        serializer = KaspiAutopilotEnableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if rule.min_price <= 0:
            raise ValidationError("Minimum price must be set before enabling autopilot.")
        if rule.max_changes_per_day <= 0:
            raise ValidationError("Daily change limit must be set before enabling autopilot.")
        if not rule.competitor_offers.filter(available=True).exists():
            raise ValidationError("Collect competitor prices before enabling autopilot.")
        rule.mode = KaspiPricingRule.Modes.AUTOPILOT
        rule.status = KaspiPricingRule.Statuses.ACTIVE
        rule.autopilot_confirmed_at = timezone.now()
        rule.autopilot_confirmed_by = request.user
        rule.last_error = ""
        rule.save(update_fields=["mode", "status", "autopilot_confirmed_at", "autopilot_confirmed_by", "last_error", "updated_at"])
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            rule,
            business=rule.business,
            metadata={"kind": "kaspi_autopilot_enabled", "max_changes_per_day": rule.max_changes_per_day, "min_price": str(rule.min_price)},
        )
        return Response(KaspiPricingRuleSerializer(rule).data)

    @action(detail=True, methods=["post"], url_path="disable-autopilot")
    def disable_autopilot(self, request, pk=None):
        rule = self.get_object()
        assert_can(request.user, rule.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=rule)
        rule.mode = KaspiPricingRule.Modes.APPROVAL
        rule.autopilot_confirmed_at = None
        rule.autopilot_confirmed_by = None
        rule.save(update_fields=["mode", "autopilot_confirmed_at", "autopilot_confirmed_by", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, rule, business=rule.business, metadata={"kind": "kaspi_autopilot_disabled"})
        return Response(KaspiPricingRuleSerializer(rule).data)


class KaspiCompetitorOfferViewSet(TenantModelViewSet):
    queryset = KaspiCompetitorOffer.objects.select_related("business", "rule")
    serializer_class = KaspiCompetitorOfferSerializer
    access_resource = Resources.INTEGRATIONS

    def perform_create(self, serializer):
        self._enforce_business_access(serializer)
        offer = serializer.save(business=serializer.validated_data["rule"].business)
        write_audit_log(self.request, AuditLog.Actions.CREATE, offer.rule, business=offer.business, metadata={"kind": "kaspi_competitor_offer_created", "offer_id": offer.id})


class KaspiPricingRecommendationViewSet(TenantModelViewSet):
    queryset = KaspiPricingRecommendation.objects.select_related("business", "rule")
    serializer_class = KaspiPricingRecommendationSerializer
    access_resource = Resources.INTEGRATIONS

    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        recommendation = self.get_object()
        assert_can(request.user, recommendation.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=recommendation)
        serializer = KaspiRecommendationApplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change = apply_kaspi_recommendation(recommendation, user=request.user, force=serializer.validated_data.get("force", False))
        write_audit_log(
            request,
            AuditLog.Actions.UPDATE,
            recommendation.rule,
            business=recommendation.business,
            metadata={"kind": "kaspi_price_change_requested", "change_id": change.id, "status": change.status, "new_price": str(change.new_price)},
        )
        return Response(KaspiPriceChangeLogSerializer(change).data)


class KaspiPriceChangeLogViewSet(TenantModelViewSet):
    queryset = KaspiPriceChangeLog.objects.select_related("business", "rule", "recommendation", "created_by")
    serializer_class = KaspiPriceChangeLogSerializer
    access_resource = Resources.INTEGRATIONS

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = (self.request.query_params.get("status") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        rule_id = (self.request.query_params.get("rule") or "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if rule_id:
            queryset = queryset.filter(rule_id=rule_id)
        if search:
            queryset = queryset.filter(Q(rule__product_sku__icontains=search) | Q(rule__product_name__icontains=search))
        return queryset


class KaspiPricingAlertViewSet(TenantModelViewSet):
    queryset = KaspiPricingAlert.objects.select_related("business", "rule", "change_log")
    serializer_class = KaspiPricingAlertSerializer
    access_resource = Resources.INTEGRATIONS

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        assert_can(request.user, alert.business, Resources.INTEGRATIONS, Actions.MANAGE, obj=alert)
        alert.status = KaspiPricingAlert.Statuses.RESOLVED
        alert.resolved_at = timezone.now()
        alert.save(update_fields=["status", "resolved_at"])
        return Response(KaspiPricingAlertSerializer(alert).data)
