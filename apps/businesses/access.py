from dataclasses import dataclass

from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.core.permissions import platform_admin_has_global_access, is_platform_admin, user_can_access_business


class Resources:
    CLIENTS = "clients"
    LEADS = "leads"
    DEALS = "deals"
    APPOINTMENTS = "appointments"
    CONVERSATIONS = "conversations"
    TASKS = "tasks"
    ANALYTICS = "analytics"
    SETTINGS = "settings"
    TEAM = "team"
    BILLING = "billing"
    INTEGRATIONS = "integrations"
    AUTOMATIONS = "automations"
    AUDIT_LOGS = "audit_logs"
    NOTIFICATIONS = "notifications"
    AI_ASSISTANT = "ai_assistant"
    AI_ANALYST = "ai_analyst"
    AI_PIPELINE = "ai_pipeline"
    AI_OUTREACH = "ai_outreach"
    AI_AUTOMATION = "ai_automation"


class Actions:
    VIEW = "view"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    MANAGE = "manage"
    SUGGEST = "suggest"
    EXECUTE = "execute"
    APPROVE = "approve"


OWNERSHIP_FIELDS = (
    "responsible_user",
    "assigned_to",
    "owner",
    "assignee",
    "created_by",
    "requested_by",
    "manager",
    "operator",
    "user",
    "recipient",
)


PERMISSION_CATALOG = {
    Resources.CLIENTS: [Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE],
    Resources.LEADS: [Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE],
    Resources.DEALS: [Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE],
    Resources.APPOINTMENTS: [Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE],
    Resources.CONVERSATIONS: [Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.MANAGE],
    Resources.TASKS: [Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE],
    Resources.ANALYTICS: [Actions.VIEW],
    Resources.SETTINGS: [Actions.VIEW, Actions.UPDATE],
    Resources.TEAM: [Actions.VIEW, Actions.MANAGE],
    Resources.BILLING: [Actions.VIEW, Actions.MANAGE],
    Resources.INTEGRATIONS: [Actions.VIEW, Actions.MANAGE],
    Resources.AUTOMATIONS: [Actions.VIEW, Actions.CREATE, Actions.UPDATE, Actions.DELETE, Actions.MANAGE],
    Resources.AUDIT_LOGS: [Actions.VIEW, Actions.MANAGE],
    Resources.NOTIFICATIONS: [Actions.VIEW, Actions.UPDATE, Actions.MANAGE],
    Resources.AI_ASSISTANT: [Actions.VIEW, Actions.SUGGEST, Actions.EXECUTE, Actions.MANAGE],
    Resources.AI_ANALYST: [Actions.VIEW, Actions.SUGGEST, Actions.MANAGE],
    Resources.AI_PIPELINE: [Actions.VIEW, Actions.SUGGEST, Actions.EXECUTE, Actions.APPROVE, Actions.MANAGE],
    Resources.AI_OUTREACH: [Actions.VIEW, Actions.SUGGEST, Actions.EXECUTE, Actions.APPROVE, Actions.MANAGE],
    Resources.AI_AUTOMATION: [Actions.VIEW, Actions.SUGGEST, Actions.EXECUTE, Actions.APPROVE, Actions.MANAGE],
}

ROLE_PRESETS = {
    BusinessMember.Roles.OWNER: {
        "*": {Actions.MANAGE: RolePermission.Scopes.BUSINESS},
    },
    BusinessMember.Roles.ADMIN: {
        "*": {Actions.MANAGE: RolePermission.Scopes.BUSINESS},
    },
    BusinessMember.Roles.MANAGER: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.BUSINESS},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.TEAM, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.TEAM},
        Resources.DEALS: {Actions.VIEW: RolePermission.Scopes.TEAM, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.TEAM},
        Resources.APPOINTMENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.BUSINESS},
        Resources.CONVERSATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.BUSINESS, Actions.MANAGE: RolePermission.Scopes.BUSINESS},
        Resources.TASKS: {Actions.VIEW: RolePermission.Scopes.TEAM, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.TEAM},
        Resources.ANALYTICS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.BUSINESS},
        Resources.SETTINGS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.AI_ASSISTANT: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.SUGGEST: RolePermission.Scopes.BUSINESS, Actions.EXECUTE: RolePermission.Scopes.BUSINESS},
        Resources.AI_ANALYST: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.SUGGEST: RolePermission.Scopes.BUSINESS},
        Resources.AI_PIPELINE: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.SUGGEST: RolePermission.Scopes.BUSINESS, Actions.EXECUTE: RolePermission.Scopes.OWN},
    },
    BusinessMember.Roles.OPERATOR: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.CONVERSATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.TASKS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.AI_ASSISTANT: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.SUGGEST: RolePermission.Scopes.OWN},
        Resources.AI_PIPELINE: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.SUGGEST: RolePermission.Scopes.OWN},
    },
    BusinessMember.Roles.MARKETER: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS},
        Resources.ANALYTICS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.AUTOMATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.BUSINESS},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN, Actions.MANAGE: RolePermission.Scopes.BUSINESS},
        Resources.AI_ASSISTANT: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.SUGGEST: RolePermission.Scopes.BUSINESS},
        Resources.AI_ANALYST: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.SUGGEST: RolePermission.Scopes.BUSINESS},
        Resources.AI_OUTREACH: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.SUGGEST: RolePermission.Scopes.BUSINESS, Actions.EXECUTE: RolePermission.Scopes.BUSINESS},
    },
    BusinessMember.Roles.ACCOUNTANT: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.ANALYTICS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.BILLING: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.AI_ANALYST: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
    },
    BusinessMember.Roles.SUPPORT: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.DEALS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.APPOINTMENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.CONVERSATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.AI_ASSISTANT: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.SUGGEST: RolePermission.Scopes.OWN},
    },
    BusinessMember.Roles.STAFF: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.APPOINTMENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.TASKS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.AI_ASSISTANT: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.SUGGEST: RolePermission.Scopes.OWN},
    },
    BusinessMember.Roles.DOCTOR: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.APPOINTMENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.TASKS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.AI_ASSISTANT: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.SUGGEST: RolePermission.Scopes.OWN},
    },
}


