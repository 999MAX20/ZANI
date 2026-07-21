import { apiClient } from "./client";
import type { PaginatedResponse } from "./client";
import type { BotSuggestedReplyResponse } from "./bots";
import type { Appointment, BotConversation, BotMessage, Client, Deal, DuplicateClient, Id, Lead, Task } from "../types";

export type InboxConversation = BotConversation;
export type InboxMessage = BotMessage;

export type InboxSummary = {
  total: number;
  unread: number;
  unread_messages: number;
  handoff_required: number;
  unread_sla_overdue: number;
  handoff_sla_overdue: number;
  assigned_to_me: number;
  unassigned: number;
  urgent: number;
  high_priority: number;
  bot_paused: number;
  channels: Array<{
    key: string;
    label: string;
    status: "available" | "beta" | "roadmap" | string;
    pilot_note: string;
    total: number;
    unread: number;
    handoff_required: number;
    last_message_at?: string | null;
    is_connected: boolean;
  }>;
  next_actions: Array<{
    label: string;
    href: string;
    priority: "low" | "normal" | "high" | "urgent" | string;
  }>;
  pilot_positioning: string;
};

export type InboxMessageListParams = {
  limit?: number;
  beforeId?: number;
};

export const INBOX_MESSAGES_PAGE_SIZE = 200;
export const INBOX_MESSAGES_MAX_PAGE_SIZE = 300;

export function normalizeFilters(filters: InboxFilters) {
  return Object.entries(filters).reduce<InboxFilters>((acc, [key, value]) => {
    if (value === undefined || value === "") return acc;
    const typedKey = key as keyof InboxFilters;
    return { ...acc, [typedKey]: value } as InboxFilters;
  }, {});
}

export const inboxQueryKeys = {
  conversations: (filters: InboxFilters = {}) => ["inbox-conversations", normalizeFilters(filters)] as const,
  messages: (conversationId?: number | null | string) => ["inbox-messages", conversationId] as const,
};

export type InboxFilters = {
  channel?: string;
  bot?: string;
  status?: string;
  assigned_to?: string;
  priority?: string;
  bot_enabled?: string;
  unread?: string;
  handoff_required?: string;
  search?: string;
  q?: string;
  client_ids?: Id[] | string;
  lead_ids?: Id[] | string;
  deal_ids?: Id[] | string;
};

export type PaginatedInboxMessageResponse = PaginatedResponse<InboxMessage> & {
  next_before_id?: number | null;
  has_more?: boolean;
};

export type InboxPipelineResult = {
  conversation: InboxConversation;
  client: Client;
  lead: Lead | null;
  deal: Deal | null;
  task: Task | null;
  qualification: {
    intent: string;
    confidence: number;
    summary: string;
    service_name?: string;
    preferred_time_text?: string;
    urgency: string;
    should_create_lead: boolean;
    should_create_deal: boolean;
    should_create_task: boolean;
    should_create_appointment: boolean;
    next_action: string;
    reason: string;
    requires_human_review: boolean;
  } | null;
  ai_log_id: Id | null;
  created: {
    client: boolean;
    lead: boolean;
    deal: boolean;
    task: boolean;
  };
};

export type InboxQualificationResult = {
  conversation: InboxConversation;
  qualification: NonNullable<InboxPipelineResult["qualification"]>;
  ai_log_id: Id | null;
  qualified_at: string;
  qualified_by: Id | null;
  last_message_id: Id | null;
};

function cleanParams(filters: InboxFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
}

