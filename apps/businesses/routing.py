from collections import Counter

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.activities.services import create_activity_event
from apps.activities.taxonomy import ActivityEvents
from apps.bots.models import BotConversation
from apps.businesses.assignment_notifications import create_assignment_notifications
from apps.businesses.assignment_policy import ELIGIBLE_ROLES, member_is_available
from apps.businesses.models import BusinessMember, RoutingPolicy, SLAAttention, Team
from apps.core.models import AuditLog
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.tasks.models import Task


RESOURCE_CONFIG = {
    RoutingPolicy.Resources.LEADS: {
        "model": Lead,
        "assignee_field": "responsible_user",
        "active_filter": Q(is_archived=False) & ~Q(status__in=[Lead.Statuses.LOST, Lead.Statuses.CLOSED]),
        "event_type": ActivityEvents.LEAD_ASSIGNED,
        "action_url": lambda item: f"/app/leads?lead={item.id}",
    },
    RoutingPolicy.Resources.CONVERSATIONS: {
        "model": BotConversation,
        "assignee_field": "assigned_to",
        "active_filter": Q(is_archived=False, status=BotConversation.Statuses.OPEN),
        "event_type": ActivityEvents.CONVERSATION_ASSIGNED,
        "action_url": lambda item: f"/app/conversations?conversation={item.id}",
    },
    RoutingPolicy.Resources.TASKS: {
        "model": Task,
        "assignee_field": "assignee",
        "active_filter": Q(is_archived=False, status__in=[Task.Statuses.OPEN, Task.Statuses.IN_PROGRESS]),
        "event_type": ActivityEvents.TASK_ASSIGNED,
        "action_url": lambda item: f"/app/tasks?task={item.id}",
    },
}
DEFAULT_ROUTING_ROLES = {
    RoutingPolicy.Resources.LEADS: {
        BusinessMember.Roles.MANAGER,
        BusinessMember.Roles.OPERATOR,
        BusinessMember.Roles.STAFF,
    },
    RoutingPolicy.Resources.CONVERSATIONS: {
        BusinessMember.Roles.MANAGER,
        BusinessMember.Roles.OPERATOR,
        BusinessMember.Roles.SUPPORT,
        BusinessMember.Roles.STAFF,
    },
    RoutingPolicy.Resources.TASKS: {
        BusinessMember.Roles.MANAGER,
        BusinessMember.Roles.OPERATOR,
        BusinessMember.Roles.STAFF,
        BusinessMember.Roles.DOCTOR,
    },
}


def resolve_routing_policy(*, business, resource, team=None):
    if resource not in RESOURCE_CONFIG:
        raise ValidationError({"resource": "Unsupported routing resource."})
    if team is not None and (not isinstance(team, Team) or team.business_id != business.id or not team.is_active):
        raise ValidationError({"team": "Routing team must be active and belong to this business."})
    policies = RoutingPolicy.objects.filter(
        business=business,
        resource=resource,
        is_active=True,
    )
    if team is not None:
        policy = policies.filter(team=team).first()
        if policy:
            return policy
    return policies.filter(team__isnull=True).first()


def eligible_routing_members(*, policy, now=None):
    now = now or timezone.now()
    roles = set(policy.eligible_roles or DEFAULT_ROUTING_ROLES[policy.resource])
    roles &= ELIGIBLE_ROLES[policy.resource]
    queryset = BusinessMember.objects.filter(
        business=policy.business,
        is_active=True,
        user__is_active=True,
        role__in=roles,
    ).filter(
        Q(availability_status=BusinessMember.AvailabilityStatuses.AVAILABLE)
        | Q(unavailable_until__lte=now)
    )
    if policy.team_id:
        queryset = queryset.filter(
            team_memberships__team=policy.team,
            team_memberships__team__is_active=True,
        )
    return queryset.select_related("user").distinct().order_by("id")


