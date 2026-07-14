import { apiClient, unwrapList } from "./client";
import type { PaginatedResponse } from "./client";
import { createCrudApi } from "./crud";
import type { Id, OutreachCampaign, OutreachConsent, OutreachRecipient, OutreachTemplate } from "../types";

export type OutreachAudiencePreview = {
  count: number;
  clients: Array<{
    id: Id;
    full_name: string;
    phone: string;
    telegram_id: string;
    whatsapp_id: string;
    recipient_id: string;
    eligible: boolean;
    suppression_reason: string;
  }>;
  eligible_count: number;
  suppressed_count: number;
};

export type OutreachCampaignStats = {
  campaign_id: Id;
  status: OutreachCampaign["status"];
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  delivery_rate: number;
  failure_rate: number;
  suppression_rate: number;
  retryable_failed: number;
  errors: Array<{ code: string; count: number; label: string }>;
};

export type OutreachLaunchChecklist = {
  can_launch: boolean;
  status: OutreachCampaign["status"];
  stats: OutreachCampaignStats;
  checks: Array<{ key: string; label: string; ok: boolean }>;
};

export type AppointmentAutomationStatus = {
  business: Id;
  enabled: boolean;
  total_pending: number;
  total_failed: number;
  failed_notifications: Array<{
    id: Id;
    label: string;
    channel: string;
    client_name: string;
    client_phone: string;
    appointment_id: Id | null;
    send_at: string;
    action_url: string;
  }>;
  scenarios: Array<{
    key: string;
    label: string;
    trigger: string;
    description: string;
    enabled: boolean;
    channel_policy: string;
    counts: {
      pending: number;
      sent: number;
      failed: number;
      cancelled: number;
    };
  }>;
};

export const outreachTemplatesApi = {
  ...createCrudApi<OutreachTemplate>("/api/outreach/templates/"),
};

export const outreachCampaignsApi = {
  ...createCrudApi<OutreachCampaign>("/api/outreach/campaigns/"),
  previewAudience: async (id: Id) => {
    const { data } = await apiClient.get<OutreachAudiencePreview>(`/api/outreach/campaigns/${id}/preview-audience/`);
    return data;
  },
  prepare: async ({ id, clientIds }: { id: Id; clientIds?: Id[] }) => {
    const { data } = await apiClient.post<{ campaign: OutreachCampaign; created: number; total: number; skipped: number }>(
      `/api/outreach/campaigns/${id}/prepare/`,
      { client_ids: clientIds || [] },
    );
    return data;
  },
  launch: async (id: Id) => {
    const { data } = await apiClient.post<{ campaign: OutreachCampaign; notifications: number; send_at: string }>(`/api/outreach/campaigns/${id}/launch/`);
    return data;
  },
  refreshStatus: async (id: Id) => {
    const { data } = await apiClient.post<{ campaign: OutreachCampaign; counts: Record<string, number> }>(`/api/outreach/campaigns/${id}/refresh-status/`);
    return data;
  },
  stats: async (id: Id) => {
    const { data } = await apiClient.get<OutreachCampaignStats>(`/api/outreach/campaigns/${id}/stats/`);
    return data;
  },
  launchChecklist: async (id: Id) => {
    const { data } = await apiClient.get<OutreachLaunchChecklist>(`/api/outreach/campaigns/${id}/launch-checklist/`);
    return data;
  },
  appointmentAutomationStatus: async (business?: Id) => {
    const { data } = await apiClient.get<AppointmentAutomationStatus>("/api/outreach/campaigns/appointment-automation-status/", {
      params: business ? { business } : undefined,
    });
    return data;
  },
  retryFailed: async ({ id, retryableOnly = false, delayMinutes = 0 }: { id: Id; retryableOnly?: boolean; delayMinutes?: number }) => {
    const { data } = await apiClient.post<{ campaign: OutreachCampaign; queued: number; skipped_non_retryable: number }>(`/api/outreach/campaigns/${id}/retry-failed/`, {
      retryable_only: retryableOnly,
      delay_minutes: delayMinutes,
    });
    return data;
  },
  cancel: async (id: Id) => {
    const { data } = await apiClient.post<OutreachCampaign>(`/api/outreach/campaigns/${id}/cancel/`);
    return data;
  },
};

export const outreachRecipientsApi = {
  ...createCrudApi<OutreachRecipient>("/api/outreach/recipients/"),
  listByCampaign: async (campaignId: Id) => {
    const { data } = await apiClient.get<OutreachRecipient[] | PaginatedResponse<OutreachRecipient>>(`/api/outreach/recipients/?campaign=${campaignId}`);
    return unwrapList(data);
  },
};

export const outreachConsentsApi = {
  ...createCrudApi<OutreachConsent>("/api/outreach/consents/"),
  bulkImport: async (payload: {
    business: Id;
    channel: "telegram" | "whatsapp";
    status: "opted_in" | "opted_out" | "unknown";
    source?: string;
    rows: Array<{ client?: Id; client_id?: Id; phone?: string; email?: string; note?: string }>;
  }) => {
    const { data } = await apiClient.post<{ imported: number; skipped: Array<Record<string, unknown>> }>("/api/outreach/consents/bulk-import/", payload);
    return data;
  },
  bulkImportFile: async (payload: {
    business: Id;
    channel: "telegram" | "whatsapp";
    status: "opted_in" | "opted_out" | "unknown";
    source?: string;
    file: File;
  }) => {
    const formData = new FormData();
    formData.append("business", String(payload.business));
    formData.append("channel", payload.channel);
    formData.append("status", payload.status);
    formData.append("source", payload.source || "file_import");
    formData.append("file", payload.file);
    const { data } = await apiClient.post<{ imported: number; skipped: Array<Record<string, unknown>>; total_rows: number }>("/api/outreach/consents/bulk-import-file/", formData);
    return data;
  },
};
