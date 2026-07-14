import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { dealsApi, type DealListParams } from "../../../api/deals";
import { teamApi } from "../../../api/team";
import { useActiveBusiness } from "../../../hooks/useBusiness";
import { useEntityData } from "../../../hooks/useEntityData";
import type { ActivityEvent, BotConversation, Id, Lead, Task } from "../../../types";
import type { DealFiltersState } from "../types";

export function useDeals(filters?: DealFiltersState) {
  const { business } = useActiveBusiness();
  const [boardLimit, setBoardLimit] = useState(25);
  const entityData = useEntityData({
    clients: true,
    pipelines: true,
    pipelineStages: true,
  });
  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
    retry: false,
  });

  const defaultPipeline = entityData.pipelines.data?.find((pipeline) => pipeline.is_default) || entityData.pipelines.data?.[0];
  const activePipeline = Number(filters?.pipelineId || defaultPipeline?.id || 0);
  const listParams = useMemo<DealListParams>(() => {
    const params: DealListParams = {
      pipeline: activePipeline || undefined,
      page_size: 100,
      ordering: "-updated_at",
    };
    if (!filters) return params;
    if (filters.stageFilter !== "all") params.stage = filters.stageFilter;
    if (filters.statusFilter !== "all") params.status = filters.statusFilter;
    if (filters.ownerFilter) params.owner = filters.ownerFilter;
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.quickFilter !== "all") params.quick = filters.quickFilter;
    if (filters.sourceFilter) params.source = filters.sourceFilter;
    if (filters.minAmount) params.amount_min = filters.minAmount;
    if (filters.maxAmount) params.amount_max = filters.maxAmount;
    if (filters.dateFrom) params.created_from = filters.dateFrom;
    if (filters.dateTo) params.created_to = filters.dateTo;
    return params;
  }, [activePipeline, filters]);

  const deals = useQuery({
    queryKey: ["deals", "paginated", business?.id, listParams],
    queryFn: () => dealsApi.listPaginated(listParams),
    enabled: Boolean(business && activePipeline),
    retry: false,
  });

  const board = useQuery({
    queryKey: ["deals", "board", business?.id, listParams, boardLimit],
    queryFn: () => dealsApi.board({ ...listParams, limit_per_stage: boardLimit }),
    enabled: Boolean(business && activePipeline),
    retry: false,
  });

  const summary = useQuery({
    queryKey: ["deals", "summary", business?.id, listParams],
    queryFn: () => dealsApi.summary(listParams),
    enabled: Boolean(business && activePipeline),
    retry: false,
  });

  const clientMap = useMemo(() => new Map((entityData.clients.data || []).map((client) => [client.id, client])), [entityData.clients.data]);
  const stageMap = useMemo(() => new Map((entityData.pipelineStages.data || []).map((stage) => [stage.id, stage])), [entityData.pipelineStages.data]);
  const boardDeals = useMemo(() => board.data?.stages.flatMap((stage) => stage.deals) || [], [board.data?.stages]);
  const boardHasMoreByStage = useMemo(() => new Map((board.data?.stages || []).map((stage) => [String(stage.id), stage.has_more])), [board.data?.stages]);
  const displayDeals = boardDeals.length ? boardDeals : deals.data?.results || [];

  const tasksByDeal = useMemo(() => {
    const map = new Map<Id, Task[]>();
    displayDeals.forEach((deal) => {
      if (!deal.next_task_id || !deal.next_task_title) return;
      map.set(deal.id, [
        {
          id: deal.next_task_id,
          business: deal.business,
          title: deal.next_task_title,
          description: "",
          client: deal.client,
          lead: deal.lead,
          deal: deal.id,
          appointment: null,
          conversation: null,
          parent_task: null,
          assignee: deal.owner,
          created_by: null,
          watchers: [],
          due_at: deal.next_task_due_at || null,
          reminder_at: null,
          snoozed_until: null,
          priority: deal.next_task_priority || "normal",
          status: "open",
          recurrence_rule: "",
          completed_at: null,
          completed_by: null,
          created_at: deal.updated_at,
          updated_at: deal.updated_at,
        },
      ]);
    });
    return map;
  }, [displayDeals]);

  const isLoading =
    entityData.clients.isLoading ||
    entityData.pipelines.isLoading ||
    entityData.pipelineStages.isLoading ||
    deals.isLoading ||
    board.isLoading;

  return {
    business,
    queries: entityData,
    teamMembers,
    activePipeline,
    listParams,
    deals,
    board,
    boardHasMoreByStage,
    boardIsFetchingMore: board.isFetching && !board.isLoading,
    loadMoreBoardDeals: () => setBoardLimit((value) => value + 25),
    summary,
    data: {
      clients: entityData.clients.data || [],
      leads: [] as Lead[],
      pipelines: entityData.pipelines.data || [],
      stages: entityData.pipelineStages.data || [],
      deals: displayDeals,
      tasks: Array.from(tasksByDeal.values()).flat(),
      activityEvents: [] as ActivityEvent[],
      conversations: [] as BotConversation[],
      teamMembers: teamMembers.data || [],
      clientMap,
      stageMap,
      tasksByDeal,
    },
    isLoading,
  };
}
