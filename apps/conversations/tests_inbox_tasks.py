from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.bots.models import Bot, BotConversation
from apps.businesses.access import Actions, Resources, ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.clients.models import Client
from apps.crm.models import Deal
from apps.crm.services import ensure_default_pipeline
from apps.leads.models import Lead
from apps.tasks.models import Task


class InboxCreateTaskTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = self._user("inbox-owner@example.com", User.Roles.BUSINESS_OWNER)
        self.staff = self._user("inbox-staff@example.com", User.Roles.STAFF)
        self.other_owner = self._user("inbox-other@example.com", User.Roles.BUSINESS_OWNER)
        self.business = Business.objects.create(owner=self.owner, name="Inbox Tasks", slug="inbox-tasks")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Inbox Tasks", slug="other-inbox-tasks")
        ensure_default_roles(self.business)
        ensure_default_roles(self.other_business)
        self._member(self.business, self.owner, BusinessMember.Roles.OWNER)
        self._member(self.business, self.staff, BusinessMember.Roles.STAFF)
        self._member(self.other_business, self.other_owner, BusinessMember.Roles.OWNER)
        self.pipeline = ensure_default_pipeline(self.business)
        ensure_default_pipeline(self.other_business)
        self.stage = self.pipeline.stages.order_by("order").first()
        self.bot = Bot.objects.create(business=self.business, name="Inbox bot", status=Bot.Statuses.ACTIVE)
        self.client = Client.objects.create(business=self.business, full_name="Inbox Client", phone="+77010000000")
        self.lead = Lead.objects.create(business=self.business, client=self.client, message="Need a follow-up")
        self.deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            lead=self.lead,
            pipeline=self.pipeline,
            stage=self.stage,
            title="Inbox Deal",
            owner=self.owner,
        )
        self.conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="+77010000000",
            client=self.client,
            lead=self.lead,
            deal=self.deal,
        )

    def _user(self, email, role):
        return User.objects.create_user(
            username=email,
            email=email,
            password="pass12345",
            role=role,
            full_name=email.split("@")[0],
        )

    def _member(self, business, user, role):
        return BusinessMember.objects.create(
            business=business,
            user=user,
            role=role,
            business_role=BusinessRole.objects.get(business=business, preset_key=role),
            is_active=True,
        )

    def test_create_task_from_inbox_uses_service_contract(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            {"title": "Call from inbox", "description": "Discuss request", "priority": "high"},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        task = Task.objects.get(id=response.data["id"])
        self.assertEqual(task.business, self.business)
        self.assertEqual(task.client, self.client)
        self.assertEqual(task.lead, self.lead)
        self.assertEqual(task.deal, self.deal)
        self.assertEqual(task.conversation, self.conversation)
        self.assertEqual(task.assignee, self.owner)
        self.assertEqual(task.created_by, self.owner)
        self.assertEqual(task.priority, Task.Priorities.HIGH)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.TASK_CREATED,
                entity_type="Task",
                entity_id=str(task.id),
                metadata__conversation_id=self.conversation.id,
                metadata__task_id=task.id,
            ).exists()
        )

    def test_create_task_from_inbox_uses_default_title(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            {"title": ""},
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["title"], "Follow up: Inbox Client")

    def test_create_task_from_inbox_requires_task_create_permission(self):
        inbox_viewer_role = BusinessRole.objects.create(
            business=self.business,
            name="Inbox viewer",
            preset_key="inbox-viewer",
        )
        RolePermission.objects.create(
            business_role=inbox_viewer_role,
            resource=Resources.CONVERSATIONS,
            action=Actions.VIEW,
            scope=RolePermission.Scopes.BUSINESS,
        )
        BusinessMember.objects.filter(business=self.business, user=self.staff).update(
            business_role=inbox_viewer_role,
            role=BusinessMember.Roles.STAFF,
        )
        self.api.force_authenticate(self.staff)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            {"title": "Staff cannot create"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Task.objects.filter(title="Staff cannot create").exists())

    def test_create_task_from_inbox_is_tenant_scoped(self):
        self.api.force_authenticate(self.other_owner)

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            {"title": "Foreign tenant task"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Task.objects.filter(title="Foreign tenant task").exists())
