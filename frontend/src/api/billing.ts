import { apiClient } from "./client";
import type { EntitlementSummaryItem, Subscription, SubscriptionPlan, UsageSummaryItem } from "../types";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function unwrapList<T>(data: T[] | PaginatedResponse<T>) {
  return Array.isArray(data) ? data : data.results;
}

export const billingApi = {
  plans: async () => {
    const { data } = await apiClient.get<SubscriptionPlan[] | PaginatedResponse<SubscriptionPlan>>("/api/billing/plans/");
    return unwrapList(data);
  },
  currentSubscription: async () => {
    const { data } = await apiClient.get<Subscription | null>("/api/billing/current-subscription/");
    return data;
  },
  usageSummary: async () => {
    const { data } = await apiClient.get<UsageSummaryItem[]>("/api/billing/usage-summary/");
    return data;
  },
  entitlements: async () => {
    const { data } = await apiClient.get<EntitlementSummaryItem[]>("/api/billing/entitlements/");
    return data;
  },
};
