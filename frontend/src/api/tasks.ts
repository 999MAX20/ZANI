import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Id, Task } from "../types";

export const tasksApi = {
  ...createCrudApi<Task>("/api/tasks/"),
  complete: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/complete/`);
    return data;
  },
  start: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/start/`);
    return data;
  },
  cancel: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/cancel/`);
    return data;
  },
};
