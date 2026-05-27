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
};

export const connectorCredentialsApi = createCrudApi<ConnectorCredential, ConnectorCredentialPayload, Partial<ConnectorCredentialPayload>>("/api/connector-credentials/");
export const businessEventsApi = createCrudApi<BusinessEvent>("/api/business-events/");
export const connectorSyncRunsApi = createCrudApi<ConnectorSyncRun>("/api/connector-sync-runs/");
