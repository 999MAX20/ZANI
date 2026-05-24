import { createCrudApi } from "./crud";
import { apiClient } from "./client";
import type { Appointment, Deal, Id, Lead, LeadDuplicateCheckResponse, Note } from "../types";

export const leadsApi = {
  ...createCrudApi<Lead>("/api/leads/"),
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
};
