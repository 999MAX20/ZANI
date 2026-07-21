import type { AppointmentMessageSetting, BusinessMembershipSummary, Notification } from "../../types";

export const teamRoleOptions: Array<{ value: BusinessMembershipSummary["role"] }> = [
  { value: "owner" },
  { value: "admin" },
  { value: "manager" },
  { value: "operator" },
  { value: "marketer" },
  { value: "accountant" },
  { value: "support" },
  { value: "staff" },
];

export const accessGroups = [
  { key: "sales", resources: ["leads", "deals"] },
  { key: "clients", resources: ["clients"] },
  { key: "chats", resources: ["conversations"] },
  { key: "calendar", resources: ["appointments"] },
  { key: "tasks", resources: ["tasks"] },
  { key: "analytics", resources: ["analytics"] },
  { key: "settings", resources: ["settings"] },
  { key: "export", resources: ["billing"] },
  { key: "security", resources: ["team", "audit_logs"] },
];

export const visibilityOptions = [
  { value: "own" },
  { value: "team" },
  { value: "business" },
] as const;

export const roleGuideKeys = ["manager", "operator", "staff", "accountant"] as const;
export const settingsGroupOrder = ["business", "team", "communication", "setup", "advanced"] as const;

export type SettingsGroupKey = (typeof settingsGroupOrder)[number];

export type SettingsSectionConfig = { id: string; group?: SettingsGroupKey; resource: string; action?: string };

export const settingsSections: SettingsSectionConfig[] = [
  { id: "business-profile", group: "business", resource: "settings", action: "update" },
  { id: "team-access", group: "team", resource: "team", action: "view" },
  { id: "roles", group: "team", resource: "team", action: "manage" },
  { id: "security-center", group: "team", resource: "audit_logs", action: "view" },
  { id: "appointment-messages", resource: "settings", action: "update" },
  { id: "notification-preferences", group: "communication", resource: "notifications", action: "view" },
  { id: "quick-replies", group: "communication", resource: "conversations", action: "view" },
  { id: "billing", group: "setup", resource: "billing", action: "view" },
  { id: "usage", group: "setup", resource: "billing", action: "view" },
  { id: "custom-fields", group: "advanced", resource: "settings", action: "update" },
];

export const settingsSectionGroupFallback: Record<string, SettingsGroupKey> = {
  "appointment-messages": "communication",
};

export const appointmentScenarioLabels: Record<AppointmentMessageSetting["scenario"], { titleKey: string; descriptionKey: string }> = {
  confirmation: {
    titleKey: "settings.appointmentMessages.scenario.confirmation",
    descriptionKey: "settings.appointmentMessages.scenario.confirmation.text",
  },
  reminder: {
    titleKey: "settings.appointmentMessages.scenario.reminder",
    descriptionKey: "settings.appointmentMessages.scenario.reminder.text",
  },
  thank_you: {
    titleKey: "settings.appointmentMessages.scenario.thankYou",
    descriptionKey: "settings.appointmentMessages.scenario.thankYou.text",
  },
};

export const appointmentChannelOptions = [
  { value: "auto", labelKey: "settings.appointmentMessages.channel.auto" },
  { value: "telegram", labelKey: "settings.appointmentMessages.channel.telegram" },
  { value: "whatsapp", labelKey: "settings.appointmentMessages.channel.whatsapp" },
  { value: "email", labelKey: "settings.appointmentMessages.channel.email" },
  { value: "sms", labelKey: "settings.appointmentMessages.channel.sms" },
  { value: "system", labelKey: "settings.appointmentMessages.channel.system" },
];

export const notificationCategories: Array<{ category: Notification["category"]; titleKey: string; descriptionKey: string }> = [
  { category: "sales", titleKey: "settings.notifications.category.sales", descriptionKey: "settings.notifications.category.sales.text" },
  { category: "tasks", titleKey: "settings.notifications.category.tasks", descriptionKey: "settings.notifications.category.tasks.text" },
  { category: "outreach", titleKey: "settings.notifications.category.outreach", descriptionKey: "settings.notifications.category.outreach.text" },
  { category: "ai_alerts", titleKey: "settings.notifications.category.aiAlerts", descriptionKey: "settings.notifications.category.aiAlerts.text" },
  { category: "system", titleKey: "settings.notifications.category.system", descriptionKey: "settings.notifications.category.system.text" },
  { category: "finance", titleKey: "settings.notifications.category.finance", descriptionKey: "settings.notifications.category.finance.text" },
];
