from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai_core.models import AIRequestLog, ApprovalRequest
from apps.ai_core.serializers import AIRequestLogSerializer
from apps.bots.models import Bot, BotConversation
from apps.bots.serializers import BotConversationSerializer
from apps.businesses.access import Actions, Resources, ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission, Team, TeamMember
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.leads.models import Lead
from apps.notifications.models import Notification, NotificationPreference


class B0SecurityTestCase(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = self.create_user("b0-owner@example.com", User.Roles.BUSINESS_OWNER)
        self.other_owner = self.create_user("b0-other-owner@example.com", User.Roles.BUSINESS_OWNER)
        self.manager = self.create_user("b0-manager@example.com", User.Roles.BUSINESS_MANAGER)
        self.operator = self.create_user("b0-operator@example.com", User.Roles.BUSINESS_OPERATOR)
        self.staff = self.create_user("b0-staff@example.com", User.Roles.STAFF)
        self.outside_staff = self.create_user("b0-outside-staff@example.com", User.Roles.STAFF)

        self.business = Business.objects.create(owner=self.owner, name="B0 Clinic", slug="b0-clinic")
        self.other_business = Business.objects.create(owner=self.other_owner, name="B0 Other", slug="b0-other")
        ensure_default_roles(self.business)
        ensure_default_roles(self.other_business)

        self.owner_member = self.create_member(self.business, self.owner, BusinessMember.Roles.OWNER)
        self.manager_member = self.create_member(self.business, self.manager, BusinessMember.Roles.MANAGER)
        self.operator_member = self.create_member(self.business, self.operator, BusinessMember.Roles.OPERATOR)
        self.staff_member = self.create_member(self.business, self.staff, BusinessMember.Roles.STAFF)
        self.other_owner_member = self.create_member(
            self.other_business,
            self.other_owner,
            BusinessMember.Roles.OWNER,
        )
        self.outside_staff_member = self.create_member(
            self.other_business,
            self.outside_staff,
            BusinessMember.Roles.STAFF,
        )

        self.client = Client.objects.create(business=self.business, full_name="B0 Client")
        self.other_client = Client.objects.create(business=self.other_business, full_name="Other Client")
        self.lead = Lead.objects.create(business=self.business, client=self.client, responsible_user=self.manager)
        self.other_lead = Lead.objects.create(
            business=self.other_business,
            client=self.other_client,
            responsible_user=self.other_owner,
        )
        self.pipeline = Pipeline.objects.create(
            business=self.business,
            name="B0 Sales",
            slug="b0-sales",
            is_default=True,
        )
        self.stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=self.pipeline,
            name="New",
            order=1,
        )
        self.other_pipeline = Pipeline.objects.create(
            business=self.other_business,
            name="Other Sales",
            slug="other-sales",
            is_default=True,
        )
        self.other_stage = PipelineStage.objects.create(
            business=self.other_business,
            pipeline=self.other_pipeline,
            name="Other New",
            order=1,
        )

    @staticmethod
    def create_user(email, role):
        return User.objects.create_user(
            username=email,
            email=email,
            password="pass12345",
            role=role,
        )

    @staticmethod
    def create_member(business, user, role):
        return BusinessMember.objects.create(
            business=business,
            user=user,
            role=role,
            business_role=BusinessRole.objects.get(business=business, preset_key=role),
        )

    def deal_payload(self, **overrides):
        payload = {
            "business": self.business.id,
            "client": self.client.id,
            "lead": self.lead.id,
            "pipeline": self.pipeline.id,
            "stage": self.stage.id,
            "title": "B0 Deal",
            "owner": self.manager.id,
        }
        payload.update(overrides)
        return payload


