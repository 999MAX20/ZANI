import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Id, Notification } from "../types";

export type NotificationSummary = {
  pending: number;
  failed: number;
  due: number;
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
  cancel: async (id: Id) => {
    const { data } = await apiClient.post<Notification>(`/api/notifications/${id}/cancel/`);
    return data;
  },
};
