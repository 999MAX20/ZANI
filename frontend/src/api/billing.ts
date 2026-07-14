import { apiClient, unwrapList } from "./client";
import type { EntitlementSummaryItem, Id, Subscription, SubscriptionPlan, UsageSummaryItem } from "../types";

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
  updateSettings: async (payload: Pick<Partial<Subscription>, "billing_email" | "payment_method" | "invoice_details_json">) => {
    const { data } = await apiClient.patch<Subscription>("/api/billing/current-subscription/settings/", payload);
    return data;
  },
  requestPlanChange: async (plan: Id) => {
    const { data } = await apiClient.post<Subscription>("/api/billing/current-subscription/change-plan/", { plan });
    return data;
  },
  pause: async () => {
    const { data } = await apiClient.post<Subscription>("/api/billing/current-subscription/pause/");
    return data;
  },
  resume: async () => {
    const { data } = await apiClient.post<Subscription>("/api/billing/current-subscription/resume/");
    return data;
  },
  cancel: async () => {
    const { data } = await apiClient.post<Subscription>("/api/billing/current-subscription/cancel/");
    return data;
  },
};
