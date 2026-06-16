from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.bots.models import Bot, BotConversation
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.conversations.models import Conversation
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.services.models import Service
from apps.tasks.models import Task


class DuplicateDetectionFoundationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="duplicate-owner",
            email="duplicate-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="duplicate-other",
            email="duplicate-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Duplicate Clinic", slug="duplicate-clinic", timezone="Asia/Almaty")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Duplicate", slug="other-duplicate")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.target = Client.objects.create(business=self.business, full_name="Main Client", phone="+77015550101", email="main@example.com")
        self.duplicate = Client.objects.create(business=self.business, full_name="Duplicate Client", phone="8 701 555 01 01", email="duplicate@example.com")
        Client.objects.create(business=self.other_business, full_name="Hidden Client", phone="+77015550101")
        self.service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        self.api.force_authenticate(self.owner)

    def test_client_duplicate_check_normalizes_phone_and_is_tenant_scoped(self):
        response = self.api.post(
            "/api/clients/check-duplicates/",
            {"business": self.business.id, "phone": "+7 (701) 555-01-01"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in response.data["duplicates"]}
        self.assertEqual(ids, {self.target.id, self.duplicate.id})
        self.assertTrue(all("phone" in item["matched_fields"] for item in response.data["duplicates"]))

    def test_lead_duplicate_check_returns_related_leads(self):
        lead = Lead.objects.create(business=self.business, client=self.target, service=self.service, message="Existing lead")

        response = self.api.post(
            "/api/leads/check-duplicates/",
            {"business": self.business.id, "client": self.target.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["related_leads"][0]["id"], lead.id)

    def test_merge_transfers_related_entities_and_logs_activity(self):
        lead = Lead.objects.create(business=self.business, client=self.duplicate, service=self.service)
        start_at = datetime(2026, 5, 14, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=self.duplicate,
            lead=lead,
            service=self.service,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
        )
        Conversation.objects.create(business=self.business, client=self.duplicate, channel=Conversation.Channels.MANUAL)
        bot = Bot.objects.create(business=self.business, name="Merge bot")
        BotConversation.objects.create(business=self.business, bot=bot, channel=BotConversation.Channels.WEBSITE, client=self.duplicate)
        task = Task.objects.create(business=self.business, client=self.duplicate, lead=lead, title="Merge task")

        response = self.api.post(
            f"/api/clients/{self.target.id}/merge/",
            {"duplicate_client_id": self.duplicate.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Client.objects.filter(id=self.duplicate.id).exists())
        lead.refresh_from_db()
        appointment.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(lead.client, self.target)
        self.assertEqual(appointment.client, self.target)
        self.assertEqual(task.client, self.target)
        self.assertTrue(Conversation.objects.filter(client=self.target).exists())
        self.assertTrue(BotConversation.objects.filter(client=self.target).exists())
        self.assertTrue(ActivityEvent.objects.filter(business=self.business, client=self.target, event_type="client_merged").exists())

    def test_merge_rejects_foreign_duplicate(self):
        foreign = Client.objects.create(business=self.other_business, full_name="Foreign")

        response = self.api.post(
            f"/api/clients/{self.target.id}/merge/",
            {"duplicate_client_id": foreign.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_client_list_returns_summary_facets_and_enriched_row_fields(self):
        lead = Lead.objects.create(business=self.business, client=self.target, service=self.service, message="Need details")
        due_at = datetime(2026, 6, 20, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        Task.objects.create(business=self.business, client=self.target, lead=lead, title="Call client", due_at=due_at)
        bot = Bot.objects.create(business=self.business, name="Client list bot")
        BotConversation.objects.create(business=self.business, bot=bot, channel=BotConversation.Channels.WEBSITE, client=self.target)

        response = self.api.get("/api/clients/", {"q": "7015550101", "page_size": 10})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["summary"]["total"], 1)
        self.assertEqual(response.data["facets"]["source"][Client.Sources.MANUAL], 1)
        row = response.data["results"][0]
        self.assertEqual(row["id"], self.target.id)
        self.assertEqual(row["leads_count"], 1)
        self.assertEqual(row["tasks_count"], 1)
        self.assertEqual(row["conversations_count"], 1)
        self.assertEqual(row["next_step_title"], "Call client")
        self.assertIsNotNone(row["next_step_date"])
        self.assertIsNotNone(row["last_activity_at"])
