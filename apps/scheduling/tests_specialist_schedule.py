from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client
from apps.core.models import AuditLog
from apps.scheduling.models import Appointment, Resource, ScheduleException, WorkingHours
from apps.services.models import Service


class SpecialistScheduleTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="schedule-owner", email="schedule-owner@example.test")
        self.business = Business.objects.create(owner=self.owner, name="Clinic", slug="specialist-clinic", timezone="Asia/Almaty")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        self.api = APIClient()
        self.api.force_authenticate(self.owner)
        self.client_record = Client.objects.create(business=self.business, full_name="Patient")
        self.service = Service.objects.create(business=self.business, name="Visit", duration_minutes=30)
        self.start = datetime(2026, 10, 5, 10, tzinfo=ZoneInfo(self.business.timezone))
        self.week = [{"weekday": day, "start_time": "09:00", "end_time": "18:00", "is_day_off": day > 4} for day in range(7)]
        response = self.api.post("/api/resources/", {"business": self.business.id, "name": "Doctor", "weekly_schedule": self.week}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.resource = Resource.objects.get(pk=response.data["id"])

    def book(self, **overrides):
        payload = {"business": self.business.id, "client": self.client_record.id, "service": self.service.id,
                   "resource": self.resource.id, "start_at": self.start.isoformat()}
        payload.update(overrides)
        return self.api.post("/api/appointments/", payload, format="json")

    def exception(self, **overrides):
        payload = {"business": self.business.id, "resource": self.resource.id, "date": "2026-10-05",
                   "start_time": "09:00", "end_time": "18:00", "is_day_off": True}
        payload.update(overrides)
        return self.api.post("/api/schedule-exceptions/", payload, format="json")

    def test_create_independent_specialist_with_atomic_week(self):
        self.assertIsNone(self.resource.linked_user_id)
        self.assertEqual(self.resource.working_hours.count(), 7)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(self.business.members.count(), 1)
        before = Resource.objects.count()
        response = self.api.post("/api/resources/", {"business": self.business.id, "name": "Invalid week", "weekly_schedule": self.week[:-1]}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Resource.objects.count(), before)

    def test_default_week_is_independent_copy_of_business_hours(self):
        WorkingHours.objects.create(business=self.business, weekday=0, start_time=time(8), end_time=time(12))
        response = self.api.post("/api/resources/", {"business": self.business.id, "name": "Second doctor"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        doctor = Resource.objects.get(pk=response.data["id"])
        self.assertEqual(doctor.working_hours.count(), 7)
        self.assertEqual(doctor.working_hours.get(weekday=0).start_time, time(8))
        self.assertTrue(doctor.working_hours.get(weekday=1).is_day_off)
        WorkingHours.objects.filter(business=self.business, resource=None).update(start_time=time(10))
        self.assertEqual(doctor.working_hours.get(weekday=0).start_time, time(8))

    def test_booking_requires_active_staff_and_respects_overlap(self):
        self.assertEqual(self.book(resource=None).status_code, 400)
        room = Resource.objects.create(business=self.business, name="Room", resource_type="room")
        self.assertEqual(self.book(resource=room.id).status_code, 400)
        self.resource.is_active = False
        self.resource.save()
        self.assertEqual(self.book().status_code, 400)
        self.resource.is_active = True
        self.resource.save()
        self.assertEqual(self.book().status_code, 201)
        self.assertEqual(self.book().status_code, 409)
        self.assertEqual(self.book(start_at=(self.start + timedelta(minutes=30)).isoformat()).status_code, 201)

    def test_absence_keeps_bookings_and_allows_manual_reassignment(self):
        response = self.book()
        self.assertEqual(response.status_code, 201, response.data)
        appointment = Appointment.objects.get(pk=response.data["id"])
        absence = self.exception()
        self.assertEqual(absence.status_code, 201, absence.data)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Statuses.CREATED)
        self.assertEqual(appointment.resource, self.resource)
        self.assertEqual(self.book(start_at=(self.start + timedelta(hours=1)).isoformat()).status_code, 409)
        second = Resource.objects.create(business=self.business, name="Replacement")
        WorkingHours.objects.create(business=self.business, resource=second, weekday=0, start_time=time(9), end_time=time(18))
        response = self.api.post(f"/api/appointments/{appointment.id}/reschedule/", {"start_at": self.start.isoformat(), "resource": second.id, "reason": "Doctor absent"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        appointment.refresh_from_db()
        self.assertEqual(appointment.resource, second)
        self.assertTrue(AuditLog.objects.filter(metadata__previous_resource_id=self.resource.id, metadata__resource_id=second.id).exists())

    def test_date_override_and_restore_week(self):
        response = self.exception(is_day_off=False, start_time="12:00", end_time="14:00")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.book().status_code, 409)
        self.assertEqual(self.book(start_at=self.start.replace(hour=12).isoformat()).status_code, 201)
        self.assertEqual(self.api.delete(f'/api/schedule-exceptions/{response.data["id"]}/').status_code, 204)
        self.assertEqual(self.book().status_code, 201)

    def test_history_notes_and_cancel_do_not_require_active_specialist(self):
        appointment = Appointment.objects.create(business=self.business, client=self.client_record, service=self.service, start_at=self.start, end_at=self.start + timedelta(minutes=30))
        response = self.api.patch(f"/api/appointments/{appointment.id}/", {"notes": "Legacy history"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        response = self.api.post(f"/api/appointments/{appointment.id}/reschedule/", {"start_at": self.start.isoformat()}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.api.post(f"/api/appointments/{appointment.id}/cancel/", {"reason": "Client declined"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)

    def test_account_login_is_independent_of_specialist_availability(self):
        user = User.objects.create_user(username="doctor", email="doctor@example.test")
        member = BusinessMember.objects.create(business=self.business, user=user, role=BusinessMember.Roles.SPECIALIST)
        self.resource.linked_user = user
        self.resource.save()
        member.is_active = False
        member.save()
        user.is_active = False
        user.save()
        self.assertEqual(self.book().status_code, 201)

    def test_foreign_links_and_unauthorized_schedule_changes_are_denied(self):
        foreign_owner = User.objects.create_user(username="foreign", email="foreign@example.test")
        foreign = Business.objects.create(owner=foreign_owner, name="Other", slug="foreign-clinic")
        foreign_resource = Resource.objects.create(business=foreign, name="Foreign doctor")
        self.assertEqual(self.exception(resource=foreign_resource.id).status_code, 400)
        self.assertEqual(self.book(resource=foreign_resource.id).status_code, 400)
        self.assertEqual(self.exception(business=foreign.id, resource=foreign_resource.id).status_code, 403)
        operator = User.objects.create_user(username="operator", email="operator@example.test")
        BusinessMember.objects.create(business=self.business, user=operator, role=BusinessMember.Roles.OPERATOR)
        self.api.force_authenticate(operator)
        self.assertEqual(self.exception().status_code, 403)
        self.assertEqual(ScheduleException.objects.count(), 0)

    def test_specialist_cannot_be_deleted_with_history(self):
        response = self.api.delete(f"/api/resources/{self.resource.id}/")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Resource.objects.filter(pk=self.resource.pk).exists())

    def test_no_duplicate_linked_specialist_but_names_are_not_identity(self):
        self.resource.linked_user = self.owner
        self.resource.save()
        duplicate = self.api.post("/api/resources/", {"business": self.business.id, "name": "Other name", "linked_user": self.owner.id}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        same_name = self.api.post("/api/resources/", {"business": self.business.id, "name": self.resource.name}, format="json")
        self.assertEqual(same_name.status_code, 201)

    def test_exception_update_delete_and_read_are_scoped(self):
        response = self.exception()
        self.assertEqual(response.status_code, 201)
        url = f'/api/schedule-exceptions/{response.data["id"]}/'
        other_owner = User.objects.create_user(username="outside", email="outside@example.test")
        other_business = Business.objects.create(owner=other_owner, name="Outside", slug="outside")
        BusinessMember.objects.create(business=other_business, user=other_owner, role=BusinessMember.Roles.OWNER)
        self.api.force_authenticate(other_owner)
        self.assertEqual(self.api.get(url).status_code, 404)
        self.assertEqual(self.api.patch(url, {"is_day_off": False}, format="json").status_code, 404)
        self.assertEqual(self.api.delete(url).status_code, 404)
        self.api.force_authenticate(self.owner)
        self.assertEqual(self.api.patch(url, {"end_time": "08:00"}, format="json").status_code, 400)
        self.assertEqual(self.api.patch(url, {"business": other_business.id}, format="json").status_code, 400)
        self.assertTrue(ScheduleException.objects.get(pk=response.data["id"]).is_day_off)

    def test_lead_and_inbox_cannot_bypass_required_specialist(self):
        from apps.bots.models import Bot, BotConversation
        from apps.leads.models import Lead

        lead = Lead.objects.create(business=self.business, client=self.client_record, service=self.service)
        bot = Bot.objects.create(business=self.business, name="Booking bot")
        conversation = BotConversation.objects.create(business=self.business, bot=bot, client=self.client_record, lead=lead)
        response = self.api.post(f"/api/leads/{lead.id}/create-appointment/", {"service": self.service.id, "start_at": self.start.isoformat()}, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        response = self.api.post(f"/api/inbox/conversations/{conversation.id}/create-appointment/", {"service_id": self.service.id, "start_at": self.start.isoformat()}, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Appointment.objects.count(), 0)
