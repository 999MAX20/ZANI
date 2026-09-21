from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.bots.models import Bot, BotConversation
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.clients.models import Client
from apps.conversations.models import Conversation
from apps.core.models import AuditLog
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.services.models import Service
from apps.tasks.models import Task


class ClientArchiveDependencyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username="archive-owner", email="archive-owner@example.test")
        cls.business = Business.objects.create(owner=cls.owner, name="Archive", slug="archive-dependencies")
        BusinessMember.objects.create(business=cls.business, user=cls.owner, role=BusinessMember.Roles.OWNER)
        ensure_default_roles(cls.business)
        cls.viewer = User.objects.create_user(username="archive-viewer", email="archive-viewer@example.test")
        role = BusinessRole.objects.create(
            business=cls.business, name="Client editor", preset_key="custom",
        )
        for action in ("view", "update", "delete"):
            RolePermission.objects.create(business_role=role, resource="clients", action=action, is_allowed=action != "delete")
        BusinessMember.objects.create(business=cls.business, user=cls.viewer, role=BusinessMember.Roles.MANAGER, business_role=role)
        cls.other_owner = User.objects.create_user(username="archive-other", email="archive-other@example.test")
        cls.other_business = Business.objects.create(owner=cls.other_owner, name="Other", slug="archive-other")
        BusinessMember.objects.create(business=cls.other_business, user=cls.other_owner, role=BusinessMember.Roles.OWNER)
        cls.service = Service.objects.create(business=cls.business, name="Visit", duration_minutes=30)
        cls.pipeline = Pipeline.objects.create(business=cls.business, name="Sales", slug="sales")
        cls.stage = PipelineStage.objects.create(business=cls.business, pipeline=cls.pipeline, name="Open")
        cls.bot = Bot.objects.create(business=cls.business, name="Inbox fixture")

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def make_client(self, **kwargs):
        return Client.objects.create(business=self.business, full_name="Archive client", **kwargs)

    def archive(self, client, route):
        if route == "post":
            return self.api.post(f"/api/clients/{client.pk}/archive/", {"reason": "Finished"}, format="json")
        return self.api.delete(f"/api/clients/{client.pk}/", format="json")

    def make_work(self, kind, client, status, **kwargs):
        common = {"business": self.business, "client": client, "status": status, **kwargs}
        if kind == "lead":
            return Lead.objects.create(**common)
        if kind == "deal":
            return Deal.objects.create(**common, title="Private deal", pipeline=self.pipeline, stage=self.stage)
        if kind == "task":
            return Task.objects.create(**common, title="Private task")
        if kind == "appointment":
            start = timezone.now() + timedelta(days=1)
            return Appointment.objects.create(**common, service=self.service, start_at=start, end_at=start + timedelta(minutes=30))
        if kind == "conversation":
            return Conversation.objects.create(**common, channel=Conversation.Channels.MANUAL)
        return BotConversation.objects.create(**common, bot=self.bot, channel=BotConversation.Channels.WEBSITE)

    def assert_blocked_without_effects(self, client, route, work):
        before = (AuditLog.objects.count(), ActivityEvent.objects.count())
        response = self.archive(client, route)
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data["code"], "invalid_transition")
        self.assertFalse(response.data["retryable"])
        client.refresh_from_db()
        self.assertFalse(client.is_archived)
        self.assertIsNone(client.archived_at)
        for item in work:
            state = (item.status, item.is_archived)
            item.refresh_from_db()
            self.assertEqual((item.status, item.is_archived), state)
        self.assertEqual((AuditLog.objects.count(), ActivityEvent.objects.count()), before)

    def test_unfinished_task_blocks_both_archive_routes(self):
        for route in ("post", "delete"):
            with self.subTest(route=route):
                client = self.make_client()
                task = self.make_work("task", client, Task.Statuses.OPEN)
                self.assert_blocked_without_effects(client, route, [task])

    def test_every_nonterminal_relation_blocks_both_routes(self):
        states = {
            "lead": (Lead.Statuses.NEW, Lead.Statuses.CONTACTED, Lead.Statuses.IN_PROGRESS, Lead.Statuses.APPOINTMENT_CREATED),
            "deal": (Deal.Statuses.OPEN,),
            "task": (Task.Statuses.IN_PROGRESS,),
            "appointment": (Appointment.Statuses.CREATED, Appointment.Statuses.CONFIRMED, Appointment.Statuses.RESCHEDULED),
            "conversation": (Conversation.Statuses.OPEN,),
            "bot_conversation": (BotConversation.Statuses.OPEN,),
        }
        for route in ("post", "delete"):
            for kind, values in states.items():
                for status in values:
                    with self.subTest(route=route, kind=kind, status=status):
                        client = self.make_client()
                        work = self.make_work(kind, client, status)
                        self.assert_blocked_without_effects(client, route, [work])

    def test_human_handoff_blocks_without_running_bot_or_provider(self):
        client = self.make_client()
        conversation = self.make_work("bot_conversation", client, BotConversation.Statuses.OPEN, handoff_required=True, bot_enabled=False)
        self.assert_blocked_without_effects(client, "post", [conversation])

    def test_pending_handoff_on_closed_conversation_still_requires_resolution(self):
        client = self.make_client()
        conversation = self.make_work("bot_conversation", client, "closed", handoff_required=True)
        self.assert_blocked_without_effects(client, "post", [conversation])

    def test_tasks_linked_indirectly_to_client_block_archive(self):
        for kind, status in (("lead", "closed"), ("deal", "won"), ("appointment", "completed"), ("bot_conversation", "closed")):
            with self.subTest(kind=kind):
                client = self.make_client()
                parent = self.make_work(kind, client, status)
                field = "conversation" if kind == "bot_conversation" else kind
                task = Task.objects.create(business=self.business, title="Indirect work", **{field: parent})
                self.assert_blocked_without_effects(client, "post", [parent, task])

    def test_inbox_linked_through_lead_or_deal_blocks_archive(self):
        for kind, status in (("lead", "closed"), ("deal", "won")):
            with self.subTest(kind=kind):
                client = self.make_client()
                parent = self.make_work(kind, client, status)
                conversation = self.make_work("bot_conversation", None, "open", **{kind: parent})
                self.assert_blocked_without_effects(client, "post", [parent, conversation])

    def test_open_task_on_archived_inbox_is_still_unfinished_work(self):
        client = self.make_client()
        conversation = self.make_work("bot_conversation", client, "archived", is_archived=True)
        task = Task.objects.create(business=self.business, conversation=conversation, title="Retained follow-up")
        self.assert_blocked_without_effects(client, "post", [conversation, task])

    def test_finished_history_allows_archive_and_restore_without_cascade(self):
        states = {"lead": ("closed", "lost"), "deal": ("won", "lost"), "task": ("done", "cancelled"),
                  "appointment": ("completed", "cancelled", "no_show"), "conversation": ("closed", "archived"),
                  "bot_conversation": ("closed", "archived")}
        for route in ("post", "delete"):
            with self.subTest(route=route):
                client = self.make_client()
                work = [self.make_work(kind, client, status) for kind, values in states.items() for status in values]
                response = self.archive(client, route)
                self.assertEqual(response.status_code, 200 if route == "post" else 204)
                client.refresh_from_db()
                self.assertTrue(client.is_archived)
                self.assertEqual(client.archived_by_id, self.owner.pk)
                restored = self.api.post(f"/api/clients/{client.pk}/restore/", {}, format="json")
                self.assertEqual(restored.status_code, 200)
                for item in work:
                    state = (item.status, item.is_archived)
                    item.refresh_from_db()
                    self.assertEqual((item.status, item.is_archived), state)
                self.assertEqual(ActivityEvent.objects.filter(client=client, event_type=ActivityEvents.CLIENT_ARCHIVED).count(), 1)
                self.assertEqual(ActivityEvent.objects.filter(client=client, event_type=ActivityEvents.CLIENT_RESTORED).count(), 1)

    def test_archived_relations_and_other_client_work_do_not_block(self):
        client = self.make_client()
        for kind in ("lead", "deal", "task", "appointment", "conversation", "bot_conversation"):
            status = "new" if kind == "lead" else "created" if kind == "appointment" else "open"
            self.make_work(kind, client, status, is_archived=True)
        self.make_work("task", self.make_client(), "open")
        self.assertEqual(self.archive(client, "post").status_code, 200)

    def test_editor_without_archive_permission_cannot_use_either_route(self):
        self.api.force_authenticate(self.viewer)
        for route in ("post", "delete"):
            with self.subTest(route=route):
                client = self.make_client()
                response = self.archive(client, route)
                self.assertEqual(response.status_code, 403, response.data)
                client.refresh_from_db()
                self.assertFalse(client.is_archived)

    def test_explicit_archive_permission_allows_both_routes(self):
        membership = BusinessMember.objects.get(business=self.business, user=self.viewer)
        RolePermission.objects.filter(
            business_role=membership.business_role, resource="clients", action="delete",
        ).update(is_allowed=True)
        self.api.force_authenticate(self.viewer)
        for route, expected in (("post", 200), ("delete", 204)):
            with self.subTest(route=route):
                client = self.make_client()
                self.assertEqual(self.archive(client, route).status_code, expected)
                client.refresh_from_db()
                self.assertTrue(client.is_archived)
                self.assertEqual(client.archived_by_id, self.viewer.pk)

    def test_foreign_client_remains_hidden(self):
        client = Client.objects.create(business=self.other_business, full_name="Foreign client")
        for route in ("post", "delete"):
            self.assertEqual(self.archive(client, route).status_code, 404)

    def test_hidden_child_blocks_without_disclosing_its_fields_or_count(self):
        role = BusinessRole.objects.get(business=self.business, name="Client editor")
        role.permissions.filter(resource="clients", action="delete").update(is_allowed=True)
        RolePermission.objects.create(business_role=role, resource="tasks", action="view", is_allowed=False)
        self.api.force_authenticate(self.viewer)
        client = self.make_client()
        task = self.make_work("task", client, "open")
        self.assertEqual(self.api.get(f"/api/tasks/{task.pk}/").status_code, 404)
        response = self.archive(client, "post")
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data["errors"], {})
        self.assertNotIn("Private task", str(response.data))

    def test_generic_patch_cannot_bypass_archive_action(self):
        client = self.make_client()
        self.make_work("task", client, "open")
        self.api.patch(f"/api/clients/{client.pk}/", {"is_archived": True, "archive_reason": "Bypass"}, format="json")
        client.refresh_from_db()
        self.assertFalse(client.is_archived)
        self.assertEqual(client.archive_reason, "")

    def test_activity_failure_rolls_back_archive_and_audit(self):
        client = self.make_client()
        before = (AuditLog.objects.count(), ActivityEvent.objects.count())
        with patch("apps.core.archive.write_activity_event", side_effect=RuntimeError("synthetic archive failure")):
            response = self.archive(client, "post")
        self.assertEqual(response.status_code, 500)
        client.refresh_from_db()
        self.assertFalse(client.is_archived)
        self.assertEqual((AuditLog.objects.count(), ActivityEvent.objects.count()), before)

    def test_repeated_archive_does_not_duplicate_audit_or_activity(self):
        client = self.make_client()
        self.assertEqual(self.archive(client, "post").status_code, 200)
        before = (AuditLog.objects.count(), ActivityEvent.objects.count())
        response = self.api.post(f"/api/clients/{client.pk}/archive/?include_archived=true", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual((AuditLog.objects.count(), ActivityEvent.objects.count()), before)
