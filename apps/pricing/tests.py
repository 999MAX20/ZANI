from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.integrations.models import BusinessEvent
from apps.notifications.models import Notification
from apps.pricing.models import KaspiCompetitorOffer, KaspiPriceChangeLog, KaspiPricingAlert, KaspiPricingControl, KaspiPricingRecommendation, KaspiPricingRule, PricingCatalogItem
from apps.pricing.services import apply_kaspi_recommendation, create_kaspi_recommendation
from apps.pricing.services import run_kaspi_pricing_cycle, set_pricing_emergency_stop, sync_pricing_catalog_from_events
from apps.pricing.tasks import run_kaspi_pricing_cycle_task


class KaspiPricingEngineTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="pricing-owner",
            email="pricing-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Pricing Shop", slug="pricing-shop")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        self.rule = KaspiPricingRule.objects.create(
            business=self.business,
            product_sku="SKU-1",
            product_name="Demo product",
            current_price=Decimal("10500"),
            min_price=Decimal("10000"),
            step_amount=Decimal("1"),
            mode=KaspiPricingRule.Modes.APPROVAL,
            max_changes_per_day=2,
            created_by=self.owner,
        )

    def test_recommendation_uses_competitor_minus_one_tenge(self):
        recommendation = create_kaspi_recommendation(self.rule, competitor_price=Decimal("10400"), competitor_name="Shop A")

        self.assertEqual(recommendation.status, KaspiPricingRecommendation.Statuses.PROPOSED)
        self.assertEqual(recommendation.target_price, Decimal("10399"))
        self.assertEqual(recommendation.delta, Decimal("-101"))
        self.assertEqual(KaspiCompetitorOffer.objects.filter(rule=self.rule).count(), 1)

    def test_recommendation_never_goes_below_min_price(self):
        recommendation = create_kaspi_recommendation(self.rule, competitor_price=Decimal("9900"), competitor_name="Shop A")

        self.assertEqual(recommendation.status, KaspiPricingRecommendation.Statuses.PROPOSED)
        self.assertEqual(recommendation.target_price, Decimal("10000"))
        self.assertEqual(recommendation.decision_json["guardrail"], "min_price")

    def test_recommendation_blocks_when_already_at_min_price(self):
        self.rule.current_price = Decimal("10000")
        self.rule.save(update_fields=["current_price"])

        recommendation = create_kaspi_recommendation(self.rule, competitor_price=Decimal("9900"), competitor_name="Shop A")

        self.assertEqual(recommendation.status, KaspiPricingRecommendation.Statuses.BLOCKED)
        self.assertEqual(recommendation.target_price, Decimal("10000"))

    @override_settings(KASPI_REPRICING_ENABLED=True, KASPI_REPRICING_WRITE_ENABLED=False)
    def test_apply_recommendation_is_simulated_until_writeback_enabled(self):
        recommendation = create_kaspi_recommendation(self.rule, competitor_price=Decimal("10400"))

        change = apply_kaspi_recommendation(recommendation, user=self.owner)
        self.rule.refresh_from_db()
        recommendation.refresh_from_db()

        self.assertEqual(change.status, KaspiPriceChangeLog.Statuses.SIMULATED)
        self.assertEqual(change.new_price, Decimal("10399"))
        self.assertEqual(self.rule.current_price, Decimal("10399"))
        self.assertEqual(recommendation.status, KaspiPricingRecommendation.Statuses.APPROVED)
        self.assertFalse(change.provider_response_json["write_enabled"])

    def test_daily_change_limit_blocks_extra_changes(self):
        first = create_kaspi_recommendation(self.rule, competitor_price=Decimal("10400"))
        apply_kaspi_recommendation(first, user=self.owner)
        self.rule.current_price = Decimal("10500")
        self.rule.save(update_fields=["current_price"])
        second = create_kaspi_recommendation(self.rule, competitor_price=Decimal("10300"))
        apply_kaspi_recommendation(second, user=self.owner)
        self.rule.current_price = Decimal("10500")
        self.rule.save(update_fields=["current_price"])
        third = create_kaspi_recommendation(self.rule, competitor_price=Decimal("10200"))

        blocked = apply_kaspi_recommendation(third, user=self.owner)

        self.assertEqual(blocked.status, KaspiPriceChangeLog.Statuses.BLOCKED)
        self.assertIn("дневной лимит", blocked.error)

    def test_pricing_cycle_uses_latest_competitor_offer(self):
        KaspiCompetitorOffer.objects.create(
            business=self.business,
            rule=self.rule,
            competitor_name="Shop A",
            price=Decimal("10400"),
            position=1,
        )

        summary = run_kaspi_pricing_cycle(business_id=self.business.id)
        recommendation = KaspiPricingRecommendation.objects.filter(rule=self.rule).latest("created_at")

        self.assertEqual(summary["rules_checked"], 1)
        self.assertEqual(summary["recommendations_created"], 1)
        self.assertEqual(recommendation.target_price, Decimal("10399"))

    def test_pricing_cycle_collects_competitor_offer_automatically(self):
        summary = run_kaspi_pricing_cycle(business_id=self.business.id)
        recommendation = KaspiPricingRecommendation.objects.filter(rule=self.rule).latest("created_at")

        self.assertEqual(summary["offers_collected"], 1)
        self.assertEqual(summary["monitor_errors"], 0)
        self.assertEqual(recommendation.target_price, Decimal("10399"))
        self.assertEqual(KaspiCompetitorOffer.objects.filter(rule=self.rule).count(), 1)

    def test_pricing_cycle_applies_only_autopilot_rules_when_requested(self):
        self.rule.mode = KaspiPricingRule.Modes.AUTOPILOT
        self.rule.autopilot_confirmed_at = timezone.now()
        self.rule.autopilot_confirmed_by = self.owner
        self.rule.save(update_fields=["mode", "autopilot_confirmed_at", "autopilot_confirmed_by"])
        KaspiCompetitorOffer.objects.create(
            business=self.business,
            rule=self.rule,
            competitor_name="Shop A",
            price=Decimal("10400"),
            position=1,
        )

        summary = run_kaspi_pricing_cycle(business_id=self.business.id, apply_autopilot=True, user=self.owner)

        self.assertEqual(summary["autopilot_applied"], 1)
        self.assertEqual(KaspiPriceChangeLog.objects.filter(rule=self.rule, status=KaspiPriceChangeLog.Statuses.SIMULATED).count(), 1)

    @override_settings(KASPI_REPRICING_ENABLED=False)
    def test_pricing_task_skips_when_disabled(self):
        result = run_kaspi_pricing_cycle_task.run()

        self.assertTrue(result["skipped"])
        self.assertEqual(result["reason"], "KASPI_REPRICING_ENABLED=False")

    @override_settings(KASPI_REPRICING_ENABLED=True, KASPI_REPRICING_APPLY_AUTOPILOT=True)
    def test_pricing_task_runs_cycle_when_enabled(self):
        result = run_kaspi_pricing_cycle_task.run(business_id=self.business.id)

        self.assertFalse(result["skipped"])
        self.assertEqual(result["rules_checked"], 1)

    def test_sync_pricing_catalog_from_business_events(self):
        BusinessEvent.objects.create(
            business=self.business,
            source="moysklad",
            event_type="moysklad_product_imported",
            external_id="ms-product-1",
            deduplication_key="pricing-catalog-product-1",
            payload_json={"sku": "SKU-CAT", "name": "Catalog product", "price": "12500", "source": "moysklad"},
        )
        BusinessEvent.objects.create(
            business=self.business,
            source="moysklad",
            event_type="moysklad_stock_imported",
            external_id="ms-stock-1",
            deduplication_key="pricing-catalog-stock-1",
            payload_json={"sku": "SKU-CAT", "quantity": "7", "source": "moysklad"},
        )

        summary = sync_pricing_catalog_from_events(self.business)
        item = PricingCatalogItem.objects.get(business=self.business, sku="SKU-CAT")

        self.assertEqual(summary["items_created"], 1)
        self.assertEqual(summary["items_updated"], 1)
        self.assertEqual(item.name, "Catalog product")
        self.assertEqual(item.current_price, Decimal("12500"))
        self.assertEqual(item.stock_quantity, Decimal("7"))

    def test_emergency_stop_blocks_price_apply_and_creates_alert(self):
        recommendation = create_kaspi_recommendation(self.rule, competitor_price=Decimal("10400"))
        set_pricing_emergency_stop(self.business, True, reason="Pilot pause", user=self.owner)

        change = apply_kaspi_recommendation(recommendation, user=self.owner)

        self.assertEqual(change.status, KaspiPriceChangeLog.Statuses.BLOCKED)
        self.assertIn("Emergency stop", change.error)
        self.assertTrue(KaspiPricingAlert.objects.filter(business=self.business, alert_type=KaspiPricingAlert.Types.CHANGE_BLOCKED).exists())
        self.assertTrue(Notification.objects.filter(business=self.business, category=Notification.Categories.AI_ALERTS).exists())

    @override_settings(KASPI_REPRICING_ENABLED=True, KASPI_REPRICING_WRITE_ENABLED=True, KASPI_PRICE_WRITE_PROVIDER="price_feed")
    def test_write_enabled_queues_price_feed_change(self):
        recommendation = create_kaspi_recommendation(self.rule, competitor_price=Decimal("10400"))

        change = apply_kaspi_recommendation(recommendation, user=self.owner)

        self.assertEqual(change.status, KaspiPriceChangeLog.Statuses.QUEUED)
        self.assertEqual(change.provider_response_json["provider"], "price_feed")


class KaspiPricingApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="pricing-api-owner",
            email="pricing-api-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Pricing API Shop", slug="pricing-api-shop")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)

    def test_owner_can_create_rule_recommend_and_apply(self):
        self.api.force_authenticate(self.owner)

        rule_response = self.api.post(
            "/api/pricing/kaspi/rules/",
            {
                "business": self.business.id,
                "product_sku": "SKU-API",
                "product_name": "API product",
                "current_price": "10500.00",
                "min_price": "10000.00",
                "step_amount": "1.00",
                "mode": "approval",
                "max_changes_per_day": 3,
            },
            format="json",
        )

        self.assertEqual(rule_response.status_code, 201)
        rule_id = rule_response.data["id"]

        recommendation_response = self.api.post(
            f"/api/pricing/kaspi/rules/{rule_id}/recommend/",
            {"competitor_price": "10400.00", "competitor_name": "Competitor"},
            format="json",
        )

        self.assertEqual(recommendation_response.status_code, 200)
        self.assertEqual(recommendation_response.data["target_price"], "10399.00")
        self.assertEqual(recommendation_response.data["status"], KaspiPricingRecommendation.Statuses.PROPOSED)

        apply_response = self.api.post(f"/api/pricing/kaspi/recommendations/{recommendation_response.data['id']}/apply/", {}, format="json")

        self.assertEqual(apply_response.status_code, 200)
        self.assertEqual(apply_response.data["status"], KaspiPriceChangeLog.Statuses.SIMULATED)
        self.assertEqual(apply_response.data["new_price"], "10399.00")

    def test_pricing_rule_response_masks_config_and_last_error_secrets(self):
        rule = KaspiPricingRule.objects.create(
            business=self.business,
            product_sku="SKU-SECRET",
            product_name="Secret product",
            current_price=Decimal("10500"),
            min_price=Decimal("10000"),
            step_amount=Decimal("1"),
            mode=KaspiPricingRule.Modes.APPROVAL,
            config_json={"api_key": "raw-config-key"},
            last_error="Provider failed with token=raw-pricing-token",
            created_by=self.owner,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get(f"/api/pricing/kaspi/rules/{rule.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("raw-config-key", str(response.data))
        self.assertNotIn("raw-pricing-token", str(response.data))

    def test_autopilot_requires_safety_confirmation_action(self):
        self.api.force_authenticate(self.owner)

        create_response = self.api.post(
            "/api/pricing/kaspi/rules/",
            {
                "business": self.business.id,
                "product_sku": "SKU-AUTO",
                "product_name": "Autopilot product",
                "current_price": "10500.00",
                "min_price": "10000.00",
                "step_amount": "1.00",
                "mode": "autopilot",
                "max_changes_per_day": 3,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 400)

    def test_owner_can_enable_autopilot_after_prices_are_collected(self):
        self.api.force_authenticate(self.owner)
        rule = KaspiPricingRule.objects.create(
            business=self.business,
            product_sku="SKU-AUTO-OK",
            product_name="Autopilot product",
            current_price=Decimal("10500"),
            min_price=Decimal("10000"),
            step_amount=Decimal("1"),
            mode=KaspiPricingRule.Modes.APPROVAL,
            max_changes_per_day=3,
            created_by=self.owner,
        )

        blocked_response = self.api.post(
            f"/api/pricing/kaspi/rules/{rule.id}/enable-autopilot/",
            {"confirm_min_price": True, "confirm_daily_limit": True, "confirm_monitoring": True, "confirm_writeback_risk": True},
            format="json",
        )
        self.assertEqual(blocked_response.status_code, 400)

        KaspiCompetitorOffer.objects.create(business=self.business, rule=rule, competitor_name="Shop A", price=Decimal("10400"), position=1)
        enable_response = self.api.post(
            f"/api/pricing/kaspi/rules/{rule.id}/enable-autopilot/",
            {"confirm_min_price": True, "confirm_daily_limit": True, "confirm_monitoring": True, "confirm_writeback_risk": True},
            format="json",
        )

        self.assertEqual(enable_response.status_code, 200)
        self.assertEqual(enable_response.data["mode"], KaspiPricingRule.Modes.AUTOPILOT)
        self.assertIsNotNone(enable_response.data["autopilot_confirmed_at"])

    def test_owner_can_sync_catalog_and_create_rule_from_item(self):
        self.api.force_authenticate(self.owner)
        BusinessEvent.objects.create(
            business=self.business,
            source="excel_csv",
            event_type="catalog.item_imported",
            external_id="SKU-CSV",
            deduplication_key="pricing-catalog-csv-1",
            payload_json={"sku": "SKU-CSV", "name": "CSV product", "price_from": "8800", "stock_quantity": "4", "source": "excel_csv"},
        )

        sync_response = self.api.post("/api/pricing/kaspi/catalog/sync/", {"business": self.business.id}, format="json")

        self.assertEqual(sync_response.status_code, 200)
        item = PricingCatalogItem.objects.get(business=self.business, sku="SKU-CSV")

        create_response = self.api.post(
            f"/api/pricing/kaspi/catalog/{item.id}/create-rule/",
            {"min_price": "8000.00", "mode": "approval", "max_changes_per_day": 2},
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["product_sku"], "SKU-CSV")
        self.assertEqual(create_response.data["current_price"], "8800.00")

    def test_owner_can_bulk_create_rules_from_catalog_items(self):
        self.api.force_authenticate(self.owner)
        first = PricingCatalogItem.objects.create(business=self.business, source="excel_csv", sku="SKU-BULK-1", name="Bulk 1", current_price=Decimal("9000"))
        second = PricingCatalogItem.objects.create(business=self.business, source="excel_csv", sku="SKU-BULK-2", name="Bulk 2", current_price=Decimal("9500"))

        response = self.api.post(
            "/api/pricing/kaspi/catalog/bulk-create-rules/",
            {"item_ids": [first.id, second.id], "min_price": "8000.00", "step_amount": "1.00", "mode": "approval", "max_changes_per_day": 2},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created"], 2)
        self.assertEqual(KaspiPricingRule.objects.filter(business=self.business, product_sku__in=["SKU-BULK-1", "SKU-BULK-2"]).count(), 2)

    def test_catalog_filters_by_search_source_and_rule_state(self):
        self.api.force_authenticate(self.owner)
        connected = PricingCatalogItem.objects.create(business=self.business, source="excel_csv", sku="SKU-FILTER-1", name="Green Tea", current_price=Decimal("9000"))
        PricingCatalogItem.objects.create(business=self.business, source="moysklad", sku="SKU-FILTER-2", name="Black Coffee", current_price=Decimal("9500"))
        KaspiPricingRule.objects.create(business=self.business, product_sku=connected.sku, product_name=connected.name, current_price=Decimal("9000"), min_price=Decimal("8000"))

        search_response = self.api.get("/api/pricing/kaspi/catalog/", {"business": self.business.id, "search": "coffee"})
        source_response = self.api.get("/api/pricing/kaspi/catalog/", {"business": self.business.id, "source": "excel_csv"})
        missing_response = self.api.get("/api/pricing/kaspi/catalog/", {"business": self.business.id, "rule_state": "missing"})
        connected_response = self.api.get("/api/pricing/kaspi/catalog/", {"business": self.business.id, "rule_state": "connected"})

        self.assertEqual(len(search_response.data["results"]), 1)
        self.assertEqual(search_response.data["results"][0]["sku"], "SKU-FILTER-2")
        self.assertEqual(len(source_response.data["results"]), 1)
        self.assertEqual(source_response.data["results"][0]["sku"], "SKU-FILTER-1")
        self.assertEqual(len(missing_response.data["results"]), 1)
        self.assertEqual(missing_response.data["results"][0]["sku"], "SKU-FILTER-2")
        self.assertEqual(len(connected_response.data["results"]), 1)
        self.assertEqual(connected_response.data["results"][0]["sku"], "SKU-FILTER-1")

    def test_owner_can_bulk_update_pricing_rules(self):
        self.api.force_authenticate(self.owner)
        first = KaspiPricingRule.objects.create(
            business=self.business,
            product_sku="SKU-RULE-BULK-1",
            current_price=Decimal("10000"),
            min_price=Decimal("9000"),
            mode=KaspiPricingRule.Modes.AUTOPILOT,
            autopilot_confirmed_at=timezone.now(),
            autopilot_confirmed_by=self.owner,
        )
        second = KaspiPricingRule.objects.create(
            business=self.business,
            product_sku="SKU-RULE-BULK-2",
            current_price=Decimal("11000"),
            min_price=Decimal("9500"),
        )

        response = self.api.post(
            "/api/pricing/kaspi/rules/bulk-update/",
            {
                "rule_ids": [first.id, second.id],
                "status": "paused",
                "min_price": "8500.00",
                "max_changes_per_day": 1,
                "disable_autopilot": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated"], 2)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, KaspiPricingRule.Statuses.PAUSED)
        self.assertEqual(first.min_price, Decimal("8500.00"))
        self.assertEqual(first.mode, KaspiPricingRule.Modes.APPROVAL)
        self.assertIsNone(first.autopilot_confirmed_at)
        self.assertEqual(second.max_changes_per_day, 1)

    def test_owner_can_filter_price_change_logs(self):
        self.api.force_authenticate(self.owner)
        first = KaspiPricingRule.objects.create(
            business=self.business,
            product_sku="SKU-LOG-1",
            product_name="Log Tea",
            current_price=Decimal("10000"),
            min_price=Decimal("9000"),
        )
        second = KaspiPricingRule.objects.create(
            business=self.business,
            product_sku="SKU-LOG-2",
            product_name="Log Coffee",
            current_price=Decimal("11000"),
            min_price=Decimal("9500"),
        )
        KaspiPriceChangeLog.objects.create(
            business=self.business,
            rule=first,
            old_price=Decimal("10000"),
            new_price=Decimal("9999"),
            status=KaspiPriceChangeLog.Statuses.BLOCKED,
            mode="approval",
            error="Blocked",
        )
        KaspiPriceChangeLog.objects.create(
            business=self.business,
            rule=second,
            old_price=Decimal("11000"),
            new_price=Decimal("10999"),
            status=KaspiPriceChangeLog.Statuses.SIMULATED,
            mode="approval",
        )

        response = self.api.get(
            "/api/pricing/kaspi/change-logs/",
            {"business": self.business.id, "status": KaspiPriceChangeLog.Statuses.BLOCKED, "search": "tea"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["product_sku"], "SKU-LOG-1")
        self.assertEqual(response.data["results"][0]["product_name"], "Log Tea")

    def test_owner_can_stop_and_resume_pricing_agent(self):
        self.api.force_authenticate(self.owner)

        stop_response = self.api.post("/api/pricing/kaspi/control/emergency-stop/", {"business": self.business.id, "reason": "Manual stop"}, format="json")

        self.assertEqual(stop_response.status_code, 200)
        self.assertTrue(stop_response.data["emergency_stop_enabled"])
        self.assertTrue(KaspiPricingControl.objects.get(business=self.business).emergency_stop_enabled)

        resume_response = self.api.post("/api/pricing/kaspi/control/resume/", {"business": self.business.id}, format="json")

        self.assertEqual(resume_response.status_code, 200)
        self.assertFalse(resume_response.data["emergency_stop_enabled"])
