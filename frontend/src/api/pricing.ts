import { apiClient, unwrapList } from "./client";
import { createCrudApi } from "./crud";
import type { Id } from "../types";

export type KaspiPricingRule = {
  id: Id;
  business: Id;
  business_name: string;
  product_sku: string;
  product_name: string;
  kaspi_product_id: string;
  current_price: string;
  min_price: string;
  step_amount: string;
  mode: "recommend" | "approval" | "autopilot";
  status: "active" | "paused" | "archived";
  max_changes_per_day: number;
  config_json: Record<string, unknown>;
  last_checked_at: string | null;
  last_recommended_price: string | null;
  last_applied_price: string | null;
  last_error: string;
  autopilot_confirmed_at: string | null;
  autopilot_confirmed_by: Id | null;
  created_at: string;
  updated_at: string;
};

export type KaspiPricingRulePayload = {
  business: Id;
  product_sku: string;
  product_name?: string;
  kaspi_product_id?: string;
  current_price: string;
  min_price: string;
  step_amount?: string;
  mode?: "recommend" | "approval" | "autopilot";
  status?: "active" | "paused" | "archived";
  max_changes_per_day?: number;
  config_json?: Record<string, unknown>;
};

export type PricingCatalogItem = {
  id: Id;
  business: Id;
  source: string;
  external_id: string;
  sku: string;
  name: string;
  current_price: string | null;
  stock_quantity: string | null;
  payload_json: Record<string, unknown>;
  last_seen_at: string;
  rule_id: Id | null;
  rule_mode: KaspiPricingRule["mode"] | "";
  created_at: string;
  updated_at: string;
};

