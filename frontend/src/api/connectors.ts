import { apiClient, unwrapList } from "./client";
import { createCrudApi } from "./crud";
import type { BusinessConnector, BusinessEvent, ConnectorCapability, ConnectorCredential, ConnectorSyncRun, Id } from "../types";

export type BusinessConnectorPayload = {
  business: Id;
  provider: BusinessConnector["provider"];
  name: string;
  capability?: BusinessConnector["capability"];
  auth_type?: BusinessConnector["auth_type"];
  config_json?: Record<string, unknown>;
  scopes_json?: string[];
};

export type ConnectorCredentialPayload = {
  connector: Id;
  key: string;
  value: string;
  expires_at?: string | null;
};

export type WhatsAppConnectionRequestPayload = {
  business: Id;
  company_name: string;
  phone_number: string;
  contact_person?: string;
  preferred_method: "not_sure" | "qr_pilot" | "meta_cloud" | "360dialog" | "twilio";
  monthly_messages?: number;
  has_meta_assets?: boolean;
  comment?: string;
};

export type WhatsAppEmbeddedSignupStartResponse = {
  authorization_url: string;
  state: string;
  redirect_uri: string;
  app_configured: boolean;
  config_id_configured: boolean;
  app_id: string;
  config_id: string;
  graph_api_version: string;
};

export type WhatsAppEmbeddedSignupCompletePayload = {
  business: Id;
  code: string;
  state: string;
  redirect_uri?: string;
  phone_number_id: string;
  waba_id?: string;
  display_phone_number?: string;
};

export type InstagramOAuthStartResponse = {
  authorization_url: string;
  state: string;
  redirect_uri: string;
  app_configured: boolean;
  app_id: string;
  graph_api_version: string;
};

export type InstagramOAuthCompletePayload = {
  business: Id;
  code: string;
  state: string;
  redirect_uri?: string;
  page_id?: string;
};

export type KaspiConnectorStatus = {
  status: string;
  api_token_configured: boolean;
  kaspi_enabled: boolean;
  api_base_url: string;
  merchant_id: string;
  order_state: string;
  sync_days: number;
  page_size: number;
  read_only: boolean;
  last_error: string;
  last_sync_at: string | null;
  next_sync_at: string | null;
};

export type KaspiConnectorConfigPayload = {
  business: Id;
  apiToken?: string;
  merchantId?: string;
  orderState?: string;
  syncDays?: number;
  pageSize?: number;
};

export type MoySkladConnectorStatus = {
  status: string;
  access_token_configured: boolean;
  moysklad_enabled: boolean;
  api_base_url: string;
  entities: string[];
  page_size: number;
  read_only: boolean;
  last_error: string;
  last_sync_at: string | null;
  next_sync_at: string | null;
};

export type MoySkladConnectorConfigPayload = {
  business: Id;
  accessToken?: string;
  entities?: string[];
  pageSize?: number;
};

export type WildberriesConnectorStatus = {
  status: string;
  api_token_configured: boolean;
  wildberries_enabled: boolean;
  api_base_url: string;
  entities: string[];
  sync_days: number;
  read_only: boolean;
  stocks_endpoint_note: string;
  last_error: string;
  last_sync_at: string | null;
  next_sync_at: string | null;
};

export type WildberriesConnectorConfigPayload = {
  business: Id;
  apiToken?: string;
  entities?: string[];
  syncDays?: number;
};

export type OzonConnectorStatus = {
  status: string;
  client_id_configured: boolean;
  api_key_configured: boolean;
  ozon_enabled: boolean;
  api_base_url: string;
  entities: string[];
  sync_days: number;
  limit: number;
  read_only: boolean;
  last_error: string;
  last_sync_at: string | null;
  next_sync_at: string | null;
};

export type OzonConnectorConfigPayload = {
  business: Id;
  clientId?: string;
  apiKey?: string;
  entities?: string[];
  syncDays?: number;
  limit?: number;
};