def route_work_item(item, *, resource, team=None, source="routing"):
    config = RESOURCE_CONFIG.get(resource)
    if config is None:
        raise ValidationError({"resource": "Unsupported routing resource."})
    if item.business_id is None:
        raise ValidationError({"business": "Work item must belong to a business."})
    policy = resolve_routing_policy(
        business=item.business,
        resource=resource,
        team=team,
    )
    if policy is None or policy.mode == RoutingPolicy.Modes.MANUAL:
        return item, False

    with transaction.atomic():
        policy = RoutingPolicy.objects.select_for_update().select_related("business", "team").get(id=policy.id)
        locked_item = config["model"].objects.select_for_update().select_related("business").get(
            id=item.id,
            business=policy.business,
        )
        assignee_field = config["assignee_field"]
        if getattr(locked_item, f"{assignee_field}_id"):
            return locked_item, False
        members = list(eligible_routing_members(policy=policy))
        if not members and policy.team_id is None:
            owner_member = policy.business.members.filter(
                user_id=policy.business.owner_id,
                is_active=True,
                user__is_active=True,
                role__in=ELIGIBLE_ROLES[policy.resource],
            ).select_related("user").first()
            if owner_member and member_is_available(owner_member):
                members = [owner_member]
        member = _select_member(policy, members, config=config)
        if member is None:
            return locked_item, False

        setattr(locked_item, assignee_field, member.user)
        locked_item.save(update_fields=[assignee_field, "updated_at"])
        policy.last_assigned_member = member
        policy.save(update_fields=["last_assigned_member", "updated_at"])
        _record_automatic_assignment(
            item=locked_item,
            resource=resource,
            previous_user=None,
            member=member,
            policy=policy,
            source=source,
            reassigned=False,
        )
        return locked_item, True


def _select_member(policy, members, *, config):
    if not members:
        return None
    if policy.mode == RoutingPolicy.Modes.ROUND_ROBIN:
        ids = [member.id for member in members]
        if policy.last_assigned_member_id in ids:
            index = (ids.index(policy.last_assigned_member_id) + 1) % len(ids)
            return members[index]
        return members[0]
    if policy.mode == RoutingPolicy.Modes.LEAST_LOADED:
        counts = _member_workload_counts(policy, members, config=config)
        return min(members, key=lambda member: (counts[member.user_id], member.id))
    return None


def _member_workload_counts(policy, members, *, config):
    user_ids = [member.user_id for member in members]
    assignee_field = config["assignee_field"]
    rows = (
        config["model"].objects.filter(
            config["active_filter"],
            business=policy.business,
            **{f"{assignee_field}_id__in": user_ids},
        )
        .values_list(f"{assignee_field}_id", flat=True)
    )
    counts = Counter(rows)
    return {user_id: counts.get(user_id, 0) for user_id in user_ids}


def route_unassigned_work(*, limit=100):
    if limit <= 0:
        return {"assigned": 0, "checked": 0}
    assigned = 0
    checked = 0
    policies = RoutingPolicy.objects.filter(
        is_active=True,
        team__isnull=True,
    ).exclude(mode=RoutingPolicy.Modes.MANUAL).select_related("business")
    for policy in policies:
        config = RESOURCE_CONFIG[policy.resource]
        assignee_field = config["assignee_field"]
        ids = list(
            config["model"].objects.filter(
                config["active_filter"],
                business=policy.business,
                **{f"{assignee_field}__isnull": True},
            )
            .order_by("created_at", "id")
            .values_list("id", flat=True)[: max(0, limit - checked)]
        )
        for item_id in ids:
            item = config["model"].objects.select_related("business").get(id=item_id)
            _, changed = route_work_item(item, resource=policy.resource, source="routing_runtime")
            checked += 1
            assigned += int(changed)
            if checked >= limit:
                return {"assigned": assigned, "checked": checked}
    return {"assigned": assigned, "checked": checked}


def apply_fallback_reassignments(*, limit=100):
    if limit <= 0:
        return {"reassigned": 0, "checked": 0}
    reassigned = 0
    checked = 0
    policies = RoutingPolicy.objects.filter(
        is_active=True,
        unavailable_strategy=RoutingPolicy.UnavailableStrategies.MEMBER_FALLBACK,
        team__isnull=True,
    ).select_related("business")
    now = timezone.now()
    for policy in policies:
        config = RESOURCE_CONFIG[policy.resource]
        assignee_field = config["assignee_field"]
        items = config["model"].objects.filter(
            config["active_filter"],
            business=policy.business,
            **{f"{assignee_field}__isnull": False},
        ).select_related(assignee_field)[: max(0, limit - checked)]
        members = {
            member.user_id: member
            for member in policy.business.members.filter(
                user_id__in=[getattr(item, f"{assignee_field}_id") for item in items],
            ).select_related("fallback_member", "fallback_member__user")
        }
        for item in items:
            checked += 1
            member = members.get(getattr(item, f"{assignee_field}_id"))
            fallback = member.fallback_member if member and not member_is_available(member, now=now) else None
            if fallback and _fallback_is_eligible(fallback, policy=policy, now=now):
                if _reassign_to_fallback(item, policy=policy, member=fallback, config=config):
                    reassigned += 1
            if checked >= limit:
                return {"reassigned": reassigned, "checked": checked}
    return {"reassigned": reassigned, "checked": checked}


