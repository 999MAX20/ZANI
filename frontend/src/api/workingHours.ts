import { createCrudApi } from "./crud";
import type { WorkingHours, ScheduleException } from "../types";
import { apiClient } from "./client";
import type { Id } from "../types";

export type WorkingHoursPreset = "weekdays_9_18" | "daily_9_20" | "mon_sat_9_18";
const exceptionCrudApi = createCrudApi<ScheduleException>("/api/schedule-exceptions/");
export const scheduleExceptionsApi = { ...exceptionCrudApi, list: exceptionCrudApi.listAll };
const hoursCrudApi = createCrudApi<WorkingHours>("/api/working-hours/");

export const workingHoursApi = {
  ...hoursCrudApi,
  list: hoursCrudApi.listAll,
  bulkUpsertWeek: async (payload: {
    business: Id;
    resource?: Id | null;
    days: Array<Pick<WorkingHours, "weekday" | "start_time" | "end_time" | "is_day_off">>;
  }) => {
    const { data } = await apiClient.post<{ count: number; results: WorkingHours[] }>(
      "/api/working-hours/bulk-upsert-week/",
      payload,
    );
    return data;
  },
  applyPreset: async (payload: { business: Id; preset: WorkingHoursPreset; resource?: Id | "" }) => {
    const { data } = await apiClient.post<{ preset: WorkingHoursPreset; count: number; results: WorkingHours[] }>(
      "/api/working-hours/apply-preset/",
      payload,
    );
    return data;
  },
};
