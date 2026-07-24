import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Appointment, AppointmentMessageSetting, AvailableSlot, Id, Note } from "../types";

export type AppointmentCreatePayload = Omit<
  Partial<Appointment>,
  "id" | "status" | "is_archived" | "archive_reason" | "archived_at" | "archived_by" | "created_at" | "updated_at"
>;

export type AppointmentUpdatePayload = Omit<
  Partial<Appointment>,
  "id" | "business" | "client" | "lead" | "service" | "resource" | "start_at" | "end_at" | "status" | "is_archived" | "archive_reason" | "archived_at" | "archived_by" | "created_at" | "updated_at"
>;

export type AppointmentReschedulePayload = {
  start_at: string;
  resource?: Id | null;
  reason?: string;
};

export type AppointmentStatusReasonPayload = {
  reason: string;
};

export type AppointmentListParams = {
  business?: Id;
  start_from?: string;
  start_to?: string;
  service?: Id | "";
  resource?: Id | "";
  status?: Appointment["status"] | "";
  client_ids?: Id[] | string;
  lead_ids?: Id[] | string;
  page?: number;
  page_size?: number;
};

export const appointmentsApi = {
  ...createCrudApi<Appointment, AppointmentCreatePayload, AppointmentUpdatePayload>("/api/appointments/"),
  list: async (params?: AppointmentListParams) => {
    const { data } = await apiClient.get<Appointment[] | { results: Appointment[] }>("/api/appointments/", { params });
    return Array.isArray(data) ? data : data.results;
  },
  confirm: async (id: Id) => {
    const { data } = await apiClient.post<Appointment>(`/api/appointments/${id}/confirm/`);
    return data;
  },
  cancel: async (id: Id, payload: AppointmentStatusReasonPayload) => {
    const { data } = await apiClient.post<Appointment>(`/api/appointments/${id}/cancel/`, payload);
    return data;
  },
  complete: async (id: Id) => {
    const { data } = await apiClient.post<Appointment>(`/api/appointments/${id}/complete/`);
    return data;
  },
  noShow: async (id: Id, payload: AppointmentStatusReasonPayload) => {
    const { data } = await apiClient.post<Appointment>(`/api/appointments/${id}/no-show/`, payload);
    return data;
  },
  addNote: async ({ id, text }: { id: Id; text: string }) => {
    const { data } = await apiClient.post<Note>(`/api/appointments/${id}/add-note/`, { text });
    return data;
  },
  reschedule: async ({ id, payload }: { id: Id; payload: AppointmentReschedulePayload }) => {
    const { data } = await apiClient.post<Appointment>(`/api/appointments/${id}/reschedule/`, payload);
    return data;
  },
  availableSlots: async (params: {
    business_id: Id;
    service_id: Id;
    date: string;
    resource_id?: Id | "";
    exclude_appointment_id?: Id;
  }) => {
    const { data } = await apiClient.get<AvailableSlot[]>("/api/appointments/available-slots/", { params });
    return data;
  },
};

export const appointmentMessageSettingsApi = {
  ...createCrudApi<AppointmentMessageSetting>("/api/appointment-message-settings/"),
  list: async (params?: { business?: Id }) => {
    const { data } = await apiClient.get<AppointmentMessageSetting[]>("/api/appointment-message-settings/", { params });
    return data;
  },
};