export const inboxApi = {
  getSummary: async () => {
    const { data } = await apiClient.get<InboxSummary>("/api/inbox/conversations/summary/");
    return data;
  },
  listConversations: async (filters: InboxFilters = {}) => {
    const { data } = await apiClient.get<PaginatedResponse<InboxConversation>>("/api/inbox/conversations/", {
      params: cleanParams(filters),
    });
    return data;
  },
  getConversation: async (id: Id) => {
    const { data } = await apiClient.get<InboxConversation>(`/api/inbox/conversations/${id}/`);
    return data;
  },
  listMessages: async (conversationId: Id, params: InboxMessageListParams = {}) => {
    const payload = params.beforeId !== undefined ? { ...params, before_id: params.beforeId } : params;
    const { data } = await apiClient.get<PaginatedInboxMessageResponse>(`/api/inbox/conversations/${conversationId}/messages/`, {
      params: { limit: INBOX_MESSAGES_PAGE_SIZE, ...payload },
    });
    return data;
  },
  assignToMe: async (conversationId: Id) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/assign/`, {});
    return data;
  },
  handoff: async ({ conversationId, reason }: { conversationId: Id; reason?: string }) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/handoff/`, { reason });
    return data;
  },
  markRead: async (conversationId: Id) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/mark-read/`);
    return data;
  },
  markUnread: async (conversationId: Id) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/mark-unread/`);
    return data;
  },
  setPriority: async ({ conversationId, priority }: { conversationId: Id; priority: NonNullable<InboxConversation["priority"]> }) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/set-priority/`, {
      priority,
    });
    return data;
  },
  closeConversation: async ({ conversationId, reason }: { conversationId: Id; reason?: string }) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/close/`, { reason });
    return data;
  },
  reopenConversation: async (conversationId: Id) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/reopen/`);
    return data;
  },
  sendMessage: async ({ conversationId, text }: { conversationId: Id; text: string }) => {
    const { data } = await apiClient.post<InboxMessage>(`/api/inbox/conversations/${conversationId}/messages/`, {
      text,
      sender_type: "manager",
    });
    return data;
  },
  retryMessage: async ({ conversationId, messageId }: { conversationId: Id; messageId: Id }) => {
    const { data } = await apiClient.post<InboxMessage>(`/api/inbox/conversations/${conversationId}/retry-message/`, {
      message_id: messageId,
    });
    return data;
  },
  suggestReply: async (conversationId: Id) => {
    const { data } = await apiClient.post<BotSuggestedReplyResponse & { client_id: Id | null; lead_id: Id | null }>(
      `/api/inbox/conversations/${conversationId}/suggest-reply/`,
    );
    return data;
  },
  qualifyConversation: async (conversationId: Id) => {
    const { data } = await apiClient.post<InboxQualificationResult>(`/api/inbox/conversations/${conversationId}/qualify/`);
    return data;
  },
  createTask: async ({ conversationId, title, description, priority, due_at }: { conversationId: Id; title?: string; description?: string; priority?: Task["priority"]; due_at?: string | null }) => {
    const { data } = await apiClient.post<Task>(`/api/inbox/conversations/${conversationId}/create-task/`, {
      title,
      description,
      priority: priority || "normal",
      due_at,
    });
    return data;
  },
  createAppointment: async ({
    conversationId,
    serviceId,
    resourceId,
    startAt,
    notes,
  }: {
    conversationId: Id;
    serviceId: Id;
    resourceId?: Id | null;
    startAt: string;
    notes?: string;
  }) => {
    const { data } = await apiClient.post<Appointment>(`/api/inbox/conversations/${conversationId}/create-appointment/`, {
      service_id: serviceId,
      resource_id: resourceId ?? null,
      start_at: startAt,
      notes,
    });
    return data;
  },
  createClient: async ({ conversationId, full_name, force_create }: { conversationId: Id; full_name?: string; force_create?: boolean }) => {
    const { data } = await apiClient.post<{
      client: Client | null;
      duplicates: DuplicateClient[];
      created: boolean;
      requires_confirmation?: boolean;
    }>(`/api/inbox/conversations/${conversationId}/create-client/`, {
      full_name,
      force_create,
    });
    return data;
  },
  linkClient: async ({ conversationId, clientId }: { conversationId: Id; clientId: Id }) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/link-client/`, {
      client_id: clientId,
    });
    return data;
  },
  createLead: async ({ conversationId, message }: { conversationId: Id; message?: string }) => {
    const { data } = await apiClient.post<Lead>(`/api/inbox/conversations/${conversationId}/create-lead/`, { message });
    return data;
  },
  createDeal: async ({ conversationId, title }: { conversationId: Id; title?: string }) => {
    const { data } = await apiClient.post<Deal>(`/api/inbox/conversations/${conversationId}/create-deal/`, { title });
    return data;
  },
  runPipeline: async ({ conversationId, dealTitle }: { conversationId: Id; dealTitle?: string }) => {
    const { data } = await apiClient.post<InboxPipelineResult>(`/api/inbox/conversations/${conversationId}/run-pipeline/`, {
      create_lead: true,
      create_deal: true,
      create_task: true,
      use_ai_qualification: true,
      apply_ai_decisions: true,
      deal_title: dealTitle,
      task_title: dealTitle ? `Next step: ${dealTitle}` : undefined,
      task_priority: "normal",
    });
    return data;
  },
  linkDeal: async ({ conversationId, dealId }: { conversationId: Id; dealId: Id }) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/link-deal/`, {
      deal_id: dealId,
    });
    return data;
  },
  linkLead: async ({ conversationId, leadId }: { conversationId: Id; leadId: Id }) => {
    const { data } = await apiClient.post<InboxConversation>(`/api/inbox/conversations/${conversationId}/link-lead/`, {
      lead_id: leadId,
    });
    return data;
  },
  toggleBot: async ({ conversationId, botEnabled }: { conversationId: Id; botEnabled: boolean }) => {
    const { data } = await apiClient.patch<InboxConversation>(`/api/bot-conversations/${conversationId}/`, {
      bot_enabled: botEnabled,
    });
    return data;
  },
};
