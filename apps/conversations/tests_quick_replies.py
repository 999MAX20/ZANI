from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.conversations.models import QuickReplyTemplate


class QuickReplyTemplateTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(username="qr-owner", email="qr-owner@example.com", password="pass")
        self.other_owner = User.objects.create_user(username="qr-other", email="qr-other@example.com", password="pass")
        self.support = User.objects.create_user(username="qr-support", email="qr-support@example.com", password="pass")
        self.business = Business.objects.create(owner=self.owner, name="Quick Clinic", slug="quick-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Quick", slug="other-quick")
        ensure_default_roles(self.business)
        ensure_default_roles(self.other_business)
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OWNER),
        )
        BusinessMember.objects.create(
            business=self.other_business,
            user=self.other_owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.other_business, preset_key=BusinessMember.Roles.OWNER),
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.support,
            role=BusinessMember.Roles.SUPPORT,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.SUPPORT),
        )
        self.api.force_authenticate(self.owner)

    def test_quick_reply_crud_is_tenant_safe(self):
        QuickReplyTemplate.objects.create(
            business=self.other_business,
            title="Hidden",
            text="Hidden text",
            channel=QuickReplyTemplate.Channels.WHATSAPP,
        )

        create_response = self.api.post(
            "/api/quick-replies/",
            {
                "business": self.business.id,
                "title": "Greeting",
                "text": "Здравствуйте! Чем можем помочь?",
                "channel": QuickReplyTemplate.Channels.WHATSAPP,
                "category": "sales",
                "is_active": True,
                "sort_order": 1,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        list_response = self.api.get("/api/quick-replies/", {"channel": QuickReplyTemplate.Channels.WHATSAPP})
        rows = list_response.data.get("results", list_response.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["title"], "Greeting")

    def test_quick_reply_management_requires_conversation_manage_permission(self):
        template = QuickReplyTemplate.objects.create(
            business=self.business,
            title="Owner template",
            text="Owner text",
            channel=QuickReplyTemplate.Channels.ALL,
        )
        self.api.force_authenticate(self.support)

        list_response = self.api.get("/api/quick-replies/")
        self.assertEqual(list_response.status_code, 200)
        rows = list_response.data.get("results", list_response.data)
        self.assertEqual(len(rows), 1)

        create_response = self.api.post(
            "/api/quick-replies/",
            {
                "business": self.business.id,
                "title": "Support template",
                "text": "Support text",
                "channel": QuickReplyTemplate.Channels.ALL,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 403)

        update_response = self.api.patch(
            f"/api/quick-replies/{template.id}/",
            {"title": "Changed"},
            format="json",
        )
        self.assertEqual(update_response.status_code, 403)

        delete_response = self.api.delete(f"/api/quick-replies/{template.id}/")
        self.assertEqual(delete_response.status_code, 403)
