import { createCrudApi } from "./crud";
import type { AnalyticsEvent } from "../types";

export const analyticsApi = createCrudApi<AnalyticsEvent>("/api/analytics-events/");