class DealRelationIsolationTests(B0SecurityTestCase):
    def setUp(self):
        super().setUp()
        self.api.force_authenticate(self.owner)

    def test_same_business_deal_relations_are_allowed(self):
        response = self.api.post("/api/deals/", self.deal_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        deal = Deal.objects.get(id=response.data["id"])
        self.assertEqual(deal.business, self.business)
        self.assertEqual(deal.client, self.client)
        self.assertEqual(deal.lead, self.lead)

    def test_foreign_deal_relations_are_rejected(self):
        cases = {
            "client": {"client": self.other_client.id},
            "lead": {"lead": self.other_lead.id},
            "pipeline": {"pipeline": self.other_pipeline.id, "stage": self.other_stage.id},
            "stage": {"stage": self.other_stage.id},
            "owner": {"owner": self.other_owner.id},
        }

        for field, overrides in cases.items():
            with self.subTest(field=field):
                response = self.api.post("/api/deals/", self.deal_payload(**overrides), format="json")
                self.assertEqual(response.status_code, 400)

        self.assertFalse(Deal.objects.filter(title="B0 Deal").exists())

    def test_update_cannot_introduce_foreign_relation(self):
        deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            lead=self.lead,
            pipeline=self.pipeline,
            stage=self.stage,
            title="Existing B0 Deal",
            owner=self.manager,
        )

        response = self.api.patch(
            f"/api/deals/{deal.id}/",
            {"client": self.other_client.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        deal.refresh_from_db()
        self.assertEqual(deal.client, self.client)


class TeamRelationIsolationTests(B0SecurityTestCase):
    def setUp(self):
        super().setUp()
        self.api.force_authenticate(self.owner)
        self.other_role = BusinessRole.objects.get(
            business=self.other_business,
            preset_key=BusinessMember.Roles.STAFF,
        )

    def test_generic_membership_rejects_foreign_business_role(self):
        response = self.api.post(
            "/api/business-members/",
            {
                "business": self.business.id,
                "user": self.create_user("b0-new-member@example.com", User.Roles.STAFF).id,
                "role": BusinessMember.Roles.STAFF,
                "business_role": self.other_role.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("business_role", response.data)

    def test_team_management_rejects_foreign_business_role(self):
        response = self.api.post(
            "/api/team/members/",
            {
                "business": self.business.id,
                "user_id": self.create_user("b0-team-member@example.com", User.Roles.STAFF).id,
                "role": BusinessMember.Roles.STAFF,
                "business_role": self.other_role.id,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("business_role", response.data)

    def test_team_membership_rejects_member_from_another_business(self):
        team = Team.objects.create(business=self.business, name="B0 Front Desk")

        response = self.api.post(
            "/api/team/department-members/",
            {"team": team.id, "member": self.outside_staff_member.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(TeamMember.objects.filter(team=team).exists())

    def test_generic_membership_cannot_create_another_owner(self):
        response = self.api.post(
            "/api/business-members/",
            {
                "business": self.business.id,
                "user": self.create_user("b0-second-owner@example.com", User.Roles.BUSINESS_OWNER).id,
                "role": BusinessMember.Roles.OWNER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("role", response.data)


class ScopedMutationTests(B0SecurityTestCase):
    def setUp(self):
        super().setUp()
        self.own_deal_role = BusinessRole.objects.create(
            business=self.business,
            name="B0 Own Deal Editor",
            preset_key="b0-own-deal-editor",
        )
        RolePermission.objects.bulk_create(
            [
                RolePermission(
                    business_role=self.own_deal_role,
                    resource=Resources.DEALS,
                    action=Actions.VIEW,
                    scope=RolePermission.Scopes.BUSINESS,
                ),
                RolePermission(
                    business_role=self.own_deal_role,
                    resource=Resources.DEALS,
                    action=Actions.CREATE,
                    scope=RolePermission.Scopes.OWN,
                ),
                RolePermission(
                    business_role=self.own_deal_role,
                    resource=Resources.DEALS,
                    action=Actions.UPDATE,
                    scope=RolePermission.Scopes.OWN,
                ),
                RolePermission(
                    business_role=self.own_deal_role,
                    resource=Resources.AI_OUTREACH,
                    action=Actions.SUGGEST,
                    scope=RolePermission.Scopes.OWN,
                ),
            ]
        )
        self.manager_member.business_role = self.own_deal_role
        self.manager_member.save(update_fields=["business_role", "updated_at"])

    def test_own_scope_applies_to_create_and_proposed_update_state(self):
        self.api.force_authenticate(self.manager)

        allowed = self.api.post("/api/deals/", self.deal_payload(owner=self.manager.id), format="json")
        denied = self.api.post("/api/deals/", self.deal_payload(owner=self.owner.id), format="json")
        owner_change = self.api.patch(
            f"/api/deals/{allowed.data['id']}/",
            {"owner": self.owner.id},
            format="json",
        )

        self.assertEqual(allowed.status_code, 201)
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(owner_change.status_code, 403)
        deal = Deal.objects.get(id=allowed.data["id"])
        self.assertEqual(deal.owner, self.manager)

    def test_team_scope_allows_team_owner_and_rejects_outsider(self):
        same_business_outsider = self.create_user("b0-same-business-outsider@example.com", User.Roles.STAFF)
        outside_member = self.create_member(self.business, same_business_outsider, BusinessMember.Roles.STAFF)
        team = Team.objects.create(business=self.business, name="B0 Sales Team")
        TeamMember.objects.create(team=team, member=self.manager_member, is_lead=True)
        TeamMember.objects.create(team=team, member=self.staff_member)
        team_role = BusinessRole.objects.create(
            business=self.business,
            name="B0 Team Deal Creator",
            preset_key="b0-team-deal-creator",
        )
        RolePermission.objects.bulk_create(
            [
                RolePermission(
                    business_role=team_role,
                    resource=Resources.DEALS,
                    action=Actions.VIEW,
                    scope=RolePermission.Scopes.BUSINESS,
                ),
                RolePermission(
                    business_role=team_role,
                    resource=Resources.DEALS,
                    action=Actions.CREATE,
                    scope=RolePermission.Scopes.TEAM,
                ),
            ]
        )
        self.manager_member.business_role = team_role
        self.manager_member.save(update_fields=["business_role", "updated_at"])
        self.api.force_authenticate(self.manager)

        allowed = self.api.post("/api/deals/", self.deal_payload(owner=self.staff.id), format="json")
        denied = self.api.post(
            "/api/deals/",
            self.deal_payload(owner=outside_member.user_id),
            format="json",
        )

        self.assertEqual(allowed.status_code, 201)
        self.assertEqual(denied.status_code, 403)

    def test_notification_preference_own_scope_cannot_target_another_member(self):
        self.api.force_authenticate(self.operator)
        payload = {
            "business": self.business.id,
            "category": Notification.Categories.OUTREACH,
            "in_app_enabled": False,
        }

        allowed = self.api.post(
            "/api/notification-preferences/",
            {**payload, "user": self.operator.id},
            format="json",
        )
        denied = self.api.post(
            "/api/notification-preferences/",
            {**payload, "user": self.manager.id},
            format="json",
        )

        self.assertEqual(allowed.status_code, 201)
        self.assertEqual(denied.status_code, 403)
        self.assertFalse(
            NotificationPreference.objects.filter(
                business=self.business,
                user=self.manager,
                category=Notification.Categories.OUTREACH,
            ).exists()
        )

    def test_approval_request_create_applies_own_scope_to_server_owned_requester(self):
        self.api.force_authenticate(self.manager)

        response = self.api.post(
            "/api/ai/approval-requests/",
            {
                "business": self.business.id,
                "action_type": ApprovalRequest.ActionTypes.CAMPAIGN_LAUNCH,
                "payload": {"campaign_id": 42},
                "requested_by": self.owner.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        approval = ApprovalRequest.objects.get(id=response.data["id"])
        self.assertEqual(approval.requested_by, self.manager)
        self.assertEqual(approval.status, ApprovalRequest.Statuses.PENDING)


class ServerOwnedBoundaryTests(B0SecurityTestCase):
    def setUp(self):
        super().setUp()
        self.api.force_authenticate(self.owner)
        self.bot = Bot.objects.create(business=self.business, name="B0 Bot")
        self.conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
        )

    def test_ai_request_logs_are_read_only_and_tenant_scoped(self):
        own_log = AIRequestLog.objects.create(
            business=self.business,
            user=self.owner,
            source=AIRequestLog.Sources.CRM,
            prompt_type="b0-own",
        )
        AIRequestLog.objects.create(
            business=self.other_business,
            user=self.other_owner,
            source=AIRequestLog.Sources.CRM,
            prompt_type="b0-other",
        )

        list_response = self.api.get("/api/ai/request-logs/")
        create_response = self.api.post(
            "/api/ai/request-logs/",
            {
                "business": self.other_business.id,
                "user": self.other_owner.id,
                "source": AIRequestLog.Sources.CRM,
                "prompt_type": "forged",
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual([row["id"] for row in list_response.data["results"]], [own_log.id])
        self.assertEqual(create_response.status_code, 405)
        self.assertFalse(AIRequestLog.objects.filter(prompt_type="forged").exists())
        self.assertTrue(all(field.read_only for field in AIRequestLogSerializer().fields.values()))

    def test_generic_conversation_create_and_update_are_disabled(self):
        create_response = self.api.post(
            "/api/bot-conversations/",
            {
                "business": self.business.id,
                "bot": self.bot.id,
                "channel": BotConversation.Channels.WEBSITE,
            },
            format="json",
        )
        update_response = self.api.patch(
            f"/api/bot-conversations/{self.conversation.id}/",
            {
                "status": BotConversation.Statuses.CLOSED,
                "assigned_to": self.other_owner.id,
                "unread_count": 99,
            },
            format="json",
        )
        retrieve_response = self.api.get(f"/api/bot-conversations/{self.conversation.id}/")

        self.assertEqual(create_response.status_code, 405)
        self.assertEqual(update_response.status_code, 405)
        self.assertEqual(retrieve_response.status_code, 200)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.status, BotConversation.Statuses.OPEN)
        self.assertIsNone(self.conversation.assigned_to)
        self.assertEqual(self.conversation.unread_count, 0)

        serializer = BotConversationSerializer()
        for field_name in ("client", "lead", "deal", "assigned_to", "status", "priority", "unread_count"):
            self.assertTrue(serializer.fields[field_name].read_only, field_name)

    def test_inbox_link_deal_rejects_foreign_tenant_and_accepts_own_deal(self):
        own_deal = Deal.objects.create(
            business=self.business,
            client=self.client,
            pipeline=self.pipeline,
            stage=self.stage,
            title="B0 Own Linked Deal",
            owner=self.owner,
        )
        foreign_deal = Deal.objects.create(
            business=self.other_business,
            client=self.other_client,
            pipeline=self.other_pipeline,
            stage=self.other_stage,
            title="B0 Foreign Linked Deal",
            owner=self.other_owner,
        )

        denied = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/link-deal/",
            {"deal_id": foreign_deal.id},
            format="json",
        )
        allowed = self.api.post(
            f"/api/inbox/conversations/{self.conversation.id}/link-deal/",
            {"deal_id": own_deal.id},
            format="json",
        )

        self.assertEqual(denied.status_code, 400)
        self.assertEqual(allowed.status_code, 200)
        self.conversation.refresh_from_db()
        self.assertEqual(self.conversation.deal, own_deal)
