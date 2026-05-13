import { apiClient } from "./client";
import type { Id } from "../types";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function unwrapList<T>(data: T[] | PaginatedResponse<T>) {
  return Array.isArray(data) ? data : data.results;
}

export function createCrudApi<T, C = Partial<T>, U = Partial<T>>(endpoint: string) {
  return {
    list: async () => {
      const { data } = await apiClient.get<T[] | PaginatedResponse<T>>(endpoint);
      return unwrapList(data);
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
  };
}