export type KaspiPricingRecommendation = {
  id: Id;
  business: Id;
  rule: Id;
  product_sku: string;
  product_name: string;
  current_price: string;
  competitor_price: string | null;
  target_price: string;
  min_price: string;
  delta: string;
  reason: string;
  status: "proposed" | "blocked" | "approved" | "applied" | "skipped" | "failed";
  decision_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type KaspiCompetitorOffer = {
  id: Id;
  business: Id;
  rule: Id;
  competitor_name: string;
  competitor_merchant_id: string;
  price: string;
  position: number | null;
  available: boolean;
  payload_json: Record<string, unknown>;
  observed_at: string;
  created_at: string;
};

export type KaspiPriceChangeLog = {
  id: Id;
  business: Id;
  rule: Id;
  product_sku: string;
  product_name: string;
  recommendation: Id | null;
  old_price: string;
  new_price: string;
  status: "simulated" | "queued" | "applied" | "blocked" | "failed";
  mode: string;
  provider_response_json: Record<string, unknown>;
  error: string;
  created_at: string;
};

export type KaspiPricingControl = {
  id: Id;
  business: Id;
  emergency_stop_enabled: boolean;
  emergency_stop_reason: string;
  stopped_at: string | null;
  stopped_by: Id | null;
  stopped_by_name: string;
  resumed_at: string | null;
  resumed_by: Id | null;
  created_at: string;
  updated_at: string;
};

export type KaspiPricingAlert = {
  id: Id;
  business: Id;
  rule: Id | null;
  product_sku: string;
  change_log: Id | null;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "resolved";
  title: string;
  message: string;
  payload_json: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
};

export const kaspiPricingApi = {
  catalog: {
    list: async (params?: Record<string, unknown>) => {
      const { data } = await apiClient.get<PricingCatalogItem[] | { results: PricingCatalogItem[] }>("/api/pricing/kaspi/catalog/", { params });
      return unwrapList(data);
    },
    sync: async ({ business, sources }: { business: Id; sources?: string[] }) => {
      const { data } = await apiClient.post<{ events_scanned: number; items_created: number; items_updated: number; items_skipped: number }>("/api/pricing/kaspi/catalog/sync/", {
        business,
        sources,
      });
      return data;
    },
    createRule: async ({
      id,
      minPrice,
      currentPrice,
      stepAmount,
      mode,
      maxChangesPerDay,
    }: {
      id: Id;
      minPrice: string;
      currentPrice?: string;
      stepAmount?: string;
      mode?: "recommend" | "approval";
      maxChangesPerDay?: number;
    }) => {
      const { data } = await apiClient.post<KaspiPricingRule>(`/api/pricing/kaspi/catalog/${id}/create-rule/`, {
        min_price: minPrice,
        current_price: currentPrice,
        step_amount: stepAmount,
        mode,
        max_changes_per_day: maxChangesPerDay,
      });
      return data;
    },
    bulkCreateRules: async ({
      itemIds,
      minPrice,
      stepAmount,
      mode,
      maxChangesPerDay,
    }: {
      itemIds: Id[];
      minPrice: string;
      stepAmount?: string;
      mode?: "recommend" | "approval";
      maxChangesPerDay?: number;
    }) => {
      const { data } = await apiClient.post<{ created: number; updated: number; rules: KaspiPricingRule[] }>("/api/pricing/kaspi/catalog/bulk-create-rules/", {
        item_ids: itemIds,
        min_price: minPrice,
        step_amount: stepAmount,
        mode,
        max_changes_per_day: maxChangesPerDay,
      });
      return data;
    },
  },
  control: {
    current: async (business: Id) => {
      const { data } = await apiClient.get<KaspiPricingControl>("/api/pricing/kaspi/control/current/", { params: { business } });
      return data;
    },
    emergencyStop: async ({ business, reason }: { business: Id; reason?: string }) => {
      const { data } = await apiClient.post<KaspiPricingControl>("/api/pricing/kaspi/control/emergency-stop/", { business, reason });
      return data;
    },
    resume: async (business: Id) => {
      const { data } = await apiClient.post<KaspiPricingControl>("/api/pricing/kaspi/control/resume/", { business });
      return data;
    },
  },
  alerts: {
    list: async (params?: Record<string, unknown>) => {
      const { data } = await apiClient.get<KaspiPricingAlert[] | { results: KaspiPricingAlert[] }>("/api/pricing/kaspi/alerts/", { params });
      return unwrapList(data);
    },
    resolve: async (id: Id) => {
      const { data } = await apiClient.post<KaspiPricingAlert>(`/api/pricing/kaspi/alerts/${id}/resolve/`, {});
      return data;
    },
  },
  rules: {
    ...createCrudApi<KaspiPricingRule, KaspiPricingRulePayload, Partial<KaspiPricingRulePayload>>("/api/pricing/kaspi/rules/"),
    list: async (params?: Record<string, unknown>) => {
      const { data } = await apiClient.get<KaspiPricingRule[] | { results: KaspiPricingRule[] }>("/api/pricing/kaspi/rules/", { params });
      return unwrapList(data);
    },
    recommend: async ({ id, competitorPrice, competitorName }: { id: Id; competitorPrice?: string; competitorName?: string }) => {
      const payload: Record<string, unknown> = {};
      if (competitorPrice) payload.competitor_price = competitorPrice;
      if (competitorName) payload.competitor_name = competitorName;
      const { data } = await apiClient.post<KaspiPricingRecommendation>(`/api/pricing/kaspi/rules/${id}/recommend/`, payload);
      return data;
    },
    collectOffers: async ({ id, provider }: { id: Id; provider?: string }) => {
      const { data } = await apiClient.post<{ ok: boolean; provider: string; offers_created: number; error: string }>(`/api/pricing/kaspi/rules/${id}/collect-offers/`, {
        provider,
      });
      return data;
    },
    enableAutopilot: async (id: Id) => {
      const { data } = await apiClient.post<KaspiPricingRule>(`/api/pricing/kaspi/rules/${id}/enable-autopilot/`, {
        confirm_min_price: true,
        confirm_daily_limit: true,
        confirm_monitoring: true,
        confirm_writeback_risk: true,
      });
      return data;
    },
    disableAutopilot: async (id: Id) => {
      const { data } = await apiClient.post<KaspiPricingRule>(`/api/pricing/kaspi/rules/${id}/disable-autopilot/`, {});
      return data;
    },
    bulkUpdate: async ({
      ruleIds,
      status,
      minPrice,
      stepAmount,
      maxChangesPerDay,
      disableAutopilot,
    }: {
      ruleIds: Id[];
      status?: "active" | "paused" | "archived";
      minPrice?: string;
      stepAmount?: string;
      maxChangesPerDay?: number;
      disableAutopilot?: boolean;
    }) => {
      const payload: Record<string, unknown> = { rule_ids: ruleIds };
      if (status) payload.status = status;
      if (minPrice) payload.min_price = minPrice;
      if (stepAmount) payload.step_amount = stepAmount;
      if (maxChangesPerDay) payload.max_changes_per_day = maxChangesPerDay;
      if (disableAutopilot) payload.disable_autopilot = true;
      const { data } = await apiClient.post<{ updated: number; rules: KaspiPricingRule[] }>("/api/pricing/kaspi/rules/bulk-update/", payload);
      return data;
    },
  },
  recommendations: {
    list: async (params?: Record<string, unknown>) => {
      const { data } = await apiClient.get<KaspiPricingRecommendation[] | { results: KaspiPricingRecommendation[] }>("/api/pricing/kaspi/recommendations/", { params });
      return unwrapList(data);
    },
    apply: async (id: Id, force = false) => {
      const { data } = await apiClient.post<KaspiPriceChangeLog>(`/api/pricing/kaspi/recommendations/${id}/apply/`, { force });
      return data;
    },
  },
  competitorOffers: {
    list: async (params?: Record<string, unknown>) => {
      const { data } = await apiClient.get<KaspiCompetitorOffer[] | { results: KaspiCompetitorOffer[] }>("/api/pricing/kaspi/competitor-offers/", { params });
      return unwrapList(data);
    },
  },
  changeLogs: {
    list: async (params?: Record<string, unknown>) => {
      const { data } = await apiClient.get<KaspiPriceChangeLog[] | { results: KaspiPriceChangeLog[] }>("/api/pricing/kaspi/change-logs/", { params });
      return unwrapList(data);
    },
  },
};
