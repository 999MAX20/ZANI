import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Deal, Id, Pipeline, PipelineStage } from "../types";

export const pipelinesApi = createCrudApi<Pipeline>("/api/pipelines/");
export const pipelineStagesApi = createCrudApi<PipelineStage>("/api/pipeline-stages/");

export const dealsApi = {
  ...createCrudApi<Deal>("/api/deals/"),
  moveStage: async ({ id, stage, lost_reason }: { id: Id; stage: Id; lost_reason?: string }) => {
    const { data } = await apiClient.post<Deal>(`/api/deals/${id}/move-stage/`, { stage, lost_reason });
    return data;
  },
  markWon: async ({ id, amount }: { id: Id; amount?: string | number }) => {
    const { data } = await apiClient.post<Deal>(`/api/deals/${id}/mark-won/`, amount !== undefined ? { amount } : {});
    return data;
  },
  markLost: async ({ id, lost_reason }: { id: Id; lost_reason: string }) => {
    const { data } = await apiClient.post<Deal>(`/api/deals/${id}/mark-lost/`, { lost_reason });
    return data;
  },
  reopen: async ({ id }: { id: Id }) => {
    const { data } = await apiClient.post<Deal>(`/api/deals/${id}/reopen/`, {});
    return data;
  },
};
