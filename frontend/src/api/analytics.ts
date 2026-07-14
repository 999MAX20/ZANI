import { createCrudApi } from "./crud";
import { apiClient } from "./client";
import type { AnalyticsEvent, AnalyticsReportSummary, Id, OwnerDashboardMetrics, ReportWidget, ScheduledReport, TeamPerformanceMetrics } from "../types";

export const analyticsApi = {
  ...createCrudApi<AnalyticsEvent>("/api/analytics-events/"),
  widgets: createCrudApi<ReportWidget>("/api/report-widgets/"),
  scheduledReports: createCrudApi<ScheduledReport>("/api/scheduled-reports/"),
  ownerDashboard: async (business?: Id) => {
    const { data } = await apiClient.get<OwnerDashboardMetrics>("/api/analytics/owner-dashboard/", {
      params: business ? { business } : undefined,
    });
    return data;
  },
  teamPerformance: async (business?: Id) => {
    const { data } = await apiClient.get<TeamPerformanceMetrics>("/api/team/performance/", {
      params: business ? { business } : undefined,
    });
    return data;
  },
  reportSummary: async (business?: Id) => {
    const { data } = await apiClient.get<AnalyticsReportSummary>("/api/analytics/reports/summary/", {
      params: business ? { business } : undefined,
    });
    return data;
  },
  exportReport: async ({ business, report }: { business?: Id; report: "source_roi" | "funnel_velocity" | "manager_performance" | "retention_ltv" }) => {
    const { data } = await apiClient.get<Blob>("/api/analytics/reports/export/", {
      params: business ? { business, report } : { report },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  },
};
