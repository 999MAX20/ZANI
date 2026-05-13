import { apiClient } from "./client";
import type { BotConversation, BotMessage, Id, Lead, Task } from "../types";

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
  search?: string;
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
  createTask: async ({ conversationId, title }: { conversationId: Id; title?: string }) => {
    const { data } = await apiClient.post<Task>(`/api/inbox/conversations/${conversationId}/create-task/`, {
      title,
      priority: "normal",
    });
    return data;
  },
  createLead: async ({ conversationId, message }: { conversationId: Id; message?: string }) => {
    const { data } = await apiClient.post<Lead>(`/api/inbox/conversations/${conversationId}/create-lead/`, { message });
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
