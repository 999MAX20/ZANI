from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.activities.models import ActivityEvent
from apps.activities.taxonomy import ActivityEvents
from apps.bots.inbox_service import create_inbound_message_notifications
from apps.bots.models import Bot, BotConversation, BotMessage
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole, RoutingPolicy, SLAAttention, Team, TeamMember
from apps.businesses.routing import (
    apply_fallback_reassignments,
    route_unassigned_work,
    route_work_item,
    routing_health,
    scan_sla_attention,
)
from apps.clients.models import Client
from apps.core.models import AuditLog
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

    def test_owner_can_manage_routing_policy_but_manager_cannot_change_it(self):
        self.api.force_authenticate(self.owner)
        created = self.api.post(
            "/api/routing-policies/",
            {
                "business": self.business.id,
                "resource": RoutingPolicy.Resources.CONVERSATIONS,
                "mode": RoutingPolicy.Modes.ROUND_ROBIN,
                "team": self.team.id,
                "sla_minutes": 15,
            },
            format="json",
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.api.force_authenticate(self.manager)
        listed = self.api.get("/api/routing-policies/", {"business": self.business.id})
        denied = self.api.patch(
            f"/api/routing-policies/{created.data['id']}/",
            {"mode": RoutingPolicy.Modes.LEAST_LOADED},
            format="json",
        )

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(denied.status_code, 403)

        foreign_business = Business.objects.create(
            owner=self.owner,
            name="Foreign routing business",
            slug="foreign-routing-business",
        )
        foreign_team = Team.objects.create(business=foreign_business, name="Foreign team")
        self.api.force_authenticate(self.owner)
        foreign_team_response = self.api.post(
            "/api/routing-policies/",
            {
                "business": self.business.id,
                "resource": RoutingPolicy.Resources.TASKS,
                "mode": RoutingPolicy.Modes.ROUND_ROBIN,
                "team": foreign_team.id,
            },
            format="json",
        )
        self.assertEqual(foreign_team_response.status_code, 400)

    def test_round_robin_is_team_scoped_and_skips_unavailable_members(self):
        policy = RoutingPolicy.objects.create(
            business=self.business,
            resource=RoutingPolicy.Resources.CONVERSATIONS,
            mode=RoutingPolicy.Modes.ROUND_ROBIN,
            team=self.team,
        )
        first = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
        )
        second = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
        )
        third = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
        )

        first, first_changed = route_work_item(
            first,
            resource=RoutingPolicy.Resources.CONVERSATIONS,
            team=self.team,
        )
        second, second_changed = route_work_item(
            second,
            resource=RoutingPolicy.Resources.CONVERSATIONS,
            team=self.team,
        )
        self.operator_member.availability_status = BusinessMember.AvailabilityStatuses.UNAVAILABLE
        self.operator_member.unavailable_until = timezone.now() + timezone.timedelta(hours=2)
        self.operator_member.save(update_fields=["availability_status", "unavailable_until", "updated_at"])
        third, third_changed = route_work_item(
            third,
            resource=RoutingPolicy.Resources.CONVERSATIONS,
            team=self.team,
        )

        self.assertTrue(first_changed and second_changed and third_changed)
        self.assertEqual(first.assigned_to, self.manager)
        self.assertEqual(second.assigned_to, self.operator)
        self.assertEqual(third.assigned_to, self.manager)
        self.assertNotIn(self.specialist.id, {first.assigned_to_id, second.assigned_to_id, third.assigned_to_id})
        policy.refresh_from_db()
        self.assertEqual(policy.last_assigned_member, self.manager_member)

    def test_least_loaded_routes_to_eligible_member_with_smallest_active_load(self):
        policy = RoutingPolicy.objects.create(
            business=self.business,
            resource=RoutingPolicy.Resources.TASKS,
            mode=RoutingPolicy.Modes.LEAST_LOADED,
            team=self.other_team,
        )
        Task.objects.create(business=self.business, title="Specialist load 1", assignee=self.specialist)
        Task.objects.create(business=self.business, title="Specialist load 2", assignee=self.specialist)
        task = Task.objects.create(business=self.business, title="Route by load")

        routed, changed = route_work_item(
            task,
            resource=RoutingPolicy.Resources.TASKS,
            team=self.other_team,
        )

        self.assertTrue(changed)
        self.assertEqual(routed.assignee, self.outsider)
        self.assertEqual(policy.team.business, self.business)

    def test_periodic_routing_assigns_default_policy_unassigned_work(self):
        RoutingPolicy.objects.create(
            business=self.business,
            resource=RoutingPolicy.Resources.LEADS,
            mode=RoutingPolicy.Modes.ROUND_ROBIN,
        )
        lead = Lead.objects.create(business=self.business, client=self.client)

        result = route_unassigned_work(limit=10)

        lead.refresh_from_db()
        self.assertEqual(result, {"assigned": 1, "checked": 1})
        self.assertIsNotNone(lead.responsible_user)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(lead.id),
                metadata__kind="automatic_assignment",
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="Lead",
                entity_id=str(lead.id),
                metadata__kind="automatic_assignment",
            ).exists()
        )

    def test_automatic_policy_falls_back_to_available_owner_for_solo_business(self):
        solo_owner = self._user("solo-owner@example.com", User.Roles.BUSINESS_OWNER)
        solo_business = Business.objects.create(
            owner=solo_owner,
            name="Solo business",
            slug="solo-business",
        )
        ensure_default_roles(solo_business)
        BusinessMember.objects.create(
            business=solo_business,
            user=solo_owner,
            role=BusinessMember.Roles.OWNER,
            business_role=BusinessRole.objects.get(
                business=solo_business,
                preset_key=BusinessMember.Roles.OWNER,
            ),
        )
        RoutingPolicy.objects.create(
            business=solo_business,
            resource=RoutingPolicy.Resources.TASKS,
            mode=RoutingPolicy.Modes.ROUND_ROBIN,
        )
        task = Task.objects.create(business=solo_business, title="Solo owner task")

        routed, changed = route_work_item(
            task,
            resource=RoutingPolicy.Resources.TASKS,
        )

        self.assertTrue(changed)
        self.assertEqual(routed.assignee, solo_owner)

    def test_fallback_reassignment_requires_explicit_policy_and_is_audited(self):
        self.operator_member.availability_status = BusinessMember.AvailabilityStatuses.UNAVAILABLE
        self.operator_member.unavailable_until = timezone.now() + timezone.timedelta(hours=2)
        self.operator_member.fallback_member = self.manager_member
        self.operator_member.save(
            update_fields=["availability_status", "unavailable_until", "fallback_member", "updated_at"]
        )
        keep = BotConversation.objects.create(
            business=self.business,
            bot=self.bot,
            channel=BotConversation.Channels.WEBSITE,
            assigned_to=self.operator,
        )
        policy = RoutingPolicy.objects.create(
            business=self.business,
            resource=RoutingPolicy.Resources.CONVERSATIONS,
            mode=RoutingPolicy.Modes.MANUAL,
            unavailable_strategy=RoutingPolicy.UnavailableStrategies.KEEP_ASSIGNED,
        )

        first = apply_fallback_reassignments(limit=10)
        keep.refresh_from_db()
        self.assertEqual(first["reassigned"], 0)
        self.assertEqual(keep.assigned_to, self.operator)

        policy.unavailable_strategy = RoutingPolicy.UnavailableStrategies.MEMBER_FALLBACK
        policy.save(update_fields=["unavailable_strategy", "updated_at"])
        second = apply_fallback_reassignments(limit=10)
        keep.refresh_from_db()

        self.assertEqual(second["reassigned"], 1)
        self.assertEqual(keep.assigned_to, self.manager)
        self.assertTrue(
            ActivityEvent.objects.filter(
                business=self.business,
                event_type=ActivityEvents.WORK_AUTO_REASSIGNED,
                entity_id=str(keep.id),
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                business=self.business,
                entity_type="BotConversation",
                entity_id=str(keep.id),
                metadata__kind="automatic_reassignment",
            ).exists()
        )

    def test_sla_attention_notifies_managers_once_and_resolves(self):
        policy = RoutingPolicy.objects.create(
            business=self.business,
            resource=RoutingPolicy.Resources.LEADS,
            mode=RoutingPolicy.Modes.MANUAL,
            sla_minutes=10,
        )
        lead = Lead.objects.create(business=self.business, client=self.client)
        old = timezone.now() - timezone.timedelta(hours=1)
        Lead.objects.filter(id=lead.id).update(created_at=old, updated_at=old)

        first = scan_sla_attention(limit=20)
        notification_count = Notification.objects.filter(
            business=self.business,
            action_url=f"/app/leads?lead={lead.id}",
            priority=Notification.Priorities.HIGH,
        ).count()
        second = scan_sla_attention(limit=20)

        self.assertEqual(first["detected"], 1)
        self.assertEqual(first["notified"], 2)
        self.assertEqual(second["notified"], 0)
        self.assertEqual(
            Notification.objects.filter(
                business=self.business,
                action_url=f"/app/leads?lead={lead.id}",
                priority=Notification.Priorities.HIGH,
            ).count(),
            notification_count,
        )
        attention = SLAAttention.objects.get(policy=policy, entity_id=str(lead.id))
        self.assertTrue(attention.is_active)

        Lead.objects.filter(id=lead.id).update(
            responsible_user=self.manager,
            updated_at=timezone.now(),
        )
        resolved = scan_sla_attention(limit=20)
        attention.refresh_from_db()
        self.assertEqual(resolved["resolved"], 1)
        self.assertFalse(attention.is_active)

    def test_routing_health_is_bounded_and_contains_no_customer_text(self):
        RoutingPolicy.objects.create(
            business=self.business,
            resource=RoutingPolicy.Resources.TASKS,
            mode=RoutingPolicy.Modes.MANUAL,
        )
        Task.objects.create(
            business=self.business,
            title="Sensitive customer task text",
        )

        health = routing_health()

        self.assertEqual(health["active_policies"], 1)
        self.assertEqual(health["unassigned"][RoutingPolicy.Resources.TASKS], 1)
        self.assertNotIn("Sensitive customer task text", str(health))