ROLE_DISPLAY_NAMES = {
    BusinessMember.Roles.OWNER: "Владелец",
    BusinessMember.Roles.ADMIN: "Директор",
    BusinessMember.Roles.MANAGER: "Менеджер",
    BusinessMember.Roles.OPERATOR: "Оператор чатов",
    BusinessMember.Roles.MARKETER: "Маркетолог",
    BusinessMember.Roles.ACCOUNTANT: "Бухгалтер",
    BusinessMember.Roles.SUPPORT: "Поддержка",
    BusinessMember.Roles.STAFF: "Сотрудник",
    BusinessMember.Roles.DOCTOR: "Doctor",
}


@dataclass(frozen=True)
class PermissionResult:
    allowed: bool
    scope: str = RolePermission.Scopes.NONE
    reason: str = ""


def normalize_role(role):
    if role == "business_manager":
        return BusinessMember.Roles.MANAGER
    if role == "business_operator":
        return BusinessMember.Roles.OPERATOR
    return role


def get_membership(user, business):
    if not user or not user.is_authenticated or business is None:
        return None
    return (
        BusinessMember.objects.select_related("business_role", "business", "user")
        .filter(user=user, business=business, is_active=True)
        .first()
    )


def user_is_business_owner(user, business: Business | None) -> bool:
    return bool(user and user.is_authenticated and business is not None and business.owner_id == user.id)


def owner_business_role(business: Business | None):
    if business is None:
        return None
    return BusinessRole.objects.filter(
        business=business,
        preset_key=BusinessMember.Roles.OWNER,
        is_active=True,
    ).first()


def ensure_owner_memberships_for_user(user):
    if not user or not user.is_authenticated:
        return
    owned_businesses = Business.objects.filter(owner=user).only("id")
    for business in owned_businesses:
        membership = (
            BusinessMember.objects.select_related("business_role")
            .filter(business=business, user=user)
            .first()
        )
        expected_role = owner_business_role(business)
        if membership is None:
            BusinessMember.objects.create(
                business=business,
                user=user,
                role=BusinessMember.Roles.OWNER,
                business_role=expected_role,
                is_active=True,
            )
            continue

        update_fields = []
        if membership.role != BusinessMember.Roles.OWNER:
            membership.role = BusinessMember.Roles.OWNER
            update_fields.append("role")
        if membership.business_role_id != getattr(expected_role, "id", None):
            membership.business_role = expected_role
            update_fields.append("business_role")
        if not membership.is_active:
            membership.is_active = True
            update_fields.append("is_active")
        if update_fields:
            update_fields.append("updated_at")
            membership.save(update_fields=update_fields)


def role_allows(role, resource, action):
    role = normalize_role(role)
    permissions = ROLE_PRESETS.get(role, {})
    if "*" in permissions:
        return permissions["*"].get(action) or permissions["*"].get(Actions.MANAGE)
    resource_permissions = permissions.get(resource, {})
    return resource_permissions.get(action) or resource_permissions.get(Actions.MANAGE)


def role_permission_allows(business_role: BusinessRole | None, resource, action):
    if not business_role or not business_role.is_active:
        return None
    permission = (
        business_role.permissions.filter(resource=resource, action=action)
        .only("is_allowed", "scope")
        .first()
    )
    if not permission and action != Actions.MANAGE:
        permission = (
            business_role.permissions.filter(resource=resource, action=Actions.MANAGE)
            .only("is_allowed", "scope")
            .first()
        )
    if permission is None:
        return None
    if not permission.is_allowed:
        return RolePermission.Scopes.NONE
    return permission.scope


