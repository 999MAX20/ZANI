import { apiClient } from "./client";
import type { BotSuggestedReplyResponse } from "./bots";
import type { BotConversation, BotMessage, Client, Deal, DuplicateClient, Id, Lead, Task } from "../types";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type InboxConversation = BotConversation;
export type InboxMessage = BotMessage;

export type InboxFilters = {
  channel?: string;
  status?: string;
  assigned_to?: string;
  priority?: string;
  bot_enabled?: string;
  unread?: string;
  handoff_required?: string;
  search?: string;
  q?: string;
};

function cleanParams(filters: InboxFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""));
}

export const inboxApi = {
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
  listMessages: async (conversationId: Id) => {
    const { data } = await apiClient.get<InboxMessage[]>(`/api/inbox/conversations/${conversationId}/messages/`);
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
  sendMessage: async ({ conversationId, text }: { conversationId: Id; text: string }) => {
    const { data } = await apiClient.post<InboxMessage>(`/api/inbox/conversations/${conversationId}/messages/`, {
      text,
      sender_type: "manager",
    });
    return data;
  },
  suggestReply: async (conversationId: Id) => {
    const { data } = await apiClient.post<BotSuggestedReplyResponse & { client_id: Id | null; lead_id: Id | null }>(
      `/api/inbox/conversations/${conversationId}/suggest-reply/`,
    );
    return data;
  },
  createTask: async ({ conversationId, title }: { conversationId: Id; title?: string }) => {
    const { data } = await apiClient.post<Task>(`/api/inbox/conversations/${conversationId}/create-task/`, {
      title,
      priority: "normal",
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
