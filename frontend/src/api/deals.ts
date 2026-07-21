import { apiClient } from "./client";
import { createCrudApi } from "./crud";
import type { PaginatedResponse } from "./client";
import type { Deal, DealBoard, DealSummary, Id, Pipeline, PipelineStage } from "../types";

export type DealListParams = {
  page?: number;
  page_size?: number;
  pipeline?: Id | string;
  stage?: Id | string;
  status?: Deal["status"] | Deal["status"][] | "all";
  statuses?: Deal["status"] | Deal["status"][];
  owner?: Id | string;
  source?: string;
  search?: string;
  amount_min?: string | number;
  amount_max?: string | number;
  created_from?: string;
  created_to?: string;
  expected_close_from?: string;
  expected_close_to?: string;
  quick?: "mine" | "hot" | "overdue" | "no_tasks" | "all";
  mine?: boolean;
  unassigned?: boolean;
  ordering?: string;
  client_ids?: Id[] | string;
  lead_ids?: Id[] | string;
};

export type DealBoardParams = DealListParams & {
  limit_per_stage?: number;
  offset?: number;
};

export type DealCreatePayload = Omit<
  Partial<Deal>,
  | "id"
  | "status"
  | "probability"
  | "lost_reason"
  | "lost_by"
  | "previous_status"
  | "previous_stage"
  | "won_at"
  | "lost_at"
  | "stage_entered_at"
  | "is_archived"
  | "archive_reason"
  | "archived_at"
  | "archived_by"
  | "created_at"
  | "updated_at"
>;

export type DealUpdatePayload = Omit<
  Partial<Deal>,
  | "id"
  | "business"
  | "client"
  | "lead"
  | "pipeline"
  | "stage"
  | "status"
  | "probability"
  | "lost_reason"
  | "lost_by"
  | "previous_status"
  | "previous_stage"
  | "won_at"
  | "lost_at"
  | "stage_entered_at"
  | "is_archived"
  | "archive_reason"
  | "archived_at"
  | "archived_by"
  | "created_at"
  | "updated_at"
>;

export const pipelinesApi = createCrudApi<Pipeline>("/api/pipelines/");
export const pipelineStagesApi = createCrudApi<PipelineStage>("/api/pipeline-stages/");

export const dealsApi = {
  ...createCrudApi<Deal, DealCreatePayload, DealUpdatePayload>("/api/deals/"),
  listPaginated: async (params?: DealListParams) => {
    const { data } = await apiClient.get<PaginatedResponse<Deal>>("/api/deals/", { params });
    return data;
  },
  summary: async (params?: DealListParams) => {
    const { data } = await apiClient.get<DealSummary>("/api/deals/summary/", { params });
    return data;
  },
  board: async (params?: DealBoardParams) => {
    const { data } = await apiClient.get<DealBoard>("/api/deals/board/", { params });
    return data;
  },
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
