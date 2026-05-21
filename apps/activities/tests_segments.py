from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import Segment, SegmentFilter, Tag, TaggedObject
from apps.businesses.models import Business, BusinessMember
from apps.clients.models import Client


class TagsAndSegmentsTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="segment-owner",
            email="segment-owner@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.other_owner = User.objects.create_user(
            username="segment-other",
            email="segment-other@example.com",
            password="pass",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Segment Clinic", slug="segment-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="Other Segment", slug="other-segment")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.other_business, user=self.other_owner, role=BusinessMember.Roles.OWNER)
        self.client = Client.objects.create(business=self.business, full_name="VIP Client", phone="+77015550101", source=Client.Sources.WEBSITE)
        self.manual_client = Client.objects.create(business=self.business, full_name="Manual Client", phone="+77015550102", source=Client.Sources.MANUAL)
        self.other_client = Client.objects.create(business=self.other_business, full_name="Other Client", phone="+77015550103", source=Client.Sources.WEBSITE)
        self.api.force_authenticate(self.owner)

    def test_segment_filters_clients_and_refreshes_count(self):
        segment_response = self.api.post(
            "/api/segments/",
            {"business": self.business.id, "name": "Website clients", "entity_type": Segment.EntityTypes.CLIENT},
            format="json",
        )
        self.assertEqual(segment_response.status_code, 201)
        segment_id = segment_response.data["id"]
        filter_response = self.api.post(
            "/api/segment-filters/",
            {
                "business": self.business.id,
                "segment": segment_id,
                "field": SegmentFilter.Fields.SOURCE,
                "operator": SegmentFilter.Operators.EQUALS,
                "value_json": {"value": Client.Sources.WEBSITE},
            },
            format="json",
        )
        self.assertEqual(filter_response.status_code, 201)

        evaluate_response = self.api.get(f"/api/segments/{segment_id}/evaluate/")
        refresh_response = self.api.post(f"/api/segments/{segment_id}/refresh-count/")
        filtered_clients = self.api.get("/api/clients/", {"segment": segment_id})

        self.assertEqual(evaluate_response.status_code, 200)
        self.assertEqual(evaluate_response.data["count"], 1)
        self.assertEqual(evaluate_response.data["clients"][0]["id"], self.client.id)
        self.assertEqual(refresh_response.data["count"], 1)
        self.assertEqual(filtered_clients.data["count"], 1)
        self.assertEqual(filtered_clients.data["results"][0]["id"], self.client.id)

    def test_tags_are_tenant_safe_and_filter_clients(self):
        tag = Tag.objects.create(business=self.business, name="VIP", color="#0ea5e9")
        other_tag = Tag.objects.create(business=self.other_business, name="VIP", color="#ef4444")
        TaggedObject.objects.create(business=self.business, tag=tag, entity_type="client", entity_id=str(self.client.id))
        TaggedObject.objects.create(business=self.other_business, tag=other_tag, entity_type="client", entity_id=str(self.other_client.id))

        response = self.api.get("/api/clients/", {"tag": tag.id})
        tagged_response = self.api.get("/api/tagged-objects/", {"entity_type": "client", "entity_id": self.client.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.client.id)
        self.assertEqual(tagged_response.status_code, 200)
        self.assertEqual(tagged_response.data["count"], 1)
        self.assertEqual(tagged_response.data["results"][0]["tag_name"], "VIP")
