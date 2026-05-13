from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase

from apps.accounts.models import User
from apps.analytics.models import AnalyticsEvent
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.scheduling.models import Appointment, Resource, WorkingHours
from apps.scheduling.services import create_appointment_from_lead, get_available_slots
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
        self.assertTrue(Notification.objects.filter(appointment=appointment).exists())
