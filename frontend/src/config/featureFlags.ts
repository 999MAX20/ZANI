export const featureFlags = {
  crmUnifiedDesign: import.meta.env.VITE_CRM_UNIFIED_DESIGN === "true",
  crmKanbanDefault: import.meta.env.VITE_CRM_KANBAN_DEFAULT === "true",
};

export type FeatureFlagKey = keyof typeof featureFlags;
