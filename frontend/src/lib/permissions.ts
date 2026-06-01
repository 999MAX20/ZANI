import type { CurrentUser, Id } from "../types";

const platformRoles = new Set(["platform_admin", "platform_manager"]);

const managerRoles = new Set(["business_manager", "manager", "marketer", "accountant", "support"]);

const operatorRoles = new Set(["business_operator", "operator", "staff"]);

export const resourceLabels: Record<string, string> = {
  clients: "Clients",
  leads: "Leads",
  deals: "Deals",
  appointments: "Calendar and bookings",
  conversations: "Chats",
  tasks: "Tasks",
  analytics: "Analytics",
  settings: "Settings",
  team: "Team and roles",
  billing: "Billing",
  integrations: "Integrations",
  automations: "Automations",
  notifications: "Notifications and outreach",
  ai_assistant: "AI assistant",
  ai_analyst: "AI analyst",
  ai_pipeline: "AI pipeline",
  ai_outreach: "AI outreach",
  ai_automation: "AI automation",
};

export const scopeLabels: Record<string, string> = {
  none: "No access",
  own: "Own items only",
  team: "Own team",
  business: "Whole business",
};

export function hasPermission(
  user: CurrentUser | null,
  businessId: Id | undefined,
  resource: string,
  action = "view",
) {
  if (!user || !businessId) return false;
  if (platformRoles.has(user.role || "")) return true;
  const membership = getActiveMembership(user, businessId);
  if (!membership) return false;
  if (membership.role === "owner") return true;
  const permissions = user.effective_permissions?.[String(businessId)] || [];
  return permissions.some((permission) => permission.resource === resource && permission.action === action);
}

export function getPermissionScope(
  user: CurrentUser | null,
  businessId: Id | undefined,
  resource: string,
  action = "view",
) {
  if (!user || !businessId) return "none";
  const membership = getActiveMembership(user, businessId);
  if (!membership) return "none";
  if (membership.role === "owner") return "business";
  const permissions = user.effective_permissions?.[String(businessId)] || [];
  return permissions.find((permission) => permission.resource === resource && permission.action === action)?.scope || "none";
}

export function getActiveMembership(user: CurrentUser | null, businessId: Id | undefined) {
  if (!user || !businessId) return null;
  return user.memberships?.find((membership) => String(membership.business) === String(businessId) && membership.is_active) || null;
}

export function getBusinessRole(user: CurrentUser | null, businessId: Id | undefined) {
  return getActiveMembership(user, businessId)?.role || null;
}

export function getRoleSurface(user: CurrentUser | null, businessId?: Id) {
  const membershipRole = getBusinessRole(user, businessId);
  const role = membershipRole || user?.role || "";
  if (role === "owner" || role === "admin" || role === "business_owner") return "owner";
  if (operatorRoles.has(role)) return "operator";
  if (managerRoles.has(role)) return "manager";
  return "staff";
}

export const businessRoleLabelKeys: Record<string, string> = {
  owner: "settings.role.owner",
  admin: "settings.role.admin",
  manager: "settings.role.manager",
  operator: "settings.role.operator",
  marketer: "settings.role.marketer",
  accountant: "settings.role.accountant",
  support: "settings.role.support",
  staff: "settings.role.staff",
};

export function businessRoleLabel(role: string | null | undefined, t: Translate) {
  if (!role) return t("settings.role.staff");
  return t(businessRoleLabelKeys[role] || "settings.role.staff");
}

export function forbiddenMessage(resource: string, action = "view") {
  const label = resourceLabels[resource] || resource;
  const actionLabel = action === "view" ? "view" : "perform this action in";
  return `Your role does not have access to ${actionLabel} "${label}". If you need it for work, ask the business owner to change your role or visibility scope in team settings.`;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function permissionResourceLabel(resource: string, t: Translate) {
  return t(`permissions.resource.${resource}`);
}

export function permissionForbiddenMessage(resource: string, action: string, t: Translate) {
  return t("permissions.forbidden", {
    action: action === "view" ? t("permissions.action.view") : t("permissions.action.manage"),
    resource: permissionResourceLabel(resource, t),
  });
}
