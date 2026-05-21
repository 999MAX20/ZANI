import type { CurrentUser, Id } from "../types";

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

export function forbiddenMessage(resource: string, action = "view") {
  const label = resourceLabels[resource] || resource;
  const actionLabel = action === "view" ? "просмотр" : "это действие";
  return `У вашей роли нет доступа на ${actionLabel} раздела "${label}". Если это нужно для работы, попросите владельца бизнеса изменить роль или область видимости в настройках команды.`;
}
