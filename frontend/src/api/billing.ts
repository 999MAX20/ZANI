import { apiClient, unwrapList } from "./client";
import type { EntitlementSummaryItem, Subscription, SubscriptionPlan, UsageSummaryItem } from "../types";

export const billingApi = {
  plans: async () => {
    const { data } = await apiClient.get<SubscriptionPlan[] | { results: SubscriptionPlan[] }>("/api/billing/plans/");
    return unwrapList(data);
  },
  currentSubscription: async () => {
    const { data } = await apiClient.get<Subscription | null>("/api/billing/current-subscription/");
    return data;
  },
  usageSummary: async () => {
    const { data } = await apiClient.get<UsageSummaryItem[] | { results: UsageSummaryItem[] }>("/api/billing/usage-summary/");
    return unwrapList(data);
  },
  entitlements: async () => {
    const { data } = await apiClient.get<EntitlementSummaryItem[] | { results: EntitlementSummaryItem[] }>("/api/billing/entitlements/");
    return unwrapList(data);
  },
};
