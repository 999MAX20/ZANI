import { apiClient, unwrapList } from "./client";
import type { PaginatedResponse } from "./client";
import type { Id } from "../types";

export function createCrudApi<T, C = Partial<T>, U = Partial<T>>(endpoint: string) {
  return {
    list: async () => {
      const { data } = await apiClient.get<T[] | PaginatedResponse<T>>(endpoint);
      return unwrapList<T>(data);
    },
    get: async (id: Id) => {
      const { data } = await apiClient.get<T>(`${endpoint}${id}/`);
      return data;
    },
    create: async (payload: C) => {
      const { data } = await apiClient.post<T>(endpoint, payload);
      return data;
    },
    update: async ({ id, payload }: { id: Id; payload: U }) => {
      const { data } = await apiClient.patch<T>(`${endpoint}${id}/`, payload);
      return data;
    },
    remove: async (id: Id) => {
      await apiClient.delete(`${endpoint}${id}/`);
    },
    archive: async ({ id, reason }: { id: Id; reason: string }) => {
      const { data } = await apiClient.post<T>(`${endpoint}${id}/archive/`, { reason });
      return data;
    },
    restore: async (id: Id) => {
      const { data } = await apiClient.post<T>(`${endpoint}${id}/restore/`);
      return data;
    },
  };
}
