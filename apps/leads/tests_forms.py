from django.conf import settings
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.analytics.models import AnalyticsEvent
from apps.automations.models import AutomationAction, AutomationRule, AutomationRun
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.leads.models import Lead, LeadForm, LeadFormSubmission, LeadFormSubmissionError
from apps.tasks.models import Task


class LeadFormCaptureTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="forms-owner",
            email="forms-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(owner=self.owner, name="Forms Clinic", slug="forms-clinic")
        ensure_default_roles(self.business)
        BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OWNER),
        )

    def test_public_form_creates_client_lead_submission_and_runs_automation(self):
        rule = AutomationRule.objects.create(
            business=self.business,
            name="Lead follow up",
            trigger_type=AutomationRule.TriggerTypes.LEAD_CREATED,
            is_active=True,
        )
        AutomationAction.objects.create(
            rule=rule,
            action_type=AutomationAction.ActionTypes.CREATE_TASK,
            config={"title": "Call new lead"},
            order=1,
        )
        self.api.force_authenticate(self.owner)
        template_response = self.api.post(
            "/api/lead-forms/create-template/",
            {"business": self.business.id, "name": "Website form"},
            format="json",
        )
        self.assertEqual(template_response.status_code, 201)
        public_id = template_response.data["public_id"]
        self.api.force_authenticate(user=None)

        get_response = self.api.get(f"/api/public/forms/{public_id}/")
        submit_response = self.api.post(
            f"/api/public/forms/{public_id}/submit/",
            {
                "full_name": "Алия Иванова",
                "phone": "+77015550101",
                "email": "aliya@example.com",
                "message": "Хочу записаться",
                "utm_source": "google",
                "utm_campaign": "spring",
            },
            format="json",
        )

        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(submit_response.status_code, 201)
        self.assertFalse(submit_response.data["duplicate_warning"])
        self.assertEqual(Client.objects.filter(business=self.business).count(), 1)
        self.assertEqual(Lead.objects.filter(business=self.business, source=Lead.Sources.WEBSITE).count(), 1)
        submission = LeadFormSubmission.objects.get()
        self.assertEqual(submission.utm_json["utm_source"], "google")
        self.assertTrue(AnalyticsEvent.objects.filter(event_type=AnalyticsEvent.EventTypes.FORM_SUBMITTED).exists())
        self.assertTrue(ActivityEvent.objects.filter(event_type="form_submitted").exists())
        self.assertTrue(AutomationRun.objects.filter(rule=rule, status=AutomationRun.Statuses.SUCCESS).exists())
        self.assertTrue(Task.objects.filter(title="Call new lead").exists())

    def test_public_form_sanitizes_secret_like_payload_before_storage(self):
        form = LeadForm.objects.create(business=self.business, name="Secure form", title="Lead")
        form.fields.create(key="phone", label="Phone", field_type="phone", is_required=True)

        response = self.api.post(
            f"/api/public/forms/{form.public_id}/submit/",
            {
                "full_name": "Secure Client",
                "phone": "+77015550101",
                "message": "Хочу записаться",
                "api_key": "raw-api-key",
                "nested": {"access_token": "raw-access-token"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        submission = LeadFormSubmission.objects.get()
        self.assertEqual(submission.payload_json["phone"], "+77015550101")
        self.assertEqual(submission.payload_json["api_key"], "configured")
        self.assertEqual(submission.payload_json["nested"]["access_token"], "configured")
        self.assertNotIn("raw-api-key", str(submission.payload_json))
        self.assertNotIn("raw-access-token", str(submission.payload_json))

    def test_lead_form_submission_api_masks_legacy_secret_payloads(self):
        form = LeadForm.objects.create(business=self.business, name="Legacy secure form", title="Lead")
        submission = LeadFormSubmission.objects.create(
            form=form,
            business=self.business,
            payload_json={"api_key": "raw-api-key", "nested": {"access_token": "raw-access-token"}, "visible": "ok"},
        )
        LeadFormSubmissionError.objects.create(
            form=form,
            business=self.business,
            public_id=str(form.public_id),
            payload_json={"client_secret": "raw-client-secret", "visible": "error"},
            error_message="Legacy error",
        )
        self.api.force_authenticate(self.owner)

        submission_response = self.api.get(f"/api/lead-form-submissions/{submission.id}/")
        error_response = self.api.get("/api/lead-form-submission-errors/")

        self.assertEqual(submission_response.status_code, 200)
        self.assertEqual(error_response.status_code, 200)
        self.assertEqual(submission_response.data["payload_json"]["api_key"], "configured")
        self.assertEqual(submission_response.data["payload_json"]["nested"]["access_token"], "configured")
        self.assertEqual(error_response.data["results"][0]["payload_json"]["client_secret"], "configured")
        self.assertEqual(submission_response.data["payload_json"]["visible"], "ok")
        self.assertNotIn("raw-api-key", str(submission_response.data))
        self.assertNotIn("raw-client-secret", str(error_response.data))

    def test_public_landing_form_preserves_source_context_and_is_tenant_scoped(self):
        other_owner = User.objects.create_user(username="other-owner", email="other-owner@example.com", password="pass12345")
        other_business = Business.objects.create(owner=other_owner, name="Other Clinic", slug="other-clinic")
        ensure_default_roles(other_business)
        BusinessMember.objects.create(
            business=other_business,
            user=other_owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=other_business, preset_key=BusinessMember.Roles.OWNER),
        )
        form = LeadForm.objects.create(
            business=self.business,
            name="Landing form",
            title="Landing",
            source=Lead.Sources.LANDING,
            landing_id="landing-forms-clinic-001",
            landing_domain="promo.forms-clinic.test",
            default_responsible_user=self.owner,
        )
        form.fields.create(key="phone", label="Phone", field_type="phone", is_required=True)

        response = self.api.post(
            f"/api/public/forms/{form.public_id}/submit/",
            {
                "full_name": "Landing Client",
                "phone": "+77017770011",
                "message": "Заявка с внешнего лендинга",
                "landing_id": "landing-forms-clinic-001",
                "page_url": "https://promo.forms-clinic.test/spring",
                "campaign": "spring-pilot",
                "utm_source": "meta",
                "utm_medium": "cpc",
            },
            format="json",
            HTTP_USER_AGENT="LandingBot/1.0",
            REMOTE_ADDR="10.10.10.10",
        )

        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get(business=self.business)
        submission = LeadFormSubmission.objects.get(business=self.business)
        self.assertEqual(lead.source, Lead.Sources.LANDING)
        self.assertEqual(submission.landing_id, "landing-forms-clinic-001")
        self.assertEqual(submission.page_domain, "promo.forms-clinic.test")
        self.assertEqual(submission.utm_json["utm_source"], "meta")
        self.assertEqual(submission.source_context_json["campaign"], "spring-pilot")
        self.assertEqual(submission.user_agent, "LandingBot/1.0")
        self.assertEqual(str(submission.ip_address), "10.10.10.10")

        self.api.force_authenticate(other_owner)
        leads_response = self.api.get("/api/leads/")
        submissions_response = self.api.get("/api/lead-form-submissions/")
        self.assertEqual(leads_response.status_code, 200)
        self.assertEqual(submissions_response.status_code, 200)
        self.assertEqual(leads_response.data["count"], 0)
        self.assertEqual(submissions_response.data["count"], 0)

    def test_public_form_validation_error_is_logged(self):
        form = LeadForm.objects.create(business=self.business, name="Required form", title="Lead")
        form.fields.create(key="phone", label="Phone", field_type="phone", is_required=True)

        response = self.api.post(
            f"/api/public/forms/{form.public_id}/submit/",
            {"full_name": "No Phone", "page_url": "https://demo.example/lead"},
            format="json",
            REMOTE_ADDR="10.10.10.11",
        )

        self.assertEqual(response.status_code, 400)
        error = LeadFormSubmissionError.objects.get()
        self.assertEqual(error.form, form)
        self.assertEqual(error.business, self.business)
        self.assertIn("Required fields missing", error.error_message)
        self.assertEqual(error.page_domain, "demo.example")

    def test_public_form_rejects_oversized_payload_without_storing_raw_body(self):
        form = LeadForm.objects.create(business=self.business, name="Sized form", title="Lead")
        form.fields.create(key="phone", label="Phone", field_type="phone", is_required=True)

        response = self.api.post(
            f"/api/public/forms/{form.public_id}/submit/",
            {"phone": "+77010000001", "message": "x" * 2001},
            format="json",
            HTTP_USER_AGENT="A" * 3000,
        )

        self.assertEqual(response.status_code, 400)
        error = LeadFormSubmissionError.objects.get()
        self.assertEqual(error.payload_json, {})
        self.assertLessEqual(len(error.user_agent), 1000)
        self.assertIn("too long", error.error_message)

    def test_public_form_has_throttle_and_honeypot_spam_guard(self):
        self.assertIn("public_form", settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"])
        form = LeadForm.objects.create(business=self.business, name="Throttle form", title="Lead")
        form.fields.create(key="phone", label="Phone", field_type="phone", is_required=True)
        url = f"/api/public/forms/{form.public_id}/submit/"

        response = self.api.post(
            url,
            {"phone": "+77010000001", "website_url": "https://spam.example"},
            format="json",
            REMOTE_ADDR="10.10.10.12",
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(LeadFormSubmissionError.objects.filter(form=form, error_message="Submission rejected.").exists())

    def test_duplicate_submission_reuses_client_and_marks_warning(self):
        existing = Client.objects.create(business=self.business, full_name="Existing", phone="+77015550101")
        form = LeadForm.objects.create(business=self.business, name="Manual form", title="Lead", default_responsible_user=self.owner)
        form.fields.create(key="phone", label="Phone", field_type="phone", is_required=True)

        response = self.api.post(
            f"/api/public/forms/{form.public_id}/submit/",
            {"phone": "+7 701 555 01 01", "message": "Повторно"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["duplicate_warning"])
        self.assertEqual(Client.objects.filter(business=self.business).count(), 1)
        self.assertEqual(Lead.objects.get().client, existing)
