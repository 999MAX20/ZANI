import json
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.automations.models import AutomationRule, AutomationRun
from apps.bots.models import Bot, BotChannel
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.notifications.models import Notification, NotificationPreference
from apps.notifications.delivery import handle_appointment_followup_reply, process_due_notifications
from apps.notifications.routing import MANAGER_ROLES, create_role_notification
from apps.scheduling.models import Appointment
from apps.scheduling.services import APPOINTMENT_CONFIRMATION_LABEL, APPOINTMENT_REMINDER_LABEL, schedule_appointment_followups
from apps.services.models import Service
from apps.tasks.models import Task


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
        self.operator = User.objects.create_user(
            username="notification-operator",
            email="notification-operator@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        self.staff = User.objects.create_user(
            username="notification-staff",
            email="notification-staff@example.com",
            password="pass",
            role=User.Roles.STAFF,
        )
        self.business = Business.objects.create(owner=self.owner, name="Notify Clinic", slug="notify-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Notify", slug="other-notify")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.operator, role=BusinessMember.Roles.OPERATOR)
        BusinessMember.objects.create(business=self.business, user=self.staff, role=BusinessMember.Roles.STAFF)
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

    def test_delivery_failure_masks_secret_reason(self):
        notification = Notification.objects.create(
            business=self.business,
            client=self.client_obj,
            channel=Notification.Channels.EMAIL,
            category=Notification.Categories.SYSTEM,
            text="Email reminder",
            send_at=timezone.now() - timezone.timedelta(minutes=1),
        )

        self.client_obj.email = "notify@example.com"
        self.client_obj.save(update_fields=["email", "updated_at"])

        with patch("apps.notifications.delivery.send_mail", side_effect=RuntimeError("Provider failed with token=raw-delivery-token")):
            result = process_due_notifications()

        notification.refresh_from_db()
        delivery_result = next(item for item in result if item["notification_id"] == notification.id)
        self.assertEqual(notification.status, Notification.Statuses.RETRY_SCHEDULED)
        self.assertIsNotNone(notification.next_retry_at)
        self.assertEqual(delivery_result["status"], "retry_scheduled")
        self.assertNotIn("raw-delivery-token", str(result))

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

    def test_targeted_notifications_are_visible_to_recipient_and_owner_only(self):
        operator_notification = Notification.objects.create(
            business=self.business,
            recipient=self.operator,
            client=self.client_obj,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.TASKS,
            text="Оператору: проверить заявку",
            send_at=timezone.now(),
        )
        staff_notification = Notification.objects.create(
            business=self.business,
            recipient=self.staff,
            client=self.client_obj,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.TASKS,
            text="Другому сотруднику",
            send_at=timezone.now(),
        )

        self.client.force_authenticate(self.operator)
        operator_response = self.client.get("/api/notifications/")
        operator_ids = [item["id"] for item in operator_response.data["results"]]

        self.client.force_authenticate(self.owner)
        owner_response = self.client.get("/api/notifications/")
        owner_ids = [item["id"] for item in owner_response.data["results"]]

        self.assertEqual(operator_response.status_code, 200)
        self.assertIn(operator_notification.id, operator_ids)
        self.assertNotIn(staff_notification.id, operator_ids)
        self.assertIn(operator_notification.id, owner_ids)

    def test_business_wide_notifications_are_visible_to_staff(self):
        business_wide = Notification.objects.create(
            business=self.business,
            client=self.client_obj,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SYSTEM,
            text="Общее уведомление бизнеса",
            send_at=timezone.now(),
        )

        self.client.force_authenticate(self.staff)
        response = self.client.get("/api/notifications/")
        ids = [item["id"] for item in response.data["results"]]

        self.assertEqual(response.status_code, 200)
        self.assertIn(business_wide.id, ids)

    def test_recipient_must_belong_to_business(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            "/api/notifications/",
            {
                "business": self.business.id,
                "recipient": self.other_owner.id,
                "client": self.client_obj.id,
                "channel": Notification.Channels.SYSTEM,
                "category": Notification.Categories.SYSTEM,
                "text": "Неверный адресат",
                "send_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_generic_write_cannot_bypass_notification_state_actions(self):
        create_response = self.client.post(
            "/api/notifications/",
            {
                "business": self.business.id,
                "client": self.client_obj.id,
                "channel": Notification.Channels.SYSTEM,
                "category": Notification.Categories.SYSTEM,
                "text": "Direct state",
                "send_at": timezone.now().isoformat(),
                "status": Notification.Statuses.SENT,
            },
            format="json",
        )
        patch_response = self.client.patch(
            f"/api/notifications/{self.notification.id}/",
            {"read_at": timezone.now().isoformat()},
            format="json",
        )

        self.assertEqual(create_response.status_code, 400)
        self.assertEqual(create_response.data["fields"], ["status"])
        self.assertEqual(patch_response.status_code, 400)
        self.assertEqual(patch_response.data["fields"], ["read_at"])
        self.notification.refresh_from_db()
        self.assertIsNone(self.notification.read_at)

    def test_role_notification_prefers_responsible_manager_and_excludes_owner(self):
        manager = User.objects.create_user(
            username="notification-manager",
            email="notification-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)

        notifications = create_role_notification(
            business=self.business,
            preferred_user=manager,
            roles=MANAGER_ROLES,
            client=self.client_obj,
            text="Новая сделка требует действия",
            action_url="/app/deals",
        )

        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].recipient, manager)
        self.assertFalse(Notification.objects.filter(text="Новая сделка требует действия", recipient=self.owner).exists())

    def test_notification_preference_suppresses_normal_but_not_high_priority(self):
        manager = User.objects.create_user(
            username="notification-pref-manager",
            email="notification-pref-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)
        NotificationPreference.objects.create(
            business=self.business,
            user=manager,
            category=Notification.Categories.OUTREACH,
            in_app_enabled=False,
        )

        normal = create_role_notification(
            business=self.business,
            preferred_user=manager,
            roles=MANAGER_ROLES,
            category=Notification.Categories.OUTREACH,
            priority=Notification.Priorities.NORMAL,
            text="Обычная рассылка подготовлена",
        )
        high = create_role_notification(
            business=self.business,
            preferred_user=manager,
            roles=MANAGER_ROLES,
            category=Notification.Categories.OUTREACH,
            priority=Notification.Priorities.HIGH,
            text="Критичная ошибка рассылки",
        )

        self.assertEqual(normal, [])
        self.assertEqual(len(high), 1)
        self.assertEqual(high[0].recipient, manager)

    def test_notification_preference_api_validates_business_membership(self):
        response = self.client.post(
            "/api/notification-preferences/",
            {
                "business": self.business.id,
                "user": self.operator.id,
                "category": Notification.Categories.OUTREACH,
                "in_app_enabled": False,
            },
            format="json",
        )
        invalid_response = self.client.post(
            "/api/notification-preferences/",
            {
                "business": self.business.id,
                "user": self.other_owner.id,
                "category": Notification.Categories.OUTREACH,
                "in_app_enabled": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(invalid_response.status_code, 400)

    @override_settings(TELEGRAM_ENABLED=True, TELEGRAM_BASE_API_URL="https://api.telegram.test")
    def test_due_telegram_appointment_notification_is_delivered_through_bot_channel(self):
        bot = Bot.objects.create(business=self.business, name="Notify bot", status=Bot.Statuses.ACTIVE)
        BotChannel.objects.create(
            bot=bot,
            channel=BotChannel.Channels.TELEGRAM,
            status=BotChannel.Statuses.ACTIVE,
            config_json={"bot_token": "test-token"},
        )
        self.client_obj.telegram_id = "telegram-client-100"
        self.client_obj.save(update_fields=["telegram_id", "updated_at"])
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        appointment = Appointment.objects.create(
            business=self.business,
            client=self.client_obj,
            service=service,
            start_at=timezone.now() + timezone.timedelta(days=1),
            end_at=timezone.now() + timezone.timedelta(days=1, hours=1),
        )
        notification = Notification.objects.create(
            business=self.business,
            client=self.client_obj,
            appointment=appointment,
            channel=Notification.Channels.TELEGRAM,
            category=Notification.Categories.SALES,
            text="Подтвердите запись",
            send_at=timezone.now() - timezone.timedelta(minutes=1),
            status=Notification.Statuses.PENDING,
            action_label="Подтвердить запись",
        )

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, traceback):
                return False

            def read(self):
                return json.dumps({"ok": True, "result": {"message_id": 10}}).encode("utf-8")

        with patch("apps.integrations.providers.telegram.urllib_request.urlopen", return_value=FakeResponse()):
            results = process_due_notifications()

        notification.refresh_from_db()
        self.assertEqual(results[0]["status"], "sent")
        self.assertEqual(notification.status, Notification.Statuses.SENT)

    def test_due_sms_notification_fails_without_provider(self):
        manager = User.objects.create_user(
            username="notification-sms-manager",
            email="notification-sms-manager@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)
        notification = Notification.objects.create(
            business=self.business,
            client=self.client_obj,
            channel=Notification.Channels.SMS,
            category=Notification.Categories.SALES,
            text="SMS reminder",
            send_at=timezone.now() - timezone.timedelta(minutes=1),
            status=Notification.Statuses.PENDING,
        )

        results = process_due_notifications()

        notification.refresh_from_db()
        sms_result = next(item for item in results if item["notification_id"] == notification.id)
        self.assertEqual(sms_result["status"], "failed")
        self.assertEqual(notification.status, Notification.Statuses.FAILED)
        self.assertTrue(Notification.objects.filter(business=self.business, recipient=manager, text__startswith="Не удалось отправить").exists())

    def test_failed_notification_can_be_retried(self):
        notification = Notification.objects.create(
            business=self.business,
            client=self.client_obj,
            channel=Notification.Channels.SYSTEM,
            category=Notification.Categories.SALES,
            text="Retry system notification",
            send_at=timezone.now() - timezone.timedelta(minutes=1),
            status=Notification.Statuses.FAILED,
        )

        response = self.client.post(f"/api/notifications/{notification.id}/retry/")

        notification.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["result"]["status"], "sent")
        self.assertEqual(notification.status, Notification.Statuses.SENT)

    def test_appointment_followup_positive_reply_confirms_future_appointment(self):
        self.client_obj.telegram_id = "telegram-client-200"
        self.client_obj.save(update_fields=["telegram_id", "updated_at"])
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        appointment = Appointment.objects.create(
            business=self.business,
            client=self.client_obj,
            service=service,
            start_at=timezone.now() + timezone.timedelta(days=1),
            end_at=timezone.now() + timezone.timedelta(days=1, hours=1),
        )

        result = handle_appointment_followup_reply(
            business=self.business,
            channel=Notification.Channels.TELEGRAM,
            external_user_id="telegram-client-200",
            text="yes",
        )

        appointment.refresh_from_db()
        self.assertEqual(result["status"], "confirmed")
        self.assertEqual(appointment.status, Appointment.Statuses.CONFIRMED)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.APPOINTMENT_CONFIRMED,
                source=Notification.Channels.TELEGRAM,
                entity_id=str(appointment.id),
                metadata__event_type=ActivityEvents.APPOINTMENT_CONFIRMED,
                metadata__lifecycle_action="appointment_confirmed",
                metadata__source="client_reply",
                metadata__channel=Notification.Channels.TELEGRAM,
                metadata__reply_action="confirm",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                business=self.business,
                recipient=self.operator,
                appointment=appointment,
                priority=Notification.Priorities.HIGH,
                text__contains=self.client_obj.full_name,
            ).exists()
        )

    def test_appointment_followup_cancel_reply_uses_lifecycle_service(self):
        self.client_obj.whatsapp_id = "whatsapp-client-201"
        self.client_obj.save(update_fields=["whatsapp_id", "updated_at"])
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = timezone.now() + timezone.timedelta(days=2)
        appointment = Appointment.objects.create(
            business=self.business,
            client=self.client_obj,
            service=service,
            start_at=start_at,
            end_at=start_at + timezone.timedelta(hours=1),
            status=Appointment.Statuses.CREATED,
        )
        schedule_appointment_followups(appointment)
        followup_labels = [APPOINTMENT_CONFIRMATION_LABEL, APPOINTMENT_REMINDER_LABEL]
        self.assertEqual(
            Notification.objects.filter(
                business=self.business,
                appointment=appointment,
                status=Notification.Statuses.PENDING,
                action_label__in=followup_labels,
            ).count(),
            2,
        )
        AutomationRule.objects.create(
            business=self.business,
            name="Cancel reply automation",
            trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_CANCELLED,
            is_active=True,
        )

        result = handle_appointment_followup_reply(
            business=self.business,
            channel=Notification.Channels.WHATSAPP,
            external_user_id="whatsapp-client-201",
            text="cancel",
        )

        appointment.refresh_from_db()
        reason = f"Client reply via {Notification.Channels.WHATSAPP}: cancel"
        self.assertEqual(result["status"], "cancelled")
        self.assertEqual(appointment.status, Appointment.Statuses.CANCELLED)
        self.assertEqual(
            Notification.objects.filter(
                business=self.business,
                appointment=appointment,
                status=Notification.Statuses.PENDING,
                action_label__in=followup_labels,
            ).count(),
            0,
        )
        self.assertEqual(
            Notification.objects.filter(
                business=self.business,
                appointment=appointment,
                status=Notification.Statuses.CANCELLED,
                action_label__in=followup_labels,
            ).count(),
            2,
        )
        self.assertTrue(
            Task.objects.filter(
                business=self.business,
                appointment=appointment,
                title__icontains="cancelled",
                description__contains=reason,
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.APPOINTMENT_CANCELLED,
                source=Notification.Channels.WHATSAPP,
                entity_id=str(appointment.id),
                metadata__event_type=ActivityEvents.APPOINTMENT_CANCELLED,
                metadata__lifecycle_action="appointment_cancelled",
                metadata__reason=reason,
                metadata__source="client_reply",
                metadata__channel=Notification.Channels.WHATSAPP,
                metadata__reply_action="cancel",
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Appointment",
                entity_id=str(appointment.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.APPOINTMENT_CANCELLED,
                metadata__lifecycle_action="appointment_cancelled",
                metadata__reason=reason,
                metadata__source="client_reply",
                metadata__channel=Notification.Channels.WHATSAPP,
            ).exists()
        )
        self.assertTrue(
            AutomationRun.objects.filter(
                business=self.business,
                trigger_type=AutomationRule.TriggerTypes.APPOINTMENT_CANCELLED,
                entity_type="Appointment",
                entity_id=str(appointment.id),
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                business=self.business,
                appointment=appointment,
                priority=Notification.Priorities.HIGH,
                text__contains=self.client_obj.full_name,
            ).exists()
        )

    def test_appointment_followup_cancel_reply_skips_terminal_appointment(self):
        self.client_obj.whatsapp_id = "whatsapp-client-202"
        self.client_obj.save(update_fields=["whatsapp_id", "updated_at"])
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        appointment = Appointment.objects.create(
            business=self.business,
            client=self.client_obj,
            service=service,
            start_at=timezone.now() + timezone.timedelta(days=1),
            end_at=timezone.now() + timezone.timedelta(days=1, hours=1),
            status=Appointment.Statuses.COMPLETED,
        )

        result = handle_appointment_followup_reply(
            business=self.business,
            channel=Notification.Channels.WHATSAPP,
            external_user_id="whatsapp-client-202",
            text="cancel",
        )

        appointment.refresh_from_db()
        self.assertEqual(result["status"], "skipped")
        self.assertEqual(appointment.status, Appointment.Statuses.COMPLETED)
        self.assertFalse(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.APPOINTMENT_CANCELLED,
                entity_id=str(appointment.id),
            ).exists()
        )
        self.assertFalse(Task.objects.filter(business=self.business, appointment=appointment, title__icontains="cancelled").exists())

    def test_appointment_followup_reschedule_reply_creates_manager_task(self):
        self.client_obj.whatsapp_id = "whatsapp-client-200"
        self.client_obj.save(update_fields=["whatsapp_id", "updated_at"])
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        appointment = Appointment.objects.create(
            business=self.business,
            client=self.client_obj,
            service=service,
            start_at=timezone.now() + timezone.timedelta(days=1),
            end_at=timezone.now() + timezone.timedelta(days=1, hours=1),
        )

        result = handle_appointment_followup_reply(
            business=self.business,
            channel=Notification.Channels.WHATSAPP,
            external_user_id="whatsapp-client-200",
            text="Перенести",
        )

        self.assertEqual(result["status"], "reschedule_requested")
        self.assertTrue(Notification.objects.filter(business=self.business, appointment=appointment, priority=Notification.Priorities.HIGH).exists())
