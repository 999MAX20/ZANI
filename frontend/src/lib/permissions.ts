import type { CurrentUser, Id } from "../types";

const ownerRoles = new Set(["business_owner", "owner", "admin"]);

const managerRoles = new Set(["business_manager", "manager", "marketer", "accountant", "support"]);

const operatorRoles = new Set(["business_operator", "operator", "staff"]);

export const resourceLabels: Record<string, string> = {
  clients: "Клиенты",
  leads: "Заявки",
  deals: "Сделки",
  appointments: "Календарь и записи",
  conversations: "Чаты",
  tasks: "Задачи",
  analytics: "Аналитика",
  settings: "Настройки",
  team: "Команда и роли",
  billing: "Оплата",
  integrations: "Интеграции",
  automations: "Автоматизации",
};

export const scopeLabels: Record<string, string> = {
  none: "Нет доступа",
  own: "Только своё",
  team: "Своя команда",
  business: "Весь бизнес",
};

export function hasPermission(
  user: CurrentUser | null,
  businessId: Id | undefined,
  resource: string,
  action = "view",
) {
  if (!user || !businessId) return false;
  if (ownerRoles.has(user.role || "")) return true;
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
  const permissions = user.effective_permissions?.[String(businessId)] || [];
  return permissions.find((permission) => permission.resource === resource && permission.action === action)?.scope || "none";
}

export function getRoleSurface(user: CurrentUser | null) {
  const role = user?.role || "";
  if (ownerRoles.has(role)) return "owner";
  if (operatorRoles.has(role)) return "operator";
  if (managerRoles.has(role)) return "manager";
  return "staff";
}

export function forbiddenMessage(resource: string, action = "view") {
  const label = resourceLabels[resource] || resource;
  const actionLabel = action === "view" ? "просмотр" : "это действие";
  return `У вашей роли нет доступа на ${actionLabel} раздела "${label}". Если это нужно для работы, попросите владельца бизнеса изменить роль или область видимости в настройках команды.`;
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
