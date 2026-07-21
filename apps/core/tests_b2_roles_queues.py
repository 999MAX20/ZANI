from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.bots.inbox_service import create_inbound_message_notifications
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole, Team, TeamMember
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.tasks.models import Task


class B2RoleQueueTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.owner = self._user("b2-owner@example.com", User.Roles.BUSINESS_OWNER)
        self.manager = self._user("b2-manager@example.com", User.Roles.BUSINESS_MANAGER)
        self.operator = self._user("b2-operator@example.com", User.Roles.BUSINESS_OPERATOR)
        self.specialist = self._user("b2-specialist@example.com", User.Roles.STAFF)
        self.outsider = self._user("b2-outsider@example.com", User.Roles.STAFF)
        self.business = Business.objects.create(owner=self.owner, name="B2 Clinic", slug="b2-clinic")
        ensure_default_roles(self.business)
        self.owner_member = self._member(self.owner, BusinessMember.Roles.OWNER)
        self.manager_member = self._member(self.manager, BusinessMember.Roles.MANAGER)
        self.operator_member = self._member(self.operator, BusinessMember.Roles.OPERATOR)
        self.specialist_member = self._member(self.specialist, BusinessMember.Roles.STAFF)
        self.outsider_member = self._member(self.outsider, BusinessMember.Roles.STAFF)
        self.team = Team.objects.create(business=self.business, name="Front desk")
        TeamMember.objects.create(team=self.team, member=self.manager_member, is_lead=True)
        TeamMember.objects.create(team=self.team, member=self.operator_member)
        self.other_team = Team.objects.create(business=self.business, name="Clinical")
        TeamMember.objects.create(team=self.other_team, member=self.specialist_member, is_lead=True)
        TeamMember.objects.create(team=self.other_team, member=self.outsider_member)
        self.client = Client.objects.create(business=self.business, full_name="B2 Client")
        self.bot = Bot.objects.create(business=self.business, name="B2 Bot")

    @staticmethod
    def _user(email, role):
        return User.objects.create_user(username=email, email=email, password="pass12345", role=role)

    def _member(self, user, role):
        return BusinessMember.objects.create(
            business=self.business,
            user=user,
            role=role,
            business_role=BusinessRole.objects.get(business=self.business, preset_key=role),
        )

    def _queue(self, user):
        self.api.force_authenticate(user)
        return self.api.get("/api/work-queues/", {"business": self.business.id, "limit": 50})

    def test_daily_queues_are_role_and_team_scoped(self):
        own_task = Task.objects.create(business=self.business, client=self.client, title="Operator task", assignee=self.operator)
        team_task = Task.objects.create(business=self.business, client=self.client, title="Manager task", assignee=self.manager)
        foreign_team_task = Task.objects.create(business=self.business, client=self.client, title="Clinical task", assignee=self.specialist)
        unassigned = Task.objects.create(business=self.business, client=self.client, title="Unassigned task")

        operator_response = self._queue(self.operator)
        manager_response = self._queue(self.manager)
        specialist_response = self._queue(self.specialist)
        owner_response = self._queue(self.owner)

        self.assertEqual(operator_response.status_code, 200)
        self.assertEqual({row["id"] for row in operator_response.data["queues"]["own_tasks"]}, {own_task.id})
        self.assertNotIn(foreign_team_task.id, {row["id"] for row in operator_response.data["queues"]["own_tasks"]})
        manager_visible = {
            row["id"]
            for key in ("own_tasks", "team_tasks", "unassigned_tasks")
            for row in manager_response.data["queues"][key]
        }
        self.assertIn(team_task.id, manager_visible)
        self.assertIn(unassigned.id, manager_visible)
        self.assertNotIn(foreign_team_task.id, manager_visible)
        self.assertEqual({row["id"] for row in specialist_response.data["queues"]["own_tasks"]}, {foreign_team_task.id})
        self.assertEqual(owner_response.data["summary"]["unassigned_tasks"], 1)

    def test_operator_self_claim_and_manager_team_assignment_policy(self):
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
        )
        self.api.force_authenticate(self.operator)

        self_claim = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/assign/",
            {"user_id": self.operator.id},
            format="json",
        )
        forbidden_cross_assignment = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/assign/",
            {"user_id": self.specialist.id},
            format="json",
        )

        self.assertEqual(self_claim.status_code, 200)
        self.assertEqual(forbidden_cross_assignment.status_code, 403)

        lead = Lead.objects.create(business=self.business, client=self.client)
        self.api.force_authenticate(self.manager)
        allowed = self.api.post(f"/api/leads/{lead.id}/assign/", {"user_id": self.operator.id}, format="json")
        denied = self.api.post(f"/api/leads/{lead.id}/assign/", {"user_id": self.specialist.id}, format="json")

        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(denied.status_code, 403)
        lead.refresh_from_db()
        self.assertEqual(lead.responsible_user, self.operator)

    def test_duplicate_assignment_is_idempotent_and_notifies_old_and_new_users(self):
        lead = Lead.objects.create(business=self.business, client=self.client, responsible_user=self.manager)
        self.api.force_authenticate(self.owner)

        first = self.api.post(f"/api/leads/{lead.id}/assign/", {"user_id": self.operator.id}, format="json")
        activity_count = ActivityEvent.objects.filter(business=self.business, entity_type="Lead", entity_id=str(lead.id)).count()
        notification_count = Notification.objects.filter(
            business=self.business,
            action_url=f"/app/leads?lead={lead.id}",
        ).count()
        second = self.api.post(f"/api/leads/{lead.id}/assign/", {"user_id": self.operator.id}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            ActivityEvent.objects.filter(business=self.business, entity_type="Lead", entity_id=str(lead.id)).count(),
            activity_count,
        )
        self.assertEqual(
            Notification.objects.filter(business=self.business, action_url=f"/app/leads?lead={lead.id}").count(),
            notification_count,
        )
        recipients = set(
            Notification.objects.filter(business=self.business, action_url=f"/app/leads?lead={lead.id}").values_list(
                "recipient_id", flat=True
            )
        )
        self.assertEqual(recipients, {self.manager.id, self.operator.id})

    def test_unavailable_member_uses_fallback_for_inbound_notifications(self):
        self.operator_member.availability_status = BusinessMember.AvailabilityStatuses.UNAVAILABLE
        self.operator_member.unavailable_until = timezone.now() + timezone.timedelta(hours=4)
        self.operator_member.fallback_member = self.manager_member
        self.operator_member.save(
            update_fields=["availability_status", "unavailable_until", "fallback_member", "updated_at"]
        )
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            assigned_to=self.operator,
        )
        message = BotMessage.objects.create(
            conversation=conversation,
            direction=BotMessage.Directions.INBOUND,
            text="Need help",
        )

        notifications = create_inbound_message_notifications(conversation, message)

        self.assertEqual([item.recipient_id for item in notifications], [self.manager.id])
        self.api.force_authenticate(self.owner)
        denied = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/assign/",
            {"user_id": self.operator.id},
            format="json",
        )
        self.assertEqual(denied.status_code, 400)

    def test_handoff_creates_immediate_manager_attention(self):
        conversation = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            assigned_to=self.operator,
        )
        self.api.force_authenticate(self.operator)

        response = self.api.post(
            f"/api/inbox/conversations/{conversation.id}/handoff/",
            {"reason": "Client requested a supervisor"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            Notification.objects.filter(
                business=self.business,
                recipient=self.manager,
                priority=Notification.Priorities.HIGH,
                action_url=f"/app/conversations?conversation={conversation.id}",
            ).exists()
        )
