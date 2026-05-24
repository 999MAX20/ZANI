import { apiClient } from "./client";
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

export const businessConnectorsApi = {
  ...createCrudApi<BusinessConnector, BusinessConnectorPayload, Partial<BusinessConnectorPayload>>("/api/business-connectors/"),
  capabilities: async () => {
    const { data } = await apiClient.get<ConnectorCapability[]>("/api/business-connectors/capabilities/");
    return data;
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
};

export const connectorCredentialsApi = createCrudApi<ConnectorCredential, ConnectorCredentialPayload, Partial<ConnectorCredentialPayload>>("/api/connector-credentials/");
export const businessEventsApi = createCrudApi<BusinessEvent>("/api/business-events/");
export const connectorSyncRunsApi = createCrudApi<ConnectorSyncRun>("/api/connector-sync-runs/");
