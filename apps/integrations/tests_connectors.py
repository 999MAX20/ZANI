from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.businesses.models import Business, BusinessMember
from apps.integrations.connectors import decrypt_credential_value, normalize_business_event, update_connector_health
from apps.integrations.kaspi import KASPI_EVENT_TYPES, build_kaspi_events_from_orders, build_kaspi_mock_events
from apps.integrations.moysklad import (
    MOYSKLAD_EVENT_TYPES,
    build_moysklad_mock_events,
    build_moysklad_product_events,
    build_moysklad_sale_events,
    build_moysklad_stock_events,
    moysklad_entity_to_import_type,
)
from apps.integrations.models import BusinessConnector, BusinessEvent, ConnectorCredential, ConnectorSyncRun, IntegrationEventLog
from apps.integrations import services as integration_services
from apps.integrations.one_c import ONE_C_EVENT_TYPES, build_one_c_mock_events, one_c_entity_to_import_type
from apps.integrations.ozon import (
    OZON_EVENT_TYPES,
    build_ozon_events_from_fbo_postings,
    build_ozon_events_from_fbs_postings,
    build_ozon_events_from_stocks,
    build_ozon_mock_events,
)
from apps.integrations.wildberries import (
    WILDBERRIES_EVENT_TYPES,
    build_wildberries_events_from_orders,
    build_wildberries_events_from_sales,
    build_wildberries_events_from_stocks,
    build_wildberries_mock_events,
)
from apps.core.models import ImportJob


class BusinessConnectorFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="connector-owner",
            email="connector-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.operator = User.objects.create_user(
            username="connector-operator",
            email="connector-operator@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        self.other_owner = User.objects.create_user(
            username="connector-other",
            email="connector-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.platform_admin = User.objects.create_user(
            username="connector-platform",
            email="connector-platform@example.com",
            password="pass",
            role=User.Roles.PLATFORM_ADMIN,
        )
        self.business = Business.objects.create(owner=self.owner, name="Connector Clinic", slug="connector-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Connector Clinic", slug="other-connector-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.operator, role=BusinessMember.Roles.OPERATOR)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)

    def test_owner_can_create_connector_and_secret_is_masked(self):
        self.api.force_authenticate(self.owner)

        create_response = self.api.post(
            "/api/business-connectors/",
            {
                "business": self.business.id,
                "provider": BusinessConnector.Providers.TELEGRAM,
                "name": "Telegram main",
                "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
                "auth_type": BusinessConnector.AuthTypes.TOKEN,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        connector_id = create_response.data["id"]

        credential_response = self.api.post(
            "/api/connector-credentials/",
            {
                "connector": connector_id,
                "key": "bot_token",
                "value": "123456:super-secret-token",
            },
            format="json",
        )

        self.assertEqual(credential_response.status_code, 201)
        self.assertNotIn("super-secret-token", str(credential_response.data))
        self.assertEqual(credential_response.data["masked_value"], "1234...oken")
        credential = ConnectorCredential.objects.get(id=credential_response.data["id"])
        self.assertEqual(decrypt_credential_value(credential.encrypted_value), "123456:super-secret-token")
        self.assertNotIn("super-secret-token", credential.encrypted_value)

    def test_connector_config_secrets_are_masked_in_api_responses(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.CUSTOM,
            name="Custom webhook",
            config_json={
                "access_token": "raw-access-token",
                "api_key": "raw-api-key",
                "webhook_secret_configured": True,
                "nested": {"client_secret": "raw-client-secret"},
            },
            created_by=self.owner,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get(f"/api/business-connectors/{connector.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["config_json"]["access_token"], "configured")
        self.assertEqual(response.data["config_json"]["api_key"], "configured")
        self.assertTrue(response.data["config_json"]["webhook_secret_configured"])
        self.assertEqual(response.data["config_json"]["nested"]["client_secret"], "configured")
        self.assertNotIn("raw-access-token", str(response.data))
        self.assertNotIn("raw-api-key", str(response.data))
        self.assertNotIn("raw-client-secret", str(response.data))

    def test_connector_last_error_is_sanitized_on_write_and_api_response(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.CUSTOM,
            name="Custom failing",
            created_by=self.owner,
        )

        update_connector_health(
            connector,
            status=BusinessConnector.Statuses.FAILED,
            error="Provider failed url=https://api.example.com/hook?access_token=raw-access-token Authorization: Bearer raw-bearer-token",
        )
        connector.refresh_from_db()

        self.assertNotIn("raw-access-token", connector.last_error)
        self.assertNotIn("raw-bearer-token", connector.last_error)

        self.api.force_authenticate(self.owner)
        response = self.api.get(f"/api/business-connectors/{connector.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("raw-access-token", str(response.data))
        self.assertNotIn("raw-bearer-token", str(response.data))

    def test_event_payload_secrets_are_masked_in_api_responses(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.CUSTOM,
            name="Custom events",
            created_by=self.owner,
        )
        BusinessEvent.objects.create(
            business=self.business,
            connector=connector,
            source=BusinessConnector.Providers.CUSTOM,
            event_type="custom.event",
            external_id="event-1",
            deduplication_key="event-1",
            payload_json={"api_key": "raw-api-key", "nested": {"access_token": "raw-access-token"}},
        )
        IntegrationEventLog.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.CUSTOM,
            channel="custom",
            direction=IntegrationEventLog.Directions.INBOUND,
            status=IntegrationEventLog.Statuses.RECEIVED,
            payload_json={"client_secret": "raw-client-secret"},
        )
        self.api.force_authenticate(self.owner)

        event_response = self.api.get("/api/business-events/")
        log_response = self.api.get("/api/integration-event-logs/")

        self.assertEqual(event_response.status_code, 200)
        self.assertEqual(log_response.status_code, 200)
        self.assertEqual(event_response.data["results"][0]["payload_json"]["api_key"], "configured")
        self.assertEqual(event_response.data["results"][0]["payload_json"]["nested"]["access_token"], "configured")
        self.assertEqual(log_response.data["results"][0]["payload_json"]["client_secret"], "configured")
        self.assertNotIn("raw-api-key", str(event_response.data))
        self.assertNotIn("raw-access-token", str(event_response.data))
        self.assertNotIn("raw-client-secret", str(log_response.data))

    def test_event_and_sync_errors_are_masked_in_api_responses(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.CUSTOM,
            name="Custom errors",
            created_by=self.owner,
        )
        BusinessEvent.objects.create(
            business=self.business,
            connector=connector,
            source=BusinessConnector.Providers.CUSTOM,
            event_type="custom.failed",
            external_id="event-error-1",
            deduplication_key="event-error-1",
            status=BusinessEvent.Statuses.FAILED,
            error="Failed with token=raw-event-token",
        )
        IntegrationEventLog.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.CUSTOM,
            channel="custom",
            direction=IntegrationEventLog.Directions.OUTBOUND,
            status=IntegrationEventLog.Statuses.FAILED,
            payload_json={},
            error='Provider returned {"client_secret":"raw-client-secret"}',
        )
        ConnectorSyncRun.objects.create(
            business=self.business,
            connector=connector,
            mode=ConnectorSyncRun.Modes.MANUAL,
            status=ConnectorSyncRun.Statuses.FAILED,
            error="Sync failed https://api.example.com/orders?api_key=raw-sync-key",
        )
        self.api.force_authenticate(self.owner)

        event_response = self.api.get("/api/business-events/")
        log_response = self.api.get("/api/integration-event-logs/")
        run_response = self.api.get("/api/connector-sync-runs/")

        self.assertEqual(event_response.status_code, 200)
        self.assertEqual(log_response.status_code, 200)
        self.assertEqual(run_response.status_code, 200)
        self.assertNotIn("raw-event-token", str(event_response.data))
        self.assertNotIn("raw-client-secret", str(log_response.data))
        self.assertNotIn("raw-sync-key", str(run_response.data))

    def test_owner_can_retry_failed_healthcheck_sync_run_but_operator_cannot(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.WEBSITE,
            name="Website forms",
            auth_type=BusinessConnector.AuthTypes.NONE,
            created_by=self.owner,
        )
        run = ConnectorSyncRun.objects.create(
            business=self.business,
            connector=connector,
            mode=ConnectorSyncRun.Modes.HEALTHCHECK,
            status=ConnectorSyncRun.Statuses.FAILED,
            error="Previous healthcheck failed.",
        )
        denied_run = ConnectorSyncRun.objects.create(
            business=self.business,
            connector=connector,
            mode=ConnectorSyncRun.Modes.HEALTHCHECK,
            status=ConnectorSyncRun.Statuses.FAILED,
            error="Previous healthcheck failed.",
        )

        self.api.force_authenticate(self.operator)
        denied_response = self.api.post(f"/api/connector-sync-runs/{denied_run.id}/retry/")
        self.assertIn(denied_response.status_code, [403, 404])

        self.api.force_authenticate(self.owner)
        response = self.api.post(f"/api/connector-sync-runs/{run.id}/retry/")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["ok"])
        self.assertEqual(response.data["sync_run"]["status"], ConnectorSyncRun.Statuses.SUCCEEDED)
        self.assertEqual(response.data["events"], [])
        connector.refresh_from_db()
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)

    def test_operator_cannot_manage_connectors(self):
        self.api.force_authenticate(self.operator)

        response = self.api.post(
            "/api/business-connectors/",
            {
                "business": self.business.id,
                "provider": BusinessConnector.Providers.WHATSAPP,
                "name": "WhatsApp",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_owner_can_create_whatsapp_request_with_provider_decision(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/whatsapp-request/",
            {
                "business": self.business.id,
                "company_name": "Connector Clinic",
                "phone_number": "+77015550101",
                "contact_person": "Owner",
                "preferred_method": "meta_cloud",
                "monthly_messages": 1200,
                "has_meta_assets": True,
                "comment": "Need official WhatsApp",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["provider"], BusinessConnector.Providers.WHATSAPP)
        self.assertEqual(response.data["status"], BusinessConnector.Statuses.PROVIDER_CONFIGURING)
        self.assertEqual(response.data["auth_type"], BusinessConnector.AuthTypes.QR)
        config = response.data["config_json"]
        self.assertEqual(config["request_status"], BusinessConnector.Statuses.PROVIDER_CONFIGURING)
        self.assertEqual(config["provider_decision"]["provider_key"], "meta_cloud_placeholder")
        self.assertEqual(config["form"]["phone_number"], "+77015550101")
        self.assertNotIn("access_token", str(response.data).lower())
        self.assertNotIn("client_secret", str(response.data).lower())

    def test_operator_cannot_create_whatsapp_request(self):
        self.api.force_authenticate(self.operator)

        response = self.api.post(
            "/api/business-connectors/whatsapp-request/",
            {
                "business": self.business.id,
                "company_name": "Connector Clinic",
                "phone_number": "+77015550101",
                "preferred_method": "qr_pilot",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_whatsapp_request_rejects_provider_secrets(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/whatsapp-request/",
            {
                "business": self.business.id,
                "company_name": "Connector Clinic",
                "phone_number": "+77015550101",
                "preferred_method": "qr_pilot",
                "comment": "access_token=do-not-store-this",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_other_merchant_cannot_see_connector(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.WHATSAPP,
            name="WhatsApp main",
            created_by=self.owner,
        )
        self.api.force_authenticate(self.other_owner)

        list_response = self.api.get("/api/business-connectors/")
        detail_response = self.api.get(f"/api/business-connectors/{connector.id}/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data["results"], [])
        self.assertEqual(detail_response.status_code, 404)

    def test_inbound_business_event_is_idempotent(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.TELEGRAM,
            name="Telegram main",
            created_by=self.owner,
        )

        first, first_created = normalize_business_event(
            business=self.business,
            connector=connector,
            source="telegram",
            event_type="message_received",
            external_id="update-1",
            payload={"text": "hello"},
        )
        second, second_created = normalize_business_event(
            business=self.business,
            connector=connector,
            source="telegram",
            event_type="message_received",
            external_id="update-1",
            payload={"text": "hello"},
        )

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first.id, second.id)
        self.assertEqual(BusinessEvent.objects.count(), 1)

    def test_crm_linked_business_event_writes_timeline_once(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.EXCEL_CSV,
            name="Excel import",
            created_by=self.owner,
        )
        client = self.business.clients.create(full_name="Timeline client")
        foreign_client = self.other_business.clients.create(full_name="Foreign timeline client")

        first, first_created = normalize_business_event(
            business=self.business,
            connector=connector,
            source="excel_csv",
            event_type="sale.recorded",
            external_id="sale-timeline-1",
            payload={"client_id": client.id, "amount": "15000", "api_key": "raw-event-key"},
        )
        second, second_created = normalize_business_event(
            business=self.business,
            connector=connector,
            source="excel_csv",
            event_type="sale.recorded",
            external_id="sale-timeline-1",
            payload={"client_id": client.id, "amount": "15000", "api_key": "raw-event-key"},
        )
        normalize_business_event(
            business=self.business,
            connector=connector,
            source="excel_csv",
            event_type="sale.recorded",
            external_id="sale-foreign-client",
            payload={"client_id": foreign_client.id, "amount": "9000"},
        )

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first.id, second.id)
        timeline = ActivityEvent.objects.get(
            business=self.business,
            client=client,
            event_type=ActivityEvents.INTEGRATION_EVENT,
            entity_type="BusinessEvent",
            entity_id=str(first.id),
        )
        self.assertEqual(timeline.category, ActivityEvent.Categories.SYSTEM)
        self.assertEqual(timeline.source, "excel_csv")
        self.assertEqual(timeline.metadata["integration_event_type"], "sale.recorded")
        self.assertEqual(timeline.metadata["connector_id"], connector.id)
        self.assertEqual(timeline.metadata["target_type"], "Client")
        self.assertEqual(timeline.metadata["target_id"], client.id)
        self.assertEqual(ActivityEvent.objects.filter(event_type=ActivityEvents.INTEGRATION_EVENT).count(), 1)
        self.assertNotIn("raw-event-key", str(first.payload_json))

    def test_owner_can_ingest_connector_event_once(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.WEBSITE,
            name="Website forms",
            auth_type=BusinessConnector.AuthTypes.NONE,
            created_by=self.owner,
        )
        self.api.force_authenticate(self.owner)

        first = self.api.post(
            f"/api/business-connectors/{connector.id}/events/",
            {"event_type": "form_submitted", "external_id": "form-1", "payload_json": {"name": "Aliya"}},
            format="json",
        )
        second = self.api.post(
            f"/api/business-connectors/{connector.id}/events/",
            {"event_type": "form_submitted", "external_id": "form-1", "payload_json": {"name": "Aliya"}},
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["id"], second.data["id"])

    def test_ingested_connector_event_sanitizes_secrets_before_storage(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.CUSTOM,
            name="Custom events",
            auth_type=BusinessConnector.AuthTypes.NONE,
            created_by=self.owner,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/business-connectors/{connector.id}/events/",
            {
                "event_type": "custom.secure_event",
                "external_id": "secure-event-1",
                "payload_json": {"amount": "15000", "api_key": "raw-api-key", "nested": {"access_token": "raw-access-token"}},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        event = BusinessEvent.objects.get(id=response.data["id"])
        self.assertEqual(event.payload_json["amount"], "15000")
        self.assertEqual(event.payload_json["api_key"], "configured")
        self.assertEqual(event.payload_json["nested"]["access_token"], "configured")
        self.assertNotIn("raw-api-key", str(event.payload_json))
        self.assertNotIn("raw-access-token", str(event.payload_json))

    @override_settings(SUPPORT_REQUIRES_GRANT=False)
    def test_whatsapp_and_instagram_connection_requests_are_platform_visible_without_secrets(self):
        self.api.force_authenticate(self.owner)

        whatsapp_response = self.api.post(
            "/api/business-connectors/",
            {
                "business": self.business.id,
                "provider": BusinessConnector.Providers.WHATSAPP,
                "name": "WhatsApp connection request",
                "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
                "auth_type": BusinessConnector.AuthTypes.QR,
                "config_json": {
                    "request_status": "pending_request",
                    "form": {
                        "company_name": "Connector Clinic",
                        "phone_number": "+77015550101",
                        "preferred_connection_type": "official_provider",
                        "comment": "Need official provider",
                    },
                },
            },
            format="json",
        )
        instagram_response = self.api.post(
            "/api/business-connectors/",
            {
                "business": self.business.id,
                "provider": BusinessConnector.Providers.INSTAGRAM,
                "name": "Instagram connection request",
                "capability": BusinessConnector.Capabilities.COMMUNICATIONS,
                "auth_type": BusinessConnector.AuthTypes.OAUTH,
                "config_json": {
                    "request_status": "pending_request",
                    "form": {
                        "instagram_username": "connector_clinic",
                        "facebook_page": "Connector Clinic",
                        "contact_person": "Owner",
                        "comment": "Owner approved request",
                    },
                },
            },
            format="json",
        )

        self.assertEqual(whatsapp_response.status_code, 201)
        self.assertEqual(instagram_response.status_code, 201)
        self.assertEqual(whatsapp_response.data["status"], BusinessConnector.Statuses.NEEDS_ATTENTION)
        self.assertEqual(instagram_response.data["status"], BusinessConnector.Statuses.NEEDS_ATTENTION)
        self.assertNotIn("password", str(instagram_response.data).lower())

        self.api.force_authenticate(self.platform_admin)
        platform_response = self.api.get("/api/business-connectors/")

        self.assertEqual(platform_response.status_code, 200)
        providers = {item["provider"] for item in platform_response.data["results"]}
        self.assertIn(BusinessConnector.Providers.WHATSAPP, providers)
        self.assertIn(BusinessConnector.Providers.INSTAGRAM, providers)

    def test_data_connector_request_and_mock_sync_event_work_without_full_sync(self):
        self.api.force_authenticate(self.owner)

        connector_response = self.api.post(
            "/api/business-connectors/",
            {
                "business": self.business.id,
                "provider": BusinessConnector.Providers.KASPI,
                "name": "Kaspi connector request",
                "capability": BusinessConnector.Capabilities.FINANCE,
                "auth_type": BusinessConnector.AuthTypes.CONNECTOR,
                "config_json": {
                    "request_status": "pending_request",
                    "pilot_mode": "request_or_import_only",
                    "no_write_back": True,
                },
            },
            format="json",
        )

        self.assertEqual(connector_response.status_code, 201)
        self.assertEqual(connector_response.data["status"], BusinessConnector.Statuses.NEEDS_ATTENTION)
        self.assertTrue(connector_response.data["config_json"]["no_write_back"])

        event_response = self.api.post(f"/api/business-connectors/{connector_response.data['id']}/mock-sync/", format="json")

        self.assertEqual(event_response.status_code, 201)
        self.assertEqual(len(event_response.data), 3)
        event_types = {event["event_type"] for event in event_response.data}
        self.assertIn(KASPI_EVENT_TYPES["order_imported"], event_types)
        self.assertIn(KASPI_EVENT_TYPES["sale_detected"], event_types)
        self.assertIn(KASPI_EVENT_TYPES["product_activity"], event_types)
        self.assertTrue(all(event["source"] == BusinessConnector.Providers.KASPI for event in event_response.data))

        second_event_response = self.api.post(f"/api/business-connectors/{connector_response.data['id']}/mock-sync/", format="json")

        self.assertEqual(second_event_response.status_code, 201)
        self.assertEqual(BusinessEvent.objects.filter(connector_id=connector_response.data["id"]).count(), 3)

    def test_kaspi_mock_events_are_read_only_visibility_events(self):
        events = build_kaspi_mock_events(prefix="clinic")

        self.assertEqual([event.event_type for event in events], [
            "kaspi_order_imported",
            "kaspi_sale_detected",
            "kaspi_product_activity",
        ])
        self.assertTrue(all(event.payload["read_only"] for event in events))
        self.assertTrue(all(event.payload["source"] == BusinessConnector.Providers.KASPI for event in events))

    def test_owner_can_configure_kaspi_token_and_run_read_only_mock_sync(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/kaspi-config/",
            {
                "business": self.business.id,
                "api_token": "kaspi-secret-token",
                "merchant_id": "merchant-1",
                "order_state": "ARCHIVE",
                "sync_days": 7,
                "page_size": 10,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["provider"], BusinessConnector.Providers.KASPI)
        self.assertEqual(response.data["status"], BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(response.data["config_json"]["api_token_configured"])
        self.assertTrue(response.data["config_json"]["read_only"])
        self.assertNotIn("kaspi-secret-token", str(response.data))
        connector = BusinessConnector.objects.get(id=response.data["id"])
        credential = ConnectorCredential.objects.get(connector=connector, key="api_token")
        self.assertEqual(decrypt_credential_value(credential.encrypted_value), "kaspi-secret-token")

        test_response = self.api.post(f"/api/business-connectors/{connector.id}/kaspi-test-connection/")
        sync_response = self.api.post(f"/api/business-connectors/{connector.id}/kaspi-sync-orders/")

        self.assertEqual(test_response.status_code, 200)
        self.assertTrue(test_response.data["ok"])
        self.assertTrue(test_response.data["mock"])
        self.assertEqual(sync_response.status_code, 201)
        self.assertTrue(sync_response.data["ok"])
        self.assertTrue(sync_response.data["mock"])
        self.assertEqual(BusinessEvent.objects.filter(connector=connector, source=BusinessConnector.Providers.KASPI).count(), 3)

    def test_kaspi_config_service_saves_masked_credentials_and_status_payload(self):
        connector, created = integration_services.save_provider_connector_config(
            business=self.business,
            user=self.owner,
            provider=BusinessConnector.Providers.KASPI,
            validated_data={
                "api_token": "kaspi-service-secret-token",
                "merchant_id": "merchant-service",
                "order_state": "ARCHIVE",
                "sync_days": 5,
                "page_size": 10,
            },
        )

        self.assertTrue(created)
        self.assertEqual(connector.provider, BusinessConnector.Providers.KASPI)
        self.assertEqual(connector.status, BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(connector.config_json["read_only"])
        self.assertTrue(connector.config_json["api_token_configured"])
        self.assertNotIn("kaspi-service-secret-token", str(connector.config_json))
        credential = ConnectorCredential.objects.get(connector=connector, key="api_token")
        self.assertEqual(decrypt_credential_value(credential.encrypted_value), "kaspi-service-secret-token")

        status_payload = integration_services.connector_status_payload(connector, BusinessConnector.Providers.KASPI)

        self.assertTrue(status_payload["api_token_configured"])
        self.assertEqual(status_payload["merchant_id"], "merchant-service")
        self.assertIn("kaspi_enabled", status_payload)

    def test_operator_cannot_run_connector_provider_action(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.KASPI,
            name="Kaspi",
            auth_type=BusinessConnector.AuthTypes.TOKEN,
            created_by=self.owner,
        )
        self.api.force_authenticate(self.operator)

        response = self.api.post(f"/api/business-connectors/{connector.id}/kaspi-test-connection/")

        self.assertIn(response.status_code, [403, 404])

    def test_other_merchant_cannot_run_connector_provider_action(self):
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.KASPI,
            name="Kaspi",
            auth_type=BusinessConnector.AuthTypes.TOKEN,
            created_by=self.owner,
        )
        self.api.force_authenticate(self.other_owner)

        response = self.api.post(f"/api/business-connectors/{connector.id}/kaspi-test-connection/")

        self.assertEqual(response.status_code, 404)

    def test_kaspi_orders_payload_normalizes_to_read_only_events(self):
        events = build_kaspi_events_from_orders(
            {
                "data": [
                    {
                        "id": "order-1",
                        "attributes": {
                            "code": "KSP-1",
                            "totalPrice": 18500,
                            "status": "COMPLETED",
                            "state": "ARCHIVE",
                            "paymentMode": "PAY_WITH_CREDIT",
                            "deliveryMode": "DELIVERY_LOCAL",
                            "creationDate": 1710000000000,
                        },
                    }
                ]
            }
        )

        self.assertEqual([event.event_type for event in events], [KASPI_EVENT_TYPES["order_imported"], KASPI_EVENT_TYPES["sale_detected"]])
        self.assertTrue(all(event.payload["read_only"] for event in events))
        self.assertEqual(events[0].payload["amount"], "18500")

    def test_one_c_adapter_reuses_excel_csv_import_entities(self):
        self.assertEqual(one_c_entity_to_import_type("clients"), ImportJob.EntityTypes.CLIENTS)
        self.assertEqual(one_c_entity_to_import_type("counterparties"), ImportJob.EntityTypes.CLIENTS)
        self.assertEqual(one_c_entity_to_import_type("sales"), ImportJob.EntityTypes.SALES)
        self.assertEqual(one_c_entity_to_import_type("products"), ImportJob.EntityTypes.CATALOG)
        self.assertEqual(one_c_entity_to_import_type("stock"), ImportJob.EntityTypes.CATALOG)

        events = build_one_c_mock_events(prefix="clinic")

        self.assertIn(ONE_C_EVENT_TYPES["sale"], [event["event_type"] for event in events])
        self.assertTrue(all(event["payload"]["read_only"] for event in events))
        self.assertTrue(all(event["payload"]["source"] == BusinessConnector.Providers.ONE_C for event in events))

    def test_moysklad_adapter_reuses_excel_csv_import_entities(self):
        self.assertEqual(moysklad_entity_to_import_type("clients"), ImportJob.EntityTypes.CLIENTS)
        self.assertEqual(moysklad_entity_to_import_type("sales"), ImportJob.EntityTypes.SALES)
        self.assertEqual(moysklad_entity_to_import_type("products"), ImportJob.EntityTypes.CATALOG)
        self.assertEqual(moysklad_entity_to_import_type("stock"), ImportJob.EntityTypes.CATALOG)

        events = build_moysklad_mock_events(prefix="clinic")

        self.assertIn(MOYSKLAD_EVENT_TYPES["stock"], [event["event_type"] for event in events])
        self.assertTrue(all(event["payload"]["read_only"] for event in events))
        self.assertTrue(all(event["payload"]["source"] == BusinessConnector.Providers.MOYSKLAD for event in events))

    def test_owner_can_configure_moysklad_token_and_run_mock_sync(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/moysklad-config/",
            {
                "business": self.business.id,
                "access_token": "moysklad-secret-token",
                "entities": ["products", "stock", "sales", "clients"],
                "page_size": 25,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["provider"], BusinessConnector.Providers.MOYSKLAD)
        self.assertEqual(response.data["auth_type"], BusinessConnector.AuthTypes.TOKEN)
        self.assertEqual(response.data["status"], BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(response.data["config_json"]["access_token_configured"])
        connector = BusinessConnector.objects.get(id=response.data["id"])
        credential = ConnectorCredential.objects.get(connector=connector, key="access_token")
        self.assertEqual(decrypt_credential_value(credential.encrypted_value), "moysklad-secret-token")

        test_response = self.api.post(f"/api/business-connectors/{connector.id}/moysklad-test-connection/")
        sync_response = self.api.post(f"/api/business-connectors/{connector.id}/moysklad-sync/")

        self.assertEqual(test_response.status_code, 200)
        self.assertTrue(test_response.data["ok"])
        self.assertTrue(test_response.data["mock"])
        self.assertEqual(sync_response.status_code, 201)
        self.assertTrue(sync_response.data["ok"])
        self.assertTrue(sync_response.data["mock"])
        self.assertEqual(BusinessEvent.objects.filter(connector=connector, source=BusinessConnector.Providers.MOYSKLAD).count(), 4)

    def test_moysklad_payloads_normalize_to_read_only_events(self):
        product_events = build_moysklad_product_events({"rows": [{"id": "prod-1", "name": "Serum", "article": "SKU-1"}]})
        stock_events = build_moysklad_stock_events({"rows": [{"assortmentId": "prod-1", "name": "Serum", "quantity": 7}]})
        sale_events = build_moysklad_sale_events({"rows": [{"id": "sale-1", "name": "0001", "sum": 1850000, "agent": {"name": "Buyer"}}]})

        self.assertEqual(product_events[0].event_type, MOYSKLAD_EVENT_TYPES["product"])
        self.assertEqual(stock_events[0].payload["quantity"], "7")
        self.assertEqual(sale_events[0].payload["amount"], "18500")
        self.assertTrue(product_events[0].payload["read_only"])

    def test_owner_can_configure_wildberries_token_and_run_mock_sync(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/wildberries-config/",
            {
                "business": self.business.id,
                "api_token": "wildberries-secret-token",
                "entities": ["orders", "sales"],
                "sync_days": 7,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["provider"], BusinessConnector.Providers.WILDBERRIES)
        self.assertEqual(response.data["auth_type"], BusinessConnector.AuthTypes.TOKEN)
        self.assertEqual(response.data["status"], BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(response.data["config_json"]["api_token_configured"])
        self.assertTrue(response.data["config_json"]["read_only"])
        self.assertNotIn("wildberries-secret-token", str(response.data))
        connector = BusinessConnector.objects.get(id=response.data["id"])
        credential = ConnectorCredential.objects.get(connector=connector, key="api_token")
        self.assertEqual(decrypt_credential_value(credential.encrypted_value), "wildberries-secret-token")

        test_response = self.api.post(f"/api/business-connectors/{connector.id}/wildberries-test-connection/")
        sync_response = self.api.post(f"/api/business-connectors/{connector.id}/wildberries-sync/")

        self.assertEqual(test_response.status_code, 200)
        self.assertTrue(test_response.data["ok"])
        self.assertTrue(test_response.data["mock"])
        self.assertEqual(sync_response.status_code, 201)
        self.assertTrue(sync_response.data["ok"])
        self.assertTrue(sync_response.data["mock"])
        self.assertEqual(BusinessEvent.objects.filter(connector=connector, source=BusinessConnector.Providers.WILDBERRIES).count(), 3)

    def test_wildberries_payloads_normalize_to_read_only_events(self):
        order_events = build_wildberries_events_from_orders([
            {"srid": "order-1", "gNumber": "WB-1", "nmId": 123, "supplierArticle": "SKU-1", "finishedPrice": 1200, "isCancel": False}
        ])
        sale_events = build_wildberries_events_from_sales([
            {"saleID": "S1", "srid": "sale-1", "forPay": 950, "supplierArticle": "SKU-1"}
        ])
        stock_events = build_wildberries_events_from_stocks([
            {"barcode": "barcode-1", "nmId": 123, "supplierArticle": "SKU-1", "quantityFull": 8}
        ])

        self.assertEqual(order_events[0].event_type, WILDBERRIES_EVENT_TYPES["order"])
        self.assertEqual(sale_events[0].event_type, WILDBERRIES_EVENT_TYPES["sale"])
        self.assertEqual(stock_events[0].event_type, WILDBERRIES_EVENT_TYPES["stock"])
        self.assertEqual(order_events[0].payload["amount"], "1200")
        self.assertEqual(stock_events[0].payload["quantity"], "8")
        self.assertTrue(order_events[0].payload["read_only"])

    def test_wildberries_mock_events_are_read_only_visibility_events(self):
        events = build_wildberries_mock_events(prefix="shop")

        self.assertEqual([event.event_type for event in events], [
            WILDBERRIES_EVENT_TYPES["order"],
            WILDBERRIES_EVENT_TYPES["sale"],
            WILDBERRIES_EVENT_TYPES["stock"],
        ])
        self.assertTrue(all(event.payload["read_only"] for event in events))
        self.assertTrue(all(event.payload["source"] == BusinessConnector.Providers.WILDBERRIES for event in events))

    def test_owner_can_configure_ozon_credentials_and_run_mock_sync(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/ozon-config/",
            {
                "business": self.business.id,
                "client_id": "ozon-client-id",
                "api_key": "ozon-secret-api-key",
                "entities": ["fbs_postings", "fbo_postings", "stocks"],
                "sync_days": 7,
                "limit": 25,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["provider"], BusinessConnector.Providers.OZON)
        self.assertEqual(response.data["auth_type"], BusinessConnector.AuthTypes.TOKEN)
        self.assertEqual(response.data["status"], BusinessConnector.Statuses.CONNECTED)
        self.assertTrue(response.data["config_json"]["client_id_configured"])
        self.assertTrue(response.data["config_json"]["api_key_configured"])
        self.assertTrue(response.data["config_json"]["read_only"])
        self.assertNotIn("ozon-secret-api-key", str(response.data))
        connector = BusinessConnector.objects.get(id=response.data["id"])
        self.assertEqual(decrypt_credential_value(ConnectorCredential.objects.get(connector=connector, key="client_id").encrypted_value), "ozon-client-id")
        self.assertEqual(decrypt_credential_value(ConnectorCredential.objects.get(connector=connector, key="api_key").encrypted_value), "ozon-secret-api-key")

        test_response = self.api.post(f"/api/business-connectors/{connector.id}/ozon-test-connection/")
        sync_response = self.api.post(f"/api/business-connectors/{connector.id}/ozon-sync/")

        self.assertEqual(test_response.status_code, 200)
        self.assertTrue(test_response.data["ok"])
        self.assertTrue(test_response.data["mock"])
        self.assertEqual(sync_response.status_code, 201)
        self.assertTrue(sync_response.data["ok"])
        self.assertTrue(sync_response.data["mock"])
        self.assertEqual(BusinessEvent.objects.filter(connector=connector, source=BusinessConnector.Providers.OZON).count(), 3)

    def test_ozon_payloads_normalize_to_read_only_events(self):
        fbs_events = build_ozon_events_from_fbs_postings(
            {
                "result": {
                    "postings": [
                        {
                            "posting_number": "FBS-1",
                            "status": "awaiting_packaging",
                            "products": [{"offer_id": "SKU-1", "price": "1200"}],
                        }
                    ]
                }
            }
        )
        fbo_events = build_ozon_events_from_fbo_postings({"result": {"postings": [{"posting_number": "FBO-1", "status": "delivered", "products": []}]}})
        stock_events = build_ozon_events_from_stocks({"result": {"items": [{"product_id": 1, "offer_id": "SKU-1", "stocks": [{"present": 7}, {"present": 2}]}]}})

        self.assertEqual(fbs_events[0].event_type, OZON_EVENT_TYPES["fbs_posting"])
        self.assertEqual(fbo_events[0].event_type, OZON_EVENT_TYPES["fbo_posting"])
        self.assertEqual(stock_events[0].event_type, OZON_EVENT_TYPES["stock"])
        self.assertEqual(fbs_events[0].payload["amount"], "1200")
        self.assertEqual(stock_events[0].payload["total_stock"], "9")
        self.assertTrue(fbs_events[0].payload["read_only"])

    def test_ozon_mock_events_are_read_only_visibility_events(self):
        events = build_ozon_mock_events(prefix="shop")

        self.assertEqual([event.event_type for event in events], [
            OZON_EVENT_TYPES["fbs_posting"],
            OZON_EVENT_TYPES["fbo_posting"],
            OZON_EVENT_TYPES["stock"],
        ])
        self.assertTrue(all(event.payload["read_only"] for event in events))
        self.assertTrue(all(event.payload["source"] == BusinessConnector.Providers.OZON for event in events))


class ConnectorOnboardingCatalogTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="catalog-owner",
            email="catalog-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Catalog Clinic", slug="catalog-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)

    def test_capabilities_include_pilot_onboarding_metadata(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/business-connectors/capabilities/")

        self.assertEqual(response.status_code, 200)
        by_provider = {item["provider"]: item for item in response.data}
        self.assertIn(BusinessConnector.Providers.WEBSITE, by_provider)
        self.assertIn(BusinessConnector.Providers.EXCEL_CSV, by_provider)
        self.assertIn(BusinessConnector.Providers.WHATSAPP, by_provider)
        self.assertIn(BusinessConnector.Providers.KASPI, by_provider)
        self.assertEqual(by_provider[BusinessConnector.Providers.WEBSITE]["launch_status"], "available")
        self.assertEqual(by_provider[BusinessConnector.Providers.EXCEL_CSV]["launch_status"], "available")
        self.assertTrue(by_provider[BusinessConnector.Providers.EXCEL_CSV]["is_pilot_safe"])
        self.assertEqual(by_provider[BusinessConnector.Providers.KASPI]["launch_status"], "beta")
        self.assertTrue(by_provider[BusinessConnector.Providers.KASPI]["is_pilot_safe"])
        self.assertIn("next_step", by_provider[BusinessConnector.Providers.WHATSAPP])
        self.assertIn("pilot_note", by_provider[BusinessConnector.Providers.INSTAGRAM])
        self.assertEqual(by_provider[BusinessConnector.Providers.WEBSITE]["availability"], "included")
        self.assertEqual(by_provider[BusinessConnector.Providers.WEBSITE]["required_plan"], "basic")
        self.assertEqual(by_provider[BusinessConnector.Providers.WEBSITE]["action_behavior"], "self_service")
        self.assertEqual(by_provider[BusinessConnector.Providers.WHATSAPP]["availability"], "included")
        self.assertEqual(by_provider[BusinessConnector.Providers.WHATSAPP]["action_behavior"], "self_service")
        self.assertEqual(by_provider[BusinessConnector.Providers.KASPI]["setup_state"], "setup_required")
        self.assertEqual(by_provider[BusinessConnector.Providers.MOYSKLAD]["launch_status"], "beta")
        self.assertEqual(by_provider[BusinessConnector.Providers.MOYSKLAD]["availability"], "included")
        self.assertTrue(by_provider[BusinessConnector.Providers.MOYSKLAD]["is_pilot_safe"])
        self.assertEqual(by_provider[BusinessConnector.Providers.WILDBERRIES]["launch_status"], "beta")
        self.assertEqual(by_provider[BusinessConnector.Providers.WILDBERRIES]["availability"], "included")
        self.assertTrue(by_provider[BusinessConnector.Providers.WILDBERRIES]["is_pilot_safe"])
        self.assertEqual(by_provider[BusinessConnector.Providers.OZON]["launch_status"], "beta")
        self.assertEqual(by_provider[BusinessConnector.Providers.OZON]["availability"], "included")
        self.assertTrue(by_provider[BusinessConnector.Providers.OZON]["is_pilot_safe"])

    def test_owner_can_create_excel_csv_connector_without_secret(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/business-connectors/",
            {
                "business": self.business.id,
                "provider": BusinessConnector.Providers.EXCEL_CSV,
                "name": "Excel / CSV imports",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["capability"], BusinessConnector.Capabilities.SALES)
        self.assertEqual(response.data["auth_type"], BusinessConnector.AuthTypes.NONE)
        self.assertEqual(response.data["status"], BusinessConnector.Statuses.CONNECTED)
