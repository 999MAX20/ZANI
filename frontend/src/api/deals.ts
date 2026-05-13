import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { Deal, Id, Pipeline, PipelineStage } from "../types";

export const pipelinesApi = createCrudApi<Pipeline>("/api/pipelines/");
export const pipelineStagesApi = createCrudApi<PipelineStage>("/api/pipeline-stages/");

export const dealsApi = {
  ...createCrudApi<Deal>("/api/deals/"),
  moveStage: async ({ id, stage }: { id: Id; stage: Id }) => {
    const { data } = await apiClient.post<Deal>(`/api/deals/${id}/move-stage/`, { stage });
    return data;
  },
};

