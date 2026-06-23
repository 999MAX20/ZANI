import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { PaginatedResponse } from "./client";
import type { Id, Task, TaskComment } from "../types";

export type TaskListParams = {
  tab?: "my" | "today" | "overdue" | string;
  status?: Task["status"] | "active" | string;
  bucket?: string;
  priority?: Task["priority"] | string;
  assignee?: Id | "unassigned" | string;
  search?: string;
  due?: "past" | "today" | "none" | "future" | string;
  relation?: "client" | "lead" | "deal" | "appointment" | "none" | string;
  due_from?: string;
  due_to?: string;
  page?: number;
  ordering?: "smart" | "priority" | "-priority" | "due_at" | "-due_at" | "updated_at" | "-updated_at" | "created_at" | "-created_at" | string;
};

export type TaskSummary = {
  overdue: number;
  today: number;
  later: number;
  noDue: number;
  unassigned: number;
  inProgress: number;
  open: number;
  closed: number;
};

export type TaskCreatePayload = Omit<
  Partial<Task>,
  | "id"
  | "status"
  | "created_by"
  | "watchers"
  | "snoozed_until"
  | "completed_at"
  | "completed_by"
  | "cancelled_at"
  | "cancelled_by"
  | "cancel_reason"
  | "is_archived"
  | "archive_reason"
  | "archived_at"
  | "archived_by"
  | "created_at"
  | "updated_at"
>;

export type TaskUpdatePayload = Omit<
  Partial<Task>,
  | "id"
  | "business"
  | "status"
  | "assignee"
  | "created_by"
  | "watchers"
  | "snoozed_until"
  | "completed_at"
  | "completed_by"
  | "cancelled_at"
  | "cancelled_by"
  | "cancel_reason"
  | "is_archived"
  | "archive_reason"
  | "archived_at"
  | "archived_by"
  | "created_at"
  | "updated_at"
>;

export type TaskDetailsUpdatePayload = Omit<TaskUpdatePayload, "assignee"> & {
  assignee?: Id | null;
};

export const tasksApi = {
  ...createCrudApi<Task, TaskCreatePayload, TaskUpdatePayload>("/api/tasks/"),
  listPage: async (params?: TaskListParams) => {
    const { data } = await apiClient.get<PaginatedResponse<Task>>("/api/tasks/", { params });
    return data;
  },
  summary: async (params?: TaskListParams) => {
    const { data } = await apiClient.get<TaskSummary>("/api/tasks/summary/", { params });
    return data;
  },
  updateDetails: async ({ id, payload }: { id: Id; payload: TaskDetailsUpdatePayload }) => {
    const { data } = await apiClient.patch<Task>(`/api/tasks/${id}/update-details/`, payload);
    return data;
  },
  complete: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/complete/`);
    return data;
  },
  start: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/start/`);
    return data;
  },
  cancel: async ({ id, reason }: { id: Id; reason: string }) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/cancel/`, { reason });
    return data;
  },
  undoCancel: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/undo-cancel/`, {});
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
  assignToMe: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/assign-to-me/`, {});
    return data;
  },
  dueToday: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/due-today/`, {});
    return data;
  },
  dueTomorrow: async (id: Id) => {
    const { data } = await apiClient.post<Task>(`/api/tasks/${id}/due-tomorrow/`, {});
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
  deleteComment: async ({ id, commentId }: { id: Id; commentId: Id }) => {
    await apiClient.delete(`/api/tasks/${id}/comments/${commentId}/`);
  },
  comments: async (id: Id) => {
    const { data } = await apiClient.get<TaskComment[]>(`/api/tasks/${id}/comments/`);
    return data;
  },
};
