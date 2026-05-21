from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import CustomFieldDefinition, CustomFieldValue


class CustomFieldsFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="custom-fields-owner",
            email="custom-fields-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="custom-fields-other",
            email="custom-fields-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Fields Clinic", slug="fields-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Fields", slug="other-fields")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(business=self.business, full_name="Custom Client")
        self.api.force_authenticate(self.owner)

    def test_business_can_create_client_custom_field(self):
        response = self.api.post(
            "/api/custom-fields/",
            {
                "business": self.business.id,
                "entity_type": CustomFieldDefinition.EntityTypes.CLIENT,
                "key": "loyalty_level",
                "label": "Loyalty level",
                "field_type": CustomFieldDefinition.FieldTypes.SELECT,
                "options_json": {"options": ["A", "B"]},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["key"], "loyalty_level")

    def test_bulk_upsert_saves_value_for_client_and_card_returns_it(self):
        definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="birthday",
            label="Birthday",
            field_type=CustomFieldDefinition.FieldTypes.DATE,
        )

        response = self.api.post(
            "/api/custom-field-values/bulk-upsert/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "values": [{"definition": definition.id, "value_json": {"value": "2026-05-14"}}],
            },
            format="json",
        )
        card_response = self.api.get(f"/api/clients/{self.client.id}/crm-card/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(CustomFieldValue.objects.filter(definition=definition, entity_id=str(self.client.id)).exists())
        self.assertEqual(card_response.status_code, 200)
        self.assertEqual(card_response.data["custom_fields"][0]["definition"]["key"], "birthday")
        self.assertEqual(card_response.data["custom_fields"][0]["value"]["value_json"]["value"], "2026-05-14")

    def test_custom_fields_are_tenant_filtered(self):
        CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="visible",
            label="Visible",
        )
        CustomFieldDefinition.objects.create(
            business=self.other_business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="hidden",
            label="Hidden",
        )

        response = self.api.get("/api/custom-fields/", {"entity_type": "client"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["key"], "visible")

    def test_bulk_upsert_rejects_foreign_definition(self):
        definition = CustomFieldDefinition.objects.create(
            business=self.other_business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="foreign",
            label="Foreign",
        )

        response = self.api.post(
            "/api/custom-field-values/bulk-upsert/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "values": [{"definition": definition.id, "value_json": {"value": "x"}}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
