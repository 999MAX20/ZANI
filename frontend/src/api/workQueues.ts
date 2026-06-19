import { apiClient } from "./client";
import type { Id } from "../types";

export type WorkQueueKey =
  | "overdue_tasks"
  | "stale_leads"
  | "sla_overdue_deals"
  | "no_next_action_deals"
  | "upcoming_appointments"
  | "appointment_confirmations"
  | "unread_conversations"
  | "handoff_conversations";

export type WorkQueueSummary = Record<WorkQueueKey | "total_attention", number>;

export type WorkQueueBaseItem = {
  type: "task" | "lead" | "deal" | "appointment" | "conversation";
  id: Id;
  title: string;
  href: string;
};

export type WorkQueueTaskItem = WorkQueueBaseItem & {
  type: "task";
  priority: string;
  due_at: string | null;
  client_id: Id | null;
  lead_id: Id | null;
  deal_id: Id | null;
  appointment_id: Id | null;
  assignee_id: Id | null;
};

export type WorkQueueLeadItem = WorkQueueBaseItem & {
  type: "lead";
  status: string;
  source: string;
  client_id: Id;
  responsible_user_id: Id | null;
  age_hours: number | null;
};

export type WorkQueueDealItem = WorkQueueBaseItem & {
  type: "deal";
  reason: "sla_overdue" | "no_next_action" | string;
  status: string;
  stage_id: Id | null;
  stage_name: string;
  client_id: Id;
  owner_id: Id | null;
  amount: string;
  currency: string;
  risk_level: "low" | "medium" | "high" | string;
  risk_percent: number;
};

export type WorkQueueAppointmentItem = WorkQueueBaseItem & {
  type: "appointment";
  status: string;
  client_id: Id;
  lead_id: Id | null;
  service_id: Id;
  resource_id: Id | null;
  start_at: string;
  end_at: string;
};

export type WorkQueueConversationItem = WorkQueueBaseItem & {
  type: "conversation";
  reason: "unread" | "handoff_required" | string;
  channel: string;
  priority: string;
  unread_count: number;
  handoff_required: boolean;
  handoff_reason: string;
  client_id: Id | null;
  lead_id: Id | null;
  deal_id: Id | null;
  assigned_to_id: Id | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
};

export type WorkQueueItem =
  | WorkQueueTaskItem
  | WorkQueueLeadItem
  | WorkQueueDealItem
  | WorkQueueAppointmentItem
  | WorkQueueConversationItem;

export type WorkQueuesResponse = {
  business: Id;
  generated_at: string;
  limit: number;
  summary: WorkQueueSummary;
  queues: {
    overdue_tasks: WorkQueueTaskItem[];
    stale_leads: WorkQueueLeadItem[];
    sla_overdue_deals: WorkQueueDealItem[];
    no_next_action_deals: WorkQueueDealItem[];
    upcoming_appointments: WorkQueueAppointmentItem[];
    appointment_confirmations: WorkQueueAppointmentItem[];
    unread_conversations: WorkQueueConversationItem[];
    handoff_conversations: WorkQueueConversationItem[];
  };
};

export const workQueuesApi = {
  get: async (params: { business: Id; limit?: number }) => {
    const { data } = await apiClient.get<WorkQueuesResponse>("/api/work-queues/", { params });
    return data;
  },
};
