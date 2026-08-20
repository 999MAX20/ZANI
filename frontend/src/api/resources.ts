import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Resource } from "../types";

export const resourcesApi = {
  ...createCrudApi<Resource>("/api/resources/"),
  options: async () => {
    const { data } = await apiClient.get<Resource[]>("/api/resources/options/");
    return data;
  },
};
