import { createCrudApi } from "./crud";
import type { ActivityEvent } from "../types";

export const activityEventsApi = createCrudApi<ActivityEvent>("/api/activity-events/");

