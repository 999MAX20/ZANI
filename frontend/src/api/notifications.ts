import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Id, Notification } from "../types";

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
};
