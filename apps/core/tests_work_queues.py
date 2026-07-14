from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.bots.models import Bot, BotConversation
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.scheduling.models import Appointment, Resource
from apps.services.models import Service
from apps.tasks.models import Task
from apps.core.work_queues import build_work_queues


class WorkQueuesTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="work-queue-owner",
            email="work-queue-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="work-queue-other",
            email="work-queue-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Queue Clinic", slug="queue-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Queue", slug="other-queue")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(business=self.business, full_name="Queue Client")
        self.service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        self.resource = Resource.objects.create(business=self.business, name="Room 1")
        self.bot = Bot.objects.create(business=self.business, name="Queue bot", status=Bot.Statuses.ACTIVE)
        self.pipeline = Pipeline.objects.create(business=self.business, name="Sales", slug="sales", is_default=True)
        self.stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=self.pipeline,
            name="Offer",
            order=1,
            probability=50,
            sla_minutes=60,
        )
        self.api.force_authenticate(self.owner)

    def test_work_queues_return_server_defined_attention_items(self):
        now = timezone.now()
        stale_lead = Lead.objects.create(
            business=self.business,
            client=self.client,
            status=Lead.Statuses.IN_PROGRESS,
            responsible_user=self.owner,
        )
        Lead.objects.filter(id=stale_lead.id).update(updated_at=now - timezone.timedelta(days=4))
        sla_deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.stage,
            title="SLA deal",
            amount=12000,
            stage_entered_at=now - timezone.timedelta(hours=2),
        )
        no_next_action_deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.stage,
            title="No next action",
            amount=5000,
            stage_entered_at=now,
        )
        overdue_task = Task.objects.create(
            business=self.business,
            client=self.client,
            title="Overdue task",
            due_at=now - timezone.timedelta(hours=1),
            status=Task.Statuses.OPEN,
        )
        Task.objects.create(
            business=self.business,
            client=self.client,
            deal=no_next_action_deal,
            title="Archived next step",
            due_at=now + timezone.timedelta(hours=1),
            status=Task.Statuses.OPEN,
            is_archived=True,
        )
        Appointment.objects.create(
            business=self.business,
            client=self.client,
            service=self.service,
            resource=self.resource,
            start_at=now + timezone.timedelta(hours=3),
            end_at=now + timezone.timedelta(hours=4),
            status=Appointment.Statuses.CONFIRMED,
        )
        appointment_to_confirm = Appointment.objects.create(
            business=self.business,
            client=self.client,
            service=self.service,
            resource=self.resource,
            start_at=now + timezone.timedelta(hours=5),
            end_at=now + timezone.timedelta(hours=6),
            status=Appointment.Statuses.CREATED,
        )
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            client=self.client,
            channel=BotConversation.Channels.WEBSITE,
            status=BotConversation.Statuses.OPEN,
            priority=BotConversation.Priorities.HIGH,
            unread_count=3,
            handoff_required=True,
            handoff_reason="Client asks for manager",
            last_message_at=now,
            last_inbound_at=now - timezone.timedelta(minutes=45),
        )

        response = self.api.get("/api/work-queues/", {"business": self.business.id, "limit": 5})
        inbox_summary = self.api.get("/api/inbox/conversations/summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["overdue_tasks"], 1)
        self.assertEqual(response.data["summary"]["stale_leads"], 1)
        self.assertEqual(response.data["summary"]["sla_overdue_deals"], 1)
        self.assertEqual(response.data["summary"]["no_next_action_deals"], 2)
        self.assertEqual(response.data["summary"]["upcoming_appointments"], 2)
        self.assertEqual(response.data["summary"]["appointment_confirmations"], 1)
        self.assertEqual(response.data["summary"]["unread_conversations"], 1)
        self.assertEqual(response.data["summary"]["handoff_conversations"], 1)
        self.assertEqual(response.data["summary"]["unread_sla_overdue_conversations"], 1)
        self.assertEqual(response.data["summary"]["handoff_sla_overdue_conversations"], 1)
        self.assertEqual(response.data["summary"]["total_attention"], 8)
        self.assertEqual(response.data["queues"]["sla_overdue_deals"][0]["id"], sla_deal.id)
        self.assertEqual(response.data["queues"]["appointment_confirmations"][0]["id"], appointment_to_confirm.id)
        self.assertEqual(response.data["queues"]["unread_conversations"][0]["id"], conversation.id)
        self.assertEqual(response.data["queues"]["handoff_conversations"][0]["id"], conversation.id)
        self.assertEqual(response.data["queues"]["unread_sla_overdue_conversations"][0]["id"], conversation.id)
        self.assertEqual(response.data["queues"]["unread_sla_overdue_conversations"][0]["reason"], "unread_sla_overdue")
        self.assertGreaterEqual(response.data["queues"]["unread_sla_overdue_conversations"][0]["sla_overdue_minutes"], 15)
        self.assertEqual(response.data["queues"]["handoff_sla_overdue_conversations"][0]["id"], conversation.id)
        self.assertEqual(response.data["queues"]["handoff_sla_overdue_conversations"][0]["reason"], "handoff_sla_overdue")
        self.assertGreaterEqual(response.data["queues"]["handoff_sla_overdue_conversations"][0]["sla_overdue_minutes"], 30)
        overdue_item = response.data["queues"]["overdue_tasks"][0]
        self.assertEqual(overdue_item["href"], f"/app/tasks?task={overdue_task.id}")
        self.assertEqual(overdue_item["conversation_id"], None)
        self.assertGreaterEqual(overdue_item["overdue_minutes"], 60)
        self.assertEqual(overdue_item["escalation_level"], "escalate")
        self.assertEqual(overdue_item["escalation_reason"], "overdue_1h")
        self.assertTrue(any(item["id"] == no_next_action_deal.id for item in response.data["queues"]["no_next_action_deals"]))
        self.assertEqual(inbox_summary.status_code, 200)
        self.assertEqual(inbox_summary.data["unread"], response.data["summary"]["unread_conversations"])
        self.assertEqual(inbox_summary.data["handoff_required"], response.data["summary"]["handoff_conversations"])
        self.assertEqual(inbox_summary.data["unread_sla_overdue"], response.data["summary"]["unread_sla_overdue_conversations"])
        self.assertEqual(inbox_summary.data["handoff_sla_overdue"], response.data["summary"]["handoff_sla_overdue_conversations"])
        self.assertTrue(any(item["priority"] == "urgent" for item in inbox_summary.data["next_actions"]))

    def test_work_queues_are_tenant_scoped(self):
        response = self.api.get("/api/work-queues/", {"business": self.other_business.id})

        self.assertEqual(response.status_code, 403)

    def test_overdue_task_escalation_levels_are_server_defined(self):
        now = timezone.now()
        Task.objects.create(
            business=self.business,
            client=self.client,
            title="Recently overdue",
            due_at=now - timezone.timedelta(minutes=10),
            priority=Task.Priorities.NORMAL,
        )
        Task.objects.create(
            business=self.business,
            client=self.client,
            title="High priority overdue",
            due_at=now - timezone.timedelta(minutes=10),
            priority=Task.Priorities.HIGH,
        )
        Task.objects.create(
            business=self.business,
            client=self.client,
            title="Urgent overdue",
            due_at=now - timezone.timedelta(minutes=5),
            priority=Task.Priorities.URGENT,
        )
        Task.objects.create(
            business=self.business,
            client=self.client,
            title="Critical overdue",
            due_at=now - timezone.timedelta(hours=25),
            priority=Task.Priorities.LOW,
        )
        Task.objects.create(
            business=self.business,
            client=self.client,
            title="Done overdue",
            due_at=now - timezone.timedelta(hours=25),
            status=Task.Statuses.DONE,
        )

        payload = build_work_queues(business=self.business, limit=10, now=now)
        items = {item["title"]: item for item in payload["queues"]["overdue_tasks"]}

        self.assertEqual(payload["summary"]["overdue_tasks"], 4)
        self.assertEqual(items["Recently overdue"]["escalation_level"], "watch")
        self.assertEqual(items["Recently overdue"]["escalation_reason"], "recently_overdue")
        self.assertEqual(items["High priority overdue"]["escalation_level"], "escalate")
        self.assertEqual(items["High priority overdue"]["escalation_reason"], "high_priority_overdue")
        self.assertEqual(items["Urgent overdue"]["escalation_level"], "critical")
        self.assertEqual(items["Urgent overdue"]["escalation_reason"], "urgent_overdue")
        self.assertEqual(items["Critical overdue"]["escalation_level"], "critical")
        self.assertEqual(items["Critical overdue"]["escalation_reason"], "overdue_24h")
