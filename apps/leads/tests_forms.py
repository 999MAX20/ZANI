from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.analytics.models import AnalyticsEvent
from apps.automations.models import AutomationAction, AutomationRule, AutomationRun
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client
from apps.leads.models import Lead, LeadForm, LeadFormSubmission
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
