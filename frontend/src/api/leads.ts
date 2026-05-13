import { createCrudApi } from "./crud";
import { apiClient } from "./client";
import type { Appointment, Id, Lead } from "../types";

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
};