export const businessConnectorsApi = {
  ...createCrudApi<BusinessConnector, BusinessConnectorPayload, Partial<BusinessConnectorPayload>>("/api/business-connectors/"),
  capabilities: async () => {
    const { data } = await apiClient.get<ConnectorCapability[] | { results: ConnectorCapability[] }>("/api/business-connectors/capabilities/");
    return unwrapList(data);
  },
  connect: async (id: Id) => {
    const { data } = await apiClient.post<BusinessConnector>(`/api/business-connectors/${id}/connect/`);
    return data;
  },
  disconnect: async (id: Id) => {
    const { data } = await apiClient.post<BusinessConnector>(`/api/business-connectors/${id}/disconnect/`);
    return data;
  },
  healthCheck: async (id: Id) => {
    const { data } = await apiClient.post<ConnectorSyncRun>(`/api/business-connectors/${id}/health-check/`);
    return data;
  },
  ingestEvent: async ({ id, payload }: { id: Id; payload: { event_type: string; external_id?: string; payload_json?: Record<string, unknown> } }) => {
    const { data } = await apiClient.post<BusinessEvent>(`/api/business-connectors/${id}/events/`, payload);
    return data;
  },
  mockSync: async (id: Id) => {
    const { data } = await apiClient.post<BusinessEvent[]>(`/api/business-connectors/${id}/mock-sync/`);
    return data;
  },
  configureKaspi: async ({ business, apiToken, merchantId, orderState, syncDays, pageSize }: KaspiConnectorConfigPayload) => {
    const { data } = await apiClient.post<BusinessConnector>("/api/business-connectors/kaspi-config/", {
      business,
      api_token: apiToken,
      merchant_id: merchantId,
      order_state: orderState,
      sync_days: syncDays,
      page_size: pageSize,
    });
    return data;
  },
  kaspiStatus: async (id: Id) => {
    const { data } = await apiClient.get<KaspiConnectorStatus>(`/api/business-connectors/${id}/kaspi-status/`);
    return data;
  },
  kaspiTestConnection: async (id: Id) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      status: string;
      orders_count: number;
      api_token_configured: boolean;
    }>(`/api/business-connectors/${id}/kaspi-test-connection/`);
    return data;
  },
  kaspiSyncOrders: async (id: Id) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      events: BusinessEvent[];
      sync_run: ConnectorSyncRun;
    }>(`/api/business-connectors/${id}/kaspi-sync-orders/`);
    return data;
  },
  configureMoySklad: async ({ business, accessToken, entities, pageSize }: MoySkladConnectorConfigPayload) => {
    const { data } = await apiClient.post<BusinessConnector>("/api/business-connectors/moysklad-config/", {
      business,
      access_token: accessToken,
      entities,
      page_size: pageSize,
    });
    return data;
  },
  moyskladStatus: async (id: Id) => {
    const { data } = await apiClient.get<MoySkladConnectorStatus>(`/api/business-connectors/${id}/moysklad-status/`);
    return data;
  },
  moyskladTestConnection: async (id: Id) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      status: string;
      rows_count: number;
      access_token_configured: boolean;
    }>(`/api/business-connectors/${id}/moysklad-test-connection/`);
    return data;
  },
  moyskladSync: async (id: Id) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      events: BusinessEvent[];
      sync_run: ConnectorSyncRun;
    }>(`/api/business-connectors/${id}/moysklad-sync/`);
    return data;
  },
  configureWildberries: async ({ business, apiToken, entities, syncDays }: WildberriesConnectorConfigPayload) => {
    const { data } = await apiClient.post<BusinessConnector>("/api/business-connectors/wildberries-config/", {
      business,
      api_token: apiToken,
      entities,
      sync_days: syncDays,
    });
    return data;
  },
  wildberriesStatus: async (id: Id) => {
    const { data } = await apiClient.get<WildberriesConnectorStatus>(`/api/business-connectors/${id}/wildberries-status/`);
    return data;
  },
  wildberriesTestConnection: async (id: Id) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      status: string;
      rows_count: number;
      api_token_configured: boolean;
    }>(`/api/business-connectors/${id}/wildberries-test-connection/`);
    return data;
  },
  wildberriesSync: async (id: Id) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      events: BusinessEvent[];
      sync_run: ConnectorSyncRun;
    }>(`/api/business-connectors/${id}/wildberries-sync/`);
    return data;
  },
  configureOzon: async ({ business, clientId, apiKey, entities, syncDays, limit }: OzonConnectorConfigPayload) => {
    const { data } = await apiClient.post<BusinessConnector>("/api/business-connectors/ozon-config/", {
      business,
      client_id: clientId,
      api_key: apiKey,
      entities,
      sync_days: syncDays,
      limit,
    });
    return data;
  },
  ozonStatus: async (id: Id) => {
    const { data } = await apiClient.get<OzonConnectorStatus>(`/api/business-connectors/${id}/ozon-status/`);
    return data;
  },
  ozonTestConnection: async (id: Id) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      status: string;
      warehouses_count: number;
      client_id_configured: boolean;
      api_key_configured: boolean;
    }>(`/api/business-connectors/${id}/ozon-test-connection/`);
    return data;
  },
  ozonSync: async (id: Id) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      events: BusinessEvent[];
      sync_run: ConnectorSyncRun;
    }>(`/api/business-connectors/${id}/ozon-sync/`);
    return data;
  },
  requestWhatsApp: async (payload: WhatsAppConnectionRequestPayload) => {
    const { data } = await apiClient.post<BusinessConnector>("/api/business-connectors/whatsapp-request/", payload);
    return data;
  },
  startWhatsAppEmbeddedSignup: async ({ business, redirectUri }: { business: Id; redirectUri?: string }) => {
    const { data } = await apiClient.post<WhatsAppEmbeddedSignupStartResponse>("/api/business-connectors/whatsapp-embedded-signup/start/", {
      business,
      redirect_uri: redirectUri,
    });
    return data;
  },
  completeWhatsAppEmbeddedSignup: async (payload: WhatsAppEmbeddedSignupCompletePayload) => {
    const { data } = await apiClient.post<{ ok: boolean; channel_id: Id; connector: BusinessConnector }>("/api/business-connectors/whatsapp-embedded-signup/complete/", payload);
    return data;
  },
  startInstagramOAuth: async ({ business, redirectUri }: { business: Id; redirectUri?: string }) => {
    const { data } = await apiClient.post<InstagramOAuthStartResponse>("/api/business-connectors/instagram-oauth/start/", {
      business,
      redirect_uri: redirectUri,
    });
    return data;
  },
  completeInstagramOAuth: async (payload: InstagramOAuthCompletePayload) => {
    const { data } = await apiClient.post<{ ok: boolean; channel_id: Id; connector: BusinessConnector }>("/api/business-connectors/instagram-oauth/complete/", payload);
    return data;
  },
};

export const connectorCredentialsApi = createCrudApi<ConnectorCredential, ConnectorCredentialPayload, Partial<ConnectorCredentialPayload>>("/api/connector-credentials/");
export const businessEventsApi = createCrudApi<BusinessEvent>("/api/business-events/");
export const connectorSyncRunsApi = {
  ...createCrudApi<ConnectorSyncRun>("/api/connector-sync-runs/"),
  retry: async (id: Id) => {
    const { data } = await apiClient.post<{
      ok: boolean;
      mock: boolean;
      reason: string;
      events: BusinessEvent[];
      sync_run: ConnectorSyncRun;
    }>(`/api/connector-sync-runs/${id}/retry/`);
    return data;
  },
};
