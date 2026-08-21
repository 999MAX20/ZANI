import warnings

from django.core.paginator import UnorderedObjectListWarning
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.businesses.access import Actions, Resources, can, ensure_default_roles, user_is_business_owner
from apps.businesses.models import Business, BusinessInvitation, BusinessMember, BusinessRole, RolePermission, Team, TeamMember
from apps.bots.models import Bot, BotConversation
from apps.clients.models import Client
from apps.crm.models import Deal, Pipeline, PipelineStage
from apps.core.models import AuditLog
from apps.leads.models import Lead
from apps.scheduling.models import Appointment, Resource
from apps.services.models import Service
from apps.tasks.models import Task


@override_settings(SUPPORT_REQUIRES_GRANT=False)
class BusinessMemberPaginationTests(TestCase):
    def test_platform_admin_member_pages_have_stable_primary_key_order(self):
        api = APIClient()
        platform_admin = User.objects.create_user(
            username="platform-admin",
            email="platform-admin@example.com",
            password="pass12345",
            role=User.Roles.PLATFORM_ADMIN,
        )
        owner = User.objects.create_user(
            username="pagination-owner",
            email="pagination-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        business = Business.objects.create(owner=owner, name="Pagination Clinic", slug="pagination-clinic")
        members = [
            User(
                username=f"pagination-staff-{index}",
                email=f"pagination-staff-{index}@example.com",
                role=User.Roles.STAFF,
            )
            for index in range(55)
        ]
        User.objects.bulk_create(members)
        BusinessMember.objects.bulk_create(
            [
                BusinessMember(business=business, user=user, role=BusinessMember.Roles.STAFF)
                for user in members
            ]
        )
        expected_ids = list(BusinessMember.objects.order_by("pk").values_list("id", flat=True))
        api.force_authenticate(platform_admin)

        first_page = api.get("/api/business-members/?page=1")
        second_page = api.get("/api/business-members/?page=2")

        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(second_page.status_code, 200)
        actual_ids = [item["id"] for item in first_page.data["results"] + second_page.data["results"]]
        self.assertEqual(actual_ids, expected_ids)


class TeamMemberPaginationTests(TestCase):
    def test_team_member_pages_are_stable_tenant_scoped_and_role_scoped(self):
        api = APIClient()
        owner = User.objects.create_user(
            username="team-pagination-owner",
            email="team-pagination-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        business = Business.objects.create(owner=owner, name="Team Pagination Clinic", slug="team-pagination-clinic")
        BusinessMember.objects.create(
            business=business,
            user=owner,
            role=BusinessMember.Roles.OWNER,
        )
        staff_users = [
            User(
                username=f"team-pagination-staff-{index}",
                email=f"team-pagination-staff-{index}@example.com",
                role=User.Roles.STAFF,
            )
            for index in range(55)
        ]
        User.objects.bulk_create(staff_users)
        BusinessMember.objects.bulk_create(
            [
                BusinessMember(business=business, user=user, role=BusinessMember.Roles.STAFF)
                for user in staff_users
            ]
        )

        other_owner = User.objects.create_user(
            username="other-team-pagination-owner",
            email="other-team-pagination-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        other_business = Business.objects.create(
            owner=other_owner,
            name="Other Team Pagination Clinic",
            slug="other-team-pagination-clinic",
        )
        foreign_member = BusinessMember.objects.create(
            business=other_business,
            user=other_owner,
            role=BusinessMember.Roles.OWNER,
        )
        expected_ids = list(
            BusinessMember.objects.filter(business=business).order_by("pk").values_list("id", flat=True)
        )
        api.force_authenticate(owner)

        with warnings.catch_warnings():
            warnings.filterwarnings("error", category=UnorderedObjectListWarning)
            first_page = api.get("/api/team/members/?page=1")
            second_page = api.get("/api/team/members/?page=2")

        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(second_page.status_code, 200)
        actual_ids = [item["id"] for item in first_page.data["results"] + second_page.data["results"]]
        self.assertEqual(actual_ids, expected_ids)
        self.assertNotIn(foreign_member.id, actual_ids)

        api.force_authenticate(staff_users[0])
        denied_response = api.get("/api/team/members/")

        self.assertEqual(denied_response.status_code, 200)
        self.assertEqual(denied_response.data["results"], [])

    def test_team_members_can_be_scoped_to_one_accessible_business(self):
        api = APIClient()
        owner = User.objects.create_user(
            username="multi-business-owner",
            email="multi-business-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        first_business = Business.objects.create(
            owner=owner,
            name="First Accessible Clinic",
            slug="first-accessible-clinic",
        )
        second_business = Business.objects.create(
            owner=owner,
            name="Second Accessible Clinic",
            slug="second-accessible-clinic",
        )
        first_member = BusinessMember.objects.create(
            business=first_business,
            user=owner,
            role=BusinessMember.Roles.OWNER,
        )
        second_member = BusinessMember.objects.create(
            business=second_business,
            user=owner,
            role=BusinessMember.Roles.OWNER,
        )
        api.force_authenticate(owner)

        response = api.get(f"/api/team/members/?business={first_business.id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["results"]], [first_member.id])
        self.assertNotIn(second_member.id, [item["id"] for item in response.data["results"]])

        invalid_response = api.get("/api/team/members/?business=not-a-number")
        self.assertEqual(invalid_response.status_code, 200)
        self.assertEqual(invalid_response.data["results"], [])


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

    def test_auth_me_does_not_rewrite_valid_owner_membership(self):
        original_updated_at = self.owner_member.updated_at
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.owner_member.refresh_from_db()
        self.assertEqual(self.owner_member.role, BusinessMember.Roles.OWNER)
        self.assertEqual(self.owner_member.business_role.preset_key, BusinessMember.Roles.OWNER)
        self.assertEqual(self.owner_member.updated_at, original_updated_at)

    def test_auth_me_repairs_owner_membership_when_role_is_wrong(self):
        accountant_role = BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.ACCOUNTANT)
        self.owner_member.role = BusinessMember.Roles.ACCOUNTANT
        self.owner_member.business_role = accountant_role
        self.owner_member.save(update_fields=["role", "business_role", "updated_at"])
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.owner_member.refresh_from_db()
        self.assertEqual(self.owner_member.role, BusinessMember.Roles.OWNER)
        self.assertEqual(response.data["memberships"][0]["role"], BusinessMember.Roles.OWNER)
        business_permissions = response.data["effective_permissions"][str(self.business.id)]
        self.assertIn(
            {"resource": Resources.TEAM, "action": Actions.MANAGE, "scope": RolePermission.Scopes.BUSINESS},
            business_permissions,
        )

    def test_business_owner_can_manage_team_even_without_membership_row(self):
        self.owner_member.delete()
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/team/departments/",
            {"business": self.business.id, "name": "Front desk"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Team.objects.filter(business=self.business, name="Front desk").exists())

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

    def test_team_screen_cannot_promote_member_to_owner(self):
        staff_member = BusinessMember.objects.create(
            business=self.business,
            user=self.staff_user,
            role=BusinessMember.Roles.STAFF,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.STAFF),
        )
        self.api.force_authenticate(self.owner)

        response = self.api.patch(
            f"/api/team/members/{staff_member.id}/",
            {"role": BusinessMember.Roles.OWNER},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        staff_member.refresh_from_db()
        self.assertEqual(staff_member.role, BusinessMember.Roles.STAFF)

    def test_team_screen_cannot_deactivate_owner(self):
        self.api.force_authenticate(self.owner)

        response = self.api.patch(
            f"/api/team/members/{self.owner_member.id}/",
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.owner_member.refresh_from_db()
        self.assertTrue(self.owner_member.is_active)

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

    def test_telegram_invitation_requires_telegram_contact(self):
        self.api.force_authenticate(self.owner)

        response = self.api.post(
            "/api/team/invitations/",
            {
                "business": self.business.id,
                "email": "missing-telegram@example.com",
                "role": BusinessMember.Roles.STAFF,
                "delivery_channel": BusinessInvitation.DeliveryChannels.TELEGRAM,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_invitation_rejects_business_role_from_other_business(self):
        self.api.force_authenticate(self.owner)
        other_owner = User.objects.create_user(username="other-owner", email="other-owner@example.com", password="pass12345")
        other_business = Business.objects.create(owner=other_owner, name="Other", slug="other")
        ensure_default_roles(other_business)
        other_role = BusinessRole.objects.get(business=other_business, preset_key=BusinessMember.Roles.MANAGER)

        response = self.api.post(
            "/api/team/invitations/",
            {
                "business": self.business.id,
                "email": "wrong-role@example.com",
                "role": BusinessMember.Roles.MANAGER,
                "business_role": other_role.id,
                "delivery_channel": BusinessInvitation.DeliveryChannels.MANUAL,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(BusinessInvitation.objects.filter(email="wrong-role@example.com").exists())

    def test_accept_invitation_rejects_common_password(self):
        invitation = BusinessInvitation.objects.create(
            business=self.business,
            invited_by=self.owner,
            email="weak-password@example.com",
            role=BusinessMember.Roles.STAFF,
            delivery_channel=BusinessInvitation.DeliveryChannels.MANUAL,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )

        response = self.api.post(
            "/api/team/invitations/accept/",
            {"token": str(invitation.token), "password": "password"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="weak-password@example.com").exists())

    def test_existing_user_must_authenticate_before_accepting_invitation(self):
        existing_user = User.objects.create_user(
            username="existing-invite",
            email="existing-invite@example.com",
            password="ExistingPass123",
            role=User.Roles.STAFF,
        )
        invitation = BusinessInvitation.objects.create(
            business=self.business,
            invited_by=self.owner,
            email=existing_user.email,
            phone="+77015550103",
            role=BusinessMember.Roles.OPERATOR,
            delivery_channel=BusinessInvitation.DeliveryChannels.MANUAL,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )

        response = self.api.post(
            "/api/team/invitations/accept/",
            {"token": str(invitation.token), "password": "NewInvitePass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["code"], "invitation_account_authentication_required")
        existing_user.refresh_from_db()
        self.assertTrue(existing_user.check_password("ExistingPass123"))
        self.assertEqual(existing_user.phone, "")
        self.assertEqual(existing_user.role, User.Roles.STAFF)
        self.assertFalse(
            BusinessMember.objects.filter(
                business=self.business,
                user=existing_user,
                role=BusinessMember.Roles.OPERATOR,
                is_active=True,
            ).exists()
        )

    def test_authenticated_existing_user_acceptance_changes_only_membership(self):
        existing_user = User.objects.create_user(
            username="existing-authenticated-invite",
            email="existing-authenticated-invite@example.com",
            password="ExistingPass123",
            role=User.Roles.STAFF,
            full_name="Existing Name",
            phone="+77010000001",
            is_active=True,
        )
        original_password = existing_user.password
        invitation = BusinessInvitation.objects.create(
            business=self.business,
            invited_by=self.owner,
            email=existing_user.email,
            phone="+77015550103",
            full_name="Attacker Supplied Name",
            role=BusinessMember.Roles.OPERATOR,
            delivery_channel=BusinessInvitation.DeliveryChannels.MANUAL,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.api.force_authenticate(existing_user)

        response = self.api.post(
            "/api/team/invitations/accept/",
            {"token": str(invitation.token)},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        existing_user.refresh_from_db()
        self.assertEqual(existing_user.password, original_password)
        self.assertEqual(existing_user.full_name, "Existing Name")
        self.assertEqual(existing_user.phone, "+77010000001")
        self.assertEqual(existing_user.role, User.Roles.STAFF)
        self.assertTrue(existing_user.is_active)
        self.assertTrue(
            BusinessMember.objects.filter(
                business=self.business,
                user=existing_user,
                role=BusinessMember.Roles.OPERATOR,
                is_active=True,
            ).exists()
        )

    def test_public_invitation_cannot_set_password_on_social_only_account(self):
        social_user = User.objects.create(
            username="social-only-invite",
            email="social-only-invite@example.com",
            role=User.Roles.STAFF,
            is_active=True,
        )
        social_user.set_unusable_password()
        social_user.save(update_fields=["password"])
        original_password = social_user.password
        invitation = BusinessInvitation.objects.create(
            business=self.business,
            invited_by=self.owner,
            email=social_user.email,
            role=BusinessMember.Roles.MANAGER,
            delivery_channel=BusinessInvitation.DeliveryChannels.MANUAL,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.api.force_authenticate(user=None)

        response = self.api.post(
            "/api/team/invitations/accept/",
            {"token": str(invitation.token), "password": "AttackerPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        social_user.refresh_from_db()
        self.assertEqual(social_user.password, original_password)
        self.assertFalse(social_user.has_usable_password())
        self.assertEqual(social_user.role, User.Roles.STAFF)
        self.assertFalse(BusinessMember.objects.filter(business=self.business, user=social_user).exists())

    def test_authenticated_user_cannot_accept_another_accounts_invitation(self):
        invited_user = User.objects.create_user(
            username="invited-existing-user",
            email="invited-existing-user@example.com",
            password="ExistingPass123",
            role=User.Roles.STAFF,
        )
        other_user = User.objects.create_user(
            username="other-existing-user",
            email="other-existing-user@example.com",
            password="ExistingPass123",
            role=User.Roles.STAFF,
        )
        invitation = BusinessInvitation.objects.create(
            business=self.business,
            invited_by=self.owner,
            email=invited_user.email,
            role=BusinessMember.Roles.MANAGER,
            delivery_channel=BusinessInvitation.DeliveryChannels.MANUAL,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.api.force_authenticate(other_user)

        response = self.api.post(
            "/api/team/invitations/accept/",
            {"token": str(invitation.token)},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(BusinessMember.objects.filter(business=self.business, user=invited_user).exists())

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

    def test_own_deal_scope_still_exposes_shared_pipeline_configuration(self):
        own_role = BusinessRole.objects.create(business=self.business, name="Own deals", preset_key="own-deals")
        RolePermission.objects.create(
            business_role=own_role,
            resource=Resources.DEALS,
            action=Actions.VIEW,
            scope=RolePermission.Scopes.OWN,
        )
        self.manager_member.business_role = own_role
        self.manager_member.save(update_fields=["business_role"])
        pipeline = Pipeline.objects.create(business=self.business, name="Sales", slug="sales", is_default=True)
        stage = PipelineStage.objects.create(business=self.business, pipeline=pipeline, name="New", order=1)
        self.api.force_authenticate(self.manager)

        pipeline_response = self.api.get("/api/pipelines/")
        stage_response = self.api.get("/api/pipeline-stages/")

        self.assertEqual(pipeline_response.status_code, 200)
        self.assertEqual(stage_response.status_code, 200)
        pipeline_rows = pipeline_response.data.get("results", pipeline_response.data)
        stage_rows = stage_response.data.get("results", stage_response.data)
        self.assertEqual([item["id"] for item in pipeline_rows], [pipeline.id])
        self.assertEqual([item["id"] for item in stage_rows], [stage.id])

    def test_team_scope_filters_deals_queryset_to_team_members(self):
        staff_member = BusinessMember.objects.create(
            business=self.business,
            user=self.staff_user,
            role=BusinessMember.Roles.STAFF,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.STAFF),
        )
        team = Team.objects.create(business=self.business, name="Sales")
        TeamMember.objects.create(team=team, member=self.manager_member, is_lead=True)
        TeamMember.objects.create(team=team, member=staff_member)
        team_role = BusinessRole.objects.create(business=self.business, name="Team deals", preset_key="team-deals")
        RolePermission.objects.create(
            business_role=team_role,
            resource=Resources.DEALS,
            action=Actions.VIEW,
            scope=RolePermission.Scopes.TEAM,
        )
        self.manager_member.business_role = team_role
        self.manager_member.save(update_fields=["business_role"])
        client = Client.objects.create(business=self.business, full_name="Team Client", phone="+77010000001")
        pipeline = Pipeline.objects.create(business=self.business, name="Team Sales", slug="team-sales", is_default=True)
        stage = PipelineStage.objects.create(business=self.business, pipeline=pipeline, name="New", order=1)
        team_deal = Deal.objects.create(
            business=self.business,
            client=client,
            pipeline=pipeline,
            stage=stage,
            title="Team deal",
            owner=self.staff_user,
        )
        Deal.objects.create(
            business=self.business,
            client=client,
            pipeline=pipeline,
            stage=stage,
            title="Outside team deal",
            owner=self.owner,
        )
        self.api.force_authenticate(self.manager)

        response = self.api.get("/api/deals/")

        self.assertEqual(response.status_code, 200)
        rows = response.data.get("results", response.data)
        self.assertEqual([item["id"] for item in rows], [team_deal.id])

    def test_default_roles_include_ai_permissions(self):
        manager_permissions = list(
            RolePermission.objects.filter(
                business_role__business=self.business,
                business_role__preset_key=BusinessMember.Roles.MANAGER,
                resource=Resources.AI_PIPELINE,
            ).values_list("action", "scope")
        )
        operator_permissions = list(
            RolePermission.objects.filter(
                business_role__business=self.business,
                business_role__preset_key=BusinessMember.Roles.OPERATOR,
                resource=Resources.AI_ASSISTANT,
            ).values_list("action", "scope")
        )

        self.assertIn((Actions.EXECUTE, RolePermission.Scopes.OWN), manager_permissions)
        self.assertIn((Actions.SUGGEST, RolePermission.Scopes.OWN), operator_permissions)

    def test_support_role_sees_deal_but_sensitive_fields_are_masked(self):
        support_user = User.objects.create_user(
            username="support-user",
            email="support-user@example.com",
            password="pass12345",
            role=User.Roles.STAFF,
        )
        BusinessMember.objects.create(
            business=self.business,
            user=support_user,
            role=BusinessMember.Roles.SUPPORT,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=BusinessMember.Roles.SUPPORT),
        )
        client = Client.objects.create(business=self.business, full_name="Sensitive Client", phone="+77010000002")
        pipeline = Pipeline.objects.create(business=self.business, name="Sensitive Sales", slug="sensitive-sales", is_default=True)
        stage = PipelineStage.objects.create(business=self.business, pipeline=pipeline, name="New", order=1)
        deal = Deal.objects.create(
            business=self.business,
            client=client,
            pipeline=pipeline,
            stage=stage,
            title="Sensitive deal",
            amount=250000,
            currency="KZT",
            notes="Internal margin note",
            lost_reason="Private reason",
        )
        self.api.force_authenticate(support_user)

        response = self.api.get(f"/api/deals/{deal.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["amount"])
        self.assertEqual(response.data["currency"], "")
        self.assertEqual(response.data["notes"], "")
        self.assertEqual(response.data["lost_reason"], "")

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
        Deal.objects.create(
            business=self.business,
            client=client,
            pipeline=pipeline,
            stage=stage,
            title="Closed old deal",
            owner=self.manager,
            status=Deal.Statuses.WON,
            stage_entered_at=timezone.now() - timezone.timedelta(hours=1),
        )
        bot = Bot.objects.create(business=self.business, name="Website bot")
        BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            status=BotConversation.Statuses.OPEN,
            handoff_required=True,
            assigned_to=self.manager,
            last_inbound_at=timezone.now() - timezone.timedelta(minutes=20),
            last_outbound_at=timezone.now() - timezone.timedelta(minutes=5),
        )
        BotConversation.objects.create(
            business=self.business,
            bot=bot,
            channel=BotConversation.Channels.WEBSITE,
            status=BotConversation.Statuses.OPEN,
            handoff_required=True,
            assigned_to=self.manager,
            last_inbound_at=timezone.now() - timezone.timedelta(minutes=5),
            last_outbound_at=None,
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
        Task.objects.create(
            business=self.business,
            title="Snoozed overdue",
            assignee=self.manager,
            due_at=timezone.now() - timezone.timedelta(days=1),
            snoozed_until=timezone.now() + timezone.timedelta(hours=2),
        )
        Task.objects.create(
            business=self.business,
            title="Done overdue",
            assignee=self.manager,
            due_at=timezone.now() - timezone.timedelta(days=1),
            status=Task.Statuses.DONE,
        )
        self.api.force_authenticate(self.owner)

        response = self.api.get("/api/team/performance/", {"business": self.business.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["scope"], "business")
        user_ids = {row["user"]["id"] for row in response.data["members"]}
        self.assertIn(self.owner.id, user_ids)
        self.assertIn(self.manager.id, user_ids)
        self.assertGreaterEqual(response.data["totals"]["tasks_overdue"], 1)
        self.assertEqual(response.data["totals"]["overdue_handoffs"], 1)
        self.assertEqual(response.data["totals"]["missed_chat_handoffs"], 1)
        self.assertEqual(response.data["totals"]["sla_overdue_deals"], 1)
        self.assertEqual(response.data["totals"]["no_show_appointments"], 1)
        self.assertTrue(response.data["action_items"])
        manager_row = next(row for row in response.data["members"] if row["user"]["id"] == self.manager.id)
        self.assertEqual(manager_row["avg_response_time_minutes"], 15)
        self.assertEqual(manager_row["tasks_overdue"], 1)
        self.assertEqual(manager_row["overdue_handoffs"], 1)
        self.assertEqual(manager_row["missed_chat_handoffs"], 1)

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


class CanonicalBusinessRoleTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = User.objects.create_user(
            username="pc2-owner",
            email="pc2-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        self.business = Business.objects.create(
            owner=self.owner,
            name="PC2 Generic CRM",
            slug="pc2-generic-crm",
            business_type=Business.BusinessTypes.DENTISTRY,
        )
        ensure_default_roles(self.business)
        self.owner_member = BusinessMember.objects.create(
            business=self.business,
            user=self.owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(
                business=self.business,
                preset_key=BusinessMember.Roles.OWNER,
            ),
        )

    def create_member(self, role, email):
        user = User.objects.create_user(
            username=email,
            email=email,
            password="pass12345",
            role=User.Roles.STAFF,
        )
        member = BusinessMember.objects.create(
            business=self.business,
            user=user,
            role=role,
            business_role=BusinessRole.objects.get(
                business=self.business,
                preset_key=role,
            ),
        )
        return user, member

    def test_canonical_profiles_exist_and_new_members_default_to_specialist(self):
        expected = {
            BusinessMember.Roles.OWNER,
            BusinessMember.Roles.ADMIN,
            BusinessMember.Roles.MANAGER,
            BusinessMember.Roles.OPERATOR,
            BusinessMember.Roles.SPECIALIST,
        }
        actual = set(
            BusinessRole.objects.filter(
                business=self.business,
                preset_key__in=expected,
                is_active=True,
            ).values_list("preset_key", flat=True)
        )
        default_user = User.objects.create_user(
            username="pc2-default-specialist",
            email="pc2-default-specialist@example.com",
            password="pass12345",
        )
        default_member = BusinessMember.objects.create(
            business=self.business,
            user=default_user,
        )

        self.assertEqual(actual, expected)
        self.assertEqual(default_member.role, BusinessMember.Roles.SPECIALIST)

    def test_operator_manages_operational_calendar_but_not_control_plane(self):
        operator, _ = self.create_member(BusinessMember.Roles.OPERATOR, "pc2-operator@example.com")

        for action in (Actions.VIEW, Actions.CREATE, Actions.UPDATE):
            result = can(operator, self.business, Resources.APPOINTMENTS, action)
            self.assertTrue(result.allowed)
            self.assertEqual(result.scope, RolePermission.Scopes.BUSINESS)
        for resource in (Resources.SETTINGS, Resources.BILLING, Resources.INTEGRATIONS):
            self.assertFalse(can(operator, self.business, resource, Actions.VIEW).allowed)

    def test_specialist_can_only_update_appointments_linked_to_them(self):
        specialist, _ = self.create_member(
            BusinessMember.Roles.SPECIALIST,
            "pc2-specialist@example.com",
        )
        other_specialist, _ = self.create_member(
            BusinessMember.Roles.SPECIALIST,
            "pc2-other-specialist@example.com",
        )
        client = Client.objects.create(business=self.business, full_name="PC2 Client")
        service = Service.objects.create(business=self.business, name="PC2 Service")
        own_resource = Resource.objects.create(
            business=self.business,
            name="Specialist A",
            linked_user=specialist,
        )
        other_resource = Resource.objects.create(
            business=self.business,
            name="Specialist B",
            linked_user=other_specialist,
        )
        start_at = timezone.now() + timezone.timedelta(days=1)
        own_appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            resource=own_resource,
            start_at=start_at,
            end_at=start_at + timezone.timedelta(minutes=30),
        )
        other_appointment = Appointment.objects.create(
            business=self.business,
            client=client,
            service=service,
            resource=other_resource,
            start_at=start_at + timezone.timedelta(hours=1),
            end_at=start_at + timezone.timedelta(hours=1, minutes=30),
        )

        self.assertTrue(
            can(
                specialist,
                self.business,
                Resources.APPOINTMENTS,
                Actions.UPDATE,
                obj=own_appointment,
            ).allowed
        )
        self.assertFalse(
            can(
                specialist,
                self.business,
                Resources.APPOINTMENTS,
                Actions.UPDATE,
                obj=other_appointment,
            ).allowed
        )
        self.assertFalse(can(specialist, self.business, Resources.TEAM, Actions.VIEW).allowed)

        self.api.force_authenticate(specialist)
        resource_response = self.api.get("/api/resources/")
        appointment_response = self.api.get("/api/appointments/")

        self.assertEqual(resource_response.status_code, 200)
        self.assertEqual(
            [resource["id"] for resource in resource_response.data["results"]],
            [own_resource.id],
        )
        self.assertEqual(appointment_response.status_code, 200)
        self.assertEqual(
            [appointment["id"] for appointment in appointment_response.data["results"]],
            [own_appointment.id],
        )

    def test_admin_has_operational_control_but_cannot_take_owner_authority(self):
        admin, _ = self.create_member(BusinessMember.Roles.ADMIN, "pc2-admin@example.com")
        self.assertTrue(can(admin, self.business, Resources.SETTINGS, Actions.UPDATE).allowed)
        self.assertFalse(user_is_business_owner(admin, self.business))
        self.api.force_authenticate(admin)

        response = self.api.patch(
            f"/api/team/members/{self.owner_member.id}/",
            {"role": BusinessMember.Roles.ADMIN},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.owner_member.refresh_from_db()
        self.assertEqual(self.owner_member.role, BusinessMember.Roles.OWNER)

    def test_specialist_has_no_cross_tenant_access(self):
        specialist, _ = self.create_member(
            BusinessMember.Roles.SPECIALIST,
            "pc2-tenant-specialist@example.com",
        )
        other_owner = User.objects.create_user(
            username="pc2-other-owner",
            email="pc2-other-owner@example.com",
            password="pass12345",
            role=User.Roles.BUSINESS_OWNER,
        )
        other_business = Business.objects.create(
            owner=other_owner,
            name="PC2 Other CRM",
            slug="pc2-other-crm",
        )

        self.assertFalse(
            can(
                specialist,
                other_business,
                Resources.APPOINTMENTS,
                Actions.VIEW,
            ).allowed
        )
