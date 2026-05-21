import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Id, Task, TaskComment } from "../types";

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
  reopen: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/reopen/`);
    return data;
  },
  snooze: async ({ id, snoozed_until }: { id: Id; snoozed_until: string }) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/snooze/`, { snoozed_until });
    return data;
  },
  assign: async ({ id, user_id }: { id: Id; user_id?: Id }) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/assign/`, user_id ? { user_id } : {});
    return data;
  },
  addWatcher: async ({ id, user_id }: { id: Id; user_id?: Id }) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/add-watcher/`, user_id ? { user_id } : {});
    return data;
  },
  addComment: async ({ id, text }: { id: Id; text: string }) => {
    const { data } = await apiClient.post<TaskComment>(`/api/tasks/${id}/add-comment/`, { text });
    return data;
  },
  comments: async (id: Id) => {
    const { data } = await apiClient.get<TaskComment[]>(`/api/tasks/${id}/comments/`);
    return data;
  },
};
