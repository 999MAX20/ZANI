from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment
from apps.services.models import Service
from apps.tasks.models import Task, TaskComment


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
                "priority": Task.Priorities.HIGH,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        task = Task.objects.get(id=response.data["id"])
        self.assertEqual(task.created_by, self.owner)
        self.assertEqual(task.client, self.client)
        self.assertEqual(task.appointment, self.appointment)

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

        self.assertEqual(response.status_code, 400)

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

    def test_task_comments_watchers_assign_and_snooze(self):
        task = Task.objects.create(business=self.business, title="Team follow up", client=self.client)
        self.api.force_authenticate(self.owner)
        snoozed_until = "2026-05-14T10:00:00+06:00"

        comment_response = self.api.post(f"/api/tasks/{task.id}/add-comment/", {"text": "Call after lunch"}, format="json")
        watcher_response = self.api.post(f"/api/tasks/{task.id}/add-watcher/", format="json")
        assign_response = self.api.post(f"/api/tasks/{task.id}/assign/", format="json")
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
        self.assertGreaterEqual(Notification.objects.filter(business=self.business, category=Notification.Categories.TASKS).count(), 3)

    def test_task_assign_to_me_is_tenant_safe(self):
        task = Task.objects.create(business=self.other_business, title="Hidden task")
        self.api.force_authenticate(self.owner)

        response = self.api.post(f"/api/tasks/{task.id}/assign-to-me/")

        self.assertEqual(response.status_code, 404)

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
