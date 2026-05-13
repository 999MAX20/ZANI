import { createCrudApi } from "./crud";
import type { WorkingHours } from "../types";

export const workingHoursApi = createCrudApi<WorkingHours>("/api/working-hours/");
