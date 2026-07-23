import { permissionResourceLabel } from "../../lib/permissions";
import type { BusinessRole, CustomFieldDefinition, RolePermission } from "../../types";

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function parseRoleList(value: string) {
  return value
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

export function formatMetric(metric: string, t: Translate) {
  const labels: Record<string, string> = {
    ai_requests: t("settings.metric.ai_requests"),
    bot_messages: t("settings.metric.bot_messages"),
    users: t("settings.metric.users"),
    bots: t("settings.metric.bots"),
    automations: t("settings.metric.automations"),
    conversations: t("settings.metric.conversations"),
    storage_mb: t("settings.metric.storage_mb"),
  };
  return labels[metric] || metric;
}

export function formatPrice(value: string | undefined, t: Translate, locale: string) {
  if (!value) return t("settings.noPrice");
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return t("settings.freePrice");
  return t("settings.monthPrice", { amount: numeric.toLocaleString(locale) });
}

export function roleVisibility(role: BusinessRole) {
  const allowedScopes = role.permissions
    .filter((permission) => permission.is_allowed)
    .map((permission) => permission.scope);
  if (allowedScopes.includes("business")) return "business";
  if (allowedScopes.includes("team")) return "team";
  if (allowedScopes.includes("own")) return "own";
  return "none";
}

export function translatedVisibilityLabel(scope: string, t: Translate) {
  if (scope === "business" || scope === "team" || scope === "own") return t(`settings.visibility.${scope}`);
  return t("settings.noAccess");
}

export function translatedVisibilityDescription(scope: string, t: Translate) {
  if (scope === "business" || scope === "team" || scope === "own") return t(`settings.visibility.${scope}.text`);
  return t("settings.noAccessText");
}

export function roleSummary(role: BusinessRole, t: Translate) {
  const visibleResources = Array.from(
    new Set(role.permissions.filter((permission) => permission.is_allowed).map((permission) => permission.resource)),
  );
  if (!visibleResources.length) return t("settings.roleSummaryNone");
  const names = visibleResources.slice(0, 4).map((resource) => permissionResourceLabel(resource, t));
  const extra = visibleResources.length > names.length ? ` +${visibleResources.length - names.length}` : "";
  return t("settings.roleSummary", { names: `${names.join(", ")}${extra}` });
}

export function entityLabel(entity: string, t: Translate) {
  if (entity === "clients") return t("settings.entity.clients");
  if (entity === "leads") return t("settings.lead");
  if (entity === "deals") return t("settings.deal");
  if (entity === "sales") return t("settings.entity.sales");
  if (entity === "catalog") return t("settings.entity.catalog");
  return entity;
}

export function auditEventTitle(action: string, entityType: string, t: Translate) {
  const actionKey = action === "create" || action === "update" || action === "delete" || action === "export" || action === "login" ? action : "change";
  const entityKey = entityType === "BusinessRole" || entityType === "BusinessMembership" || entityType === "ImportJob" || entityType === "LeadForm" ? entityType : "record";
  return t("settings.auditEventTitle", {
    action: t(`settings.auditAction.${actionKey}`),
    entity: t(`settings.auditEntity.${entityKey}`),
  });
}

export function riskLabel(risk: string, t: Translate) {
  if (risk === "low" || risk === "medium" || risk === "high" || risk === "critical") return t(`settings.risk.${risk}`);
  return t("settings.risk.low");
}

export function loginStatusLabel(status: string, t: Translate) {
  if (status === "success") return t("settings.loginStatus.success");
  if (status === "failed") return t("settings.loginStatus.failed");
  return status;
}

export function customFieldSummary(field: CustomFieldDefinition, t: Translate) {
  return t("settings.customFieldSummary", {
    entity: t(`settings.customFieldEntity.${field.entity_type}`),
    type: t(`settings.customFieldType.${field.field_type}`),
  });
}

export function groupLevel(role: BusinessRole, resources: string[]): RolePermission["scope"] {
  const permissions = role.permissions.filter((permission) => resources.includes(permission.resource));
  if (!permissions.length || permissions.every((permission) => !permission.is_allowed)) return "none";
  const scopes = permissions.filter((permission) => permission.is_allowed).map((permission) => permission.scope);
  if (scopes.includes("business")) return "business";
  if (scopes.includes("team")) return "team";
  if (scopes.includes("own")) return "own";
  return "none";
}

export function riskClass(risk: string) {
  const classes: Record<string, string> = {
    low: "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600",
    medium: "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700",
    high: "rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700",
    critical: "rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700",
  };
  return classes[risk] || classes.low;
}
