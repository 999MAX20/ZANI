from dataclasses import dataclass

from rest_framework.exceptions import PermissionDenied

from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission
from apps.core.permissions import is_platform_admin, user_can_access_business


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


class Actions:
    VIEW = "view"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    MANAGE = "manage"


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
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.DEALS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.APPOINTMENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.BUSINESS},
        Resources.CONVERSATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.BUSINESS, Actions.MANAGE: RolePermission.Scopes.BUSINESS},
        Resources.TASKS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.ANALYTICS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.BUSINESS},
        Resources.SETTINGS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
    },
    BusinessMember.Roles.OPERATOR: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.CONVERSATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.TASKS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
    },
    BusinessMember.Roles.MARKETER: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS},
        Resources.ANALYTICS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.AUTOMATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.CREATE: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.BUSINESS},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
    },
    BusinessMember.Roles.ACCOUNTANT: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.ANALYTICS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.BILLING: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
    },
    BusinessMember.Roles.SUPPORT: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.DEALS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.APPOINTMENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.CONVERSATIONS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
    },
    BusinessMember.Roles.STAFF: {
        Resources.CLIENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS},
        Resources.LEADS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.APPOINTMENTS: {Actions.VIEW: RolePermission.Scopes.BUSINESS, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.TASKS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
        Resources.NOTIFICATIONS: {Actions.VIEW: RolePermission.Scopes.OWN, Actions.UPDATE: RolePermission.Scopes.OWN},
    },
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
    if is_platform_admin(user):
        return PermissionResult(True, RolePermission.Scopes.BUSINESS)
    if not user_can_access_business(user, business):
        return PermissionResult(False, reason="No access to this business.")

    membership = get_membership(user, business)
    if membership is None:
        return PermissionResult(False, reason="No active membership.")

    explicit_scope = role_permission_allows(membership.business_role, resource, action)
    scope = explicit_scope if explicit_scope is not None else role_allows(membership.role, resource, action)
    if not scope or scope == RolePermission.Scopes.NONE:
        return PermissionResult(False, reason="Permission denied.")

    return PermissionResult(True, scope)


def assert_can(user, business: Business | None, resource: str, action: str, obj=None):
    result = can(user, business, resource, action, obj=obj)
    if not result.allowed:
        raise PermissionDenied(result.reason or "Permission denied.")
    return result


def user_scope_for(user, business: Business | None, resource: str, action: str):
    return can(user, business, resource, action).scope


def scope_queryset(queryset, user, business: Business | None, resource: str, action: str = Actions.VIEW):
    result = can(user, business, resource, action)
    if not result.allowed:
        return queryset.none()
    if result.scope in {RolePermission.Scopes.BUSINESS, RolePermission.Scopes.TEAM}:
        return queryset
    if result.scope == RolePermission.Scopes.OWN:
        model_fields = {field.name for field in queryset.model._meta.get_fields()}
        if "responsible_user" in model_fields:
            return queryset.filter(responsible_user=user)
        if "assigned_to" in model_fields:
            return queryset.filter(assigned_to=user)
        if "owner" in model_fields:
            return queryset.filter(owner=user)
        if "assignee" in model_fields:
            return queryset.filter(assignee=user)
        if "created_by" in model_fields:
            return queryset.filter(created_by=user)
        if "recipient" in model_fields:
            return queryset.filter(recipient=user) | queryset.filter(recipient__isnull=True)
        if "user" in model_fields:
            return queryset.filter(user=user)
    return queryset


def effective_permissions_for(user, business: Business | None):
    if business is None:
        return []
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
                "name": role.replace("_", " ").title(),
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
