import { createCrudApi } from "./crud";
import { apiClient, unwrapList } from "./client";
import type { Client, DuplicateCheckResponse, Id } from "../types";

export type ClientListSummary = {
  total: number;
  active: number;
  no_reply: number;
  repeat: number;
};

export type ClientListFacets = {
  source?: Record<string, number>;
  activity?: {
    active: number;
    vip: number;
    no_reply: number;
    repeat: number;
  };
};

type ClientListFilterParams = {
  q?: string;
  source?: string;
  tag?: Id | string;
  segment?: Id | string;
  quick_filter?: "all" | "new" | "vip" | "no_reply" | "mine";
  page?: number;
  page_size?: number;
  client_ids?: string | number[];
};

export type ClientListResult = {
  clients: Client[];
  count: number;
  next: string | null;
  previous: string | null;
  summary?: ClientListSummary;
  facets?: ClientListFacets;
};

export type ClientMergeDryRun = {
  target_client_id: Id;
  duplicate: Pick<Client, "id" | "full_name" | "phone" | "email" | "whatsapp_id" | "telegram_id" | "instagram_id">;
  transferred: Record<
    | "leads"
    | "appointments"
    | "conversations"
    | "bot_conversations"
    | "tasks"
    | "deals"
    | "notes"
    | "activity_events"
    | "analytics_events"
    | "notifications"
    | "tags"
    | "attachments"
    | "custom_field_values",
    number
  >;
  will_delete_duplicate: boolean;
  policy: "hard_delete_duplicate_after_transfer" | string;
};

export const clientsApi = {
  ...createCrudApi<Client>("/api/clients/"),
  listFiltered: async (params: ClientListFilterParams): Promise<ClientListResult> => {
    const payload = params.client_ids
      ? {
          ...params,
          client_ids: Array.isArray(params.client_ids) ? params.client_ids.join(",") : params.client_ids,
        }
      : params;

    const { data } = await apiClient.get<Client[] | { results: Client[]; count?: number; next?: string | null; previous?: string | null; summary?: ClientListSummary; facets?: ClientListFacets }>("/api/clients/", {
      params: payload,
    });
    const clients = unwrapList(data);
    const metadata = data as {
      count?: number;
      next?: string | null;
      previous?: string | null;
      summary?: ClientListSummary;
      facets?: ClientListFacets;
    };

    return {
      clients,
      count: metadata.count ?? clients.length,
      next: metadata.next ?? null,
      previous: metadata.previous ?? null,
      summary: metadata.summary || undefined,
      facets: metadata.facets || undefined,
    };
  },
  checkDuplicates: async (payload: {
    business: Id;
    phone?: string;
    email?: string;
    whatsapp_id?: string;
    telegram_id?: string;
    instagram_id?: string;
    exclude_client_id?: Id;
  }) => {
    const { data } = await apiClient.post<DuplicateCheckResponse>("/api/clients/check-duplicates/", payload);
    return data;
  },
  merge: async ({ id, duplicate_client_id }: { id: Id; duplicate_client_id: Id }) => {
    const { data } = await apiClient.post(`/api/clients/${id}/merge/`, { duplicate_client_id });
    return data;
  },
  mergeDryRun: async ({ id, duplicate_client_id }: { id: Id; duplicate_client_id: Id }) => {
    const { data } = await apiClient.post<ClientMergeDryRun>(`/api/clients/${id}/merge-dry-run/`, { duplicate_client_id });
    return data;
  },
};
