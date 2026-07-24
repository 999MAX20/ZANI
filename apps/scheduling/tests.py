from datetime import date, datetime, time, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent, Note
from apps.activities.taxonomy import ActivityEvents
from apps.analytics.models import AnalyticsEvent
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment, AppointmentMessageSetting, Resource, WorkingHours
from apps.scheduling.services import (
    APPOINTMENT_CONFIRMATION_LABEL,
    APPOINTMENT_REMINDER_LABEL,
    create_appointment_from_lead,
    get_available_slots,
    schedule_appointment_followups,
    schedule_post_service_followup,
)
from apps.services.models import Service
from apps.tasks.models import Task


class CorePlatformTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="Demo Clinic",
            slug="demo-clinic",
            business_type=Business.BusinessTypes.MEDICAL,
            city="Almaty",
            timezone="Asia/Almaty",
        )
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
        )

    def test_create_business(self):
        self.assertEqual(self.business.owner, self.owner)
        self.assertEqual(self.business.status, Business.Statuses.TRIAL)

    def test_create_client(self):
        client = Client.objects.create(
            business=self.business,
            full_name="Aruzhan Client",
            phone="+77010000000",
            source=Client.Sources.MANUAL,
        )
        self.assertEqual(client.business, self.business)

    def test_create_service(self):
        service = Service.objects.create(
            business=self.business,
            name="Consultation",
            duration_minutes=60,
            price_from=10000,
        )
        self.assertTrue(service.is_active)

    def test_create_lead(self):
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation")
        lead = Lead.objects.create(
            business=self.business,
            client=client,
            service=service,
            message="Need appointment",
        )
        self.assertEqual(lead.status, Lead.Statuses.NEW)

    def test_create_appointment(self):
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=30)
        resource = Resource.objects.create(business=self.business, name="Room 1")
        start_at = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            resource=resource,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=30),
        )
        self.assertEqual(appointment.status, Appointment.Statuses.CREATED)

    def test_get_available_slots(self):
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(12, 0),
        )
        slots = get_available_slots(self.business, service, date(2026, 5, 11))
        self.assertEqual(len(slots), 5)
        self.assertEqual(slots[0].time(), time(9, 0))
        self.assertEqual(slots[-1].time(), time(11, 0))

    def test_busy_slots_are_not_returned(self):
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(12, 0),
        )
        start_at = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
        )

        slots = get_available_slots(self.business, service, date(2026, 5, 11))
        slot_times = [slot.time() for slot in slots]

        self.assertNotIn(time(9, 30), slot_times)
        self.assertNotIn(time(10, 0), slot_times)
        self.assertNotIn(time(10, 30), slot_times)
        self.assertIn(time(9, 0), slot_times)
        self.assertIn(time(11, 0), slot_times)

    def test_create_appointment_from_lead_updates_lead(self):
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        lead = Lead.objects.create(business=self.business, client=client, message="Please book me")
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(12, 0),
        )

        start_at = datetime(2026, 5, 11, 9, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = create_appointment_from_lead(lead, service, start_at)
        lead.refresh_from_db()

        self.assertEqual(appointment.lead, lead)
        self.assertEqual(lead.status, Lead.Statuses.APPOINTMENT_CREATED)
        self.assertEqual(lead.service, service)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(lead.id),
                event_type=ActivityEvents.APPOINTMENT_CREATED,
                metadata__lifecycle_action="lead_appointment_created",
                metadata__appointment_id=appointment.id,
            ).exists()
        )
        self.assertTrue(
            AnalyticsEvent.objects.filter(
                business=self.business,
                client=client,
                event_type=AnalyticsEvent.EventTypes.APPOINTMENT_CREATED,
            ).exists()
        )
        self.assertEqual(Notification.objects.filter(appointment=appointment, status=Notification.Statuses.PENDING).count(), 2)

    def test_create_appointment_from_closed_lead_is_rejected_without_side_effects(self):
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        lead = Lead.objects.create(
            business=self.business,
            client=client,
            message="Please book me",
            status=Lead.Statuses.CLOSED,
        )
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(12, 0),
        )
        start_at = datetime(2026, 5, 11, 9, 0, tzinfo=ZoneInfo("Asia/Almaty"))

        with self.assertRaisesMessage(Exception, "Cannot move lead"):
            create_appointment_from_lead(lead, service, start_at)

        self.assertFalse(Appointment.objects.filter(business=self.business, lead=lead).exists())
        lead.refresh_from_db()
        self.assertEqual(lead.status, Lead.Statuses.CLOSED)
        self.assertFalse(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(lead.id),
                event_type=ActivityEvents.APPOINTMENT_CREATED,
            ).exists()
        )

    def test_appointment_followups_prefer_client_channel_and_schedule_confirmation_and_reminder(self):
        client = Client.objects.create(
            business=self.business,
            full_name="Telegram Client",
            phone="+77015550000",
            telegram_id="tg-100",
        )
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = timezone.now() + timedelta(days=3)
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
        )

        notifications = schedule_appointment_followups(appointment)

        self.assertEqual(len(notifications), 2)
        self.assertEqual({item.channel for item in notifications}, {Notification.Channels.TELEGRAM})
        self.assertEqual({item.action_label for item in notifications}, {"Подтвердить запись", "Напомнить о записи"})
        confirmation = Notification.objects.get(appointment=appointment, action_label="Подтвердить запись")
        reminder = Notification.objects.get(appointment=appointment, action_label="Напомнить о записи")
        self.assertEqual(confirmation.send_at, start_at - timedelta(hours=24))
        self.assertEqual(reminder.send_at, start_at - timedelta(hours=2))

    def test_appointment_followups_use_business_message_settings(self):
        client = Client.objects.create(
            business=self.business,
            full_name="Aruzhan",
            telegram_id="tg-101",
        )
        service = Service.objects.create(business=self.business, name="Haircut", duration_minutes=60)
        start_at = timezone.now() + timedelta(days=2)
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
        )
        AppointmentMessageSetting.objects.update_or_create(
            business=self.business,
            scenario=AppointmentMessageSetting.Scenarios.REMINDER,
            defaults={
                "label": "Напомнить о записи",
                "is_enabled": False,
                "offset_minutes": -60,
                "channel_policy": AppointmentMessageSetting.ChannelPolicies.AUTO,
                "template_text": "Напоминание для {client_name}",
            },
        )
        AppointmentMessageSetting.objects.update_or_create(
            business=self.business,
            scenario=AppointmentMessageSetting.Scenarios.CONFIRMATION,
            defaults={
                "label": "Подтвердить запись",
                "is_enabled": True,
                "offset_minutes": -180,
                "channel_policy": AppointmentMessageSetting.ChannelPolicies.SYSTEM,
                "template_text": "Здравствуйте, {client_name}. Услуга: {service_name}.",
            },
        )

        notifications = schedule_appointment_followups(appointment)

        self.assertEqual(len(notifications), 1)
        notification = notifications[0]
        self.assertEqual(notification.channel, Notification.Channels.SYSTEM)
        self.assertEqual(notification.send_at, start_at - timedelta(minutes=180))
        self.assertIn("Здравствуйте, Aruzhan. Услуга: Haircut.", notification.text)

    def test_completed_appointment_schedules_post_service_thank_you(self):
        client = Client.objects.create(
            business=self.business,
            full_name="Telegram Client",
            telegram_id="tg-200",
        )
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = timezone.now() - timedelta(hours=2)
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
            status=Appointment.Statuses.COMPLETED,
        )

        notification = schedule_post_service_followup(appointment)

        self.assertIsNotNone(notification)
        self.assertEqual(notification.channel, Notification.Channels.TELEGRAM)
        self.assertEqual(notification.action_label, "Поблагодарить после визита")
        self.assertIn("Спасибо, что выбрали нас", notification.text)
        self.assertGreater(notification.send_at, timezone.now())

    def test_disabled_thank_you_setting_skips_post_service_followup(self):
        client = Client.objects.create(
            business=self.business,
            full_name="Telegram Client",
            telegram_id="tg-201",
        )
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = timezone.now() - timedelta(hours=2)
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
            status=Appointment.Statuses.COMPLETED,
        )
        AppointmentMessageSetting.objects.create(
            business=self.business,
            scenario=AppointmentMessageSetting.Scenarios.THANK_YOU,
            label="Поблагодарить после визита",
            is_enabled=False,
            offset_minutes=30,
            channel_policy=AppointmentMessageSetting.ChannelPolicies.AUTO,
            template_text="Спасибо",
        )

        notification = schedule_post_service_followup(appointment)

        self.assertIsNone(notification)
        self.assertFalse(Notification.objects.filter(appointment=appointment).exists())

    def test_appointment_message_settings_api_returns_defaults(self):
        api = APIClient()
        api.force_authenticate(self.owner)

        response = api.get("/api/appointment-message-settings/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 3)
        self.assertEqual(
            {item["scenario"] for item in response.data},
            {"confirmation", "reminder", "thank_you"},
        )

    def test_resource_can_link_active_business_member(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        staff = User.objects.create_user(
            username="resource-staff",
            email="resource-staff@example.com",
            password="pass",
            full_name="Resource Staff",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=staff, role=BusinessMember.Roles.STAFF)

        response = api.post(
            "/api/resources/",
            {
                "business": self.business.id,
                "name": "Resource Staff",
                "resource_type": Resource.ResourceTypes.STAFF,
                "linked_user": staff.id,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        resource = Resource.objects.get(id=response.data["id"])
        self.assertEqual(resource.linked_user, staff)
        self.assertEqual(response.data["linked_user"], staff.id)
        self.assertEqual(response.data["linked_user_name"], "Resource Staff")

    def test_resource_rejects_inactive_or_cross_tenant_linked_user(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        inactive_staff = User.objects.create_user(
            username="inactive-staff",
            email="inactive-staff@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=inactive_staff,
            role=BusinessMember.Roles.STAFF,
            is_active=False,
        )
        other_owner = User.objects.create_user(
            username="other-owner",
            email="other-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        other_business = Business.objects.create(
            owner=other_owner,
            name="Other Clinic",
            slug="other-clinic",
            business_type=Business.BusinessTypes.MEDICAL,
            city="Astana",
            timezone="Asia/Almaty",
        )
        BusinessMember.objects.create(business=other_business, user=other_owner, role=BusinessMember.Roles.OWNER)

        inactive_response = api.post(
            "/api/resources/",
            {
                "business": self.business.id,
                "name": "Inactive Staff",
                "resource_type": Resource.ResourceTypes.STAFF,
                "linked_user": inactive_staff.id,
                "is_active": True,
            },
            format="json",
        )
        cross_tenant_response = api.post(
            "/api/resources/",
            {
                "business": self.business.id,
                "name": "Foreign Staff",
                "resource_type": Resource.ResourceTypes.STAFF,
                "linked_user": other_owner.id,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(inactive_response.status_code, 400)
        self.assertEqual(cross_tenant_response.status_code, 400)
        self.assertEqual(Resource.objects.filter(name__in=["Inactive Staff", "Foreign Staff"]).count(), 0)

    def test_appointment_creation_notifies_linked_resource_user(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        staff = User.objects.create_user(
            username="notified-staff",
            email="notified-staff@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(business=self.business, user=staff, role=BusinessMember.Roles.STAFF)
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        resource = Resource.objects.create(
            business=self.business,
            name="Notified Staff",
            resource_type=Resource.ResourceTypes.STAFF,
            linked_user=staff,
        )
        WorkingHours.objects.create(
            business=self.business,
            resource=resource,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )

        response = api.post(
            "/api/appointments/",
            {
                "business": self.business.id,
                "client": client.id,
                "service": service.id,
                "resource": resource.id,
                "start_at": "2026-05-11T10:00:00+05:00",
                "source": Appointment.Sources.MANUAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        appointment_id = response.data["id"]
        self.assertTrue(
            Notification.objects.filter(
                business=self.business,
                appointment_id=appointment_id,
                recipient=staff,
                channel=Notification.Channels.SYSTEM,
                action_label="Open appointment",
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                business=self.business,
                appointment_id=appointment_id,
                recipient=self.owner,
                action_label="Open appointment",
            ).exists()
        )

    def test_appointment_api_cancels_pending_followups_when_cancelled(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client", phone="+77015550123")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )

        response = api.post(
            "/api/appointments/",
            {
                "business": self.business.id,
                "client": client.id,
                "service": service.id,
                "start_at": "2026-05-11T10:00:00+05:00",
                "status": Appointment.Statuses.CREATED,
                "source": Appointment.Sources.MANUAL,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        appointment_id = response.data["id"]
        followup_labels = [APPOINTMENT_CONFIRMATION_LABEL, APPOINTMENT_REMINDER_LABEL]
        self.assertEqual(
            Notification.objects.filter(
                appointment_id=appointment_id,
                status=Notification.Statuses.PENDING,
                action_label__in=followup_labels,
            ).count(),
            2,
        )

        cancel_without_reason = api.post(f"/api/appointments/{appointment_id}/cancel/", {}, format="json")
        self.assertEqual(cancel_without_reason.status_code, 400)

        cancel_response = api.post(
            f"/api/appointments/{appointment_id}/cancel/",
            {"reason": "Client asked to cancel"},
            format="json",
        )

        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(
            Notification.objects.filter(
                appointment_id=appointment_id,
                status=Notification.Statuses.PENDING,
                action_label__in=followup_labels,
            ).count(),
            0,
        )
        self.assertEqual(
            Notification.objects.filter(
                appointment_id=appointment_id,
                status=Notification.Statuses.CANCELLED,
                action_label__in=followup_labels,
            ).count(),
            2,
        )
        self.assertEqual(Task.objects.filter(appointment_id=appointment_id, status=Task.Statuses.OPEN).count(), 1)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Appointment",
                entity_id=str(appointment_id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.APPOINTMENT_CANCELLED,
                metadata__lifecycle_action="appointment_cancelled",
                metadata__reason="Client asked to cancel",
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.APPOINTMENT_CANCELLED,
                entity_id=str(appointment_id),
                metadata__event_type=ActivityEvents.APPOINTMENT_CANCELLED,
                metadata__lifecycle_action="appointment_cancelled",
                metadata__reason="Client asked to cancel",
            ).exists()
        )

    def test_appointment_confirm_writes_taxonomy_activity(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client", phone="+77015550120")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
            status=Appointment.Statuses.CREATED,
        )

        response = api.post(f"/api/appointments/{appointment.id}/confirm/")

        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Statuses.CONFIRMED)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.APPOINTMENT_CONFIRMED,
                entity_id=str(appointment.id),
                metadata__event_type=ActivityEvents.APPOINTMENT_CONFIRMED,
                metadata__lifecycle_action="appointment_confirmed",
                metadata__from=Appointment.Statuses.CREATED,
                metadata__to=Appointment.Statuses.CONFIRMED,
            ).exists()
        )

    def test_appointment_no_show_requires_reason_and_creates_follow_up(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        manager = User.objects.create_user(username="manager", email="manager@example.com", password="pass", role=User.Roles.BUSINESS_MANAGER)
        BusinessMember.objects.create(business=self.business, user=manager, role=BusinessMember.Roles.MANAGER)
        client = Client.objects.create(business=self.business, full_name="Client", phone="+77015550124")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        lead = Lead.objects.create(business=self.business, client=client, service=service, responsible_user=manager)
        start_at = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            lead=lead,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
            status=Appointment.Statuses.CONFIRMED,
        )

        missing_reason = api.post(f"/api/appointments/{appointment.id}/no-show/", {}, format="json")
        self.assertEqual(missing_reason.status_code, 400)

        response = api.post(
            f"/api/appointments/{appointment.id}/no-show/",
            {"reason": "Client did not arrive"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Statuses.NO_SHOW)
        task = Task.objects.get(appointment=appointment)
        self.assertEqual(task.lead, lead)
        self.assertEqual(task.client, client)
        self.assertEqual(task.assignee, manager)
        self.assertEqual(task.priority, Task.Priorities.HIGH)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Appointment",
                entity_id=str(appointment.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.APPOINTMENT_NO_SHOW,
                metadata__lifecycle_action="appointment_no_show",
                metadata__reason="Client did not arrive",
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.APPOINTMENT_NO_SHOW,
                entity_id=str(appointment.id),
                metadata__event_type=ActivityEvents.APPOINTMENT_NO_SHOW,
                metadata__lifecycle_action="appointment_no_show",
                metadata__reason="Client did not arrive",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                business=self.business,
                recipient=manager,
                appointment=appointment,
                channel=Notification.Channels.SYSTEM,
            ).exists()
        )

    def test_completed_appointment_creates_follow_up_task_and_blocks_terminal_replay(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client", phone="+77015550125")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
            status=Appointment.Statuses.CONFIRMED,
        )

        response = api.post(f"/api/appointments/{appointment.id}/complete/")

        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Statuses.COMPLETED)
        self.assertTrue(Task.objects.filter(appointment=appointment, title__icontains="completed").exists())
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Appointment",
                entity_id=str(appointment.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.APPOINTMENT_COMPLETED,
                metadata__lifecycle_action="appointment_completed",
            ).exists()
        )
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.APPOINTMENT_COMPLETED,
                entity_id=str(appointment.id),
                metadata__event_type=ActivityEvents.APPOINTMENT_COMPLETED,
                metadata__lifecycle_action="appointment_completed",
                metadata__from=Appointment.Statuses.CONFIRMED,
                metadata__to=Appointment.Statuses.COMPLETED,
            ).exists()
        )

        replay = api.post(
            f"/api/appointments/{appointment.id}/cancel/",
            {"reason": "Late cancellation attempt"},
            format="json",
        )

        self.assertEqual(replay.status_code, 409)
        self.assertEqual(replay.data["code"], "invalid_transition")
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Statuses.COMPLETED)
        self.assertEqual(Task.objects.filter(appointment=appointment).count(), 1)

    def test_generic_patch_cannot_bypass_appointment_lifecycle_actions(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client", phone="+77015550124")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = timezone.now() + timedelta(days=2)
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
        )

        response = api.patch(
            f"/api/appointments/{appointment.id}/",
            {"status": Appointment.Statuses.CANCELLED},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["status"])
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Statuses.CREATED)

    def test_generic_patch_cannot_bypass_appointment_reschedule_action(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client", phone="+77015550127")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = timezone.now() + timedelta(days=2)
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
        )

        response = api.patch(
            f"/api/appointments/{appointment.id}/",
            {"start_at": (start_at + timedelta(hours=1)).isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["start_at"])
        appointment.refresh_from_db()
        self.assertEqual(appointment.start_at, start_at)

    def test_generic_patch_cannot_bypass_appointment_archive_action(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client", phone="+77015550125")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        start_at = timezone.now() + timedelta(days=3)
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
        )

        response = api.patch(
            f"/api/appointments/{appointment.id}/",
            {"is_archived": True, "archive_reason": "Bypass attempt"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["archive_reason", "is_archived"])
        appointment.refresh_from_db()
        self.assertFalse(appointment.is_archived)
        self.assertEqual(appointment.archive_reason, "")

    def test_create_appointment_cannot_seed_archive_state(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client", phone="+77015550126")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.get_or_create(
            business=self.business,
            weekday=0,
            defaults={"start_time": time(9, 0), "end_time": time(18, 0)},
        )

        response = api.post(
            "/api/appointments/",
            {
                "business": self.business.id,
                "client": client.id,
                "service": service.id,
                "start_at": "2026-05-11T11:00:00+05:00",
                "is_archived": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["fields"], ["is_archived"])

    def test_direct_appointment_create_replays_idempotency_key(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Idempotent appointment client")
        service = Service.objects.create(business=self.business, name="Idempotent appointment", duration_minutes=60)
        WorkingHours.objects.get_or_create(
            business=self.business,
            weekday=0,
            defaults={"start_time": time(9, 0), "end_time": time(18, 0)},
        )
        payload = {
            "business": self.business.id,
            "client": client.id,
            "service": service.id,
            "start_at": "2026-05-11T11:00:00+05:00",
        }
        headers = {"HTTP_IDEMPOTENCY_KEY": "direct-appointment-once"}

        first = api.post("/api/appointments/", payload, format="json", **headers)
        replay = api.post("/api/appointments/", payload, format="json", **headers)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(replay.status_code, 201)
        self.assertEqual(replay.data["id"], first.data["id"])
        self.assertEqual(Appointment.objects.filter(business=self.business, client=client).count(), 1)

    def test_apply_working_hours_preset_creates_weekdays_without_duplicates(self):
        api = APIClient()
        api.force_authenticate(self.owner)

        response = api.post(
            "/api/working-hours/apply-preset/",
            {"business": self.business.id, "preset": "weekdays_9_18"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 7)
        self.assertEqual(WorkingHours.objects.filter(business=self.business, resource__isnull=True).count(), 7)
        monday = WorkingHours.objects.get(business=self.business, weekday=0, resource__isnull=True)
        sunday = WorkingHours.objects.get(business=self.business, weekday=6, resource__isnull=True)
        self.assertFalse(monday.is_day_off)
        self.assertEqual(monday.start_time, time(9, 0))
        self.assertEqual(monday.end_time, time(18, 0))
        self.assertTrue(sunday.is_day_off)

        second_response = api.post(
            "/api/working-hours/apply-preset/",
            {"business": self.business.id, "preset": "weekdays_9_18"},
            format="json",
        )

        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(WorkingHours.objects.filter(business=self.business, resource__isnull=True).count(), 7)

    def test_bulk_upsert_week_creates_and_updates_without_duplicates(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        payload = {
            "business": self.business.id,
            "resource": None,
            "days": [
                {
                    "weekday": weekday,
                    "start_time": "09:00",
                    "end_time": "18:00",
                    "is_day_off": weekday >= 5,
                }
                for weekday in range(7)
            ],
        }

        response = api.post("/api/working-hours/bulk-upsert-week/", payload, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 7)
        self.assertEqual(WorkingHours.objects.filter(business=self.business, resource__isnull=True).count(), 7)

        payload["days"][0]["start_time"] = "10:00"
        second_response = api.post("/api/working-hours/bulk-upsert-week/", payload, format="json")

        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(WorkingHours.objects.filter(business=self.business, resource__isnull=True).count(), 7)
        monday = WorkingHours.objects.get(business=self.business, resource__isnull=True, weekday=0)
        self.assertEqual(monday.start_time, time(10, 0))

    def test_bulk_upsert_week_rejects_invalid_week_without_partial_save(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        payload = {
            "business": self.business.id,
            "resource": None,
            "days": [
                {
                    "weekday": weekday,
                    "start_time": "09:00",
                    "end_time": "18:00",
                    "is_day_off": False,
                }
                for weekday in range(7)
            ],
        }
        payload["days"][3]["end_time"] = "08:00"

        response = api.post("/api/working-hours/bulk-upsert-week/", payload, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(WorkingHours.objects.filter(business=self.business, resource__isnull=True).count(), 0)

    def test_available_slots_appear_after_working_hours_preset(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        api.post(
            "/api/working-hours/apply-preset/",
            {"business": self.business.id, "preset": "weekdays_9_18"},
            format="json",
        )

        response = api.get(
            "/api/appointments/available-slots/",
            {"business_id": self.business.id, "service_id": service.id, "date": "2026-05-11"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.data), 0)

    def test_available_slots_can_exclude_current_appointment_for_reschedule(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(12, 0),
        )
        start_at = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
        )

        response = api.get(
            "/api/appointments/available-slots/",
            {
                "business_id": self.business.id,
                "service_id": service.id,
                "date": "2026-05-11",
                "exclude_appointment_id": appointment.id,
            },
        )

        self.assertEqual(response.status_code, 200)
        slot_times = [timezone.localtime(datetime.fromisoformat(item["start_at"]), ZoneInfo("Asia/Almaty")).time() for item in response.data]
        self.assertIn(time(10, 0), slot_times)

    def test_appointment_api_rejects_slots_outside_working_hours(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(12, 0),
        )

        response = api.post(
            "/api/appointments/",
            {
                "business": self.business.id,
                "client": client.id,
                "service": service.id,
                "start_at": "2026-05-11T08:00:00+05:00",
                "status": Appointment.Statuses.CREATED,
                "source": Appointment.Sources.MANUAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "schedule_conflict")
        self.assertIn("start_at", response.data["errors"])
        self.assertIn("outside working hours", str(response.data))

    def test_appointment_api_rejects_busy_slots(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(12, 0),
        )
        start_at = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
        )

        response = api.post(
            "/api/appointments/",
            {
                "business": self.business.id,
                "client": client.id,
                "service": service.id,
                "start_at": "2026-05-11T10:30:00+05:00",
                "status": Appointment.Statuses.CREATED,
                "source": Appointment.Sources.MANUAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "schedule_conflict")
        self.assertIn("start_at", response.data["errors"])
        self.assertIn("not available", str(response.data))

    def test_appointment_api_filters_calendar_range_and_facets(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        other_service = Service.objects.create(business=self.business, name="Massage", duration_minutes=60)
        resource = Resource.objects.create(business=self.business, name="Room 1")
        other_resource = Resource.objects.create(business=self.business, name="Room 2")
        first_start = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        second_start = datetime(2026, 5, 12, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        outside_start = datetime(2026, 5, 20, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        first = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            resource=resource,
            start_at=first_start,
            end_at=first_start + timedelta(minutes=60),
            status=Appointment.Statuses.CONFIRMED,
        )
        Appointment.objects.create(
            business=self.business,
            client=client,
            service=other_service,
            resource=other_resource,
            start_at=second_start,
            end_at=second_start + timedelta(minutes=60),
            status=Appointment.Statuses.CREATED,
        )
        Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            resource=resource,
            start_at=outside_start,
            end_at=outside_start + timedelta(minutes=60),
            status=Appointment.Statuses.CONFIRMED,
        )

        response = api.get(
            "/api/appointments/",
            {
                "business": self.business.id,
                "start_from": "2026-05-11",
                "start_to": "2026-05-13",
                "resource": resource.id,
                "service": service.id,
                "status": Appointment.Statuses.CONFIRMED,
            },
        )

        self.assertEqual(response.status_code, 200)
        rows = response.data["results"] if isinstance(response.data, dict) else response.data
        self.assertEqual([item["id"] for item in rows], [first.id])

    def test_appointment_api_requires_business_for_calendar_range(self):
        api = APIClient()
        api.force_authenticate(self.owner)

        response = api.get("/api/appointments/", {"start_from": "2026-05-11", "start_to": "2026-05-13"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("business is required", str(response.data))

    def test_appointment_reschedule_moves_booking_and_requeues_followups(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        resource = Resource.objects.create(business=self.business, name="Room 1")
        WorkingHours.objects.create(
            business=self.business,
            resource=resource,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        start_at = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            resource=resource,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
            status=Appointment.Statuses.CONFIRMED,
        )
        schedule_appointment_followups(appointment)
        self.assertEqual(Notification.objects.filter(appointment=appointment, status=Notification.Statuses.PENDING).count(), 2)

        response = api.post(
            f"/api/appointments/{appointment.id}/reschedule/",
            {
                "start_at": "2026-05-11T12:00:00+05:00",
                "resource": resource.id,
                "reason": "Client asked for later time",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Statuses.CONFIRMED)
        self.assertEqual(appointment.start_at, datetime(2026, 5, 11, 12, 0, tzinfo=ZoneInfo("Asia/Almaty")))
        self.assertEqual(appointment.end_at, datetime(2026, 5, 11, 13, 0, tzinfo=ZoneInfo("Asia/Almaty")))
        self.assertEqual(Notification.objects.filter(appointment=appointment, status=Notification.Statuses.PENDING).count(), 2)
        self.assertEqual(Notification.objects.filter(appointment=appointment, status=Notification.Statuses.CANCELLED).count(), 2)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.APPOINTMENT_RESCHEDULED,
                entity_id=str(appointment.id),
                metadata__event_type=ActivityEvents.APPOINTMENT_RESCHEDULED,
                metadata__lifecycle_action="appointment_rescheduled",
                metadata__reason="Client asked for later time",
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Appointment",
                entity_id=str(appointment.id),
                metadata__kind="lifecycle",
                metadata__event_type=ActivityEvents.APPOINTMENT_RESCHEDULED,
                metadata__lifecycle_action="appointment_rescheduled",
                metadata__reason="Client asked for later time",
            ).exists()
        )

    def test_appointment_reschedule_rejects_busy_slot(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        first_start = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        second_start = datetime(2026, 5, 11, 12, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=first_start,
            end_at=first_start + timedelta(minutes=60),
        )
        Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=second_start,
            end_at=second_start + timedelta(minutes=60),
        )

        response = api.post(
            f"/api/appointments/{appointment.id}/reschedule/",
            {"start_at": "2026-05-11T12:30:00+05:00"},
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "schedule_conflict")
        self.assertIn("not available", str(response.data))
        appointment.refresh_from_db()
        self.assertEqual(appointment.start_at, first_start)

    def test_appointment_reschedule_rejects_slots_outside_working_hours(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(12, 0),
        )
        start_at = datetime(2026, 5, 11, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=60),
        )

        response = api.post(
            f"/api/appointments/{appointment.id}/reschedule/",
            {"start_at": "2026-05-11T12:00:00+05:00"},
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "schedule_conflict")
        self.assertIn("outside working hours", str(response.data))
        appointment.refresh_from_db()
        self.assertEqual(appointment.start_at, start_at)

    def test_resource_day_off_overrides_business_working_hours(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        client = Client.objects.create(business=self.business, full_name="Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=60)
        resource = Resource.objects.create(business=self.business, name="Room 1")
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        WorkingHours.objects.create(
            business=self.business,
            resource=resource,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
            is_day_off=True,
        )

        response = api.post(
            "/api/appointments/",
            {
                "business": self.business.id,
                "client": client.id,
                "service": service.id,
                "resource": resource.id,
                "start_at": "2026-05-11T10:00:00+05:00",
                "source": Appointment.Sources.MANUAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "schedule_conflict")
        self.assertIn("outside working hours", str(response.data))

    def test_apply_working_hours_preset_rejects_unknown_key(self):
        api = APIClient()
        api.force_authenticate(self.owner)

        response = api.post(
            "/api/working-hours/apply-preset/",
            {"business": self.business.id, "preset": "unknown"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_doctor_can_mutate_only_appointment_for_linked_resource(self):
        doctor, _, own_appointment, other_appointment = self._doctor_appointment_scope_fixture()
        api = APIClient()
        api.force_authenticate(doctor)
        before = self._business_side_effect_counts(self.business)

        denied_note = api.post(
            f"/api/appointments/{other_appointment.id}/add-note/",
            {"text": "Must not be added"},
            format="json",
        )
        denied = api.post(f"/api/appointments/{other_appointment.id}/confirm/")

        self.assertEqual(denied_note.status_code, 403)
        self.assertEqual(denied.status_code, 403)
        other_appointment.refresh_from_db()
        self.assertEqual(other_appointment.status, Appointment.Statuses.CREATED)
        self.assertEqual(self._business_side_effect_counts(self.business), before)

        allowed = api.post(f"/api/appointments/{own_appointment.id}/confirm/")

        self.assertEqual(allowed.status_code, 200, allowed.data)
        own_appointment.refresh_from_db()
        self.assertEqual(own_appointment.status, Appointment.Statuses.CONFIRMED)

    def test_doctor_cannot_mutate_unlinked_appointment(self):
        doctor, _, _, _ = self._doctor_appointment_scope_fixture()
        client = Client.objects.create(business=self.business, full_name="Unassigned Patient")
        service = Service.objects.create(
            business=self.business,
            name="Unassigned Consultation",
            duration_minutes=30,
        )
        start_at = datetime(2026, 5, 14, 12, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=30),
        )
        api = APIClient()
        api.force_authenticate(doctor)
        before = self._business_side_effect_counts(self.business)

        note_response = api.post(
            f"/api/appointments/{appointment.id}/add-note/",
            {"text": "Must not be added"},
            format="json",
        )
        response = api.post(f"/api/appointments/{appointment.id}/confirm/")

        self.assertEqual(note_response.status_code, 403)
        self.assertEqual(response.status_code, 403)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Statuses.CREATED)
        self.assertEqual(self._business_side_effect_counts(self.business), before)

    def test_doctor_appointment_mutation_is_tenant_hidden(self):
        doctor, _, _, _ = self._doctor_appointment_scope_fixture()
        other_owner = User.objects.create_user(
            username="other-doctor-owner",
            email="other-doctor-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        other_doctor = User.objects.create_user(
            username="other-tenant-doctor",
            email="other-tenant-doctor@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        other_business = Business.objects.create(
            owner=other_owner,
            name="Other Doctor Clinic",
            slug="other-doctor-clinic",
            business_type=Business.BusinessTypes.MEDICAL,
            timezone="Asia/Almaty",
        )
        BusinessMember.objects.create(
            business=other_business,
            user=other_owner,
            role=BusinessMember.Roles.OWNER,
        )
        BusinessMember.objects.create(
            business=other_business,
            user=other_doctor,
            role=BusinessMember.Roles.DOCTOR,
        )
        other_client = Client.objects.create(business=other_business, full_name="Hidden Patient")
        other_service = Service.objects.create(
            business=other_business,
            name="Hidden Consultation",
            duration_minutes=30,
        )
        other_resource = Resource.objects.create(
            business=other_business,
            name="Hidden Doctor",
            linked_user=other_doctor,
        )
        start_at = datetime(2026, 5, 14, 10, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        hidden_appointment = Appointment.objects.create(
            business=other_business,
            client=other_client,
            service=other_service,
            resource=other_resource,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=30),
        )
        api = APIClient()
        api.force_authenticate(doctor)
        before = self._business_side_effect_counts(other_business)

        note_response = api.post(
            f"/api/appointments/{hidden_appointment.id}/add-note/",
            {"text": "Must stay hidden"},
            format="json",
        )
        response = api.post(f"/api/appointments/{hidden_appointment.id}/confirm/")

        self.assertEqual(note_response.status_code, 404)
        self.assertEqual(response.status_code, 404)
        hidden_appointment.refresh_from_db()
        self.assertEqual(hidden_appointment.status, Appointment.Statuses.CREATED)
        self.assertEqual(self._business_side_effect_counts(other_business), before)

    def test_appointment_crm_card_exposes_per_record_doctor_action_permissions(self):
        doctor, _, own_appointment, other_appointment = self._doctor_appointment_scope_fixture()
        api = APIClient()
        api.force_authenticate(doctor)

        own_response = api.get(f"/api/appointments/{own_appointment.id}/crm-card/")
        other_response = api.get(f"/api/appointments/{other_appointment.id}/crm-card/")

        self.assertEqual(own_response.status_code, 200)
        self.assertEqual(other_response.status_code, 200)
        own_actions = {item["id"]: item for item in own_response.data["available_action_details"]}
        other_actions = {item["id"]: item for item in other_response.data["available_action_details"]}
        self.assertTrue(own_actions["confirm"]["allowed"])
        self.assertEqual(own_actions["confirm"]["scope"], "own")
        self.assertTrue(own_actions["add_note"]["allowed"])
        self.assertEqual(own_actions["add_note"]["scope"], "own")
        self.assertFalse(other_actions["confirm"]["allowed"])
        self.assertEqual(other_actions["confirm"]["scope"], "own")
        self.assertIn("outside your permitted scope", other_actions["confirm"]["reason"])
        self.assertFalse(other_actions["add_note"]["allowed"])
        self.assertEqual(other_actions["add_note"]["scope"], "own")
        self.assertIn("outside your permitted scope", other_actions["add_note"]["reason"])

    def test_doctor_can_execute_advertised_add_note_for_own_appointment(self):
        doctor, _, own_appointment, _ = self._doctor_appointment_scope_fixture()
        api = APIClient()
        api.force_authenticate(doctor)

        card_response = api.get(f"/api/appointments/{own_appointment.id}/crm-card/")
        actions = {item["id"]: item for item in card_response.data["available_action_details"]}
        response = api.post(
            f"/api/appointments/{own_appointment.id}/add-note/",
            {"text": "Patient requested a follow-up call."},
            format="json",
        )

        self.assertEqual(card_response.status_code, 200)
        self.assertTrue(actions["add_note"]["allowed"])
        self.assertEqual(response.status_code, 201, response.data)
        note = Note.objects.get(pk=response.data["id"])
        self.assertEqual(note.business, self.business)
        self.assertEqual(note.client, own_appointment.client)
        self.assertEqual(note.author, doctor)
        self.assertEqual(note.entity_type, "Appointment")
        self.assertEqual(note.entity_id, str(own_appointment.id))
        activity = ActivityEvent.objects.get(
            business=self.business,
            event_type=ActivityEvents.NOTE_CREATED,
            entity_type="Appointment",
            entity_id=str(own_appointment.id),
        )
        self.assertEqual(activity.actor, doctor)
        self.assertEqual(activity.metadata["note_id"], note.id)
        audit = AuditLog.objects.get(
            business=self.business,
            action=AuditLog.Actions.CREATE,
            entity_type="Note",
            entity_id=str(note.id),
        )
        self.assertEqual(audit.actor, doctor)
        self.assertEqual(audit.metadata["kind"], "appointment_note")
        self.assertEqual(audit.metadata["appointment_id"], own_appointment.id)

    def test_appointment_add_note_rolls_back_when_audit_fails(self):
        doctor, _, own_appointment, _ = self._doctor_appointment_scope_fixture()
        api = APIClient()
        api.force_authenticate(doctor)
        before = self._business_side_effect_counts(self.business)

        with patch("apps.scheduling.services.write_audit_log", side_effect=RuntimeError("audit unavailable")):
            with self.assertRaisesMessage(RuntimeError, "audit unavailable"):
                api.post(
                    f"/api/appointments/{own_appointment.id}/add-note/",
                    {"text": "This note must roll back."},
                    format="json",
                )

        self.assertEqual(self._business_side_effect_counts(self.business), before)

    def _doctor_appointment_scope_fixture(self):
        doctor = User.objects.create_user(
            username="doctor-one",
            email="doctor-one@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        other_doctor = User.objects.create_user(
            username="doctor-two",
            email="doctor-two@example.com",
            password="pass",
            role=User.Roles.BUSINESS_MANAGER,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=doctor,
            role=BusinessMember.Roles.DOCTOR,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=other_doctor,
            role=BusinessMember.Roles.DOCTOR,
        )
        client = Client.objects.create(business=self.business, full_name="Doctor Scope Patient")
        service = Service.objects.create(
            business=self.business,
            name="Doctor Scope Consultation",
            duration_minutes=30,
        )
        own_resource = Resource.objects.create(
            business=self.business,
            name="Doctor One",
            linked_user=doctor,
        )
        other_resource = Resource.objects.create(
            business=self.business,
            name="Doctor Two",
            linked_user=other_doctor,
        )
        start_at = datetime(2026, 5, 14, 9, 0, tzinfo=ZoneInfo("Asia/Almaty"))
        own_appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            resource=own_resource,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=30),
        )
        other_appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            resource=other_resource,
            start_at=start_at + timedelta(hours=1),
            end_at=start_at + timedelta(hours=1, minutes=30),
        )
        return doctor, other_doctor, own_appointment, other_appointment

    def _business_side_effect_counts(self, business):
        return {
            "activity": ActivityEvent.objects.filter(business=business).count(),
            "audit": AuditLog.objects.filter(business=business).count(),
            "notes": Note.objects.filter(business=business).count(),
            "notifications": Notification.objects.filter(business=business).count(),
            "tasks": Task.objects.filter(business=business).count(),
        }
