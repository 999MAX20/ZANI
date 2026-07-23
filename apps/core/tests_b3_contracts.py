from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory

from apps.accounts.models import User
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessInvitation, BusinessMember, BusinessRole, Team, TeamMember
from apps.clients.models import Client
from apps.core.domain_errors import (
    AssigneeUnavailable,
    IdempotencyConflict,
    InvalidTransition,
    ModuleDisabled,
    ProviderUnavailable,
    ScheduleConflict,
    TemporaryServiceFailure,
)
from apps.core.exceptions import SAFE_PERMISSION_DETAIL, api_exception_handler
from apps.leads.models import Lead
from apps.tasks.models import Task


class B3BackendContractTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="b3-owner@example.com",
            email="b3-owner@example.com",
            password="Strong-pass-123",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.operator = User.objects.create_user(
            username="b3-operator@example.com",
            email="b3-operator@example.com",
            password="Strong-pass-123",
            role=User.Roles.BUSINESS_OPERATOR,
        )
        self.other_owner = User.objects.create_user(
            username="b3-other@example.com",
            email="b3-other@example.com",
            password="Strong-pass-123",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="B3 Clinic", slug="b3-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="B3 Other", slug="b3-other")
        ensure_default_roles(self.business)
        ensure_default_roles(self.other_business)
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OWNER),
        )
        self.operator_member = BusinessMember.objects.create(
            business=self.business,
            user=self.operator,
            role=BusinessMember.Roles.OPERATOR,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OPERATOR),
        )
        BusinessMember.objects.create(
            business=self.other_business,
            user=self.other_owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.other_business, preset_key=BusinessMember.Roles.OWNER),
        )
        self.client = Client.objects.create(business=self.business, full_name="B3 Client")

    def test_aggregates_use_full_dataset_and_include_metric_semantics(self):
        Lead.objects.bulk_create(
            [Lead(business=self.business, client=self.client, responsible_user=self.operator) for _ in range(75)]
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/analytics/owner-dashboard/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["crm_funnel"]["lead_counts"]["total"], 75)
        meta = response.data["crm_metrics_meta"]
        self.assertEqual(meta["business_id"], self.business.id)
        self.assertEqual(meta["timezone"], self.business.timezone)
        self.assertIn("generated_at", meta)

    def test_api_errors_have_stable_code_and_correlation_id(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/leads/",
            {"business": self.business.id},
            format="json",
            HTTP_X_REQUEST_ID="b3-request-42",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "validation_error")
        self.assertEqual(response.data["request_id"], "b3-request-42")
        self.assertEqual(response["X-Request-ID"], "b3-request-42")
        self.assertIn("errors", response.data)

        self.api.force_authenticate(self.other_owner)
        denied = self.api.get("/api/onboarding/status/", {"business": self.business.id})
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.data["code"], "permission_denied")
        self.assertEqual(denied.data["detail"], SAFE_PERMISSION_DETAIL)
        self.assertNotIn(self.business.name, str(denied.data))
        self.assertEqual(denied.data["errors"], {})
        self.assertTrue(denied.data["request_id"])

    def test_domain_errors_have_explicit_codes_and_complete_safe_envelope(self):
        request = APIRequestFactory().get("/")
        request.correlation_id = "domain-error-42"
        cases = (
            (InvalidTransition(errors={"status": "Choose another action."}), 409, "invalid_transition"),
            (ScheduleConflict(errors={"start_at": "Choose another slot."}), 409, "schedule_conflict"),
            (AssigneeUnavailable(errors={"user_id": "Choose another member."}), 409, "assignee_unavailable"),
            (ModuleDisabled(errors={"module": "deals"}), 403, "module_disabled"),
            (IdempotencyConflict(), 409, "idempotency_conflict"),
            (ProviderUnavailable(), 503, "provider_unavailable"),
            (TemporaryServiceFailure(), 503, "temporary_service_failure"),
        )

        for exception, status_code, code in cases:
            with self.subTest(code=code):
                response = api_exception_handler(exception, {"request": request})
                self.assertEqual(response.status_code, status_code)
                self.assertEqual(response.data["code"], code)
                self.assertEqual(response.data["request_id"], "domain-error-42")
                self.assertTrue(response.data["detail"])
                self.assertIn("errors", response.data)

    def test_invitation_acceptance_is_explicit_once_and_assigns_team(self):
        team = Team.objects.create(business=self.business, name="B3 Front desk")
        self.api.force_authenticate(self.owner)
        create_response = self.api.post(
            "/api/team/invitations/",
            {
                "business": self.business.id,
                "email": "b3-invitee@example.com",
                "role": BusinessMember.Roles.OPERATOR,
                "team": team.id,
                "delivery_channel": BusinessInvitation.DeliveryChannels.MANUAL,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        token = create_response.data["token"]
        self.api.force_authenticate(user=None)

        first = self.api.post(
            "/api/team/invitations/accept/",
            {"token": token, "password": "Strong-pass-123", "full_name": "Invitee"},
            format="json",
        )
        second = self.api.post(
            "/api/team/invitations/accept/",
            {"token": token, "password": "Strong-pass-123"},
            format="json",
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.data["code"], "validation_error")
        membership = BusinessMember.objects.get(business=self.business, user__email="b3-invitee@example.com")
        self.assertTrue(TeamMember.objects.filter(team=team, member=membership).exists())

    def test_duplicate_pending_and_expired_invitation_states_are_safe(self):
        self.api.force_authenticate(self.owner)
        payload = {
            "business": self.business.id,
            "email": "b3-pending@example.com",
            "role": BusinessMember.Roles.STAFF,
            "delivery_channel": BusinessInvitation.DeliveryChannels.MANUAL,
        }
        first = self.api.post("/api/team/invitations/", payload, format="json")
        duplicate = self.api.post("/api/team/invitations/", payload, format="json")
        invitation = BusinessInvitation.objects.get(id=first.data["id"])
        invitation.expires_at = timezone.now() - timezone.timedelta(seconds=1)
        invitation.save(update_fields=["expires_at", "updated_at"])
        self.api.force_authenticate(user=None)
        preview = self.api.get(f"/api/team/invitations/preview/{invitation.token}/")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["status"], BusinessInvitation.Statuses.EXPIRED)

    def test_onboarding_status_is_resumable_for_owner_and_employee(self):
        Task.objects.create(business=self.business, title="First operator task", assignee=self.operator)

        self.api.force_authenticate(self.owner)
        owner_status = self.api.get("/api/onboarding/status/", {"business": self.business.id})
        self.api.force_authenticate(self.operator)
        employee_status = self.api.get("/api/onboarding/status/", {"business": self.business.id})

        self.assertEqual(owner_status.status_code, 200)
        self.assertEqual(owner_status.data["audience"], "owner")
        self.assertIsNotNone(owner_status.data["next_recommended_action"])
        self.assertEqual(employee_status.status_code, 200)
        self.assertEqual(employee_status.data["audience"], "employee")
        self.assertTrue(next(item for item in employee_status.data["items"] if item["key"] == "assigned_task")["is_completed"])
