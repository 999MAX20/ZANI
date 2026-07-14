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
        self.manager = User.objects.create_user(
            username="custom-fields-manager",
            email="custom-fields-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Fields Clinic", slug="fields-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Fields", slug="other-fields")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.manager, role=BusinessMember.Roles.MANAGER)
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

    def test_bulk_upsert_validates_custom_field_value_type(self):
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
                "values": [{"definition": definition.id, "value_json": {"value": "not-a-date"}}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(CustomFieldValue.objects.filter(definition=definition, entity_id=str(self.client.id)).exists())

    def test_bulk_upsert_validates_select_options_and_normalizes_numbers(self):
        select_definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="loyalty",
            label="Loyalty",
            field_type=CustomFieldDefinition.FieldTypes.SELECT,
            options_json={"options": ["A", "B"]},
        )
        number_definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="score",
            label="Score",
            field_type=CustomFieldDefinition.FieldTypes.NUMBER,
        )

        invalid = self.api.post(
            "/api/custom-field-values/bulk-upsert/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "values": [{"definition": select_definition.id, "value_json": {"value": "C"}}],
            },
            format="json",
        )
        valid = self.api.post(
            "/api/custom-field-values/bulk-upsert/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "values": [
                    {"definition": select_definition.id, "value_json": {"value": "A"}},
                    {"definition": number_definition.id, "value_json": {"value": "10,5"}},
                ],
            },
            format="json",
        )

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(valid.status_code, 200)
        self.assertEqual(CustomFieldValue.objects.get(definition=number_definition).value_json["value"], "10.5")

    def test_bulk_upsert_requires_json_boolean_for_boolean_fields(self):
        definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="consent",
            label="Consent",
            field_type=CustomFieldDefinition.FieldTypes.BOOLEAN,
        )

        invalid = self.api.post(
            "/api/custom-field-values/bulk-upsert/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "values": [{"definition": definition.id, "value_json": {"value": "true"}}],
            },
            format="json",
        )
        valid = self.api.post(
            "/api/custom-field-values/bulk-upsert/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "values": [{"definition": definition.id, "value_json": {"value": True}}],
            },
            format="json",
        )

        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(valid.status_code, 200)
        self.assertIs(CustomFieldValue.objects.get(definition=definition).value_json["value"], True)

    def test_bulk_upsert_is_atomic_when_one_value_is_invalid(self):
        text_definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="notes",
            label="Notes",
            field_type=CustomFieldDefinition.FieldTypes.TEXT,
        )
        date_definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="next_date",
            label="Next date",
            field_type=CustomFieldDefinition.FieldTypes.DATE,
        )

        response = self.api.post(
            "/api/custom-field-values/bulk-upsert/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "values": [
                    {"definition": text_definition.id, "value_json": {"value": "Saved only if all valid"}},
                    {"definition": date_definition.id, "value_json": {"value": "tomorrow"}},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(CustomFieldValue.objects.filter(definition=text_definition, entity_id=str(self.client.id)).exists())

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

    def test_custom_field_view_roles_hide_definition_and_value(self):
        owner_only = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="owner_private",
            label="Owner private",
            permissions_json={"view_roles": [BusinessMember.Roles.OWNER], "edit_roles": [BusinessMember.Roles.OWNER]},
        )
        manager_visible = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="manager_visible",
            label="Manager visible",
            permissions_json={"view_roles": [BusinessMember.Roles.MANAGER], "edit_roles": [BusinessMember.Roles.OWNER]},
        )
        CustomFieldValue.objects.create(
            business=self.business,
            definition=owner_only,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            entity_id=str(self.client.id),
            value_json={"value": "secret"},
        )
        CustomFieldValue.objects.create(
            business=self.business,
            definition=manager_visible,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            entity_id=str(self.client.id),
            value_json={"value": "visible"},
        )
        self.api.force_authenticate(self.manager)

        definitions_response = self.api.get("/api/custom-fields/", {"entity_type": "client"})
        values_response = self.api.get(
            "/api/custom-field-values/",
            {"entity_type": "client", "entity_id": str(self.client.id)},
        )

        self.assertEqual(definitions_response.status_code, 200)
        self.assertEqual([item["key"] for item in definitions_response.data["results"]], ["manager_visible"])
        self.assertEqual(values_response.status_code, 200)
        self.assertEqual([item["definition"] for item in values_response.data["results"]], [manager_visible.id])

    def test_custom_field_edit_roles_block_bulk_upsert(self):
        definition = CustomFieldDefinition.objects.create(
            business=self.business,
            entity_type=CustomFieldDefinition.EntityTypes.CLIENT,
            key="owner_edit_only",
            label="Owner edit only",
            permissions_json={"view_roles": [BusinessMember.Roles.MANAGER], "edit_roles": [BusinessMember.Roles.OWNER]},
        )
        self.api.force_authenticate(self.manager)

        response = self.api.post(
            "/api/custom-field-values/bulk-upsert/",
            {
                "business": self.business.id,
                "entity_type": "client",
                "entity_id": str(self.client.id),
                "values": [{"definition": definition.id, "value_json": {"value": "blocked"}}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(CustomFieldValue.objects.filter(definition=definition, entity_id=str(self.client.id)).exists())
