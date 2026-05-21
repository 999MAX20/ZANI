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
