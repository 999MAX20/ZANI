import { createCrudApi } from "./crud";
import { apiClient, unwrapList } from "./client";
import type { Client, DuplicateCheckResponse, Id } from "../types";

export const clientsApi = {
  ...createCrudApi<Client>("/api/clients/"),
  listFiltered: async (params: { q?: string; source?: string; tag?: Id | string; segment?: Id | string }) => {
    const { data } = await apiClient.get<Client[] | { results: Client[] }>("/api/clients/", { params });
    return unwrapList(data);
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
};
