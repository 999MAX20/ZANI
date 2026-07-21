from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.businesses.access import Actions, Resources, can, team_user_ids_for, user_is_business_owner
from apps.businesses.models import BusinessMember, RolePermission


ELIGIBLE_ROLES = {
    Resources.LEADS: {
        BusinessMember.Roles.OWNER,
        BusinessMember.Roles.ADMIN,
        BusinessMember.Roles.MANAGER,
        BusinessMember.Roles.OPERATOR,
        BusinessMember.Roles.STAFF,
        BusinessMember.Roles.DOCTOR,
    },
    Resources.DEALS: {
        BusinessMember.Roles.OWNER,
        BusinessMember.Roles.ADMIN,
        BusinessMember.Roles.MANAGER,
    },
    Resources.CONVERSATIONS: {
        BusinessMember.Roles.OWNER,
        BusinessMember.Roles.ADMIN,
        BusinessMember.Roles.MANAGER,
        BusinessMember.Roles.OPERATOR,
        BusinessMember.Roles.SUPPORT,
        BusinessMember.Roles.STAFF,
    },
}


def member_is_available(member, *, now=None):
    now = now or timezone.now()
    if not member.is_active:
        return False
    if member.availability_status == BusinessMember.AvailabilityStatuses.AVAILABLE:
        return True
    return bool(member.unavailable_until and member.unavailable_until <= now)


def resolve_assignment_member(*, business, user, resource):
    if business.owner_id == user.id:
        member = business.members.filter(user=user, is_active=True).first()
        if member is None:
            return None
    else:
        member = business.members.filter(user=user, is_active=True).first()
        if member is None:
            raise ValidationError({"user_id": "Assignee must be an active member of this business."})
    eligible_roles = ELIGIBLE_ROLES.get(resource)
    if member is not None and eligible_roles and member.role not in eligible_roles:
        raise ValidationError({"user_id": "This member role is not eligible for the selected work item."})
    if member is not None and not member_is_available(member):
        raise ValidationError({"user_id": "This member is currently unavailable. Select an available fallback."})
    return member


def assert_assignment_allowed(*, actor, business, target_user, resource):
    target_member = resolve_assignment_member(business=business, user=target_user, resource=resource)
    if user_is_business_owner(actor, business):
        return target_member
    result = can(actor, business, resource, Actions.UPDATE)
    if not result.allowed:
        raise PermissionDenied(result.reason or "Assignment is not allowed.")
    if result.scope == RolePermission.Scopes.BUSINESS:
        return target_member
    if result.scope == RolePermission.Scopes.OWN and target_user.id != actor.id:
        raise PermissionDenied("You can assign this work item only to yourself.")
    if result.scope == RolePermission.Scopes.TEAM and target_user.id not in team_user_ids_for(actor, business):
        raise PermissionDenied("Target assignee must belong to your active team.")
    return target_member


def available_fallback_user(member):
    if member is None or member_is_available(member):
        return member.user if member else None
    fallback = member.fallback_member
    if fallback and fallback.business_id == member.business_id and member_is_available(fallback):
        return fallback.user
    return None
