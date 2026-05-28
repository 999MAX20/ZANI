from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.integrations.models import ApiToken, WebhookDeliveryLog, WebhookEndpoint
from apps.integrations.webhooks import deliver_webhook_event


def unwrap_response_list(response):
    if isinstance(response.data, dict) and "results" in response.data:
        return response.data["results"]
    return response.data


class PublicApiAndWebhookTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username="dev-owner", email="dev-owner@example.com", password="pass")
        self.operator = User.objects.create_user(username="dev-operator", email="dev-operator@example.com", password="pass")
        self.other_owner = User.objects.create_user(username="other-owner", email="other-owner@example.com", password="pass")
        self.business = Business.objects.create(owner=self.owner, name="Developer Clinic", slug="developer-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Clinic", slug="other-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.operator, role=BusinessMember.Roles.OPERATOR)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(business=self.business, full_name="API Client", phone="+77010000001")
        Client.objects.create(business=self.other_business, full_name="Hidden Client", phone="+77010000002")

    def test_scoped_token_can_access_public_clients_api(self):
        self.api.force_authenticate(self.owner)
        create_response = self.api.post(
            "/api/api-tokens/",
            {"business": self.business.id, "name": "Clients reader", "scopes_json": ["clients:read"]},
            format="json",
        )
        raw_token = create_response.data["token"]

        public_response = self.api.get("/api/public-api/clients/", HTTP_X_ZANI_API_KEY=raw_token)

        self.assertEqual(create_response.status_code, 201)
        self.assertNotEqual(raw_token, create_response.data["token_prefix"])
        self.assertEqual(public_response.status_code, 200)
        self.assertEqual(len(public_response.data), 1)
        self.assertEqual(public_response.data[0]["id"], self.client.id)
        token = ApiToken.objects.get(id=create_response.data["id"])
        self.assertNotEqual(token.token_hash, raw_token)
        self.assertIsNotNone(token.last_used_at)

    def test_unscoped_token_is_rejected_on_create(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/api-tokens/",
            {"business": self.business.id, "name": "No scopes", "scopes_json": []},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_unscoped_token_is_forbidden(self):
        raw_token = ApiToken.generate_raw_token()
        token = ApiToken.objects.create(business=self.business, name="No scope", scopes_json=["webhooks:manage"], created_by=self.owner)
        token.set_raw_token(raw_token)
        token.save()

        response = self.api.get("/api/public-api/clients/", HTTP_X_ZANI_API_KEY=raw_token)

        self.assertEqual(response.status_code, 403)

    def test_revoked_token_cannot_access_public_api(self):
        raw_token = ApiToken.generate_raw_token()
        token = ApiToken.objects.create(business=self.business, name="Revoked", scopes_json=["clients:read"], is_active=False, created_by=self.owner)
        token.set_raw_token(raw_token)
        token.save()

        response = self.api.get("/api/public-api/clients/", HTTP_X_ZANI_API_KEY=raw_token)

        self.assertEqual(response.status_code, 401)

    def test_token_rotate_and_revoke(self):
        self.api.force_authenticate(self.owner)
        create_response = self.api.post(
            "/api/api-tokens/",
            {"business": self.business.id, "name": "Rotating", "scopes_json": ["clients:read"]},
            format="json",
        )
        rotate_response = self.api.post(f"/api/api-tokens/{create_response.data['id']}/rotate/")
        revoke_response = self.api.post(f"/api/api-tokens/{create_response.data['id']}/revoke/")

        self.assertEqual(rotate_response.status_code, 200)
        self.assertIn("token", rotate_response.data)
        self.assertEqual(revoke_response.status_code, 200)
        self.assertFalse(revoke_response.data["is_active"])

    def test_operator_cannot_manage_developer_tokens_or_webhooks(self):
        self.api.force_authenticate(self.operator)

        token_response = self.api.post(
            "/api/api-tokens/",
            {"business": self.business.id, "name": "Operator token", "scopes_json": ["clients:read"]},
            format="json",
        )
        webhook_response = self.api.post(
            "/api/webhook-endpoints/",
            {"business": self.business.id, "name": "Operator hook", "url": "mock://success", "events_json": ["system.test"]},
            format="json",
        )

        self.assertEqual(token_response.status_code, 403)
        self.assertEqual(webhook_response.status_code, 403)

    def test_webhook_endpoint_rejects_local_and_private_urls(self):
        self.api.force_authenticate(self.owner)

        localhost_response = self.api.post(
            "/api/webhook-endpoints/",
            {"business": self.business.id, "name": "Local hook", "url": "http://127.0.0.1:8000/internal", "events_json": ["system.test"]},
            format="json",
        )
        private_response = self.api.post(
            "/api/webhook-endpoints/",
            {"business": self.business.id, "name": "Private hook", "url": "http://10.0.0.5/hook", "events_json": ["system.test"]},
            format="json",
        )

        self.assertEqual(localhost_response.status_code, 400)
        self.assertEqual(private_response.status_code, 400)
        self.assertEqual(WebhookEndpoint.objects.count(), 0)

    def test_webhook_delivery_success_and_failure_are_logged(self):
        self.api.force_authenticate(self.owner)
        success_response = self.api.post(
            "/api/webhook-endpoints/",
            {"business": self.business.id, "name": "Success hook", "url": "mock://success", "events_json": ["system.test"]},
            format="json",
        )
        fail_response = self.api.post(
            "/api/webhook-endpoints/",
            {"business": self.business.id, "name": "Fail hook", "url": "mock://fail", "events_json": ["system.test"]},
            format="json",
        )

        success_delivery = self.api.post(f"/api/webhook-endpoints/{success_response.data['id']}/test-delivery/")
        failed_delivery = self.api.post(f"/api/webhook-endpoints/{fail_response.data['id']}/test-delivery/")
        retry_response = self.api.post(f"/api/webhook-deliveries/{failed_delivery.data['id']}/retry/")

        self.assertEqual(success_delivery.status_code, 200)
        self.assertEqual(success_delivery.data["status"], WebhookDeliveryLog.Statuses.SENT)
        self.assertEqual(failed_delivery.status_code, 200)
        self.assertEqual(failed_delivery.data["status"], WebhookDeliveryLog.Statuses.FAILED)
        self.assertEqual(retry_response.status_code, 200)
        self.assertGreaterEqual(retry_response.data["attempts"], 2)
        self.assertEqual(WebhookEndpoint.objects.count(), 2)

    def test_webhook_delivery_sanitizes_payload_before_storage(self):
        endpoint = WebhookEndpoint.objects.create(
            business=self.business,
            name="Secure hook",
            url="mock://success",
            events_json=["system.test"],
            created_by=self.owner,
        )

        log = deliver_webhook_event(
            endpoint,
            "system.test",
            {"visible": True, "api_key": "raw-api-key", "nested": {"access_token": "raw-access-token"}},
            "secure-delivery",
        )

        self.assertEqual(log.status, WebhookDeliveryLog.Statuses.SENT)
        self.assertTrue(log.payload_json["visible"])
        self.assertEqual(log.payload_json["api_key"], "configured")
        self.assertEqual(log.payload_json["nested"]["access_token"], "configured")
        self.assertNotIn("raw-api-key", str(log.payload_json))
        self.assertNotIn("raw-access-token", str(log.payload_json))

    def test_other_merchant_cannot_see_webhooks_or_tokens(self):
        ApiToken.objects.create(business=self.business, name="Hidden token", scopes_json=["clients:read"], created_by=self.owner)
        endpoint = WebhookEndpoint.objects.create(business=self.business, name="Hidden hook", url="mock://success", created_by=self.owner)
        WebhookDeliveryLog.objects.create(
            business=self.business,
            endpoint=endpoint,
            event_type="system.test",
            idempotency_key="hidden",
            payload_json={},
        )
        self.api.force_authenticate(self.other_owner)

        token_response = self.api.get("/api/api-tokens/")
        endpoint_response = self.api.get("/api/webhook-endpoints/")
        delivery_response = self.api.get("/api/webhook-deliveries/")

        self.assertEqual(token_response.status_code, 200)
        self.assertEqual(endpoint_response.status_code, 200)
        self.assertEqual(delivery_response.status_code, 200)
        self.assertEqual(unwrap_response_list(token_response), [])
        self.assertEqual(unwrap_response_list(endpoint_response), [])
        self.assertEqual(unwrap_response_list(delivery_response), [])
