from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.businesses.access import Actions, Resources
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.clients.models import Client
from apps.core.models import AuditLog, LoginHistory, SupportAccessGrant


class SecurityCenterTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="security-owner", email="security-owner@example.com", password="pass", role=User.Roles.BUSINESS_OWNER)
        self.staff = User.objects.create_user(username="security-staff", email="security-staff@example.com", password="pass", role=User.Roles.STAFF)
        self.support = User.objects.create_user(username="security-support", email="security-support@example.com", password="pass", role=User.Roles.STAFF)
        self.business = Business.objects.create(owner=self.owner, name="Security Clinic", slug="security-clinic")
        BusinessMember.objects.create(business=self.business, user=self.owner, role=BusinessMember.Roles.OWNER)
        BusinessMember.objects.create(business=self.business, user=self.staff, role=BusinessMember.Roles.STAFF)
        self.client_obj = Client.objects.create(business=self.business, full_name="Secure Client")
        self.audit = AuditLog.objects.create(
            business=self.business,
            actor=self.owner,
            action=AuditLog.Actions.UPDATE,
            category=AuditLog.Categories.SECURITY,
            risk_level=AuditLog.RiskLevels.HIGH,
            entity_type="Client",
            entity_id=str(self.client_obj.id),
            metadata={"kind": "export"},
        )
        LoginHistory.objects.create(business=self.business, user=self.owner, email=self.owner.email, status=LoginHistory.Statuses.SUCCESS)

    def test_owner_sees_security_stream_and_staff_is_forbidden(self):
        self.client.force_authenticate(self.owner)
        audit_response = self.client.get("/api/security/audit/", {"business": self.business.id, "risk": AuditLog.RiskLevels.HIGH})
        risk_response = self.client.get("/api/security/risk-summary/", {"business": self.business.id})

        self.assertEqual(audit_response.status_code, 200)
        self.assertEqual(audit_response.data[0]["id"], self.audit.id)
        self.assertEqual(risk_response.data["risk_counts"]["high"], 1)

        self.client.force_authenticate(self.staff)
        forbidden = self.client.get("/api/security/audit/", {"business": self.business.id})
        self.assertEqual(forbidden.status_code, 403)

    def test_custom_role_with_audit_logs_view_can_read_security_center(self):
        role = BusinessRole.objects.create(business=self.business, name="Auditor", preset_key="auditor")
        RolePermission.objects.create(
            business_role=role,
            resource=Resources.AUDIT_LOGS,
            action=Actions.VIEW,
            scope=RolePermission.Scopes.BUSINESS,
            is_allowed=True,
        )
        member = BusinessMember.objects.get(business=self.business, user=self.staff)
        member.business_role = role
        member.save(update_fields=["business_role", "updated_at"])

        self.client.force_authenticate(self.staff)
        response = self.client.get("/api/security/audit/", {"business": self.business.id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_support_grant_requires_owner_and_is_logged(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            "/api/security/support-grants/",
            {
                "business": self.business.id,
                "user": self.support.id,
                "reason": "Support ticket #1",
                "is_active": True,
                "expires_at": (timezone.now() + timezone.timedelta(hours=2)).isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(SupportAccessGrant.objects.filter(business=self.business, user=self.support).exists())
        self.assertTrue(AuditLog.objects.filter(business=self.business, action=AuditLog.Actions.SUPPORT_ACCESS, risk_level=AuditLog.RiskLevels.HIGH).exists())