def can(user, business: Business | None, resource: str, action: str, obj=None) -> PermissionResult:
    if platform_admin_has_global_access(user):
        return PermissionResult(True, RolePermission.Scopes.BUSINESS)
    if not user_can_access_business(user, business):
        return PermissionResult(False, reason="No access to this business.")

    if is_platform_admin(user):
        return PermissionResult(True, RolePermission.Scopes.BUSINESS)

    if user_is_business_owner(user, business):
        scope = role_allows(BusinessMember.Roles.OWNER, resource, action)
        if not scope or scope == RolePermission.Scopes.NONE:
            return PermissionResult(False, reason="Permission denied.")
        return PermissionResult(True, scope)

    membership = get_membership(user, business)
    if membership is None:
        return PermissionResult(False, reason="No active membership.")

    explicit_scope = role_permission_allows(membership.business_role, resource, action)
    scope = explicit_scope if explicit_scope is not None else role_allows(membership.role, resource, action)
    if not scope or scope == RolePermission.Scopes.NONE:
        return PermissionResult(False, reason="Permission denied.")

    result = PermissionResult(True, scope)
    if obj is not None and scope in {RolePermission.Scopes.OWN, RolePermission.Scopes.TEAM}:
        if not _object_matches_scope(obj, user, business, scope, action):
            return PermissionResult(False, scope=scope, reason="Object is outside your permitted scope.")
    return result


def assert_can(user, business: Business | None, resource: str, action: str, obj=None):
    result = can(user, business, resource, action, obj=obj)
    if not result.allowed:
        raise PermissionDenied(result.reason or "Permission denied.")
    return result


def user_scope_for(user, business: Business | None, resource: str, action: str):
    return can(user, business, resource, action).scope


def can_view_sensitive_field(user, business: Business | None, resource: str, field: str) -> bool:
    if platform_admin_has_global_access(user) or is_platform_admin(user):
        return True
    if user_is_business_owner(user, business):
        return True
    membership = get_membership(user, business)
    if membership is None:
        return False
    if membership.role in {BusinessMember.Roles.ADMIN, BusinessMember.Roles.MANAGER, BusinessMember.Roles.ACCOUNTANT}:
        return True
    if field in {"amount", "revenue", "margin", "payment_status", "discount"}:
        return can(user, business, Resources.BILLING, Actions.VIEW).allowed
    if field in {"internal_notes", "notes", "lost_reason"}:
        return membership.role not in {BusinessMember.Roles.OPERATOR, BusinessMember.Roles.SUPPORT, BusinessMember.Roles.STAFF}
    return False


def scope_queryset(queryset, user, business: Business | None, resource: str, action: str = Actions.VIEW):
    result = can(user, business, resource, action)
    if not result.allowed:
        return queryset.none()
    if _is_business_shared_configuration_queryset(queryset):
        return queryset
    if result.scope == RolePermission.Scopes.BUSINESS:
        return queryset
    if result.scope == RolePermission.Scopes.TEAM:
        team_user_ids = _team_user_ids_for(user, business)
        if not team_user_ids:
            team_user_ids = [user.id]
        return _filter_queryset_by_users(
            queryset,
            team_user_ids,
            business=business,
            include_business_wide_notifications=False,
        )
    if result.scope == RolePermission.Scopes.OWN:
        return _filter_queryset_by_users(
            queryset,
            [user.id],
            business=business,
            include_business_wide_notifications=True,
        )
    return queryset


def _is_business_shared_configuration_queryset(queryset):
    return queryset.model.__name__ in {"Pipeline", "PipelineStage", "StageTransition"}


def _object_matches_scope(obj, user, business: Business | None, scope: str, action: str) -> bool:
    if obj.__class__.__name__ in {"Pipeline", "PipelineStage", "StageTransition"}:
        return True

    object_business_id = _object_business_id(obj)
    if object_business_id is not None and business is not None and object_business_id != business.id:
        return False

    model_fields = {field.name for field in obj._meta.get_fields()}
    object_user_ids = {
        getattr(obj, f"{field}_id", None)
        for field in OWNERSHIP_FIELDS
        if field in model_fields
    }
    appointment_linked_user_id = _appointment_linked_user_id(obj, business)
    if appointment_linked_user_id is not None:
        object_user_ids.add(appointment_linked_user_id)
    object_user_ids.discard(None)

    if (
        obj.__class__.__name__ == "Appointment"
        and scope in {RolePermission.Scopes.OWN, RolePermission.Scopes.TEAM}
        and not object_user_ids
    ):
        return False
    if not object_user_ids and action == Actions.UPDATE:
        return True

    if scope == RolePermission.Scopes.OWN:
        if action == Actions.VIEW and "recipient" in model_fields and getattr(obj, "recipient_id", None) is None:
            return True
        return user.id in object_user_ids
    if scope == RolePermission.Scopes.TEAM:
        return bool(object_user_ids.intersection(_team_user_ids_for(user, business)))
    return False


