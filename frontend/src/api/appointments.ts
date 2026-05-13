import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Appointment, AvailableSlot, Id } from "../types";

export const appointmentsApi = {
  ...createCrudApi<Appointment>("/api/appointments/"),
  availableSlots: async (params: {
    business_id: Id;
    service_id: Id;
    date: string;
    resource_id?: Id | "";
  }) => {
    const { data } = await apiClient.get<AvailableSlot[]>("/api/appointments/available-slots/", { params });
    return data;
  },
};
