from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.bots.models import Bot, BotConversation
from apps.businesses.access import Actions, Resources
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.notifications.models import Notification, NotificationPreference
from apps.scheduling.models import Appointment
from apps.services.models import Service
from apps.tasks.models import Task, TaskComment
from apps.tasks.services import create_task_notification


class TasksAndNotificationsPolishTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="task-owner",
            email="task-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="other-task-owner",
            email="other-task-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Task Clinic", slug="task-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Task Clinic", slug="other-task-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(business=self.business, full_name="Task Client")
        self.other_client = Client.objects.create(business=self.other_business, full_name="Other Client")
        self.bot = Bot.objects.create(business=self.business, name="Task bot")
        self.other_bot = Bot.objects.create(business=self.other_business, name="Other task bot")
        self.conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            client=self.client,
            external_user_id="task-visitor",
        )
        self.other_conversation = BotConversation.objects.create(
            business=self.other_business,
            bot=self.other_bot,
            channel=BotConversation.Channels.WEBSITE,
            client=self.other_client,
            external_user_id="other-task-visitor",
        )
        self.service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = datetime(2026, 5, 13, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        self.appointment = Appointment.objects.create(
            business=self.business,
            client=self.client,
            service=self.service,
            start_at=start_at,
            end_at=start_at + timedelta(hours=1),
        )

    def test_quick_task_create_can_link_client_and_appointment(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Call before appointment",
                "client": self.client.id,
                "appointment": self.appointment.id,
                "conversation": self.conversation.id,
                "assignee": self.owner.id,
                "priority": Task.Priorities.HIGH,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(id=response.data["id"])
        self.assertEqual(task.created_by, self.owner)
        self.assertEqual(task.assignee, self.owner)
        self.assertEqual(task.client, self.client)
        self.assertEqual(task.appointment, self.appointment)
        self.assertEqual(task.conversation, self.conversation)
        my_tasks_response = self.api.get("/api/tasks/", {"tab": "my", "status": "active"})
        self.assertEqual(my_tasks_response.status_code, 200)
        self.assertIn(task.id, {item["id"] for item in my_tasks_response.data["results"]})

    def test_direct_task_create_replays_idempotency_key(self):
        self.api.force_authenticate(self.owner)
        payload = {
            "business": self.business.id,
            "title": "Create direct task once",
            "client": self.client.id,
            "assignee": self.owner.id,
        }
        headers = {"HTTP_IDEMPOTENCY_KEY": "direct-task-once"}

        first = self.api.post("/api/tasks/", payload, format="json", **headers)
        replay = self.api.post("/api/tasks/", payload, format="json", **headers)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.data["id"], first.data["id"])
        self.assertEqual(Task.objects.filter(business=self.business, title="Create direct task once").count(), 1)

    def test_task_api_rejects_nonblank_recurrence_rule(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Unsupported recurring task",
                "client": self.client.id,
                "recurrence_rule": "FREQ=WEEKLY",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("recurrence_rule", response.data)
        self.assertFalse(Task.objects.filter(title="Unsupported recurring task").exists())

    def test_task_api_ignores_blank_legacy_recurrence_rule(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Legacy compatible task",
                "client": self.client.id,
                "recurrence_rule": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertNotIn("recurrence_rule", response.data)
        self.assertEqual(Task.objects.get(id=response.data["id"]).recurrence_rule, "")

    def test_task_serializer_includes_display_fields_for_list_rows(self):
        task = Task.objects.create(
            business=self.business,
            title="Display task",
            client=self.client,
            appointment=self.appointment,
            conversation=self.conversation,
            assignee=self.owner,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/tasks/")

        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data["results"] if item["id"] == task.id)
        self.assertEqual(row["client_name"], self.client.full_name)
        self.assertEqual(row["appointment_service_name"], self.service.name)
        self.assertEqual(parse_datetime(row["appointment_start_at"]), self.appointment.start_at)
        self.assertEqual(row["conversation"], self.conversation.id)
        self.assertEqual(row["conversation_label"], self.client.full_name)
        self.assertEqual(row["conversation_channel"], BotConversation.Channels.WEBSITE)
        self.assertEqual(row["assignee_name"], self.owner.full_name)
        self.assertEqual(row["assignee_email"], self.owner.email)
        self.assertNotIn("recurrence_rule", row)

    def test_active_status_filter_excludes_done_and_cancelled_tasks(self):
        active = Task.objects.create(business=self.business, title="Active task", client=self.client)
        Task.objects.create(business=self.business, title="Done task", client=self.client, status=Task.Statuses.DONE)
        Task.objects.create(business=self.business, title="Cancelled task", client=self.client, status=Task.Statuses.CANCELLED)
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/tasks/", {"status": "active"})

        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(ids, {active.id})

    def test_task_filters_search_assignee_and_due_range(self):
        due_at = timezone.now() + timezone.timedelta(days=1)
        visible = Task.objects.create(
            business=self.business,
            title="Call premium client",
            description="Discuss renewal",
            client=self.client,
            assignee=self.owner,
            due_at=due_at,
        )
        Task.objects.create(
            business=self.business,
            title="Different task",
            client=self.client,
            due_at=due_at + timezone.timedelta(days=7),
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get(
            "/api/tasks/",
            {
                "search": "premium",
                "assignee": self.owner.id,
                "due_from": (due_at - timezone.timedelta(hours=1)).isoformat(),
                "due_to": (due_at + timezone.timedelta(hours=1)).isoformat(),
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["results"]], [visible.id])

    def test_task_rejects_related_objects_from_another_business(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Invalid task",
                "client": self.other_client.id,
            },
            format="json",
        )
        conversation_response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Invalid conversation task",
                "conversation": self.other_conversation.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(conversation_response.status_code, 400)

    def test_task_relation_filter_and_search_support_conversation(self):
        conversation_task = Task.objects.create(
            business=self.business,
            title="Conversation follow up",
            conversation=self.conversation,
        )
        Task.objects.create(business=self.business, title="Plain follow up")
        Task.objects.create(business=self.other_business, title="Hidden conversation task", conversation=self.other_conversation)
        self.api.force_authenticate(self.owner)

        relation_response = self.api.get("/api/tasks/", {"relation": "conversation"})
        none_response = self.api.get("/api/tasks/", {"relation": "none"})
        search_response = self.api.get("/api/tasks/", {"search": "task-visitor"})

        self.assertEqual(relation_response.status_code, 200)
        self.assertEqual([item["id"] for item in relation_response.data["results"]], [conversation_task.id])
        self.assertEqual(none_response.status_code, 200)
        self.assertNotIn(conversation_task.id, {item["id"] for item in none_response.data["results"]})
        self.assertEqual(search_response.status_code, 200)
        self.assertEqual([item["id"] for item in search_response.data["results"]], [conversation_task.id])

    def test_task_templates_require_task_view_permission(self):
        staff = User.objects.create_user(
            username="task-template-staff",
            email="task-template-staff@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        BusinessMember.objects.create(business=self.business, user=staff, role=BusinessMember.Roles.STAFF)
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/tasks/templates/", {"business": self.business.id})
        missing_business_response = self.api.get("/api/tasks/templates/")

        self.assertEqual(response.status_code, 200)
        keys = {item["key"] for item in response.data}
        self.assertIn("call_client", keys)
        self.assertIn("qualify_lead", keys)
        self.assertTrue(all(item["title"] and item["priority"] for item in response.data))
        self.assertEqual(missing_business_response.status_code, 400)

        self.api.force_authenticate(staff)
        staff_response = self.api.get("/api/tasks/templates/", {"business": self.business.id})

        self.assertEqual(staff_response.status_code, 200)

    def test_task_workload_groups_active_tasks_by_assignee(self):
        manager = User.objects.create_user(
            username="task-workload-manager",
            email="task-workload-manager@example.com",
            password="pass",
            role=User.Roles.STAFF,
            full_name="Workload Manager",
        )
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)
        now = timezone.now()
        Task.objects.create(
            business=self.business,
            title="Owner overdue",
            client=self.client,
            assignee=self.owner,
            due_at=now - timezone.timedelta(hours=2),
        )
        Task.objects.create(
            business=self.business,
            title="Owner snoozed",
            client=self.client,
            assignee=self.owner,
            due_at=now - timezone.timedelta(hours=2),
            snoozed_until=now + timezone.timedelta(hours=1),
        )
        Task.objects.create(
            business=self.business,
            title="Manager active",
            client=self.client,
            assignee=manager,
            status=Task.Statuses.IN_PROGRESS,
            priority=Task.Priorities.HIGH,
            due_at=now + timezone.timedelta(hours=2),
        )
        Task.objects.create(business=self.business, title="Unassigned active", client=self.client)
        Task.objects.create(
            business=self.business,
            title="Closed manager task",
            client=self.client,
            assignee=manager,
            status=Task.Statuses.DONE,
            due_at=now - timezone.timedelta(hours=1),
        )
        Task.objects.create(
            business=self.other_business,
            title="Hidden workload",
            assignee=self.other_owner,
            due_at=now - timezone.timedelta(hours=3),
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/tasks/workload/", {"business": self.business.id})
        missing_business_response = self.api.get("/api/tasks/workload/")
        forbidden_response = self.api.get("/api/tasks/workload/", {"business": self.other_business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["business"], self.business.id)
        self.assertEqual(response.data["totals"]["active_tasks"], 4)
        self.assertEqual(response.data["totals"]["overdue"], 1)
        self.assertEqual(response.data["totals"]["high_priority"], 1)
        self.assertEqual(response.data["totals"]["unassigned"], 1)
        items_by_user = {item["user_id"]: item for item in response.data["items"] if item["user_id"]}
        owner_item = items_by_user[self.owner.id]
        manager_item = items_by_user[manager.id]
        unassigned_item = next(item for item in response.data["items"] if item["type"] == "unassigned")
        self.assertEqual(owner_item["total"], 2)
        self.assertEqual(owner_item["overdue"], 1)
        self.assertEqual(owner_item["capacity_status"], "busy")
        self.assertEqual(manager_item["total"], 1)
        self.assertEqual(manager_item["in_progress"], 1)
        self.assertEqual(manager_item["high_priority"], 1)
        self.assertEqual(unassigned_item["total"], 1)
        self.assertEqual(unassigned_item["no_due"], 1)
        self.assertEqual(missing_business_response.status_code, 400)
        self.assertEqual(forbidden_response.status_code, 403)

    def test_unassigned_task_notifications_route_to_manager_roles_not_business_wide(self):
        manager = User.objects.create_user(
            username="task-notify-manager",
            email="task-notify-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        staff = User.objects.create_user(
            username="task-notify-staff",
            email="task-notify-staff@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)
        BusinessMember.objects.create(business=self.business, user=staff, role=BusinessMember.Roles.STAFF)
        task = Task.objects.create(business=self.business, title="Manager routed task", client=self.client)
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/tasks/{task.id}/start/")

        self.assertEqual(response.status_code, 200)
        notifications = Notification.objects.filter(business=self.business, category=Notification.Categories.TASKS, action_url=f"/app/tasks?task={task.id}")
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.get().recipient, manager)
        self.assertFalse(notifications.filter(recipient__isnull=True).exists())
        self.assertFalse(notifications.filter(recipient=staff).exists())

    def test_task_notification_preferences_suppress_normal_but_not_high_priority_role_fallback(self):
        manager = User.objects.create_user(
            username="task-notify-pref-manager",
            email="task-notify-pref-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)
        NotificationPreference.objects.create(
            business=self.business,
            user=manager,
            category=Notification.Categories.TASKS,
            in_app_enabled=False,
        )
        task = Task.objects.create(business=self.business, title="Preference routed task", client=self.client)

        normal_notifications = create_task_notification(task, "Normal task notification")
        high_notifications = create_task_notification(task, "High task notification", priority=Notification.Priorities.HIGH)

        self.assertEqual(normal_notifications, [])
        self.assertFalse(Notification.objects.filter(business=self.business, text="Normal task notification").exists())
        self.assertEqual(len(high_notifications), 1)
        self.assertEqual(high_notifications[0].recipient_id, manager.id)
        self.assertFalse(Notification.objects.filter(business=self.business, text="High task notification", recipient__isnull=True).exists())

    def test_task_status_actions(self):
        task = Task.objects.create(business=self.business, title="Status task", client=self.client)
        self.api.force_authenticate(self.owner)

        start_response = self.api.post(f"/api/tasks/{task.id}/start/")
        complete_response = self.api.post(f"/api/tasks/{task.id}/complete/")
        reopen_response = self.api.post(f"/api/tasks/{task.id}/reopen/")

        self.assertEqual(start_response.status_code, 200)
        self.assertEqual(start_response.data["status"], Task.Statuses.IN_PROGRESS)
        self.assertEqual(complete_response.status_code, 200)
        self.assertEqual(complete_response.data["status"], Task.Statuses.DONE)
        self.assertEqual(reopen_response.status_code, 200)
        self.assertEqual(reopen_response.data["status"], Task.Statuses.OPEN)
        task.refresh_from_db()
        self.assertIsNone(task.completed_at)

        missing_reason_response = self.api.post(f"/api/tasks/{task.id}/cancel/", {})
        cancel_response = self.api.post(f"/api/tasks/{task.id}/cancel/", {"reason": "Client no longer needs this follow-up"}, format="json")

        self.assertEqual(missing_reason_response.status_code, 400)
        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(cancel_response.data["status"], Task.Statuses.CANCELLED)
        self.assertEqual(cancel_response.data["cancel_reason"], "Client no longer needs this follow-up")
        task.refresh_from_db()
        self.assertEqual(task.cancel_reason, "Client no longer needs this follow-up")
        self.assertEqual(task.cancelled_by, self.owner)
        self.assertIsNotNone(task.cancelled_at)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Task",
                entity_id=str(task.id),
                metadata__kind="lifecycle",
                metadata__lifecycle_action="task_cancelled",
            ).exists()
        )
        cancel_activity = ActivityEvent.objects.get(
            business=self.business,
            entity_type="Task",
            entity_id=str(task.id),
            event_type=ActivityEvents.TASK_CANCELLED,
        )
        self.assertEqual(cancel_activity.metadata["event_type"], ActivityEvents.TASK_CANCELLED)
        self.assertEqual(cancel_activity.metadata["kind"], "lifecycle")
        self.assertEqual(cancel_activity.metadata["lifecycle_action"], "task_cancelled")
        cancel_audit = AuditLog.objects.get(
            business=self.business,
            entity_type="Task",
            entity_id=str(task.id),
            metadata__lifecycle_action="task_cancelled",
        )
        self.assertEqual(cancel_audit.metadata["event_type"], ActivityEvents.TASK_CANCELLED)
        self.assertEqual(cancel_audit.metadata["reason"], "Client no longer needs this follow-up")

    def test_undo_cancel_restores_previous_task_status(self):
        task = Task.objects.create(business=self.business, title="Undo cancel task", client=self.client, status=Task.Statuses.IN_PROGRESS)
        self.api.force_authenticate(self.owner)

        cancel_response = self.api.post(f"/api/tasks/{task.id}/cancel/", {"reason": "Mistaken cancellation"}, format="json")
        undo_response = self.api.post(f"/api/tasks/{task.id}/undo-cancel/")

        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(undo_response.status_code, 200)
        self.assertEqual(undo_response.data["status"], Task.Statuses.IN_PROGRESS)
        self.assertEqual(undo_response.data["cancel_reason"], "")
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Statuses.IN_PROGRESS)
        self.assertEqual(task.cancel_reason, "")
        self.assertIsNone(task.cancelled_at)

    def test_invalid_task_lifecycle_transitions_are_rejected(self):
        done_task = Task.objects.create(business=self.business, title="Done lifecycle task", client=self.client, status=Task.Statuses.DONE)
        cancelled_task = Task.objects.create(business=self.business, title="Cancelled lifecycle task", client=self.client, status=Task.Statuses.CANCELLED)
        self.api.force_authenticate(self.owner)

        start_done_response = self.api.post(f"/api/tasks/{done_task.id}/start/")
        complete_cancelled_response = self.api.post(f"/api/tasks/{cancelled_task.id}/complete/")
        cancel_done_response = self.api.post(f"/api/tasks/{done_task.id}/cancel/", {"reason": "No longer needed"}, format="json")
        snooze_cancelled_response = self.api.post(f"/api/tasks/{cancelled_task.id}/snooze/", {"snoozed_until": "2026-05-14T10:00:00+06:00"}, format="json")

        for response in (
            start_done_response,
            complete_cancelled_response,
            cancel_done_response,
            snooze_cancelled_response,
        ):
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.data["code"], "invalid_transition")
            self.assertIn("status", response.data["errors"])

    def test_unavailable_assignee_returns_actionable_domain_error(self):
        assignee = User.objects.create_user(
            username="unavailable-task-assignee",
            email="unavailable-task-assignee@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=assignee,
            role=BusinessMember.Roles.STAFF,
            availability_status=BusinessMember.AvailabilityStatuses.UNAVAILABLE,
            unavailable_until=timezone.now() + timezone.timedelta(hours=2),
        )
        task = Task.objects.create(business=self.business, title="Unavailable assignment", client=self.client)
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            f"/api/tasks/{task.id}/assign/",
            {"user_id": assignee.id},
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "assignee_unavailable")
        self.assertIn("user_id", response.data["errors"])
        task.refresh_from_db()
        self.assertIsNone(task.assignee)

    def test_assign_endpoint_requires_explicit_user_id(self):
        task = Task.objects.create(business=self.business, title="Explicit assign task", client=self.client)
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/tasks/{task.id}/assign/", {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("user_id", response.data)
        task.refresh_from_db()
        self.assertIsNone(task.assignee)

    def test_task_due_filters_reject_invalid_datetimes(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/tasks/", {"due_from": "not-a-date"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("due_from", response.data)

    def test_task_smart_ordering_prioritizes_important_due_work(self):
        base_due = timezone.now() + timezone.timedelta(days=1)
        low_due = Task.objects.create(
            business=self.business,
            title="Low due",
            client=self.client,
            priority=Task.Priorities.LOW,
            due_at=base_due,
        )
        urgent_no_due = Task.objects.create(
            business=self.business,
            title="Urgent no due",
            client=self.client,
            priority=Task.Priorities.URGENT,
        )
        high_due = Task.objects.create(
            business=self.business,
            title="High due",
            client=self.client,
            priority=Task.Priorities.HIGH,
            due_at=base_due + timezone.timedelta(hours=1),
        )
        urgent_due = Task.objects.create(
            business=self.business,
            title="Urgent due",
            client=self.client,
            priority=Task.Priorities.URGENT,
            due_at=base_due + timezone.timedelta(hours=2),
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/tasks/", {"ordering": "smart", "status": "active"})

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["results"]]
        ordered_ids = [urgent_due.id, urgent_no_due.id, high_due.id, low_due.id]
        self.assertEqual([task_id for task_id in ids if task_id in ordered_ids], ordered_ids)

    def test_task_list_rejects_unknown_ordering(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/tasks/", {"ordering": "random"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("ordering", response.data)

    def test_task_bucket_filter_and_summary_are_tenant_scoped(self):
        now = timezone.now()
        overdue = Task.objects.create(business=self.business, title="Overdue", client=self.client, due_at=now - timezone.timedelta(hours=1))
        today = Task.objects.create(business=self.business, title="Today", client=self.client, due_at=now + timezone.timedelta(hours=1))
        Task.objects.create(business=self.business, title="Later", client=self.client, due_at=now + timezone.timedelta(days=2))
        Task.objects.create(business=self.business, title="No due", client=self.client)
        Task.objects.create(business=self.business, title="Unassigned", client=self.client, assignee=None, due_at=now + timezone.timedelta(days=3))
        Task.objects.create(business=self.business, title="Progress", client=self.client, status=Task.Statuses.IN_PROGRESS, due_at=now + timezone.timedelta(days=4))
        Task.objects.create(business=self.business, title="Closed", client=self.client, status=Task.Statuses.DONE)
        Task.objects.create(business=self.other_business, title="Hidden overdue", due_at=now - timezone.timedelta(hours=2))
        self.api.force_authenticate(self.owner)

        summary_response = self.api.get("/api/tasks/summary/")
        overdue_response = self.api.get("/api/tasks/", {"bucket": "overdue"})
        invalid_response = self.api.get("/api/tasks/", {"bucket": "missing"})

        self.assertEqual(summary_response.status_code, 200)
        self.assertGreaterEqual(summary_response.data["overdue"], 1)
        self.assertGreaterEqual(summary_response.data["today"], 1)
        self.assertGreaterEqual(summary_response.data["later"], 1)
        self.assertGreaterEqual(summary_response.data["noDue"], 1)
        self.assertGreaterEqual(summary_response.data["unassigned"], 1)
        self.assertGreaterEqual(summary_response.data["inProgress"], 1)
        self.assertGreaterEqual(summary_response.data["closed"], 1)
        self.assertEqual(overdue_response.status_code, 200)
        overdue_ids = {item["id"] for item in overdue_response.data["results"]}
        self.assertIn(overdue.id, overdue_ids)
        self.assertNotIn(today.id, overdue_ids)
        self.assertEqual(invalid_response.status_code, 400)
        self.assertIn("bucket", invalid_response.data)

    def test_update_details_updates_task_and_assignee_atomically(self):
        task = Task.objects.create(business=self.business, title="Original details", client=self.client)
        due_at = timezone.now() + timezone.timedelta(days=2)
        self.api.force_authenticate(self.owner)

        response = self.api.patch(
            f"/api/tasks/{task.id}/update-details/",
            {
                "title": "Updated details",
                "description": "Call the client after the demo",
                "assignee": self.owner.id,
                "conversation": self.conversation.id,
                "priority": Task.Priorities.HIGH,
                "due_at": due_at.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.title, "Updated details")
        self.assertEqual(task.description, "Call the client after the demo")
        self.assertEqual(task.assignee, self.owner)
        self.assertEqual(task.priority, Task.Priorities.HIGH)
        self.assertEqual(task.conversation, self.conversation)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Task",
                entity_id=str(task.id),
                metadata__kind="task_details_update",
                metadata__fields__title__to="Updated details",
                metadata__fields__assignee__to=self.owner.id,
                metadata__fields__conversation__to=self.conversation.id,
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Task",
                entity_id=str(task.id),
                event_type=ActivityEvents.TASK_UPDATED,
                metadata__kind="task_details_update",
                metadata__fields__priority__to=Task.Priorities.HIGH,
            ).exists()
        )

    def test_update_details_rejects_invalid_assignee_without_partial_save(self):
        task = Task.objects.create(business=self.business, title="Original title", client=self.client)
        self.api.force_authenticate(self.owner)

        response = self.api.patch(
            f"/api/tasks/{task.id}/update-details/",
            {
                "title": "Should not persist",
                "assignee": self.other_owner.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("assignee", response.data)
        task.refresh_from_db()
        self.assertEqual(task.title, "Original title")
        self.assertIsNone(task.assignee)

    def test_update_details_rejects_closed_tasks_without_partial_save(self):
        done_task = Task.objects.create(business=self.business, title="Done details", client=self.client, status=Task.Statuses.DONE)
        cancelled_task = Task.objects.create(business=self.business, title="Cancelled details", client=self.client, status=Task.Statuses.CANCELLED)
        self.api.force_authenticate(self.owner)

        done_response = self.api.patch(
            f"/api/tasks/{done_task.id}/update-details/",
            {"title": "Should not update done"},
            format="json",
        )
        cancelled_response = self.api.patch(
            f"/api/tasks/{cancelled_task.id}/update-details/",
            {"title": "Should not update cancelled"},
            format="json",
        )

        self.assertEqual(done_response.status_code, 400)
        self.assertEqual(cancelled_response.status_code, 400)
        self.assertIn("status", done_response.data)
        self.assertIn("status", cancelled_response.data)
        done_task.refresh_from_db()
        cancelled_task.refresh_from_db()
        self.assertEqual(done_task.title, "Done details")
        self.assertEqual(cancelled_task.title, "Cancelled details")

    def test_overdue_tab_uses_work_queue_overdue_definition(self):
        due_at = timezone.now() - timezone.timedelta(hours=1)
        visible = Task.objects.create(business=self.business, title="Visible overdue", client=self.client, due_at=due_at)
        Task.objects.create(
            business=self.business,
            title="Snoozed overdue",
            client=self.client,
            due_at=due_at,
            snoozed_until=timezone.now() + timezone.timedelta(hours=2),
        )
        Task.objects.create(
            business=self.business,
            title="Archived overdue",
            client=self.client,
            due_at=due_at,
            is_archived=True,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/tasks/", {"tab": "overdue"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], visible.id)

    def test_generic_patch_cannot_bypass_task_lifecycle_actions(self):
        task = Task.objects.create(business=self.business, title="Status bypass task", client=self.client)
        self.api.force_authenticate(self.owner)

        response = self.api.patch(
            f"/api/tasks/{task.id}/",
            {"status": Task.Statuses.DONE},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["status"])
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Statuses.OPEN)
        self.assertIsNone(task.completed_at)

    def test_generic_patch_cannot_bypass_task_assignment_and_snooze_actions(self):
        task = Task.objects.create(business=self.business, title="Assignment bypass task", client=self.client)
        self.api.force_authenticate(self.owner)

        response = self.api.patch(
            f"/api/tasks/{task.id}/",
            {"assignee": self.owner.id, "watchers": [self.owner.id], "snoozed_until": "2026-05-14T10:00:00+06:00"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["assignee", "snoozed_until", "watchers"])
        task.refresh_from_db()
        self.assertIsNone(task.assignee)
        self.assertEqual(task.watchers.count(), 0)
        self.assertIsNone(task.snoozed_until)

    def test_generic_patch_cannot_bypass_task_archive_action(self):
        task = Task.objects.create(business=self.business, title="Archive bypass task", client=self.client)
        self.api.force_authenticate(self.owner)

        response = self.api.patch(
            f"/api/tasks/{task.id}/",
            {"is_archived": True, "archive_reason": "Bypass attempt"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["archive_reason", "is_archived"])
        task.refresh_from_db()
        self.assertFalse(task.is_archived)
        self.assertEqual(task.archive_reason, "")

    def test_create_task_cannot_seed_archive_state(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Archived at birth",
                "client": self.client.id,
                "is_archived": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["is_archived"])

    def test_create_task_cannot_seed_lifecycle_or_snooze_state(self):
        self.api.force_authenticate(self.owner)

        status_response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Done at birth",
                "client": self.client.id,
                "status": Task.Statuses.DONE,
            },
            format="json",
        )
        snooze_response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Snoozed at birth",
                "client": self.client.id,
                "snoozed_until": "2026-05-14T10:00:00+06:00",
                "watchers": [self.owner.id],
            },
            format="json",
        )

        self.assertEqual(status_response.status_code, 400)
        self.assertEqual(status_response.data["fields"], ["status"])
        self.assertEqual(snooze_response.status_code, 400)
        self.assertEqual(snooze_response.data["fields"], ["snoozed_until", "watchers"])

    def test_create_task_rejects_assignee_from_another_business(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Wrong assignee",
                "client": self.client.id,
                "assignee": self.other_owner.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Assignee must be an active business member", str(response.data))

    def test_task_comments_watchers_assign_and_snooze(self):
        task = Task.objects.create(business=self.business, title="Team follow up", client=self.client)
        self.api.force_authenticate(self.owner)
        snoozed_until = "2026-05-14T10:00:00+06:00"

        comment_response = self.api.post(f"/api/tasks/{task.id}/add-comment/", {"text": "Call after lunch"}, format="json")
        watcher_response = self.api.post(f"/api/tasks/{task.id}/add-watcher/", format="json")
        assign_response = self.api.post(f"/api/tasks/{task.id}/assign/", {"user_id": self.owner.id}, format="json")
        snooze_response = self.api.post(f"/api/tasks/{task.id}/snooze/", {"snoozed_until": snoozed_until}, format="json")

        self.assertEqual(comment_response.status_code, 201)
        self.assertEqual(watcher_response.status_code, 200)
        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(snooze_response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(TaskComment.objects.filter(task=task).count(), 1)
        self.assertTrue(task.watchers.filter(id=self.owner.id).exists())
        self.assertEqual(task.assignee, self.owner)
        self.assertIsNotNone(task.snoozed_until)

    def test_task_assign_watch_and_comment_actions_require_update_permission(self):
        viewer = User.objects.create_user(
            username="task-viewer",
            email="task-viewer@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        task_role = BusinessRole.objects.create(business=self.business, name="Task viewer", preset_key="task-viewer")
        RolePermission.objects.create(
            business_role=task_role,
            resource=Resources.TASKS,
            action=Actions.VIEW,
            scope=RolePermission.Scopes.BUSINESS,
            is_allowed=True,
        )
        RolePermission.objects.create(
            business_role=task_role,
            resource=Resources.TASKS,
            action=Actions.UPDATE,
            scope=RolePermission.Scopes.BUSINESS,
            is_allowed=False,
        )
        BusinessMember.objects.create(business=self.business, user=viewer, role=BusinessMember.Roles.STAFF, business_role=task_role)
        task = Task.objects.create(business=self.business, title="Permission gated task", client=self.client)
        self.api.force_authenticate(viewer)

        assign_response = self.api.post(f"/api/tasks/{task.id}/assign/", {"user_id": viewer.id}, format="json")
        watcher_response = self.api.post(f"/api/tasks/{task.id}/add-watcher/", {"user_id": viewer.id}, format="json")
        comment_response = self.api.post(f"/api/tasks/{task.id}/add-comment/", {"text": "Should be denied"}, format="json")

        self.assertEqual(assign_response.status_code, 403)
        self.assertEqual(watcher_response.status_code, 403)
        self.assertEqual(comment_response.status_code, 403)
        task.refresh_from_db()
        self.assertIsNone(task.assignee)
        self.assertFalse(task.watchers.filter(id=viewer.id).exists())
        self.assertEqual(TaskComment.objects.filter(task=task).count(), 0)
        self.assertFalse(ActivityEvent.objects.filter(entity_type="Task", entity_id=str(task.id)).exists())
        self.assertFalse(AuditLog.objects.filter(entity_type="Task", entity_id=str(task.id)).exists())

    def test_task_comment_can_be_deleted_and_writes_activity(self):
        task = Task.objects.create(business=self.business, title="Delete comment task", client=self.client)
        comment = TaskComment.objects.create(task=task, author=self.owner, text="Remove this comment")
        self.api.force_authenticate(self.owner)

        response = self.api.delete(f"/api/tasks/{task.id}/comments/{comment.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(TaskComment.objects.filter(id=comment.id).exists())
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Task",
                entity_id=str(task.id),
                event_type=ActivityEvents.TASK_COMMENT_DELETED,
                metadata__kind="task_comment_deleted",
                metadata__comment_id=comment.id,
            ).exists()
        )

    def test_task_comment_delete_rejects_comment_from_another_task(self):
        task = Task.objects.create(business=self.business, title="Delete comment task", client=self.client)
        other_task = Task.objects.create(business=self.business, title="Other delete comment task", client=self.client)
        comment = TaskComment.objects.create(task=other_task, author=self.owner, text="Wrong task comment")
        self.api.force_authenticate(self.owner)

        response = self.api.delete(f"/api/tasks/{task.id}/comments/{comment.id}/")

        self.assertEqual(response.status_code, 400)
        self.assertTrue(TaskComment.objects.filter(id=comment.id).exists())

    def test_task_assign_to_me_and_due_quick_actions_create_notifications(self):
        task = Task.objects.create(business=self.business, title="Call hot lead", client=self.client, priority=Task.Priorities.HIGH)
        self.api.force_authenticate(self.owner)

        assign_response = self.api.post(f"/api/tasks/{task.id}/assign-to-me/")
        due_today_response = self.api.post(f"/api/tasks/{task.id}/due-today/")
        due_tomorrow_response = self.api.post(f"/api/tasks/{task.id}/due-tomorrow/")

        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(assign_response.data["assignee"], self.owner.id)
        self.assertEqual(assign_response.data["status"], Task.Statuses.IN_PROGRESS)
        self.assertEqual(due_today_response.status_code, 200)
        self.assertIsNotNone(due_today_response.data["due_at"])
        self.assertIsNotNone(due_today_response.data["reminder_at"])
        self.assertEqual(due_tomorrow_response.status_code, 200)
        self.assertIsNotNone(due_tomorrow_response.data["due_at"])
        task_notifications = Notification.objects.filter(business=self.business, category=Notification.Categories.TASKS, action_url=f"/app/tasks?task={task.id}")
        self.assertEqual(task_notifications.count(), 3)
        self.assertEqual(set(task_notifications.values_list("recipient_id", flat=True)), {self.owner.id})
        self.assertFalse(task_notifications.filter(recipient__isnull=True).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Task",
                entity_id=str(task.id),
                metadata__kind="assignment",
                metadata__lifecycle_action="task_assigned_to_me",
            ).exists()
        )
        assign_activity = ActivityEvent.objects.get(
            business=self.business,
            entity_type="Task",
            entity_id=str(task.id),
            event_type=ActivityEvents.TASK_ASSIGNED_TO_ME,
        )
        self.assertEqual(assign_activity.metadata["event_type"], ActivityEvents.TASK_ASSIGNED_TO_ME)
        self.assertEqual(assign_activity.metadata["kind"], "assignment")
        self.assertEqual(assign_activity.metadata["lifecycle_action"], "task_assigned_to_me")
        assign_audit = AuditLog.objects.get(
            business=self.business,
            entity_type="Task",
            entity_id=str(task.id),
            metadata__lifecycle_action="task_assigned_to_me",
        )
        self.assertEqual(assign_audit.metadata["event_type"], ActivityEvents.TASK_ASSIGNED_TO_ME)
        due_today_activity = ActivityEvent.objects.get(
            business=self.business,
            entity_type="Task",
            entity_id=str(task.id),
            event_type=ActivityEvents.TASK_DUE_TODAY,
        )
        self.assertEqual(due_today_activity.metadata["kind"], "schedule")
        self.assertEqual(due_today_activity.metadata["event_type"], ActivityEvents.TASK_DUE_TODAY)
        due_tomorrow_activity = ActivityEvent.objects.get(
            business=self.business,
            entity_type="Task",
            entity_id=str(task.id),
            event_type=ActivityEvents.TASK_DUE_TOMORROW,
        )
        self.assertEqual(due_tomorrow_activity.metadata["kind"], "schedule")
        self.assertEqual(due_tomorrow_activity.metadata["event_type"], ActivityEvents.TASK_DUE_TOMORROW)

    def test_task_assign_to_me_is_tenant_safe(self):
        task = Task.objects.create(business=self.other_business, title="Hidden task")
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/tasks/{task.id}/assign-to-me/")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(ActivityEvent.objects.filter(entity_type="Task", entity_id=str(task.id)).exists())
        self.assertFalse(AuditLog.objects.filter(entity_type="Task", entity_id=str(task.id)).exists())

    def test_notification_summary_and_actions_are_tenant_scoped(self):
        own_notification = Notification.objects.create(
            business=self.business,
            client=self.client,
            appointment=self.appointment,
            channel=Notification.Channels.SYSTEM,
            text="Reminder",
            send_at=datetime(2026, 5, 13, 9, 0, tzinfo=ZoneInfo("Asia/Almaty")),
        )
        Notification.objects.create(
            business=self.other_business,
            client=self.other_client,
            channel=Notification.Channels.SYSTEM,
            text="Hidden",
            send_at=datetime(2026, 5, 13, 9, 0, tzinfo=ZoneInfo("Asia/Almaty")),
        )
        self.api.force_authenticate(self.owner)

        summary_response = self.api.get("/api/notifications/summary/")
        mark_response = self.api.post(f"/api/notifications/{own_notification.id}/mark-sent/")
        list_response = self.api.get("/api/notifications/")

        self.assertEqual(summary_response.status_code, 200)
        self.assertEqual(summary_response.data["pending"], 1)
        self.assertEqual(mark_response.status_code, 200)
        self.assertEqual(mark_response.data["status"], Notification.Statuses.SENT)
        self.assertEqual(list_response.data["count"], 1)
