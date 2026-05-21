from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.notifications.models import Notification


class NotificationCenterTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="notification-owner",
            email="notification-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="notification-other",
            email="notification-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Notify Clinic", slug="notify-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Notify", slug="other-notify")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client_obj = Client.objects.create(business=self.business, full_name="Notify Client", phone="+77015551010")
        other_client = Client.objects.create(business=self.other_business, full_name="Hidden Client", phone="+77015551011")
        self.notification = Notification.objects.create(
            business=self.business,
            client=self.client_obj,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            priority=Notification.Priorities.URGENT,
            text="Позвонить клиенту",
            send_at=timezone.now() - timezone.timedelta(minutes=5),
            action_url="/leads",
            action_label="Открыть заявки",
        )
        Notification.objects.create(
            business=self.other_business,
            client=other_client,
            channel=Notification.Channels.SYSTEM,
            text="Hidden",
            send_at=timezone.now(),
        )
        self.client.force_authenticate(self.owner)

    def test_summary_and_unread_filters_are_tenant_safe(self):
        summary = self.client.get("/api/notifications/summary/")
        unread = self.client.get("/api/notifications/", {"unread": "true", "priority": Notification.Priorities.URGENT})

        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["unread"], 1)
        self.assertEqual(summary.data["urgent"], 1)
        self.assertEqual(summary.data["by_category"][Notification.Categories.SALES], 1)
        self.assertEqual(unread.data["count"], 1)
        self.assertEqual(unread.data["results"][0]["id"], self.notification.id)
        self.assertEqual(unread.data["results"][0]["action_url"], "/leads")

    def test_mark_read_and_mark_all_read(self):
        mark_response = self.client.post(f"/api/notifications/{self.notification.id}/mark-read/")
        self.notification.refresh_from_db()
        self.assertEqual(mark_response.status_code, 200)
        self.assertIsNotNone(self.notification.read_at)

        second = Notification.objects.create(
            business=self.business,
            client=self.client_obj,
            text="Second",
            send_at=timezone.now(),
            category=Notification.Categories.TASKS,
        )
        response = self.client.post("/api/notifications/mark-all-read/")
        second.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated"], 1)
        self.assertIsNotNone(second.read_at)
