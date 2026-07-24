from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.bots.models import Bot, BotConversation
from apps.businesses.access import Actions, Resources, ensure_default_roles
from apps.businesses.capabilities import ensure_business_capabilities
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.clients.models import Client
from apps.conversations.booking import create_appointment_from_conversation
from apps.conversations.services import create_task_from_conversation
from apps.core.domain_errors import ModuleDisabled
from apps.core.models import AuditLog
from apps.crm.models import Deal
from apps.crm.services import ensure_default_pipeline
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment
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
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=self.owner,
                action=AuditLog.Actions.CREATE,
                entity_type="Task",
                entity_id=str(task.id),
                metadata__event_type=ActivityEvents.TASK_CREATED,
                metadata__source="inbox",
            ).exists()
        )
        self.assertEqual(
            Notification.objects.filter(
                business=self.business,
                recipient=self.owner,
                category=Notification.Categories.TASKS,
                action_url=f"/app/tasks?task={task.id}",
            ).count(),
            1,
        )

    def test_create_task_from_inbox_replays_idempotency_key(self):
        self.api.force_authenticate(self.owner)
        payload = {"title": "Call from inbox once", "priority": "high"}
        headers = {"HTTP_IDEMPOTENCY_KEY": "inbox-task-once"}

        first = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            payload,
            format="json",
            **headers,
        )
        replay = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            payload,
            format="json",
            **headers,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.data["id"], first.data["id"])
        self.assertEqual(Task.objects.filter(conversation=self.conversation, title=payload["title"]).count(), 1)
        task = Task.objects.get(id=first.data["id"])
        self.assertEqual(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.TASK_CREATED,
                entity_type="Task",
                entity_id=str(task.id),
            ).count(),
            1,
        )
        self.assertEqual(
            AuditLog.objects.filter(
                business=self.business,
                action=AuditLog.Actions.CREATE,
                entity_type="Task",
                entity_id=str(task.id),
            ).count(),
            1,
        )
        self.assertEqual(
            Notification.objects.filter(
                business=self.business,
                category=Notification.Categories.TASKS,
                action_url=f"/app/tasks?task={task.id}",
            ).count(),
            1,
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
        before = self._side_effect_counts()

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            {"title": "Staff cannot create"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Task.objects.filter(title="Staff cannot create").exists())
        self.assertEqual(self._side_effect_counts(), before)

    def test_create_task_from_inbox_rejects_disabled_tasks_without_side_effects(self):
        self._disable_module("tasks")
        self.api.force_authenticate(self.owner)
        before = self._side_effect_counts()

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            {"title": "Disabled inbox task"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "module_disabled")
        self.assertEqual(response.data["errors"], {"module": "tasks"})
        self.assertEqual(self._side_effect_counts(), before)

    def test_create_task_service_rejects_disabled_tasks_without_side_effects(self):
        self._disable_module("tasks")
        before = self._side_effect_counts()

        with self.assertRaises(ModuleDisabled):
            create_task_from_conversation(
                conversation=self.conversation,
                actor=self.owner,
                title="Disabled service task",
            )

        self.assertEqual(self._side_effect_counts(), before)

    def test_create_appointment_from_inbox_rejects_disabled_appointments_without_side_effects(self):
        self._disable_module("appointments")
        self.api.force_authenticate(self.owner)
        before = self._side_effect_counts()

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-appointment/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "module_disabled")
        self.assertEqual(response.data["errors"], {"module": "appointments"})
        self.assertEqual(self._side_effect_counts(), before)

    def test_create_appointment_service_rejects_disabled_appointments_without_side_effects(self):
        self._disable_module("appointments")
        before = self._side_effect_counts()

        with self.assertRaises(ModuleDisabled):
            create_appointment_from_conversation(
                conversation=self.conversation,
                actor=self.owner,
                service_id=0,
                start_at=timezone.now(),
            )

        self.assertEqual(self._side_effect_counts(), before)

    def test_create_task_from_inbox_is_tenant_scoped(self):
        self._disable_module("tasks")
        self.api.force_authenticate(self.other_owner)
        before = self._side_effect_counts()

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-task/",
            {"title": "Foreign tenant task"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Task.objects.filter(title="Foreign tenant task").exists())
        self.assertEqual(self._side_effect_counts(), before)

    def test_create_appointment_from_inbox_is_tenant_scoped_before_capability_check(self):
        self._disable_module("appointments")
        self.api.force_authenticate(self.other_owner)
        before = self._side_effect_counts()

        response = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/create-appointment/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(self._side_effect_counts(), before)

    def _disable_module(self, module_key):
        ensure_business_capabilities(self.business)
        capability = self.business.capabilities.get(module_key=module_key)
        capability.is_enabled = False
        capability.save(update_fields=["is_enabled", "updated_at"])
        if hasattr(self.business, "_capability_map"):
            del self.business._capability_map

    def _side_effect_counts(self):
        return {
            "tasks": Task.objects.filter(business=self.business).count(),
            "appointments": Appointment.objects.filter(business=self.business).count(),
            "activity": ActivityEvent.objects.filter(business=self.business).count(),
            "audit": AuditLog.objects.filter(business=self.business).count(),
            "notifications": Notification.objects.filter(business=self.business).count(),
        }
