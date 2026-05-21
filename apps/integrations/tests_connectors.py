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