def _object_business_id(obj):
    if hasattr(obj, "business_id"):
        return obj.business_id
    for relation_name in ("conversation", "bot", "rule"):
        related = getattr(obj, relation_name, None)
        if related is not None and hasattr(related, "business_id"):
            return related.business_id
    return None


def _appointment_linked_user_id(obj, business: Business | None):
    if obj.__class__.__name__ != "Appointment" or business is None:
        return None
    resource = getattr(obj, "resource", None)
    if (
        resource is None
        or resource.business_id != business.id
        or resource.linked_user_id is None
    ):
        return None
    if resource.linked_user_id == business.owner_id:
        return resource.linked_user_id
    if business.members.filter(user_id=resource.linked_user_id, is_active=True).exists():
        return resource.linked_user_id
    return None


def _team_user_ids_for(user, business: Business | None):
    if not user or not user.is_authenticated or business is None:
        return []
    membership = get_membership(user, business)
    if membership is None:
        return [user.id]
    team_ids = list(membership.team_memberships.filter(team__is_active=True).values_list("team_id", flat=True))
    if not team_ids:
        return [user.id]
    return list(
        BusinessMember.objects.filter(
            business=business,
            is_active=True,
            team_memberships__team_id__in=team_ids,
        )
        .values_list("user_id", flat=True)
        .distinct()
    )


def team_user_ids_for(user, business: Business | None):
    return _team_user_ids_for(user, business)


def _filter_queryset_by_users(
    queryset,
    user_ids,
    *,
    business: Business | None,
    include_business_wide_notifications: bool,
):
    model_fields = {field.name for field in queryset.model._meta.get_fields()}
    query = Q()
    for field in OWNERSHIP_FIELDS:
        if field in model_fields:
            query |= Q(**{f"{field}_id__in": user_ids})
    if queryset.model.__name__ == "Appointment" and business is not None:
        active_link = Q(
            resource__linked_user__business_memberships__business=business,
            resource__linked_user__business_memberships__is_active=True,
        )
        owner_link = Q(resource__linked_user_id=business.owner_id)
        query |= (
            Q(
                resource__business=business,
                resource__linked_user_id__in=user_ids,
            )
            & (active_link | owner_link)
        )
    if "recipient" in model_fields:
        query |= Q(recipient_id__in=user_ids)
        if include_business_wide_notifications:
            query |= Q(recipient__isnull=True)
    if not query:
        return queryset.none()
    return queryset.filter(query).distinct()


def effective_permissions_for(user, business: Business | None):
    if business is None:
        return []
    if user_is_business_owner(user, business):
        return [
            {"resource": resource, "action": action, "scope": RolePermission.Scopes.BUSINESS}
            for resource, actions in PERMISSION_CATALOG.items()
            for action in actions
        ]
    permissions = []
    for resource, actions in PERMISSION_CATALOG.items():
        for action in actions:
            result = can(user, business, resource, action)
            if result.allowed:
                permissions.append({"resource": resource, "action": action, "scope": result.scope})
    return permissions


def ensure_default_roles(business: Business):
    for role, permissions in ROLE_PRESETS.items():
        business_role, _ = BusinessRole.objects.get_or_create(
            business=business,
            preset_key=role,
            defaults={
                "name": ROLE_DISPLAY_NAMES.get(role, role.replace("_", " ").title()),
                "description": "Default access preset.",
                "permissions_json": permissions,
                "is_system": True,
                "is_active": True,
            },
        )
        business_role.permissions_json = permissions
        business_role.is_system = True
        business_role.is_active = True
        business_role.save(update_fields=["permissions_json", "is_system", "is_active", "updated_at"])
        for resource, actions in permissions.items():
            if resource == "*":
                for catalog_resource in PERMISSION_CATALOG:
                    for action in PERMISSION_CATALOG[catalog_resource]:
                        RolePermission.objects.update_or_create(
                            business_role=business_role,
                            resource=catalog_resource,
                            action=action,
                            defaults={"scope": RolePermission.Scopes.BUSINESS, "is_allowed": True},
                        )
                continue
            for action, scope in actions.items():
                RolePermission.objects.update_or_create(
                    business_role=business_role,
                    resource=resource,
                    action=action,
                    defaults={"scope": scope, "is_allowed": True},
                )
