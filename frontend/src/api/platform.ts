import { apiClient } from "./client";
import type { PlatformMerchant, PlatformOperationsHealth, PlatformOverview, PlatformSupportAction } from "../types";

export const platformApi = {
  overview: async () => {
    const { data } = await apiClient.get<PlatformOverview>("/api/platform/overview/");
    return data;
  },
  operationsHealth: async () => {
    const { data } = await apiClient.get<PlatformOperationsHealth>("/api/platform/operations-health/");
    return data;
  },
  merchants: async () => {
    const { data } = await apiClient.get<PlatformMerchant[]>("/api/platform/merchants/");
    return data;
  },
  merchant: async (id: number | string) => {
    const { data } = await apiClient.get<PlatformMerchant>(`/api/platform/merchants/${id}/`);
    return data;
  },
  createSupportAction: async (id: number | string, payload: { action_type?: string; note: string; status?: string }) => {
    const { data } = await apiClient.post<PlatformSupportAction>(`/api/platform/merchants/${id}/support-actions/`, payload);
    return data;
  },
};