def _fallback_is_eligible(member, *, policy, now):
    roles = set(policy.eligible_roles or DEFAULT_ROUTING_ROLES[policy.resource])
    roles &= ELIGIBLE_ROLES[policy.resource]
    if member.business_id != policy.business_id or member.role not in roles:
        return False
    if not member_is_available(member, now=now) or not member.user.is_active:
        return False
    if policy.team_id and not member.team_memberships.filter(team=policy.team, team__is_active=True).exists():
        return False
    return True


def _reassign_to_fallback(item, *, policy, member, config):
    assignee_field = config["assignee_field"]
    with transaction.atomic():
        locked = config["model"].objects.select_for_update().select_related("business").get(
            id=item.id,
            business=policy.business,
        )
        previous_user = getattr(locked, assignee_field)
        if previous_user is None or previous_user.id == member.user_id:
            return False
        setattr(locked, assignee_field, member.user)
        locked.save(update_fields=[assignee_field, "updated_at"])
        _record_automatic_assignment(
            item=locked,
            resource=policy.resource,
            previous_user=previous_user,
            member=member,
            policy=policy,
            source="fallback_runtime",
            reassigned=True,
        )
        return True


def _record_automatic_assignment(*, item, resource, previous_user, member, policy, source, reassigned):
    config = RESOURCE_CONFIG[resource]
    event_type = ActivityEvents.WORK_AUTO_REASSIGNED if reassigned else config["event_type"]
    metadata = {
        "kind": "automatic_reassignment" if reassigned else "automatic_assignment",
        "resource": resource,
        "policy_id": policy.id,
        "routing_mode": policy.mode,
        "team_id": policy.team_id,
        "from_user_id": previous_user.id if previous_user else None,
        "to_user_id": member.user_id,
    }
    create_activity_event(
        business=item.business,
        actor=None,
        event_type=event_type,
        instance=item,
        source=source,
        metadata=metadata,
    )
    AuditLog.objects.create(
        business=item.business,
        actor=None,
        action=AuditLog.Actions.UPDATE,
        category=AuditLog.Categories.SYSTEM,
        risk_level=AuditLog.RiskLevels.LOW,
        entity_type=item.__class__.__name__,
        entity_id=str(item.id),
        metadata=metadata,
    )
    create_assignment_notifications(
        business=item.business,
        previous_user=previous_user,
        new_user=member.user,
        text=f"{resource[:-1].capitalize()} #{item.id} assigned automatically.",
        action_url=config["action_url"](item),
    )


def scan_sla_attention(*, limit=200, now=None):
    if limit <= 0:
        return {"detected": 0, "notified": 0, "resolved": 0}
    now = now or timezone.now()
    detected_keys = set()
    notified = 0
    detected = 0
    policies = RoutingPolicy.objects.filter(is_active=True, team__isnull=True).select_related("business")
    for policy in policies:
        for item, reason in _sla_candidates(policy, now=now, limit=max(0, limit - detected)):
            key = (policy.business_id, policy.resource, str(item.id), reason)
            detected_keys.add(key)
            with transaction.atomic():
                attention, created = SLAAttention.objects.get_or_create(
                    business=policy.business,
                    resource=policy.resource,
                    entity_id=str(item.id),
                    reason=reason,
                    defaults={
                        "policy": policy,
                        "first_detected_at": now,
                        "last_detected_at": now,
                        "is_active": True,
                    },
                )
                if not created:
                    attention = SLAAttention.objects.select_for_update().get(id=attention.id)
                should_notify = created or not attention.is_active
                attention.policy = policy
                attention.is_active = True
                attention.last_detected_at = now
                attention.resolved_at = None
                if should_notify:
                    attention.notified_at = now
                attention.save(
                    update_fields=[
                        "policy",
                        "is_active",
                        "last_detected_at",
                        "resolved_at",
                        "notified_at",
                        "updated_at",
                    ]
                )
                if should_notify:
                    notified += _notify_sla_attention(attention, item=item, policy=policy, now=now)
            detected += 1
            if detected >= limit:
                break
        if detected >= limit:
            break

    resolved = 0
    if detected < limit:
        for attention in SLAAttention.objects.filter(is_active=True).select_related("business"):
            key = (attention.business_id, attention.resource, attention.entity_id, attention.reason)
            if key not in detected_keys and RoutingPolicy.objects.filter(
                business_id=attention.business_id,
                resource=attention.resource,
                is_active=True,
                team__isnull=True,
            ).exists():
                attention.is_active = False
                attention.resolved_at = now
                attention.save(update_fields=["is_active", "resolved_at", "updated_at"])
                resolved += 1
    return {"detected": detected, "notified": notified, "resolved": resolved}


