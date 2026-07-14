import { createCrudApi } from "./crud";
import { apiClient } from "./client";
import type { PaginatedResponse } from "./client";
import type { Appointment, Client, Deal, Id, Lead, LeadDuplicateCheckResponse, LeadSummary, Note, Task } from "../types";

export type LeadListParams = {
  page?: number;
  page_size?: number;
  search?: string;
  status?: Lead["status"] | Lead["status"][];
  statuses?: Lead["status"] | Lead["status"][];
  source?: string;
  responsible_user?: Id;
  unassigned?: boolean;
  mine?: boolean;
  attention?: boolean;
  created_from?: string;
  created_to?: string;
  ordering?: string;
  client_ids?: Id[] | string;
};

export type LeadCreatePayload = Omit<
  Partial<Lead>,
  "id" | "status" | "previous_status" | "lost_reason" | "lost_at" | "lost_by" | "is_archived" | "archive_reason" | "archived_at" | "archived_by" | "created_at" | "updated_at"
>;

export type LeadUpdatePayload = Omit<
  Partial<Lead>,
  "id" | "business" | "client" | "service" | "source" | "status" | "previous_status" | "lost_reason" | "lost_at" | "lost_by" | "is_archived" | "archive_reason" | "archived_at" | "archived_by" | "created_at" | "updated_at"
>;

export const leadsApi = {
  ...createCrudApi<Lead, LeadCreatePayload, LeadUpdatePayload>("/api/leads/"),
  listPaginated: async (params?: LeadListParams) => {
    const { data } = await apiClient.get<PaginatedResponse<Lead>>("/api/leads/", { params });
    return data;
  },
  summary: async () => {
    const { data } = await apiClient.get<LeadSummary>("/api/leads/summary/");
    return data;
  },
  createAppointment: async ({
    leadId,
    payload,
  }: {
    leadId: Id;
    payload: { service: Id; resource?: Id | null; start_at: string };
  }) => {
    const { data } = await apiClient.post<Appointment>(`/api/leads/${leadId}/create-appointment/`, payload);
    return data;
  },
  createTask: async ({
    leadId,
    payload,
  }: {
    leadId: Id;
    payload: { title: string; description?: string; priority?: string; due_at?: string | null; assignee?: Id | null };
  }) => {
    const { data } = await apiClient.post<Task>(`/api/leads/${leadId}/create-task/`, payload);
    return data;
  },
  checkDuplicates: async (payload: { business: Id; client?: Id; phone?: string; email?: string }) => {
    const { data } = await apiClient.post<LeadDuplicateCheckResponse>("/api/leads/check-duplicates/", payload);
    return data;
  },
  assign: async ({ id, user_id }: { id: Id; user_id?: Id }) => {
    const { data } = await apiClient.post<Lead>(`/api/leads/${id}/assign/`, user_id ? { user_id } : {});
    return data;
  },
  addNote: async ({ id, text }: { id: Id; text: string }) => {
    const { data } = await apiClient.post<Note>(`/api/leads/${id}/add-note/`, { text });
    return data;
  },

  takeInWork: async ({ id }: { id: Id }) => {
    const { data } = await apiClient.post<Lead>(`/api/leads/${id}/take-in-work/`, {});
    return data;
  },
  markContacted: async ({ id }: { id: Id }) => {
    const { data } = await apiClient.post<Lead>(`/api/leads/${id}/mark-contacted/`, {});
    return data;
  },
  markClosed: async ({ id }: { id: Id }) => {
    const { data } = await apiClient.post<Lead>(`/api/leads/${id}/mark-closed/`, {});
    return data;
  },
  markLost: async ({ id, lost_reason }: { id: Id; lost_reason: string }) => {
    const { data } = await apiClient.post<Lead>(`/api/leads/${id}/mark-lost/`, { lost_reason });
    return data;
  },
  reopen: async ({ id }: { id: Id }) => {
    const { data } = await apiClient.post<Lead>(`/api/leads/${id}/reopen/`, {});
    return data;
  },
  createDeal: async ({ id, amount, title }: { id: Id; amount?: string; title?: string }) => {
    const { data } = await apiClient.post<Deal>(`/api/leads/${id}/create-deal/`, { amount, title });
    return data;
  },
  convertToClient: async ({ id }: { id: Id }) => {
    const { data } = await apiClient.post<Client>(`/api/leads/${id}/convert-client/`, {});
    return data;
  },
};
