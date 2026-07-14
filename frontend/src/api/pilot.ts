import { apiClient } from "./client";

export type PilotReadinessStatus = "ready" | "needs_attention" | "missing";

export type PilotReadinessItem = {
  key: string;
  title: string;
  description: string;
  is_ready: boolean;
  status: PilotReadinessStatus;
  count: number | null;
  href: string;
};

export type PilotReadiness = {
  business: {
    id: number;
    name: string;
    slug: string;
    status: string;
  } | null;
  score: number;
  ready_count: number;
  total_count: number;
  critical_missing: string[];
  items: PilotReadinessItem[];
  next_actions: string[];
};

export const pilotApi = {
  readiness: async () => {
    const { data } = await apiClient.get<PilotReadiness>("/api/pilot/readiness/");
    return data;
  },
};
