from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.integrations.connectors import decrypt_credential_value, normalize_business_event
from apps.integrations.models import BusinessConnector, BusinessEvent, ConnectorCredential


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

        event_response = self.api.post(
            f"/api/business-connectors/{connector_response.data['id']}/events/",
            {
                "event_type": "order_imported",
                "external_id": "kaspi-order-1",
                "payload_json": {"amount": 12000, "note": "mock sync only"},
            },
            format="json",
        )

        self.assertEqual(event_response.status_code, 201)
        self.assertEqual(event_response.data["event_type"], "order_imported")
        self.assertEqual(event_response.data["source"], BusinessConnector.Providers.KASPI)


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
        self.assertEqual(by_provider[BusinessConnector.Providers.KASPI]["launch_status"], "roadmap")
        self.assertFalse(by_provider[BusinessConnector.Providers.KASPI]["is_pilot_safe"])
        self.assertIn("next_step", by_provider[BusinessConnector.Providers.WHATSAPP])
        self.assertIn("pilot_note", by_provider[BusinessConnector.Providers.INSTAGRAM])
        self.assertEqual(by_provider[BusinessConnector.Providers.WEBSITE]["availability"], "included")
        self.assertEqual(by_provider[BusinessConnector.Providers.WEBSITE]["required_plan"], "basic")
        self.assertEqual(by_provider[BusinessConnector.Providers.WEBSITE]["action_behavior"], "self_service")
        self.assertEqual(by_provider[BusinessConnector.Providers.WHATSAPP]["availability"], "request")
        self.assertEqual(by_provider[BusinessConnector.Providers.KASPI]["setup_state"], "roadmap")

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