def _sla_candidates(policy, *, now, limit):
    if limit <= 0:
        return []
    config = RESOURCE_CONFIG[policy.resource]
    assignee_field = config["assignee_field"]
    cutoff = now - timezone.timedelta(minutes=max(1, policy.sla_minutes))
    queryset = config["model"].objects.filter(
        config["active_filter"],
        business=policy.business,
    ).order_by("created_at", "id")[: min(limit * 3, 600)]
    rows = []
    for item in queryset:
        if getattr(item, f"{assignee_field}_id") is None and item.created_at <= cutoff:
            rows.append((item, SLAAttention.Reasons.UNASSIGNED))
        elif _is_stale(item, resource=policy.resource, cutoff=cutoff, now=now):
            rows.append((item, SLAAttention.Reasons.STALE))
        if len(rows) >= limit:
            break
    return rows


def _is_stale(item, *, resource, cutoff, now):
    if resource == RoutingPolicy.Resources.CONVERSATIONS:
        return bool(
            item.last_inbound_at
            and item.last_inbound_at <= cutoff
            and (item.last_outbound_at is None or item.last_outbound_at < item.last_inbound_at)
        )
    if resource == RoutingPolicy.Resources.TASKS and item.due_at is not None:
        return item.due_at <= now
    return item.updated_at <= cutoff


def _notify_sla_attention(attention, *, item, policy, now):
    recipients = _manager_recipients(policy)
    config = RESOURCE_CONFIG[policy.resource]
    notifications = Notification.objects.bulk_create(
        [
            Notification(
                business=policy.business,
                recipient=member.user,
                channel=Notification.Channels.SYSTEM,
                category=Notification.Categories.TASKS,
                priority=Notification.Priorities.HIGH,
                text=f"{policy.resource[:-1].capitalize()} #{item.id} requires SLA attention.",
                send_at=now,
                action_url=config["action_url"](item),
                action_label="Open",
            )
            for member in recipients
        ]
    )
    return len(notifications)


def _manager_recipients(policy):
    roles = {
        BusinessMember.Roles.OWNER,
        BusinessMember.Roles.ADMIN,
        BusinessMember.Roles.MANAGER,
    }
    queryset = BusinessMember.objects.filter(
        business=policy.business,
        role__in=roles,
        is_active=True,
        user__is_active=True,
    )
    if policy.team_id:
        queryset = queryset.filter(
            Q(team_memberships__team=policy.team, team_memberships__is_lead=True)
            | Q(role__in=[BusinessMember.Roles.OWNER, BusinessMember.Roles.ADMIN])
        )
    return queryset.select_related("user").distinct()


def routing_health():
    active_policies = RoutingPolicy.objects.filter(is_active=True)
    unassigned = {}
    for resource, config in RESOURCE_CONFIG.items():
        assignee_field = config["assignee_field"]
        unassigned[resource] = config["model"].objects.filter(
            config["active_filter"],
            **{f"{assignee_field}__isnull": True},
        ).count()
    return {
        "active_policies": active_policies.count(),
        "automatic_policies": active_policies.exclude(mode=RoutingPolicy.Modes.MANUAL).count(),
        "unassigned": unassigned,
        "active_sla_attention": SLAAttention.objects.filter(is_active=True).count(),
    }


def run_routing_cycle(*, routing_limit=100, sla_limit=200):
    return {
        "routing": route_unassigned_work(limit=routing_limit),
        "fallback": apply_fallback_reassignments(limit=routing_limit),
        "sla": scan_sla_attention(limit=sla_limit),
    }
