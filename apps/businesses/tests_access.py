from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.access import Actions, Resources, ensure_default_roles
from apps.businesses.models import Business, BusinessInvitation, BusinessMember, BusinessRole, RolePermission, Team, TeamMember
from apps.bots.models import Bot, BotConversation
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.core.models import AuditLog
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.services.models import Service
from apps.tasks.models import Task


class TeamAccessTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.manager = User.objects.create_user(
            username="manager",
            email="manager@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_MANAGER,
        )
        self.staff_user = User.objects.create_user(
            username="staff",
            email="staff@example.com",
            password="pass12345",
            role=User.Roles.STAFF,
        )
        self.business = Business.objects.create(owner=self.owner, name="Clinic", slug="clinic")
        ensure_default_roles(self.business)
        self.owner_member = BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OWNER),
        )
        self.manager_member = BusinessMember.objects.create(
            business=self.business,
            user=self.manager,
            role=BusinessMember.Roles.MANAGER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.MANAGER),
        )

    def test_auth_me_returns_memberships_and_effective_permissions(self):
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["memberships"][0]["role"], BusinessMember.Roles.OWNER)
        business_permissions = response.data["effective_permissions"][str(self.business.id)]
        self.assertIn(
            {"resource": Resources.TEAM, "action": Actions.MANAGE, "scope": RolePermission.Scopes.BUSINESS},
            business_permissions,
        )

    def test_owner_can_manage_team_members(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/team/members/",
            {
                "business": self.business.id,
                "user_id": self.staff_user.id,
                "role": BusinessMember.Roles.STAFF,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(BusinessMember.objects.filter(business=self.business, user=self.staff_user).exists())

    def test_manager_cannot_manage_team(self):
        self.api.force_authenticate(self.manager)

        response = self.api.post(
            "/api/team/departments/",
            {"business": self.business.id, "name": "Sales"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Team.objects.filter(business=self.business, name="Sales").exists())

    def test_owner_can_create_and_accept_whatsapp_invitation(self):
        self.api.force_authenticate(self.owner)

        create_response = self.api.post(
            "/api/team/invitations/",
            {
                "business": self.business.id,
                "email": "invited-manager@example.com",
                "phone": "+77015550102",
                "full_name": "Invited Manager",
                "role": BusinessMember.Roles.MANAGER,
                "delivery_channel": BusinessInvitation.DeliveryChannels.WHATSAPP,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, 201)
        invitation = BusinessInvitation.objects.get(email="invited-manager@example.com")
        self.assertEqual(invitation.invited_by, self.owner)
        self.assertEqual(invitation.business, self.business)
        self.assertEqual(invitation.status, BusinessInvitation.Statuses.PENDING)
        self.assertIn("/invite/", create_response.data["invite_path"])

        self.api.force_authenticate(user=None)
        accept_response = self.api.post(
            "/api/team/invitations/accept/",
            {"token": str(invitation.token), "password": "InvitePass123", "full_name": "Accepted Manager"},
            format="json",
        )

        self.assertEqual(accept_response.status_code, 200)
        user = User.objects.get(email="invited-manager@example.com")
        self.assertTrue(user.check_password("InvitePass123"))
        self.assertEqual(user.phone, "+77015550102")
        self.assertEqual(user.role, User.Roles.BUSINESS_MANAGER)
        self.assertTrue(BusinessMember.objects.filter(business=self.business, user=user, role=BusinessMember.Roles.MANAGER, is_active=True).exists())
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, BusinessInvitation.Statuses.ACCEPTED)

    def test_manager_cannot_create_invitation(self):
        self.api.force_authenticate(self.manager)

        response = self.api.post(
            "/api/team/invitations/",
            {
                "business": self.business.id,
                "email": "no-access@example.com",
                "role": BusinessMember.Roles.STAFF,
                "delivery_channel": BusinessInvitation.DeliveryChannels.MANUAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(BusinessInvitation.objects.filter(email="no-access@example.com").exists())

    def test_whatsapp_invitation_requires_phone(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/team/invitations/",
            {
                "business": self.business.id,
                "email": "missing-phone@example.com",
                "role": BusinessMember.Roles.STAFF,
                "delivery_channel": BusinessInvitation.DeliveryChannels.WHATSAPP,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_revoked_invitation_cannot_be_accepted(self):
        self.api.force_authenticate(self.owner)
        invitation = BusinessInvitation.objects.create(
            business=self.business,
            invited_by=self.owner,
            email="revoked@example.com",
            role=BusinessMember.Roles.STAFF,
            delivery_channel=BusinessInvitation.DeliveryChannels.MANUAL,
            expires_at=timezone.now() + timezone.timedelta(days=7),
            revoked_at=timezone.now(),
        )
        self.api.force_authenticate(user=None)

        response = self.api.post(
            "/api/team/invitations/accept/",
            {"token": str(invitation.token), "password": "InvitePass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_expired_invitation_cannot_be_accepted(self):
        invitation = BusinessInvitation.objects.create(
            business=self.business,
            invited_by=self.owner,
            email="expired@example.com",
            role=BusinessMember.Roles.STAFF,
            delivery_channel=BusinessInvitation.DeliveryChannels.MANUAL,
            expires_at=timezone.now() - timezone.timedelta(minutes=1),
        )

        response = self.api.post(
            "/api/team/invitations/accept/",
            {"token": str(invitation.token), "password": "InvitePass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="expired@example.com").exists())

    def test_accepted_invitation_cannot_be_reused(self):
        invitation = BusinessInvitation.objects.create(
            business=self.business,
            invited_by=self.owner,
            email="single-use@example.com",
            role=BusinessMember.Roles.STAFF,
            delivery_channel=BusinessInvitation.DeliveryChannels.MANUAL,
            expires_at=timezone.now() + timezone.timedelta(days=7),
            accepted_at=timezone.now(),
        )

        response = self.api.post(
            "/api/team/invitations/accept/",
            {"token": str(invitation.token), "password": "InvitePass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="single-use@example.com").exists())

    def test_role_permission_change_is_audit_logged(self):
        self.api.force_authenticate(self.owner)
        role = BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.MANAGER)
        permission = RolePermission.objects.get(business_role=role, resource=Resources.ANALYTICS, action=Actions.VIEW)

        response = self.api.patch(
            f"/api/team/role-permissions/{permission.id}/",
            {"is_allowed": False, "scope": RolePermission.Scopes.NONE},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                actor=self.owner,
                entity_type="BusinessRole",
                action=AuditLog.Actions.UPDATE,
            ).exists()
        )

    def test_own_scope_filters_deals_queryset(self):
        own_role = BusinessRole.objects.create(business=self.business, name="Own deals", preset_key="own-deals")
        RolePermission.objects.create(
            business_role=own_role,
            resource=Resources.DEALS,
            action=Actions.VIEW,
            scope=RolePermission.Scopes.OWN,
        )
        self.manager_member.business_role = own_role
        self.manager_member.save(update_fields=["business_role"])
        client = Client.objects.create(business=self.business, full_name="Client", phone="+77010000000")
        pipeline = Pipeline.objects.create(business=self.business, name="Sales", slug="sales", is_default=True)
        stage = PipelineStage.objects.create(business=self.business, pipeline=pipeline, name="New", order=1)
        own_deal = Deal.objects.create(
            business=self.business,
            client=client,
            pipeline=pipeline,
            stage=stage,
            title="Own deal",
            owner=self.manager,
        )
        Deal.objects.create(
            business=self.business,
            client=client,
            pipeline=pipeline,
            stage=stage,
            title="Other deal",
            owner=self.owner,
        )
        self.api.force_authenticate(self.manager)

        response = self.api.get("/api/deals/")

        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", response.data)
        self.assertEqual([item["id"] for item in rows], [own_deal.id])

    def test_operator_cannot_open_owner_analytics(self):
        operator = User.objects.create_user(
            username="operator",
            email="operator@example.com",
            password="pass12345",
            role=User.Roles.STAFF,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=operator,
            role=BusinessMember.Roles.OPERATOR,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OPERATOR),
        )
        self.api.force_authenticate(operator)

        response = self.api.get("/api/analytics/owner-dashboard/", {"business": self.business.id})

        self.assertEqual(response.status_code, 403)

    def test_staff_cannot_open_billing_usage(self):
        BusinessMember.objects.create(
            business=self.business,
            user=self.staff_user,
            role=BusinessMember.Roles.STAFF,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.STAFF),
        )
        self.api.force_authenticate(self.staff_user)

        response = self.api.get("/api/billing/usage-summary/")

        self.assertEqual(response.status_code, 403)

    def test_owner_sees_team_performance_for_all_members(self):
        client = Client.objects.create(business=self.business, full_name="Performance Client")
        service = Service.objects.create(business=self.business, name="Consultation", duration_minutes=30)
        lead = Lead.objects.create(
            business=self.business,
            client=client,
            responsible_user=self.manager,
            status=Lead.Statuses.APPOINTMENT_CREATED,
        )
        Lead.objects.create(
            business=self.business,
            client=client,
            responsible_user=self.manager,
            status=Lead.Statuses.LOST,
            lost_reason="No answer",
        )
        pipeline = Pipeline.objects.create(business=self.business, name="SLA pipeline", slug="sla-pipeline")
        stage = PipelineStage.objects.create(
            business=self.business,
            pipeline=pipeline,
            name="Offer",
            order=1,
            sla_minutes=10,
        )
        Deal.objects.create(
            business=self.business,
            client=client,
            pipeline=pipeline,
            stage=stage,
            title="Old deal",
            owner=self.manager,
            stage_entered_at=timezone.now() - timezone.timedelta(hours=1),
        )
        bot = Bot.objects.create(business=self.business, name="Website bot")
        BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            assigned_to=self.manager,
            last_inbound_at=timezone.now() - timezone.timedelta(minutes=20),
            last_outbound_at=timezone.now() - timezone.timedelta(minutes=5),
        )
        Appointment.objects.create(
            business=self.business,
            client=client,
            lead=lead,
            service=service,
            start_at=timezone.now() - timezone.timedelta(days=1),
            end_at=timezone.now() - timezone.timedelta(days=1, minutes=-30),
            status=Appointment.Statuses.NO_SHOW,
        )
        Task.objects.create(
            business=self.business,
            title="Overdue",
            assignee=self.manager,
            due_at=timezone.now() - timezone.timedelta(days=1),
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/team/performance/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["scope"], "business")
        user_ids = {row["user"]["id"] for row in response.data["members"]}
        self.assertIn(self.owner.id, user_ids)
        self.assertIn(self.manager.id, user_ids)
        self.assertGreaterEqual(response.data["totals"]["tasks_overdue"], 1)
        self.assertEqual(response.data["totals"]["sla_overdue_deals"], 1)
        self.assertEqual(response.data["totals"]["no_show_appointments"], 1)
        self.assertTrue(response.data["action_items"])
        manager_row = next(row for row in response.data["members"] if row["user"]["id"] == self.manager.id)
        self.assertEqual(manager_row["avg_response_time_minutes"], 15)

    def test_team_lead_sees_only_own_team_performance(self):
        staff_member = BusinessMember.objects.create(
            business=self.business,
            user=self.staff_user,
            role=BusinessMember.Roles.STAFF,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.STAFF),
        )
        team = Team.objects.create(business=self.business, name="Sales")
        TeamMember.objects.create(team=team, member=self.manager_member, is_lead=True)
        TeamMember.objects.create(team=team, member=staff_member)
        outside_user = User.objects.create_user(username="outside", email="outside@example.com", password="pass")
        BusinessMember.objects.create(
            business=self.business,
            user=outside_user,
            role=BusinessMember.Roles.MANAGER,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.MANAGER),
        )
        self.api.force_authenticate(self.manager)

        response = self.api.get("/api/team/performance/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["scope"], "team")
        user_ids = {row["user"]["id"] for row in response.data["members"]}
        self.assertEqual(user_ids, {self.manager.id, self.staff_user.id})

    def test_operator_cannot_open_team_performance(self):
        operator = User.objects.create_user(username="team-operator", email="team-operator@example.com", password="pass")
        BusinessMember.objects.create(
            business=self.business,
            user=operator,
            role=BusinessMember.Roles.OPERATOR,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.OPERATOR),
        )
        self.api.force_authenticate(operator)

        response = self.api.get("/api/team/performance/", {"business": self.business.id})

        self.assertEqual(response.status_code, 403)
