import { apiClient, type PaginatedResponse } from "./client";
import { createCrudApi } from "./crud";
import type { Id, Resource } from "../types";

export type ResourceListParams = {
  business?: Id;
  search?: string;
  resource_type?: Resource["resource_type"] | "";
  status?: "active" | "inactive" | "";
  page?: number;
  page_size?: number;
};

export type ResourceListSummary = {
  active: number;
  staff: number;
  with_individual_schedule: number;
};

export type ResourceListResponse = PaginatedResponse<Resource> & {
  summary?: ResourceListSummary;
};

const resourceCrudApi = createCrudApi<Resource>("/api/resources/");

export const resourcesApi = {
  ...resourceCrudApi,
  listPage: async (params?: ResourceListParams) => {
    const { data } = await apiClient.get<Resource[] | ResourceListResponse>("/api/resources/", { params });
    if (Array.isArray(data)) {
      return {
        count: data.length,
        next: null,
        previous: null,
        results: data,
      } satisfies ResourceListResponse;
    }
    return data;
  },
  options: async () => {
    const { data } = await apiClient.get<Resource[]>("/api/resources/options/");
    return data;
  },
};
