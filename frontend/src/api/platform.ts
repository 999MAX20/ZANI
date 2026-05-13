import { apiClient } from "./client";
import type { PlatformMerchant, PlatformOverview } from "../types";

export const platformApi = {
  overview: async () => {
    const { data } = await apiClient.get<PlatformOverview>("/api/platform/overview/");
    return data;
  },
  merchants: async () => {
    const { data } = await apiClient.get<PlatformMerchant[]>("/api/platform/merchants/");
    return data;
  },
};
