import type { Id, Lead, Task } from "../../../types";

export type LeadFilter =
  "all" | "new" | "hot" | "unanswered" | "mine" | "attention";
export type LeadAction =
  "take" | "contacted" | "deal" | "closed" | "lost" | "reopen" | "assign";
export type LeadViewMode = "table" | "kanban";
export type LeadColumnKey =
  | "lead"
  | "phone"
  | "source"
  | "status"
  | "priority"
  | "manager"
  | "activity"
  | "next";
export type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type OfflineLeadAction =
  | { id: string; type: "note"; leadId: Id; text: string; createdAt: string }
  | {
      id: string;
      type: "task";
      leadId: Id;
      title: string;
      due_at: string;
      assignee: string;
      priority: Task["priority"];
      createdAt: string;
    };

export type FilterPreset = {
  id: string;
  name: string;
  filter: LeadFilter;
  source: string;
  search: string;
};

export type UndoToast = {
  message: string;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
};

export type ActionHistoryItem = UndoToast & {
  id: string;
};

export type LeadAiInsight = {
  score: number;
  lossRisk: number;
  stale: boolean;
  duplicateLeads: Lead[];
  duplicateClients: import("../../../types").Client[];
  summary: string;
  intent: string;
  recommendation: string;
};

export type LeadMetrics = {
  total: number;
  newToday: number;
  newThisWeek: number;
  unanswered: number;
  unansweredThisWeek: number;
  inProgress: number;
  inProgressThisWeek: number;
  hot: number;
  hotThisWeek: number;
};

export const LEADS_PAGE_SIZE = 10;
export const LEAD_PRESETS_KEY = "zani_leads_filter_presets";
export const LEAD_COLUMNS_KEY = "zani_leads_columns";
export const LEAD_COLUMN_ORDER_KEY = "zani_leads_column_order";
export const LEAD_OFFLINE_QUEUE_KEY = "zani_leads_offline_queue";
export const LEAD_CACHE_KEY = "zani_leads_cache";

export const leadFilters: LeadFilter[] = [
  "all",
  "new",
  "hot",
  "unanswered",
  "mine",
  "attention",
];
export const leadViewModes: LeadViewMode[] = ["table", "kanban"];
export const leadColumnOrder: LeadColumnKey[] = [
  "lead",
  "phone",
  "source",
  "status",
  "priority",
  "manager",
  "activity",
  "next",
];

export const leadColumnWidths: Record<LeadColumnKey, string> = {
  lead: "minmax(220px,1.7fr)",
  phone: "minmax(130px,0.8fr)",
  source: "minmax(110px,0.7fr)",
  status: "minmax(112px,0.7fr)",
  priority: "minmax(96px,0.55fr)",
  manager: "minmax(128px,0.75fr)",
  activity: "minmax(118px,0.65fr)",
  next: "minmax(220px,1.45fr)",
};

export const defaultVisibleColumns: Record<LeadColumnKey, boolean> = {
  lead: true,
  phone: false,
  source: true,
  status: true,
  priority: false,
  manager: false,
  activity: false,
  next: true,
};

export const kanbanStatuses: Lead["status"][] = [
  "new",
  "contacted",
  "in_progress",
  "appointment_created",
  "closed",
  "lost",
];

export const statusLabels: Record<Lead["status"], string> = {
  new: "leads.statusNew",
  contacted: "leads.statusContacted",
  in_progress: "leads.statusInProgress",
  appointment_created: "leads.statusAppointmentCreated",
  closed: "leads.statusClosed",
  lost: "leads.statusLost",
};

export const statusClass: Record<Lead["status"], string> = {
  new: "bg-[var(--zani-warning-soft)] text-zani-warning ring-[rgba(183,121,31,0.22)]",
  contacted:
    "bg-[var(--zani-info-soft)] text-zani-info ring-[rgba(14,116,144,0.18)]",
  in_progress: "bg-ai-50 text-ai-700 ring-ai-100",
  appointment_created:
    "bg-[var(--zani-success-soft)] text-zani-success ring-[rgba(21,128,61,0.18)]",
  closed: "bg-brand-50 text-brand-700 ring-brand-100",
  lost: "bg-[var(--zani-danger-soft)] text-zani-danger ring-[rgba(194,65,12,0.2)]",
};

export const sourceLabels: Record<string, string> = {
  website: "leads.sourceWebsite",
  landing: "leads.sourceLanding",
  telegram: "leads.sourceTelegram",
  whatsapp: "leads.sourceWhatsApp",
  instagram: "leads.sourceInstagram",
  manual: "leads.sourceManual",
  parser: "leads.sourceParser",
  other: "leads.sourceOther",
};
