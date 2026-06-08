import { useMemo } from "react";

import { useAuth } from "../../auth/AuthProvider";
import type { DealDataContext, DealFiltersState, DealMetricsModel, DealRow } from "../types";
import { dealRisk, nextOpenTask } from "../utils/dealHelpers";

export function useDealMetrics(data: DealDataContext, filters: DealFiltersState) {
  const { user } = useAuth();
  const activePipeline = Number(
    filters.pipelineId || data.pipelines.find((pipeline) => pipeline.is_default)?.id || data.pipelines[0]?.id || 0,
  );
  const activeStages = useMemo(
    () => data.stages.filter((stage) => stage.pipeline === activePipeline).sort((a, b) => a.order - b.order),
    [activePipeline, data.stages],
  );

  const rows = useMemo<DealRow[]>(() => {
    const searchValue = filters.search.trim().toLowerCase();
    const ownerMap = new Map(data.teamMembers.map((member) => [member.user.id, member]));
    return data.deals
      .filter((deal) => deal.pipeline === activePipeline)
      .map((deal) => {
        const tasks = data.tasksByDeal.get(deal.id) || [];
        const risk = dealRisk(deal, tasks);
        return {
          ...deal,
          clientEntity: data.clientMap.get(deal.client),
          stageEntity: data.stageMap.get(deal.stage),
          ownerEntity: deal.owner ? ownerMap.get(deal.owner) : undefined,
          nextTask: nextOpenTask(tasks),
          ...risk,
        };
      })
      .filter((deal) => {
        const searchable = [deal.title, deal.source, deal.clientEntity?.full_name, deal.clientEntity?.phone, deal.clientEntity?.email].join(" ").toLowerCase();
        const amount = Number(deal.amount || 0);
        const created = new Date(deal.created_at).getTime();
        return (
          (filters.statusFilter === "all" || deal.status === filters.statusFilter) &&
          (!filters.ownerFilter || String(deal.owner || "") === filters.ownerFilter) &&
          (filters.stageFilter === "all" || String(deal.stage) === filters.stageFilter) &&
          (!filters.sourceFilter || deal.source === filters.sourceFilter) &&
          (!filters.minAmount || amount >= Number(filters.minAmount)) &&
          (!filters.maxAmount || amount <= Number(filters.maxAmount)) &&
          (!filters.dateFrom || created >= new Date(filters.dateFrom).getTime()) &&
          (!filters.dateTo || created <= new Date(filters.dateTo).getTime() + 86_399_999) &&
          (!searchValue || searchable.includes(searchValue)) &&
          (filters.quickFilter === "all" ||
            (filters.quickFilter === "mine" && Boolean(user?.id && deal.owner === user.id)) ||
            (filters.quickFilter === "hot" && deal.riskPercent >= 60) ||
            (filters.quickFilter === "overdue" && Boolean(deal.sla_overdue)) ||
            (filters.quickFilter === "no_tasks" && deal.status === "open" && !deal.nextTask && !deal.next_action_at))
        );
      });
  }, [activePipeline, data, filters, user?.id]);

  const model = useMemo<DealMetricsModel>(() => {
    const pipelineRows = data.deals
      .filter((deal) => deal.pipeline === activePipeline)
      .map((deal) => {
        const tasks = data.tasksByDeal.get(deal.id) || [];
        return { ...deal, clientEntity: data.clientMap.get(deal.client), stageEntity: data.stageMap.get(deal.stage), nextTask: nextOpenTask(tasks), ...dealRisk(deal, tasks) };
      });
    const openDeals = pipelineRows.filter((deal) => deal.status === "open");
    const wonDeals = pipelineRows.filter((deal) => deal.status === "won");
    const lostDeals = pipelineRows.filter((deal) => deal.status === "lost");
    const overdueDeals = openDeals.filter((deal) => deal.sla_overdue);
    const noTaskDeals = openDeals.filter((deal) => !deal.nextTask && !deal.next_action_at);
    const staleDeals = openDeals.filter((deal) => deal.riskPercent >= 60);
    return {
      pipelineValue: openDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0),
      openDeals,
      wonDeals,
      lostDeals,
      overdueDeals,
      noTaskDeals,
      staleDeals,
      stageOptions: [
        { value: "all", label: "Все стадии", count: pipelineRows.length },
        ...activeStages.map((stage) => ({ value: String(stage.id), label: stage.name, count: pipelineRows.filter((deal) => deal.stage === stage.id).length })),
      ],
      quickFilters: [
        { value: "all", label: "Все стадии", count: pipelineRows.length },
        { value: "mine", label: "Мои сделки", count: pipelineRows.filter((deal) => user?.id && deal.owner === user.id).length },
        { value: "hot", label: "Горячие", count: staleDeals.length },
        { value: "overdue", label: "Просрочено", count: overdueDeals.length },
        { value: "no_tasks", label: "Без задач", count: noTaskDeals.length },
      ],
      priorityDeal: staleDeals[0] || null,
    };
  }, [activePipeline, activeStages, data, user?.id]);

  return { activePipeline, activeStages, rows, metrics: model };
}
