from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.ai_core.models import AIRequestLog, AIToolCallLog, ApprovalRequest
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.clients.models import Client, ClientMergeLog
from apps.core.models import AuditLog
from apps.crm.models import Deal
from apps.crm.services import ensure_default_pipeline
from apps.integrations.connectors import normalize_business_event
from apps.integrations.models import BusinessConnector, BusinessEvent
from apps.leads.models import Lead
from apps.scheduling.models import Appointment, Resource, WorkingHours
from apps.services.models import Service
from apps.tasks.models import Task


class CrmBusinessFlowE2ETests(TestCase):
    password = "pass12345"

    def setUp(self):
        self.api = APIClient()
        self.owner = self._user("e2e-owner@example.com", User.Roles.BUSINESS_OWNER)
        self.manager = self._user("e2e-manager@example.com", User.Roles.BUSINESS_MANAGER)
        self.marketer = self._user("e2e-marketer@example.com", User.Roles.BUSINESS_MANAGER)
        self.other_owner = self._user("e2e-other-owner@example.com", User.Roles.BUSINESS_OWNER)

        self.business = Business.objects.create(
            owner=self.owner,
            name="E2E Clinic",
            slug="e2e-clinic",
            business_type=Business.BusinessTypes.MEDICAL,
            city="Almaty",
            timezone="Asia/Almaty",
            status=Business.Statuses.ACTIVE,
        )
        self.other_business = Business.objects.create(
            owner=self.other_owner,
            name="Other E2E Clinic",
            slug="other-e2e-clinic",
            status=Business.Statuses.ACTIVE,
        )
        ensure_default_roles(self.business)
        ensure_default_roles(self.other_business)
        self._member(self.business, self.owner, BusinessMember.Roles.OWNER)
        self._member(self.business, self.manager, BusinessMember.Roles.MANAGER)
        self._member(self.business, self.marketer, BusinessMember.Roles.MARKETER)
        self._member(self.other_business, self.other_owner, BusinessMember.Roles.OWNER)

        self.pipeline = ensure_default_pipeline(self.business)
        ensure_default_pipeline(self.other_business)
        self.service = Service.objects.create(
            business=self.business,
            name="Consultation",
            duration_minutes=30,
            price_from=10000,
        )
        self.resource = Resource.objects.create(
            business=self.business,
            name="Doctor",
            resource_type=Resource.ResourceTypes.STAFF,
        )
        WorkingHours.objects.create(
            business=self.business,
            weekday=0,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
        self.bot = Bot.objects.create(business=self.business, name="E2E bot", status=Bot.Statuses.ACTIVE)

    def _user(self, email, role):
        return User.objects.create_user(
            username=email,
            email=email,
            password=self.password,
            role=role,
            full_name=email.split("@")[0],
        )

    def _member(self, business, user, role):
        business_role = BusinessRole.objects.filter(business=business, preset_key=role).first()
        return BusinessMember.objects.create(
            business=business,
            user=user,
            role=role,
            business_role=business_role,
            is_active=True,
        )

    def _auth_owner(self):
        self.api.force_authenticate(self.owner)

    def _slot(self, hour, *, day=20):
        return datetime(2026, 7, day, hour, 0, tzinfo=ZoneInfo("Asia/Almaty"))

    def _create_client(self, name="E2E Client", phone="+77010000001"):
        return Client.objects.create(
            business=self.business,
            full_name=name,
            phone=phone,
            source=Client.Sources.MANUAL,
        )

    def _api_create_lead(self, *, client=None, message="Need CRM help"):
        client = client or self._create_client()
        response = self.api.post(
            "/api/leads/",
            {
                "business": self.business.id,
                "client": client.id,
                "service": self.service.id,
                "source": Lead.Sources.MANUAL,
                "message": message,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return Lead.objects.get(id=response.data["id"])

    def _api_create_appointment(self, *, client, start_at, lead=None):
        response = self.api.post(
            "/api/appointments/",
            {
                "business": self.business.id,
                "client": client.id,
                "lead": lead.id if lead else None,
                "service": self.service.id,
                "resource": self.resource.id,
                "start_at": start_at.isoformat(),
                "source": Appointment.Sources.MANUAL,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return Appointment.objects.get(id=response.data["id"])

    def test_owner_login_dashboard_create_and_assign_lead_flow(self):
        login_response = self.api.post(
            "/api/auth/token/",
            {"email": self.owner.email, "password": self.password},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200, login_response.data)
        self.assertTrue(login_response.data["access"])
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        dashboard_response = self.api.get("/api/analytics/owner-dashboard/", {"business": self.business.id})
        self.assertEqual(dashboard_response.status_code, 200, dashboard_response.data)

        lead = self._api_create_lead(message="Owner creates lead from dashboard follow-up")
        assign_response = self.api.post(
            f"/api/leads/{lead.id}/assign/",
            {"user_id": self.manager.id},
            format="json",
        )

        self.assertEqual(assign_response.status_code, 200, assign_response.data)
        lead.refresh_from_db()
        self.assertEqual(lead.responsible_user, self.manager)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                actor=self.owner,
                event_type=ActivityEvents.LEAD_ASSIGNED,
                entity_id=str(lead.id),
                metadata__to=self.manager.id,
            ).exists()
        )

    def test_lead_client_appointment_task_flow(self):
        self._auth_owner()
        lead = self._api_create_lead(message="Lead wants a consultation")

        convert_response = self.api.post(f"/api/leads/{lead.id}/convert-client/")
        self.assertEqual(convert_response.status_code, 200, convert_response.data)
        self.assertEqual(convert_response.data["id"], lead.client_id)

        appointment_response = self.api.post(
            f"/api/leads/{lead.id}/create-appointment/",
            {
                "service": self.service.id,
                "resource": self.resource.id,
                "start_at": self._slot(9).isoformat(),
            },
            format="json",
        )
        self.assertEqual(appointment_response.status_code, 201, appointment_response.data)
        appointment = Appointment.objects.get(id=appointment_response.data["id"])
        lead.refresh_from_db()
        self.assertEqual(appointment.client_id, lead.client_id)
        self.assertEqual(appointment.lead_id, lead.id)
        self.assertEqual(lead.status, Lead.Statuses.APPOINTMENT_CREATED)

        task_response = self.api.post(
            "/api/tasks/",
            {
                "business": self.business.id,
                "title": "Prepare visit materials",
                "client": lead.client_id,
                "lead": lead.id,
                "appointment": appointment.id,
                "assignee": self.manager.id,
                "priority": Task.Priorities.HIGH,
            },
            format="json",
        )

        self.assertEqual(task_response.status_code, 201, task_response.data)
        task = Task.objects.get(id=task_response.data["id"])
        self.assertEqual(task.client_id, lead.client_id)
        self.assertEqual(task.lead_id, lead.id)
        self.assertEqual(task.appointment_id, appointment.id)
        self.assertEqual(task.assignee, self.manager)
        self.assertTrue(ActivityEvent.objects.filter(event_type=ActivityEvents.APPOINTMENT_CREATED, entity_id=str(appointment.id)).exists())
        self.assertTrue(ActivityEvent.objects.filter(event_type=ActivityEvents.TASK_CREATED, entity_id=str(task.id)).exists())

    def test_lead_to_deal_won_and_lost_flow(self):
        self._auth_owner()
        won_lead = self._api_create_lead(message="Lead wants to buy")
        won_deal_response = self.api.post(
            f"/api/leads/{won_lead.id}/create-deal/",
            {"title": "Won E2E deal", "amount": "25000.00"},
            format="json",
        )
        self.assertEqual(won_deal_response.status_code, 201, won_deal_response.data)
        won_response = self.api.post(
            f"/api/deals/{won_deal_response.data['id']}/mark-won/",
            {"amount": "27000.00"},
            format="json",
        )

        self.assertEqual(won_response.status_code, 200, won_response.data)
        won_deal = Deal.objects.get(id=won_response.data["id"])
        self.assertEqual(won_deal.status, Deal.Statuses.WON)
        self.assertIsNotNone(won_deal.won_at)

        lost_lead = self._api_create_lead(client=self._create_client("Lost Client", "+77010000002"), message="Lead asks for quote")
        lost_deal_response = self.api.post(
            f"/api/leads/{lost_lead.id}/create-deal/",
            {"title": "Lost E2E deal", "amount": "15000.00"},
            format="json",
        )
        self.assertEqual(lost_deal_response.status_code, 201, lost_deal_response.data)
        missing_reason_response = self.api.post(f"/api/deals/{lost_deal_response.data['id']}/mark-lost/", {}, format="json")
        lost_response = self.api.post(
            f"/api/deals/{lost_deal_response.data['id']}/mark-lost/",
            {"lost_reason": "Client selected another provider"},
            format="json",
        )

        self.assertEqual(missing_reason_response.status_code, 400)
        self.assertEqual(lost_response.status_code, 200, lost_response.data)
        lost_deal = Deal.objects.get(id=lost_response.data["id"])
        self.assertEqual(lost_deal.status, Deal.Statuses.LOST)
        self.assertEqual(lost_deal.lost_reason, "Client selected another provider")
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(won_deal.id),
                metadata__lifecycle_action="deal_won",
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Deal",
                entity_id=str(lost_deal.id),
                metadata__lifecycle_action="deal_lost",
            ).exists()
        )

    @override_settings(AI_PROVIDER="mock", OPENAI_API_KEY="", OPENROUTER_API_KEY="", KIMI_API_KEY="")
    def test_inbox_message_ai_qualification_creates_lead_and_task_flow(self):
        self._auth_owner()
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WHATSAPP,
            external_user_id="+77017770000",
        )
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Р—РґСЂР°РІСЃС‚РІСѓР№С‚Рµ, С…РѕС‡Сѓ Р·Р°РїРёСЃР°С‚СЊСЃСЏ Рё СѓР·РЅР°С‚СЊ С†РµРЅСѓ",
            payload_json={"whatsapp_profile_name": "Pipeline Client"},
        )

        missing_preview_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/run-pipeline/",
            {"deal_title": "Inbox pipeline deal", "create_task": True},
            format="json",
        )
        preview_response = self.api.post(f"/api/inbox/conversations/{conversation.id}/qualify/", format="json")
        run_response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/run-pipeline/",
            {"deal_title": "Inbox pipeline deal", "create_task": True},
            format="json",
        )

        self.assertEqual(missing_preview_response.status_code, 400)
        self.assertEqual(preview_response.status_code, 200, preview_response.data)
        self.assertEqual(run_response.status_code, 200, run_response.data)
        self.assertEqual(run_response.data["created"], {"client": True, "lead": True, "deal": False, "task": True})
        conversation.refresh_from_db()
        self.assertEqual(conversation.client_id, run_response.data["client"]["id"])
        self.assertEqual(conversation.lead_id, run_response.data["lead"]["id"])
        self.assertIsNone(run_response.data["deal"])
        self.assertTrue(AIRequestLog.objects.filter(id=run_response.data["ai_log_id"], prompt_type="conversation_qualification").exists())
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.CONVERSATION_QUALIFICATION_PREVIEWED,
                metadata__conversation_id=conversation.id,
                metadata__ai_log_id=preview_response.data["ai_log_id"],
            ).exists()
        )
        self.assertTrue(Task.objects.filter(business=self.business, conversation=conversation).exists())

    def test_client_duplicate_warning_merge_dry_run_and_merge_flow(self):
        self._auth_owner()
        target = self._create_client("Main Duplicate Client", "+77015550101")
        duplicate = self._create_client("Duplicate Client", "8 701 555 01 01")
        Lead.objects.create(business=self.business, client=duplicate, service=self.service)
        Task.objects.create(business=self.business, client=duplicate, title="Duplicate follow-up")
        foreign_duplicate = Client.objects.create(
            business=self.other_business,
            full_name="Foreign duplicate",
            phone="+77015550101",
        )

        duplicate_response = self.api.post(
            "/api/clients/check-duplicates/",
            {"business": self.business.id, "phone": "+7 (701) 555-01-01"},
            format="json",
        )
        dry_run_response = self.api.post(
            f"/api/clients/{target.id}/merge-dry-run/",
            {"duplicate_client_id": duplicate.id},
            format="json",
        )

        self.assertEqual(duplicate_response.status_code, 200, duplicate_response.data)
        self.assertEqual({item["id"] for item in duplicate_response.data["duplicates"]}, {target.id, duplicate.id})
        self.assertEqual(dry_run_response.status_code, 200, dry_run_response.data)
        self.assertEqual(dry_run_response.data["transferred"]["leads"], 1)
        self.assertEqual(dry_run_response.data["transferred"]["tasks"], 1)
        duplicate.refresh_from_db()
        self.assertFalse(duplicate.is_archived)

        self.api.force_authenticate(self.marketer)
        denied_response = self.api.post(
            f"/api/clients/{target.id}/merge/",
            {"duplicate_client_id": duplicate.id},
            format="json",
        )
        self.assertEqual(denied_response.status_code, 403)

        self._auth_owner()
        foreign_response = self.api.post(
            f"/api/clients/{target.id}/merge/",
            {"duplicate_client_id": foreign_duplicate.id},
            format="json",
        )
        merge_response = self.api.post(
            f"/api/clients/{target.id}/merge/",
            {"duplicate_client_id": duplicate.id},
            format="json",
        )

        self.assertEqual(foreign_response.status_code, 400)
        self.assertEqual(merge_response.status_code, 200, merge_response.data)
        duplicate.refresh_from_db()
        self.assertTrue(duplicate.is_archived)
        self.assertTrue(Lead.objects.filter(business=self.business, client=target).exists())
        self.assertTrue(Task.objects.filter(business=self.business, client=target).exists())
        self.assertTrue(ClientMergeLog.objects.filter(business=self.business, target_client=target).exists())
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=target,
                event_type=ActivityEvents.CLIENT_MERGED,
                metadata__duplicate_client_id=duplicate.id,
            ).exists()
        )

    def test_appointment_reschedule_cancel_and_no_show_flow(self):
        self._auth_owner()
        client = self._create_client("Lifecycle Client", "+77010000003")
        rescheduled = self._api_create_appointment(client=client, start_at=self._slot(9))
        cancelled = self._api_create_appointment(client=client, start_at=self._slot(11))
        no_show = self._api_create_appointment(client=client, start_at=self._slot(13))

        reschedule_response = self.api.post(
            f"/api/appointments/{rescheduled.id}/reschedule/",
            {"start_at": self._slot(10).isoformat(), "resource": self.resource.id, "reason": "Client asked for later time"},
            format="json",
        )
        missing_cancel_reason = self.api.post(f"/api/appointments/{cancelled.id}/cancel/", {}, format="json")
        cancel_response = self.api.post(
            f"/api/appointments/{cancelled.id}/cancel/",
            {"reason": "Client cancelled"},
            format="json",
        )
        missing_no_show_reason = self.api.post(f"/api/appointments/{no_show.id}/no-show/", {}, format="json")
        no_show_response = self.api.post(
            f"/api/appointments/{no_show.id}/no-show/",
            {"reason": "Client did not arrive"},
            format="json",
        )

        self.assertEqual(reschedule_response.status_code, 200, reschedule_response.data)
        self.assertEqual(cancel_response.status_code, 200, cancel_response.data)
        self.assertEqual(no_show_response.status_code, 200, no_show_response.data)
        self.assertEqual(missing_cancel_reason.status_code, 400)
        self.assertEqual(missing_no_show_reason.status_code, 400)
        rescheduled.refresh_from_db()
        cancelled.refresh_from_db()
        no_show.refresh_from_db()
        self.assertEqual(rescheduled.status, Appointment.Statuses.CREATED)
        self.assertEqual(rescheduled.start_at, self._slot(10))
        self.assertEqual(cancelled.status, Appointment.Statuses.CANCELLED)
        self.assertEqual(no_show.status, Appointment.Statuses.NO_SHOW)
        self.assertTrue(ActivityEvent.objects.filter(event_type=ActivityEvents.APPOINTMENT_RESCHEDULED, entity_id=str(rescheduled.id)).exists())
        self.assertTrue(ActivityEvent.objects.filter(event_type=ActivityEvents.APPOINTMENT_CANCELLED, entity_id=str(cancelled.id)).exists())
        self.assertTrue(ActivityEvent.objects.filter(event_type=ActivityEvents.APPOINTMENT_NO_SHOW, entity_id=str(no_show.id)).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Appointment",
                metadata__lifecycle_action="appointment_cancelled",
            ).exists()
        )

    def test_integration_event_creates_business_event_and_crm_timeline_flow(self):
        self._auth_owner()
        client = self._create_client("Integration Client", "+77010000004")
        connector = BusinessConnector.objects.create(
            business=self.business,
            provider=BusinessConnector.Providers.EXCEL_CSV,
            capability=BusinessConnector.Capabilities.SALES,
            name="Excel import",
            created_by=self.owner,
        )

        first_event, first_created = normalize_business_event(
            business=self.business,
            connector=connector,
            source=BusinessConnector.Providers.EXCEL_CSV,
            event_type="sale.recorded",
            external_id="sale-e2e-1",
            payload={"client_id": client.id, "amount": "15000", "api_key": "raw-event-key"},
        )
        second_event, second_created = normalize_business_event(
            business=self.business,
            connector=connector,
            source=BusinessConnector.Providers.EXCEL_CSV,
            event_type="sale.recorded",
            external_id="sale-e2e-1",
            payload={"client_id": client.id, "amount": "15000", "api_key": "raw-event-key"},
        )

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first_event.id, second_event.id)
        self.assertEqual(BusinessEvent.objects.filter(business=self.business, source=BusinessConnector.Providers.EXCEL_CSV).count(), 1)
        self.assertNotIn("raw-event-key", str(first_event.payload_json))
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                client=client,
                event_type=ActivityEvents.INTEGRATION_EVENT,
                entity_type="BusinessEvent",
                entity_id=str(first_event.id),
                metadata__target_type="Client",
                metadata__target_id=client.id,
            ).exists()
        )

    def test_ai_suggests_action_user_approves_service_executes_and_audit_exists_flow(self):
        self._auth_owner()
        client = self._create_client("AI Client", "+77010000005")
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            external_user_id="ai-visitor",
            client=client,
            assigned_to=self.manager,
        )
        BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            sender_type=BotMessage.SenderTypes.CLIENT,
            text="Please remind the manager to follow up",
        )

        suggest_response = self.api.post(
            "/api/ai/tools/suggest/",
            {"business": self.business.id, "conversation": conversation.id, "message": "Suggest next action"},
            format="json",
        )
        self.assertEqual(suggest_response.status_code, 201, suggest_response.data)
        task_log_id = next(item["id"] for item in suggest_response.data["suggested_actions"] if item["tool_name"] == "create_task")

        blocked_response = self.api.post(f"/api/ai/tools/{task_log_id}/execute/", format="json")
        self.assertEqual(blocked_response.status_code, 403, blocked_response.data)
        self.assertTrue(blocked_response.data["approval_required"])
        self.assertFalse(Task.objects.filter(business=self.business, conversation=conversation).exists())

        create_approval_response = self.api.post(
            "/api/ai/approval-requests/",
            {
                "business": self.business.id,
                "action_type": ApprovalRequest.ActionTypes.AI_PIPELINE,
                "payload": {"tool_call_id": task_log_id, "tool_name": "create_task"},
                "source_object_type": "AIToolCallLog",
                "source_object_id": str(task_log_id),
                "ai_tool_call_log": task_log_id,
            },
            format="json",
        )
        self.assertEqual(create_approval_response.status_code, 201, create_approval_response.data)
        approve_response = self.api.post(
            f"/api/ai/approval-requests/{create_approval_response.data['id']}/approve/",
            {"reason": "Confirmed by owner"},
            format="json",
        )
        execute_response = self.api.post(
            f"/api/ai/tools/{task_log_id}/execute/",
            {"approval_id": create_approval_response.data["id"]},
            format="json",
        )

        self.assertEqual(approve_response.status_code, 200, approve_response.data)
        self.assertEqual(execute_response.status_code, 200, execute_response.data)
        self.assertEqual(execute_response.data["status"], AIToolCallLog.Statuses.EXECUTED)
        task = Task.objects.get(business=self.business, conversation=conversation)
        self.assertEqual(task.assignee, self.manager)
        approval = ApprovalRequest.objects.get(id=create_approval_response.data["id"])
        self.assertEqual(approval.status, ApprovalRequest.Statuses.EXECUTED)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=self.owner,
                entity_type="AIToolCallLog",
                entity_id=str(task_log_id),
                metadata__kind="ai_tool_execution",
                metadata__status=AIToolCallLog.Statuses.EXECUTED,
                metadata__approval_id=approval.id,
                metadata__output_refs__task_id=task.id,
            ).exists()
        )
