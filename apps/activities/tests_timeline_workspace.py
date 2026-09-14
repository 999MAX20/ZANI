from datetime import datetime, timezone as dt_timezone

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.businesses.models import Business, BusinessCapability, BusinessMember
from apps.clients.models import Client


class TimelineWorkspaceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username="timeline-owner", email="timeline-owner@example.test", full_name="Owner Timeline")
        cls.foreign = User.objects.create_user(username="timeline-foreign", email="timeline-foreign@example.test", full_name="Foreign secret name")
        cls.business = Business.objects.create(name="Timeline", slug="timeline", owner=cls.owner, timezone="Asia/Almaty")
        cls.other = Business.objects.create(name="Other", slug="timeline-other", owner=cls.foreign)
        BusinessMember.objects.create(business=cls.business, user=cls.owner, role="owner")
        BusinessMember.objects.create(business=cls.other, user=cls.foreign, role="owner")
        cls.crm_client = Client.objects.create(business=cls.business, full_name="Searchable Client", phone="+77000000001")
        cls.other_client = Client.objects.create(business=cls.other, full_name="Foreign client secret", phone="+77000000002")
        cls.event = ActivityEvent.objects.create(business=cls.business, client=cls.crm_client, actor=cls.owner, category="crm", event_type="client_created", text="Created", entity_type="Client", entity_id=str(cls.crm_client.pk))
        cls.other_event = ActivityEvent.objects.create(business=cls.other, client=cls.other_client, actor=cls.foreign, category="crm", event_type="client_created", text="Foreign")

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def get(self, path="", **params):
        return self.api.get(f"/api/activity-events/{path}", {"business": self.business.pk, **params})

    def test_search_client_name_and_normalized_labels(self):
        response = self.get(q="Searchable")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["actor_name"], "Owner Timeline")
        self.assertEqual(response.data["results"][0]["client_name"], "Searchable Client")

    def test_actor_category_and_null_filters(self):
        ActivityEvent.objects.create(business=self.business, category="task", event_type="task_created")
        self.assertEqual(self.get(actor=self.owner.pk).data["count"], 1)
        self.assertEqual(self.get(actor="none", category="task").data["count"], 1)
        self.assertEqual(self.get(actor=self.foreign.pk).data["count"], 0)

    def test_calendar_dates_include_whole_business_day(self):
        # Almaty is UTC+5: 19:30Z on the previous date belongs to this day.
        ActivityEvent.objects.filter(pk=self.event.pk).update(created_at=datetime(2026, 9, 13, 19, 30, tzinfo=dt_timezone.utc))
        self.assertEqual(self.get(date_from="2026-09-14", date_to="2026-09-14").data["count"], 1)
        self.assertEqual(self.get(date_from="2026-09-13", date_to="2026-09-13").data["count"], 0)

    def test_timestamp_aliases_remain_compatible(self):
        response = self.get(client_id=self.crm_client.pk, created_after="2020-01-01T00:00:00Z", created_before="2100-01-01T00:00:00Z", entity_type="Client", entity_id=self.crm_client.pk, event_type="client_created")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_invalid_filters_are_validation_errors_not_server_errors(self):
        for params in ({"actor": "invalid"}, {"actor": "99999999999999999999"}, {"selected_actor": "99999999999999999999"}, {"category": "invalid"}, {"date_from": "not-a-date"}, {"date_to": "2026-02-30"}, {"business": "x"}, {"date_from": "2026-09-15", "date_to": "2026-09-14"}):
            with self.subTest(params=params):
                self.assertEqual(self.get(**params).status_code, 400)

    def test_stable_pagination_and_page_size_limit(self):
        ActivityEvent.objects.bulk_create([ActivityEvent(business=self.business, category="task", event_type="task_created") for _ in range(104)])
        ActivityEvent.objects.filter(business=self.business).update(created_at=self.event.created_at)
        first = self.get(page_size=10)
        second = self.get(page_size=10, page=2)
        self.assertEqual(first.data["count"], 105)
        self.assertEqual(len(first.data["results"]), 10)
        self.assertEqual([row["id"] for row in first.data["results"]], sorted([row["id"] for row in first.data["results"]], reverse=True))
        self.assertFalse({row["id"] for row in first.data["results"]} & {row["id"] for row in second.data["results"]})
        self.assertEqual(len(self.get(page_size=999).data["results"]), 100)

    def test_foreign_business_and_detail_are_not_accessible(self):
        self.assertEqual(self.get(business=self.other.pk).status_code, 404)
        self.assertEqual(self.get(f"{self.other_event.pk}/").status_code, 404)
        response = self.api.get("/api/activity-events/")
        self.assertNotIn("Foreign", str(response.data))

    def test_denied_role_and_unauthenticated_read(self):
        operator = User.objects.create_user(username="timeline-operator", email="timeline-operator@example.test", role="business_operator")
        BusinessMember.objects.create(business=self.business, user=operator, role="operator")
        self.api.force_authenticate(operator)
        self.assertEqual(self.get().status_code, 403)
        self.assertEqual(self.get("actors/").status_code, 403)
        self.api.force_authenticate(None)
        self.assertIn(self.get().status_code, (401, 403))

    def test_actor_options_are_scoped_searchable_paginated_and_safe(self):
        response = self.get("actors/", q="Owner", page_size=10, selected_actor=self.owner.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"], [{"id": self.owner.pk, "name": "Owner Timeline"}])
        self.assertEqual(response.data["selected_actor"]["id"], self.owner.pk)
        self.assertNotIn("email", str(response.data))
        self.assertIsNone(self.get("actors/", selected_actor=self.foreign.pk).data["selected_actor"])
        self.assertEqual(self.get("actors/", business=self.other.pk).status_code, 404)

    def test_historical_poisoned_relations_do_not_leak_labels_or_actor_options(self):
        ActivityEvent.objects.filter(pk=self.event.pk).update(actor=self.foreign, client=self.other_client)
        row = self.get().data["results"][0]
        self.assertEqual(row["actor_name"], "")
        self.assertEqual(row["client_name"], "")
        self.assertEqual(self.get("actors/").data["count"], 0)
        self.assertEqual(self.get(q="Foreign client secret").data["count"], 0)

    def test_owner_of_two_businesses_has_exact_active_business_actor_options(self):
        BusinessMember.objects.create(business=self.other, user=self.owner, role="admin")
        self.assertEqual(self.get("actors/").data["results"], [{"id": self.owner.pk, "name": "Owner Timeline"}])
        self.assertEqual(self.get(business=self.other.pk).data["count"], 1)

    def test_actor_options_can_page_beyond_first_twenty(self):
        for index in range(21):
            actor = User.objects.create_user(username=f"actor-{index}", email=f"actor-{index}@example.test", full_name=f"Actor {index:02}")
            BusinessMember.objects.create(business=self.business, user=actor, role="manager")
            ActivityEvent.objects.create(business=self.business, actor=actor, event_type="task_created", category="task")
        first = self.get("actors/", page_size=20)
        second = self.get("actors/", page_size=20, page=2)
        self.assertEqual(first.data["count"], 22)
        self.assertEqual(len(second.data["results"]), 2)
        self.assertFalse({row["id"] for row in first.data["results"]} & {row["id"] for row in second.data["results"]})

    def test_disabled_analytics_is_not_presented_as_an_empty_history(self):
        BusinessCapability.objects.update_or_create(business=self.business, module_key="analytics", defaults={"is_enabled": False})
        self.assertEqual(self.get().status_code, 403)
        self.assertEqual(self.get("actors/").status_code, 403)
