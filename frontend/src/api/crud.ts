import type { QueryFunctionContext } from "@tanstack/react-query";

import { apiClient, unwrapList } from "./client";
import type { PaginatedResponse } from "./client";
import type { Id } from "../types";

type QueryParams = Record<string, Id | string | number | boolean | string[] | Id[] | null | undefined>;
type ListParams = QueryParams | QueryFunctionContext;

function isQueryFunctionContext(params: ListParams | undefined): params is QueryFunctionContext {
  return Boolean(params && typeof params === "object" && "queryKey" in params && "signal" in params);
}

export function createCrudApi<T, C = Partial<T>, U = Partial<T>>(endpoint: string) {
  return {
    list: async (params?: ListParams) => {
      const cleanParams = isQueryFunctionContext(params) ? undefined : params;
      const { data } = await apiClient.get<T[] | PaginatedResponse<T>>(endpoint, { params: cleanParams });
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
