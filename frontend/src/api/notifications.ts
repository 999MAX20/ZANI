import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Id, Notification, NotificationPreference } from "../types";

export type NotificationSummary = {
  pending: number;
  failed: number;
  due: number;
  unread: number;
  urgent: number;
  by_category: Record<string, number>;
};

export const notificationsApi = {
  ...createCrudApi<Notification>("/api/notifications/"),
  preferences: {
    ...createCrudApi<NotificationPreference>("/api/notification-preferences/"),
    list: async (params?: { user?: Id | "me"; category?: Notification["category"] }) => {
      const { data } = await apiClient.get<NotificationPreference[] | { results: NotificationPreference[] }>("/api/notification-preferences/", { params });
      return Array.isArray(data) ? data : data.results;
    },
  },
  summary: async () => {
    const { data } = await apiClient.get<NotificationSummary>("/api/notifications/summary/");
    return data;
  },
  markSent: async (id: Id) => {
    const { data } = await apiClient.post<Notification>(`/api/notifications/${id}/mark-sent/`);
    return data;
  },
  markRead: async (id: Id) => {
    const { data } = await apiClient.post<Notification>(`/api/notifications/${id}/mark-read/`);
    return data;
  },
  markUnread: async (id: Id) => {
    const { data } = await apiClient.post<Notification>(`/api/notifications/${id}/mark-unread/`);
    return data;
  },
  markAllRead: async () => {
    const { data } = await apiClient.post<{ updated: number }>("/api/notifications/mark-all-read/");
    return data;
  },
  cancel: async (id: Id) => {
    const { data } = await apiClient.post<Notification>(`/api/notifications/${id}/cancel/`);
    return data;
  },
  retry: async (id: Id) => {
    const { data } = await apiClient.post<{ result: Record<string, unknown>; notification: Notification }>(`/api/notifications/${id}/retry/`);
    return data;
  },
};
