from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.analytics.models import AnalyticsEvent
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment, AppointmentMessageSetting, Resource, WorkingHours
from apps.scheduling.services import create_appointment_from_lead, get_available_slots, schedule_appointment_followups, schedule_post_service_followup
from apps.services.models import Service


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
        self.assertTrue(
            AnalyticsEvent.objects.filter(
                business=self.business,
                client=client,
                event_type=AnalyticsEvent.EventTypes.APPOINTMENT_CREATED,
            ).exists()
        )
        self.assertEqual(Notification.objects.filter(appointment=appointment, status=Notification.Statuses.PENDING).count(), 2)

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
        self.assertEqual(Notification.objects.filter(appointment_id=appointment_id, status=Notification.Statuses.PENDING).count(), 2)

        cancel_response = api.patch(
            f"/api/appointments/{appointment_id}/",
            {"status": Appointment.Statuses.CANCELLED},
            format="json",
        )

        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(Notification.objects.filter(appointment_id=appointment_id, status=Notification.Statuses.PENDING).count(), 0)
        self.assertEqual(Notification.objects.filter(appointment_id=appointment_id, status=Notification.Statuses.CANCELLED).count(), 2)

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

        self.assertEqual(response.status_code, 400)
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

        self.assertEqual(response.status_code, 400)
        self.assertIn("not available", str(response.data))

    def test_apply_working_hours_preset_rejects_unknown_key(self):
        api = APIClient()
        api.force_authenticate(self.owner)

        response = api.post(
            "/api/working-hours/apply-preset/",
            {"business": self.business.id, "preset": "unknown"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
