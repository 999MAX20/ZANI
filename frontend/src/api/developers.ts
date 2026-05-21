import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { ApiToken, ApiTokenCreateResponse, Id, WebhookDeliveryLog, WebhookEndpoint } from "../types";

export type ApiTokenPayload = {
  business: Id;
  name: string;
  scopes_json: string[];
  expires_at?: string | null;
};

export type WebhookEndpointPayload = {
  business: Id;
  name: string;
  url: string;
  secret?: string;
  events_json: string[];
  is_active?: boolean;
};

export const developerApi = {
  tokens: {
    ...createCrudApi<ApiToken, ApiTokenPayload, Partial<ApiTokenPayload>>("/api/api-tokens/"),
    create: async (payload: ApiTokenPayload) => {
      const { data } = await apiClient.post<ApiTokenCreateResponse>("/api/api-tokens/", payload);
      return data;
    },
    rotate: async (id: Id) => {
      const { data } = await apiClient.post<ApiTokenCreateResponse>(`/api/api-tokens/${id}/rotate/`);
      return data;
    },
    revoke: async (id: Id) => {
      const { data } = await apiClient.post<ApiToken>(`/api/api-tokens/${id}/revoke/`);
      return data;
    },
  },
  webhooks: {
    ...createCrudApi<WebhookEndpoint, WebhookEndpointPayload, Partial<WebhookEndpointPayload>>("/api/webhook-endpoints/"),
    testDelivery: async (id: Id) => {
      const { data } = await apiClient.post<WebhookDeliveryLog>(`/api/webhook-endpoints/${id}/test-delivery/`);
      return data;
    },
  },
  deliveries: {
    list: async (params?: { endpoint?: Id; status?: WebhookDeliveryLog["status"] }) => {
      const { data } = await apiClient.get<WebhookDeliveryLog[] | { results: WebhookDeliveryLog[] }>("/api/webhook-deliveries/", { params });
      return Array.isArray(data) ? data : data.results || [];
    },
    retry: async (id: Id) => {
      const { data } = await apiClient.post<WebhookDeliveryLog>(`/api/webhook-deliveries/${id}/retry/`);
      return data;
    },
  },
};
