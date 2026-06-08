import type { ActivityEvent, BotConversation, Client, Deal, Id, Lead, Pipeline, PipelineStage, Task, TeamMember } from "../../../types";
import type { useI18n } from "../../../lib/i18n";

export type Translate = ReturnType<typeof useI18n>["t"];
export type DealStatusFilter = "open" | "won" | "lost" | "all";
export type DealQuickFilter = "all" | "mine" | "hot" | "overdue" | "no_tasks";
export type DealViewMode = "list" | "kanban" | "table";
export type DealSortKey = "updated" | "amount" | "priority";
export type DealDetailTab = "overview" | "activities" | "history";
export type DealActionFlow = { type: "won" | "lost"; deal: Deal } | null;

export type DealFiltersState = {
  pipelineId: string;
  stageFilter: string;
  statusFilter: DealStatusFilter;
  ownerFilter: string;
  search: string;
  quickFilter: DealQuickFilter;
  sourceFilter: string;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
  expanded: boolean;
};

export type DealRow = Deal & {
  clientEntity?: Client;
  stageEntity?: PipelineStage;
  ownerEntity?: TeamMember;
  nextTask?: Task;
  riskLevel: "low" | "medium" | "high";
  riskPercent: number;
};

export type DealDataContext = {
  clients: Client[];
  leads: Lead[];
  pipelines: Pipeline[];
  stages: PipelineStage[];
  deals: Deal[];
  tasks: Task[];
  activityEvents: ActivityEvent[];
  conversations: BotConversation[];
  teamMembers: TeamMember[];
  clientMap: Map<Id, Client>;
  stageMap: Map<Id, PipelineStage>;
  tasksByDeal: Map<Id, Task[]>;
};

export type DealMetricsModel = {
  pipelineValue: number;
  openDeals: DealRow[];
  wonDeals: DealRow[];
  lostDeals: DealRow[];
  overdueDeals: DealRow[];
  noTaskDeals: DealRow[];
  staleDeals: DealRow[];
  stageOptions: Array<{ value: string; label: string; count: number }>;
  quickFilters: Array<{ value: DealQuickFilter; label: string; count: number }>;
  priorityDeal: DealRow | null;
};

export type DealCreateForm = {
  title: string;
  client: string;
  pipeline: string;
  stage: string;
  amount: string;
  source: string;
};
