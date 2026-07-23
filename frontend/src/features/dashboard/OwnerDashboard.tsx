import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  ListChecks,
  MessageSquareText,
  PlugZap,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type {
  AIAssistantStatusResponse,
  AIOwnerDailyBriefResponse,
} from "../../api/ai";
import type {
  WorkQueueAppointmentItem,
  WorkQueueConversationItem,
  WorkQueueDealItem,
  WorkQueueLeadItem,
  WorkQueueTaskItem,
  WorkQueuesResponse,
} from "../../api/workQueues";
import { Surface } from "../../components/ui/Card";
import { IconBubble, MetricTile } from "../../components/ui/Primitives";
import { EmptyState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type {
  Appointment,
  Client,
  Lead,
  OwnerDashboardMetrics,
  Service,
  Task,
} from "../../types";
import { formatMoney } from "./dashboardUtils";

type OwnerDashboardProps = {
  dashboard?: OwnerDashboardMetrics;
  metricsError: unknown;
  isCoreDataLoading: boolean;
  revenue: number;
  revenueHasData: boolean;
  newLeadsCount: number;
  todayAppointmentsCount: number;
  conversion: number;
  openTasks: number;
  overdueTasks: number;
  setupScore: number;
  leads: Lead[];
  clients: Client[];
  appointments: Appointment[];
  services: Service[];
  tasks: Task[];
  workQueues?: WorkQueuesResponse;
  ownerBrief?: AIOwnerDailyBriefResponse;
  ownerBriefError?: unknown;
  isOwnerBriefLoading?: boolean;
  canViewAiAnalyst: boolean;
  aiStatus?: AIAssistantStatusResponse;
};

type AttentionItem = {
  key: string;
  title: string;
  text: string;
  count: number;
  href: string;
  icon: LucideIcon;
  tone: "brand" | "amber" | "red" | "ai";
};

type BriefItem = {
  key: string;
  title: string;
  text: string;
  href: string;
  action: string;
  tone: "brand" | "amber" | "red" | "ai";
  sourceIds?: string[];
};

function initials(value?: string | null) {
  const source = (value || "ZANI").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function toneDot(tone: AttentionItem["tone"]) {
  if (tone === "red") return "bg-zani-danger";
  if (tone === "amber") return "bg-zani-warning";
  if (tone === "ai") return "bg-ai-600";
  return "bg-brand-600";
}

function RevenueStateCard({
  revenue,
  revenueHasData,
  dashboard,
}: {
  revenue: number;
  revenueHasData: boolean;
  dashboard?: OwnerDashboardMetrics;
}) {
  const { t } = useI18n();
  const revenueToday = Number(dashboard?.revenue?.today || revenue || 0);
  const revenueYesterday = Number(dashboard?.revenue?.yesterday || 0);
  const growth = dashboard?.revenue?.growth_percent;
  const hasExactRevenue = Boolean(dashboard?.revenue?.today);

  return (
    <Surface as="section" padding="lg" className="min-h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
            {t("dashboard.revenue")}
          </p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-zani-text sm:text-4xl">
            {revenueHasData
              ? formatMoney(revenueToday || revenue)
              : t("dashboard.revenueMissingValue")}
          </p>
        </div>
        <IconBubble
          icon={CircleDollarSign}
          tone="brand"
          className="h-11 w-11 rounded-control"
        />
      </div>
      <p className="mt-4 text-sm leading-6 text-zani-subtle">
        {revenueHasData
          ? hasExactRevenue
            ? t("dashboard.revenueExactText")
            : t("dashboard.revenueEstimateText")
          : t("dashboard.revenueMissingHint")}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-control bg-surface-muted p-3">
          <p className="text-xs font-semibold text-zani-faint">
            {t("dashboard.yesterday")}
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-zani-text">
            {revenueYesterday
              ? formatMoney(revenueYesterday)
              : t("dashboard.revenueMissingValue")}
          </p>
        </div>
        <div className="rounded-control bg-surface-muted p-3">
          <p className="text-xs font-semibold text-zani-faint">
            {t("dashboard.toYesterday")}
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-zani-text">
            {typeof growth === "number"
              ? `${growth}%`
              : t("dashboard.revenueMissingValue")}
          </p>
        </div>
      </div>
    </Surface>
  );
}

function AttentionList({ items }: { items: AttentionItem[] }) {
  const { t } = useI18n();
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <Surface as="section" padding="lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
            {t("dashboard.ownerUrgentActions")}
          </p>
          <h2 className="mt-1 text-base font-bold text-zani-text">
            {t("dashboard.attention")}
          </h2>
        </div>
        <span className="grid min-h-8 min-w-8 place-items-center rounded-full bg-surface-muted px-2 text-xs font-bold tabular-nums text-zani-text">
          {total}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              to={item.href}
              className="flex min-h-[4.25rem] items-center gap-3 rounded-control border border-zani-border bg-surface-card p-3 transition hover:border-brand-100 hover:bg-surface-warm"
            >
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toneDot(item.tone)}`}
              />
              <Icon className="shrink-0 text-zani-subtle" size={18} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-zani-text">
                  {item.title}
                </span>
                <span className="block truncate text-xs font-semibold text-zani-subtle">
                  {item.text}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-zani-text">
                {item.count}
              </span>
              <ArrowRight size={16} className="shrink-0 text-zani-faint" />
            </Link>
          );
        })}
      </div>
    </Surface>
  );
}

function AiBriefCard({ items, meta }: { items: BriefItem[]; meta: string }) {
  const { t } = useI18n();

  return (
    <Surface as="section" variant="ai" padding="lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ai-700">
            {t("dashboard.aiBrief.eyebrow")}
          </p>
          <h2 className="mt-1 text-base font-bold text-zani-text">
            {t("dashboard.aiBrief.title")}
          </h2>
        </div>
        <span className="rounded-full bg-surface-card px-2.5 py-1 text-[11px] font-bold text-zani-subtle">
          {meta}
        </span>
      </div>
      <p className="mb-4 text-sm leading-6 text-zani-subtle">
        {t("dashboard.aiBrief.source")}
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-control border border-ai-100 bg-surface-card p-3"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 rounded-full ${toneDot(item.tone)}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-zani-text">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-zani-subtle">
                  {item.text}
                </p>
                {item.sourceIds?.length ? (
                  <p className="mt-2 rounded-control bg-surface-muted px-2 py-1 text-[11px] font-bold text-zani-subtle">
                    {t("dashboard.ownerBriefSourceIds", {
                      ids: item.sourceIds.join(", "),
                    })}
                  </p>
                ) : null}
              </div>
            </div>
            <Link
              to={item.href}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-control px-3 text-xs font-bold text-ai-700 transition hover:bg-ai-50"
            >
              {item.action}
              <ArrowRight size={14} />
            </Link>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function QueuePreview({
  title,
  href,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  href: string;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const isEmpty = Array.isArray(children) && children.length === 0;

  return (
    <Surface as="section" padding="lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-zani-text">{title}</h2>
        <Link to={href} className="text-sm font-bold text-brand-700">
          {t("common.all")}
        </Link>
      </div>
      {isEmpty ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </Surface>
  );
}

function LeadRow({
  lead,
  client,
  service,
}: {
  lead: Lead | WorkQueueLeadItem;
  client?: Client;
  service?: Service;
}) {
  const { t } = useI18n();
  const title = "title" in lead ? lead.title : client?.full_name;
  const source = "source" in lead ? lead.source : "";

  return (
    <Link
      to={`/app/leads/${lead.id}`}
      className="flex items-center gap-3 rounded-control border border-zani-border bg-surface-card p-3 transition hover:border-brand-100 hover:bg-surface-warm"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
        {initials(title || client?.full_name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-zani-text">
          {title || t("dashboard.leadNumber", { id: lead.id })}
        </span>
        <span className="block truncate text-xs font-semibold text-zani-subtle">
          {service?.name || source || t("dashboard.noMessage")}
        </span>
      </span>
      <StatusBadge status={lead.status} size="sm" />
    </Link>
  );
}

function AppointmentRow({
  appointment,
  client,
  service,
}: {
  appointment: Appointment | WorkQueueAppointmentItem;
  client?: Client;
  service?: Service;
}) {
  const { t } = useI18n();
  const title = "title" in appointment ? appointment.title : client?.full_name;

  return (
    <Link
      to={`/app/calendar/${appointment.id}`}
      className="flex items-center gap-3 rounded-control border border-zani-border bg-surface-card p-3 transition hover:border-brand-100 hover:bg-surface-warm"
    >
      <IconBubble
        icon={CalendarCheck}
        tone="brand"
        className="h-10 w-10 rounded-control"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-zani-text">
          {title || t("common.client")}
        </span>
        <span className="block truncate text-xs font-semibold text-zani-subtle">
          {service?.name || t("common.service")} /{" "}
          {formatDateTime(appointment.start_at)}
        </span>
      </span>
      <StatusBadge status={appointment.status} size="sm" />
    </Link>
  );
}

function TaskRow({ task }: { task: Task | WorkQueueTaskItem }) {
  const { t } = useI18n();
  const href = "href" in task ? task.href : `/app/tasks/${task.id}`;
  const escalationLevel =
    "escalation_level" in task ? task.escalation_level : null;

  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-control border border-zani-border bg-surface-card p-3 transition hover:border-brand-100 hover:bg-surface-warm"
    >
      <IconBubble
        icon={ListChecks}
        tone="amber"
        className="h-10 w-10 rounded-control"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-zani-text">
          {task.title}
        </span>
        <span className="block truncate text-xs font-semibold text-zani-subtle">
          {task.due_at ? formatDateTime(task.due_at) : t("dashboard.noDueDate")}
        </span>
      </span>
      {escalationLevel ? (
        <StatusBadge status={escalationLevel} size="sm" />
      ) : null}
    </Link>
  );
}

function ConnectorHealthCard({
  dashboard,
  communicationsReady,
  salesReady,
}: {
  dashboard?: OwnerDashboardMetrics;
  communicationsReady: boolean;
  salesReady: boolean;
}) {
  const { t } = useI18n();
  const health = dashboard?.connector_health;
  const rows = [
    {
      key: "communications",
      label: t("dashboard.channels"),
      ready: communicationsReady,
      href: "/app/integrations",
    },
    {
      key: "sales",
      label: t("dashboard.dataSources"),
      ready: salesReady,
      href: "/app/integrations",
    },
    {
      key: "health",
      label: t("dashboard.connectorHealth"),
      ready: !health || health.error === 0,
      href: "/app/integrations",
    },
  ];

  return (
    <Surface as="section" padding="lg">
      <div className="mb-4 flex items-center gap-2">
        <PlugZap size={20} className="text-brand-600" />
        <h2 className="text-base font-bold text-zani-text">
          {t("dashboard.connections")}
        </h2>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <Link
            key={row.key}
            to={row.href}
            className="flex items-center justify-between gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2.5 transition hover:border-brand-100 hover:bg-surface-warm"
          >
            <span className="truncate text-sm font-bold text-zani-text">
              {row.label}
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-zani-subtle">
              <span
                className={`h-2 w-2 rounded-full ${row.ready ? "bg-zani-success" : "bg-zani-warning"}`}
              />
              {row.ready
                ? t("dashboard.statusConnected")
                : t("dashboard.statusConnect")}
            </span>
          </Link>
        ))}
      </div>
      {health ? (
        <p className="mt-4 rounded-control bg-surface-muted px-3 py-2 text-xs font-semibold text-zani-subtle">
          {t("dashboard.connectionReadiness", {
            score: health.total
              ? Math.round((health.connected / health.total) * 100)
              : 0,
          })}
        </p>
      ) : null}
    </Surface>
  );
}

function buildBriefItems({
  ownerBrief,
  ownerBriefError,
  isOwnerBriefLoading,
  canViewAiAnalyst,
  aiStatus,
  overdueTasks,
  newLeadsCount,
  todayAppointmentsCount,
  revenueHasData,
  setupScore,
  t,
}: {
  ownerBrief?: AIOwnerDailyBriefResponse;
  ownerBriefError?: unknown;
  isOwnerBriefLoading?: boolean;
  canViewAiAnalyst: boolean;
  aiStatus?: AIAssistantStatusResponse;
  overdueTasks: number;
  newLeadsCount: number;
  todayAppointmentsCount: number;
  revenueHasData: boolean;
  setupScore: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}): BriefItem[] {
  const recommendations =
    ownerBrief?.recommendations.slice(0, 4).map((recommendation) => ({
      key: recommendation.id,
      title: recommendation.label,
      text: recommendation.description,
      href: recommendation.href,
      action: t("dashboard.openPrioritySource"),
      tone:
        recommendation.priority === "high"
          ? ("red" as const)
          : recommendation.priority === "medium"
            ? ("amber" as const)
            : ("ai" as const),
      sourceIds: recommendation.source_ids,
    })) || [];
  if (recommendations.length) return recommendations;
  if (ownerBrief?.summary.no_data) {
    return [
      {
        key: "owner-brief-no-data",
        title: t("dashboard.ownerBriefNoDataTitle"),
        text:
          ownerBrief.summary.no_data_reason ||
          t("dashboard.ownerBriefNoDataText"),
        href: "/app/integrations",
        action: t("dashboard.aiBrief.missingAction"),
        tone: "ai",
      },
    ];
  }
  if (isOwnerBriefLoading) {
    return [
      {
        key: "owner-brief-loading",
        title: t("dashboard.ownerBriefLoadingTitle"),
        text: t("dashboard.ownerBriefLoadingText"),
        href: "/app/ai-assistant",
        action: t("dashboard.openAiAnalyst"),
        tone: "ai",
      },
    ];
  }
  if (!canViewAiAnalyst) {
    return [
      {
        key: "owner-brief-forbidden",
        title: t("dashboard.ownerBriefNoAccessTitle"),
        text: t("dashboard.ownerBriefNoAccessText"),
        href: "/app/settings",
        action: t("dashboard.openTeamSettings"),
        tone: "amber",
      },
    ];
  }
  if (ownerBriefError || (aiStatus && !aiStatus.ready)) {
    return [
      {
        key: "owner-brief-unavailable",
        title: t("dashboard.ownerBriefUnavailableTitle"),
        text: t("dashboard.ownerBriefUnavailableText"),
        href: "/app/ai-assistant",
        action: t("dashboard.openAiAnalyst"),
        tone: "amber",
      },
    ];
  }
  if (overdueTasks > 0) {
    return [
      {
        key: "overdue-tasks",
        title: t("dashboard.aiBrief.overdueTitle"),
        text: t("dashboard.aiBrief.overdueText", { count: overdueTasks }),
        href: "/app/tasks",
        action: t("dashboard.aiBrief.openTasks"),
        tone: "red",
      },
    ];
  }
  if (newLeadsCount > 0) {
    return [
      {
        key: "new-leads",
        title: t("dashboard.aiBrief.leadsTitle"),
        text: t("dashboard.aiBrief.leadsText", { count: newLeadsCount }),
        href: "/app/leads",
        action: t("dashboard.aiBrief.openLeads"),
        tone: "brand",
      },
    ];
  }
  if (todayAppointmentsCount > 0) {
    return [
      {
        key: "today-bookings",
        title: t("dashboard.aiBrief.bookingsTitle"),
        text: t("dashboard.aiBrief.bookingsText", {
          count: todayAppointmentsCount,
        }),
        href: "/app/calendar",
        action: t("dashboard.aiBrief.openCalendar"),
        tone: "brand",
      },
    ];
  }
  if (!revenueHasData) {
    return [
      {
        key: "sales-data",
        title: t("dashboard.aiBrief.salesTitle"),
        text: t("dashboard.aiBrief.salesText"),
        href: "/app/integrations",
        action: t("dashboard.aiBrief.connectSales"),
        tone: "amber",
      },
    ];
  }
  if (setupScore < 100) {
    return [
      {
        key: "setup",
        title: t("dashboard.aiBrief.setupTitle"),
        text: t("dashboard.aiBrief.setupText", { progress: setupScore }),
        href: "/app/settings",
        action: t("dashboard.aiBrief.openSetup"),
        tone: "amber",
      },
    ];
  }
  return [
    {
      key: "no-priority",
      title: t("dashboard.aiBrief.missingTitle"),
      text: t("dashboard.aiBrief.missingText"),
      href: "/app/analytics",
      action: t("dashboard.openAnalytics"),
      tone: "ai",
    },
  ];
}

export function OwnerDashboard({
  dashboard,
  metricsError,
  isCoreDataLoading,
  revenue,
  revenueHasData,
  newLeadsCount,
  todayAppointmentsCount,
  conversion,
  openTasks,
  overdueTasks,
  setupScore,
  leads,
  clients,
  appointments,
  services,
  tasks,
  workQueues,
  ownerBrief,
  ownerBriefError,
  isOwnerBriefLoading,
  canViewAiAnalyst,
  aiStatus,
}: OwnerDashboardProps) {
  const { t } = useI18n();
  const activeLeads = leads.filter((lead) =>
    ["new", "contacted", "in_progress"].includes(lead.status),
  );
  const visibleLeads =
    workQueues?.queues.stale_leads.slice(0, 4) || activeLeads.slice(0, 4);
  const visibleAppointments = workQueues
    ? [
        ...workQueues.queues.appointment_confirmations,
        ...workQueues.queues.upcoming_appointments,
      ].slice(0, 4)
    : appointments.slice(0, 4);
  const visibleTasks =
    workQueues?.queues.overdue_tasks.slice(0, 4) ||
    tasks
      .filter((task) => task.status !== "done" && task.status !== "cancelled")
      .slice(0, 4);
  const visibleConversations: WorkQueueConversationItem[] = [
    ...(workQueues?.queues.unread_sla_overdue_conversations || []),
    ...(workQueues?.queues.handoff_sla_overdue_conversations || []),
    ...(workQueues?.queues.unread_conversations || []),
    ...(workQueues?.queues.handoff_conversations || []),
  ].slice(0, 4);
  const staleDeals: WorkQueueDealItem[] = [
    ...(workQueues?.queues.sla_overdue_deals || []),
    ...(workQueues?.queues.no_next_action_deals || []),
  ].slice(0, 4);
  const communicationsReady = Boolean(
    dashboard?.setup?.sources?.communications,
  );
  const salesReady = Boolean(
    dashboard?.setup?.sources?.sales_data || revenueHasData,
  );
  const noAnswerCount = workQueues
    ? workQueues.summary.unread_conversations +
      workQueues.summary.handoff_conversations +
      workQueues.summary.unread_sla_overdue_conversations +
      workQueues.summary.handoff_sla_overdue_conversations
    : 0;
  const attentionItems: AttentionItem[] = [
    {
      key: "leads",
      title: t("dashboard.answerNewLeads"),
      text: t("dashboard.newLeadsWaiting", { count: newLeadsCount }),
      count: newLeadsCount,
      href: "/app/leads",
      icon: UserPlus,
      tone: "brand",
    },
    {
      key: "tasks",
      title: t("dashboard.closeOverdue"),
      text: t("dashboard.overdueTasksCount", { count: overdueTasks }),
      count: overdueTasks,
      href: "/app/tasks",
      icon: AlertTriangle,
      tone: overdueTasks ? "red" : "amber",
    },
    {
      key: "conversations",
      title: t("dashboard.managerNoAnswer"),
      text: t("dashboard.managerNoAnswerText", { count: noAnswerCount }),
      count: noAnswerCount,
      href: "/app/conversations",
      icon: MessageSquareText,
      tone: noAnswerCount ? "red" : "brand",
    },
    {
      key: "deals",
      title: t("dashboard.staleDeals"),
      text: t("dashboard.staleDealsText", { count: staleDeals.length }),
      count: staleDeals.length,
      href: "/app/deals",
      icon: CircleDollarSign,
      tone: staleDeals.length ? "amber" : "brand",
    },
  ];
  const providerMode =
    aiStatus?.mode === "live"
      ? t("aiAssistant.modeLive")
      : t("aiAssistant.modeMock");
  const briefMeta = isOwnerBriefLoading
    ? t("common.loading")
    : ownerBrief
      ? t("dashboard.ownerBriefSources", {
          count: ownerBrief.summary.source_count,
        })
      : aiStatus
        ? t("dashboard.aiProviderStatus", {
            provider: aiStatus.provider,
            mode: providerMode,
          })
        : t("aiAssistant.providerChecking");
  const briefItems = buildBriefItems({
    ownerBrief,
    ownerBriefError,
    isOwnerBriefLoading,
    canViewAiAnalyst,
    aiStatus,
    overdueTasks,
    newLeadsCount,
    todayAppointmentsCount,
    revenueHasData,
    setupScore,
    t,
  });

  return (
    <div className="space-y-5 pb-8">
      {isCoreDataLoading ? (
        <Surface
          className="border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700"
          padding="none"
        >
          {t("dashboard.loadingCoreData")}
        </Surface>
      ) : null}
      {metricsError ? (
        <Surface
          className="border-[rgba(151,90,22,0.24)] bg-[var(--zani-warning-soft)] px-4 py-3 text-sm font-semibold text-zani-warning"
          padding="none"
        >
          {t("dashboard.ownerAnalyticsError")}
        </Surface>
      ) : null}
      {ownerBriefError ? (
        <Surface
          className="border-[rgba(151,90,22,0.24)] bg-[var(--zani-warning-soft)] px-4 py-3 text-sm font-semibold text-zani-warning"
          padding="none"
        >
          {t("dashboard.ownerBriefError")}
        </Surface>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <RevenueStateCard
          revenue={revenue}
          revenueHasData={revenueHasData}
          dashboard={dashboard}
        />
        <AttentionList items={attentionItems} />
      </section>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          label={t("dashboard.newLeadsShort")}
          value={newLeadsCount}
          hint={t("dashboard.needProcess")}
          icon={UserPlus}
          tone="brand"
          className="shadow-soft"
        />
        <MetricTile
          label={t("dashboard.todayBookings")}
          value={todayAppointmentsCount}
          hint={t("common.today")}
          icon={CalendarCheck}
          tone="green"
          className="shadow-soft"
        />
        <MetricTile
          label={t("dashboard.openTasks")}
          value={openTasks}
          hint={
            overdueTasks
              ? t("dashboard.overdueTasksCount", { count: overdueTasks })
              : t("dashboard.openFollowups")
          }
          icon={ListChecks}
          tone={overdueTasks ? "amber" : "slate"}
          className="shadow-soft"
        />
        <MetricTile
          label={t("dashboard.conversion")}
          value={`${conversion}%`}
          hint={t("dashboard.leadToBooking")}
          icon={CheckCircle2}
          tone="green"
          className="shadow-soft"
        />
        <MetricTile
          label={t("dashboard.setupScore")}
          value={`${setupScore}%`}
          hint={t("dashboard.businessReadiness")}
          icon={PlugZap}
          tone={setupScore >= 80 ? "green" : "amber"}
          className="shadow-soft"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <AiBriefCard items={briefItems} meta={briefMeta} />
        <ConnectorHealthCard
          dashboard={dashboard}
          communicationsReady={communicationsReady}
          salesReady={salesReady}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <QueuePreview
          title={t("dashboard.latestLeads")}
          href="/app/leads"
          emptyTitle={t("dashboard.noLeads")}
          emptyDescription={t("dashboard.noLeadsText")}
        >
          {visibleLeads.map((lead) => {
            const client =
              "client_id" in lead
                ? clients.find((item) => item.id === lead.client_id)
                : clients.find((item) => item.id === lead.client);
            const service =
              "service" in lead
                ? services.find((item) => item.id === lead.service)
                : undefined;
            return (
              <LeadRow
                key={lead.id}
                lead={lead}
                client={client}
                service={service}
              />
            );
          })}
        </QueuePreview>

        <QueuePreview
          title={t("dashboard.upcomingBookings")}
          href="/app/calendar"
          emptyTitle={t("dashboard.noBookings")}
          emptyDescription={t("dashboard.noBookingsText")}
        >
          {visibleAppointments.map((appointment) => {
            const client = clients.find((item) =>
              "client_id" in appointment
                ? item.id === appointment.client_id
                : item.id === appointment.client,
            );
            const service = services.find((item) =>
              "service_id" in appointment
                ? item.id === appointment.service_id
                : item.id === appointment.service,
            );
            return (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                client={client}
                service={service}
              />
            );
          })}
        </QueuePreview>

        <QueuePreview
          title={t("dashboard.myTasks")}
          href="/app/tasks"
          emptyTitle={t("dashboard.noOpenTasks")}
          emptyDescription={t("dashboard.noOpenTasksText")}
        >
          {visibleTasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </QueuePreview>
      </section>

      {visibleConversations.length || staleDeals.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Surface as="section" padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquareText size={20} className="text-brand-600" />
              <h2 className="text-base font-bold text-zani-text">
                {t("dashboard.managerNoAnswer")}
              </h2>
            </div>
            <div className="space-y-2">
              {visibleConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  to={conversation.href}
                  className="flex items-center justify-between gap-3 rounded-control border border-zani-border bg-surface-card p-3 transition hover:border-brand-100 hover:bg-surface-warm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-zani-text">
                      {conversation.title}
                    </span>
                    <span className="block truncate text-xs font-semibold text-zani-subtle">
                      {conversation.channel} / {conversation.unread_count}
                    </span>
                  </span>
                  <StatusBadge status={conversation.priority} size="sm" />
                </Link>
              ))}
            </div>
          </Surface>

          <Surface as="section" padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <CircleDollarSign size={20} className="text-zani-warning" />
              <h2 className="text-base font-bold text-zani-text">
                {t("dashboard.staleDeals")}
              </h2>
            </div>
            <div className="space-y-2">
              {staleDeals.map((deal) => (
                <Link
                  key={`${deal.reason}-${deal.id}`}
                  to={deal.href}
                  className="flex items-center justify-between gap-3 rounded-control border border-zani-border bg-surface-card p-3 transition hover:border-brand-100 hover:bg-surface-warm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-zani-text">
                      {deal.title}
                    </span>
                    <span className="block truncate text-xs font-semibold text-zani-subtle">
                      {deal.stage_name} /{" "}
                      {formatMoney(Number(deal.amount || 0))}
                    </span>
                  </span>
                  <StatusBadge status={deal.risk_level} size="sm" />
                </Link>
              ))}
            </div>
          </Surface>
        </section>
      ) : null}

      <Surface as="section" padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <IconBubble
              icon={Bot}
              tone="ai"
              className="h-11 w-11 rounded-control"
            />
            <div>
              <h2 className="text-base font-bold text-zani-text">
                {t("dashboard.aiNavigator")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-zani-subtle">
                {t("dashboard.ownerReadinessLine", {
                  setup: setupScore,
                  conversion,
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/app/ai-assistant"
              className="inline-flex min-h-10 items-center gap-2 rounded-control bg-ai-600 px-4 text-sm font-bold text-white transition hover:bg-ai-700"
            >
              <Sparkles size={16} />
              {t("dashboard.openAiAnalyst")}
            </Link>
            <Link
              to="/app/analytics"
              className="inline-flex min-h-10 items-center gap-2 rounded-control border border-zani-border bg-surface-card px-4 text-sm font-bold text-zani-text transition hover:border-brand-100 hover:bg-surface-warm"
            >
              {t("dashboard.openAnalytics")}
            </Link>
          </div>
        </div>
      </Surface>
    </div>
  );
}
