import { useMemo } from "react";

import { useAuth } from "../../auth/AuthProvider";
import type { DealDataContext, DealFiltersState, DealMetricsModel, DealRow, Translate } from "../types";
import { dealRisk, nextOpenTask } from "../utils/dealHelpers";
import type { Client, PipelineStage, Task, TeamMember } from "../../../types";

export function useDealMetrics(data: DealDataContext, filters: DealFiltersState, t: Translate) {
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
        const risk = deal.risk_level && deal.risk_percent !== undefined
          ? { riskLevel: deal.risk_level, riskPercent: deal.risk_percent }
          : dealRisk(deal, tasks);
        const clientEntity = data.clientMap.get(deal.client) || (deal.client_name ? {
          id: deal.client,
          business: deal.business,
          full_name: deal.client_name,
          phone: deal.client_phone || "",
          email: deal.client_email || "",
          whatsapp_id: "",
          telegram_id: "",
          instagram_id: "",
          source: "manual",
          source_detail: "",
          source_context_json: {},
          notes: "",
          created_at: deal.created_at,
          updated_at: deal.updated_at,
        } satisfies Client : undefined);
        const stageEntity = data.stageMap.get(deal.stage) || (deal.stage_name ? {
          id: deal.stage,
          business: deal.business,
          pipeline: deal.pipeline,
          name: deal.stage_name,
          order: deal.stage_order || 0,
          color: deal.stage_color || "#2563eb",
          probability: deal.stage_probability || deal.probability || 0,
          sla_minutes: null,
          is_won: Boolean(deal.stage_is_won),
          is_lost: Boolean(deal.stage_is_lost),
          created_at: deal.created_at,
          updated_at: deal.updated_at,
        } satisfies PipelineStage : undefined);
        const ownerEntity = deal.owner ? ownerMap.get(deal.owner) || (deal.owner_name || deal.owner_email ? {
          id: deal.owner,
          business: deal.business,
          user: {
            id: deal.owner,
            email: deal.owner_email || "",
            full_name: deal.owner_name || deal.owner_email || "",
          },
          role: "manager",
          business_role: null,
          is_active: true,
          created_at: deal.created_at,
          updated_at: deal.updated_at,
        } as TeamMember : undefined) : undefined;
        const nextTask = nextOpenTask(tasks) || (deal.next_task_id && deal.next_task_title ? {
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
        } satisfies Task : undefined);
        return {
          ...deal,
          clientEntity,
          stageEntity,
          ownerEntity,
          nextTask,
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
        const risk = deal.risk_level && deal.risk_percent !== undefined
          ? { riskLevel: deal.risk_level, riskPercent: deal.risk_percent }
          : dealRisk(deal, tasks);
        return { ...deal, clientEntity: data.clientMap.get(deal.client), stageEntity: data.stageMap.get(deal.stage), nextTask: nextOpenTask(tasks), ...risk };
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
        { value: "all", label: t("deals.allStages"), count: pipelineRows.length },
        ...activeStages.map((stage) => ({ value: String(stage.id), label: stage.name, count: pipelineRows.filter((deal) => deal.stage === stage.id).length })),
      ],
      quickFilters: [
        { value: "all", label: t("deals.allStages"), count: pipelineRows.length },
        { value: "mine", label: t("deals.filterMine"), count: pipelineRows.filter((deal) => user?.id && deal.owner === user.id).length },
        { value: "hot", label: t("deals.hot"), count: staleDeals.length },
        { value: "overdue", label: t("deals.overdue"), count: overdueDeals.length },
        { value: "no_tasks", label: t("deals.noTasksFilter"), count: noTaskDeals.length },
      ],
      priorityDeal: staleDeals[0] || null,
    };
  }, [activePipeline, activeStages, data, t, user?.id]);

  return { activePipeline, activeStages, rows, metrics: model };
}
