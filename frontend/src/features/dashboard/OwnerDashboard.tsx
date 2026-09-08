import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  MessageSquareText,
  PlugZap,
  UserPlus,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

import type {
  AIAssistantStatusResponse,
  AIOwnerDailyBriefResponse,
} from "../../api/ai";
import type {
  WorkQueueConversationItem,
  WorkQueueDealItem,
  WorkQueuesResponse,
} from "../../api/workQueues";
import { Button } from "../../components/ui/Button";
import { Surface } from "../../components/ui/Card";
import { IconBubble } from "../../components/ui/Primitives";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import { businessRoleLabel } from "../../lib/permissions";
import type { OwnerDashboardMetrics } from "../../types";
import { formatMoney } from "./dashboardUtils";

type OwnerDashboardProps = {
  dashboard?: OwnerDashboardMetrics;
  metricsError: unknown;
  isCoreDataLoading: boolean;
  revenue: number;
  revenueHasData: boolean;
  newLeadsCount: number;
  todayAppointmentsCount: number;
  overdueTasks: number;
  workQueues?: WorkQueuesResponse;
  workQueuesError?: unknown;
  isWorkQueuesLoading: boolean;
  retryWorkQueues: () => void;
  ownerBrief?: AIOwnerDailyBriefResponse;
  ownerBriefError?: unknown;
  isOwnerBriefLoading?: boolean;
  canViewAiAnalyst: boolean;
  canViewAiAssistant: boolean;
  canViewConversations: boolean;
  canViewDeals: boolean;
  canViewIntegrations: boolean;
  canViewLeads: boolean;
  canViewAppointments: boolean;
  canViewTasks: boolean;
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
  href?: string;
  action?: string;
  tone: "brand" | "amber" | "red" | "ai";
  sourceLabels?: string[];
};

type DashboardMetricProps = {
  label: string;
  value: string | number;
  hint: string;
  href: string;
  icon: LucideIcon;
  tone: "brand" | "green" | "amber" | "slate";
};

function initials(value?: string | null) {
  return (value || "ZANI")
    .trim()
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
  return "bg-[var(--zani-brand-content)]";
}

function DashboardMetric({
  label,
  value,
  hint,
  href,
  icon,
  tone,
}: DashboardMetricProps) {
  return (
    <Surface
      as={Link}
      to={href}
      interactive
      padding="md"
      className="group flex min-h-28 items-start gap-3"
    >
      <IconBubble icon={icon} tone={tone} className="h-10 w-10 rounded-control" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-zani-subtle">{label}</span>
        <span className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums text-zani-ink">
          {value}
        </span>
        <span className="mt-1 block truncate text-xs font-medium text-zani-faint">
          {hint}
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        size={16}
        className="mt-1 shrink-0 text-zani-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700"
      />
    </Surface>
  );
}

function AttentionList({ items }: { items: AttentionItem[] }) {
  const { t } = useI18n();

  return (
    <Surface as="section" padding="lg" className="min-h-full min-w-0">
      <div className="mb-4 min-w-0">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
            {t("dashboard.ownerUrgentActions")}
          </p>
          <h2 className="mt-1 text-base font-bold text-zani-text">
            {t("dashboard.attention")}
          </h2>
        </div>
      </div>

      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.href}
                className="group flex min-h-14 items-center gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2.5 transition hover:border-brand-100 hover:bg-surface-warm"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneDot(item.tone)}`} />
                <Icon aria-hidden="true" className="shrink-0 text-zani-subtle" size={18} />
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
                <ArrowRight
                  aria-hidden="true"
                  size={16}
                  className="shrink-0 text-zani-faint transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-control border border-dashed border-zani-border bg-surface-muted px-5 text-center">
          <CheckCircle2 aria-hidden="true" size={28} className="text-zani-success" />
          <p className="mt-3 text-sm font-bold text-zani-text">
            {t("dashboard.noPrioritiesTitle")}
          </p>
          <p className="mt-1 text-xs leading-5 text-zani-subtle">
            {t("dashboard.noPrioritiesText")}
          </p>
        </div>
      )}
    </Surface>
  );
}

function AiBriefCard({ items }: { items: BriefItem[] }) {
  const { t } = useI18n();

  return (
    <Surface as="section" variant="ai" padding="lg" className="min-h-full min-w-0">
      <div className="mb-4 min-w-0">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ai-700">
            {t("dashboard.aiBrief.eyebrow")}
          </p>
          <h2 className="mt-1 text-base font-bold text-zani-text">
            {t("dashboard.aiBrief.title")}
          </h2>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-control border border-ai-100 bg-surface-card p-3">
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneDot(item.tone)}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-zani-text">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-zani-subtle">{item.text}</p>
                {item.sourceLabels?.length ? (
                  <p className="mt-2 truncate text-[11px] font-semibold text-zani-faint">
                    {t("dashboard.ownerBriefSourceIds", {
                      ids: item.sourceLabels.join(", "),
                    })}
                  </p>
                ) : null}
              </div>
            </div>
            {item.href && item.action ? (
              <Link
                to={item.href}
                className="mt-2 inline-flex min-h-8 items-center gap-2 rounded-control px-2 text-xs font-bold text-ai-700 transition hover:bg-ai-50"
              >
                {item.action}
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </Surface>
  );
}

function TeamPerformanceCard({ dashboard }: { dashboard?: OwnerDashboardMetrics }) {
  const { t } = useI18n();
  const members = [...(dashboard?.manager_performance?.rows || [])]
    .filter((member) => !["owner", "business_owner"].includes(member.role))
    .sort(
      (left, right) =>
        right.overdue_tasks - left.overdue_tasks ||
        right.assigned_leads - left.assigned_leads,
    )
    .slice(0, 4);

  return (
    <Surface as="section" padding="lg" className="min-h-full min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <UsersRound aria-hidden="true" size={20} className="shrink-0 text-brand-600" />
          <h2 className="truncate text-base font-bold text-zani-text">
            {t("analytics.teamPerformance")}
          </h2>
        </div>
        <Link to="/app/analytics" className="shrink-0 text-xs font-bold text-brand-700">
          {t("common.all")}
        </Link>
      </div>

      {members.length ? (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-control border border-zani-border bg-surface-card px-3 py-2.5 sm:flex"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                {initials(member.full_name || member.email)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-zani-text">
                  {member.full_name || member.email}
                </span>
                <span className="block truncate text-xs font-semibold text-zani-subtle">
                  {businessRoleLabel(member.role, t)}
                </span>
              </span>
              <span className="col-span-2 flex min-w-0 justify-between gap-3 border-t border-zani-border pt-2 text-xs font-semibold text-zani-subtle sm:block sm:shrink-0 sm:border-0 sm:pt-0 sm:text-right">
                <span className="truncate tabular-nums text-zani-text sm:block">
                  {t("analytics.assignedLeads")}: {member.assigned_leads}
                </span>
                <span className={`truncate sm:block ${member.overdue_tasks ? "text-zani-danger" : "text-zani-faint"}`}>
                  {t("analytics.overdueTasks")}: {member.overdue_tasks}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center rounded-control border border-dashed border-zani-border bg-surface-muted px-5 text-center">
          <UsersRound aria-hidden="true" size={28} className="text-zani-faint" />
          <p className="mt-3 text-sm font-bold text-zani-text">
            {t("dashboard.teamDataEmpty")}
          </p>
          <p className="mt-1 text-xs leading-5 text-zani-subtle">
            {t("dashboard.teamDataEmptyText")}
          </p>
        </div>
      )}
    </Surface>
  );
}

function buildBriefItems({
  ownerBrief,
  ownerBriefError,
  isOwnerBriefLoading,
  canViewAiAnalyst,
  canViewAiAssistant,
  aiStatus,
  t,
}: {
  ownerBrief?: AIOwnerDailyBriefResponse;
  ownerBriefError?: unknown;
  isOwnerBriefLoading?: boolean;
  canViewAiAnalyst: boolean;
  canViewAiAssistant: boolean;
  aiStatus?: AIAssistantStatusResponse;
  t: (key: string, vars?: Record<string, string | number>) => string;
}): BriefItem[] {
  const sourcesById = new Map(
    (ownerBrief?.sources || []).map((source) => [source.id, source]),
  );
  const categoryKeys: Record<string, string> = {
    stale_leads: "staleLead",
    overdue_tasks: "overdueTask",
    unanswered_conversations: "unansweredConversation",
    stalled_deals: "stalledDeal",
    failed_connectors: "failedConnector",
  };
  const uniqueRecommendations = Array.from(
    new Map(
      (ownerBrief?.recommendations || []).map((recommendation) => [
        recommendation.category,
        recommendation,
      ]),
    ).values(),
  ).slice(0, 3);
  const recommendations = uniqueRecommendations.map((recommendation) => {
    const sourceLabels = recommendation.source_ids
      .map((sourceId) => sourcesById.get(sourceId)?.label)
      .filter((label): label is string => Boolean(label));
    const primarySource =
      sourceLabels[0] || t("dashboard.ownerBriefFallbackSource");
    const copyKey = categoryKeys[recommendation.category];

    return {
      key: recommendation.category || recommendation.id,
      title: copyKey
        ? t(`dashboard.ownerBrief.${copyKey}.title`, { source: primarySource })
        : recommendation.label,
      text: copyKey
        ? t(`dashboard.ownerBrief.${copyKey}.text`)
        : recommendation.description,
      href: recommendation.href,
      action: t("dashboard.openPrioritySource"),
      tone:
        recommendation.priority === "high"
          ? ("red" as const)
          : recommendation.priority === "medium"
            ? ("amber" as const)
            : ("ai" as const),
      sourceLabels,
    };
  });
  if (recommendations.length) return recommendations;
  if (ownerBrief?.summary.no_data) {
    return [
      {
        key: "owner-brief-no-data",
        title: t("dashboard.ownerBriefNoDataTitle"),
        text:
          ownerBrief.summary.no_data_reason ||
          t("dashboard.ownerBriefNoDataText"),
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
        href: canViewAiAssistant ? "/app/ai-assistant" : undefined,
        action: canViewAiAssistant ? t("dashboard.openAiAnalyst") : undefined,
        tone: "amber",
      },
    ];
  }
  return [
    {
      key: "no-priority",
      title: t("dashboard.ownerBriefNoDataTitle"),
      text: t("dashboard.ownerBriefNoDataText"),
      tone: "ai",
    },
  ];
}

function uniqueQueueItems<T extends { id: number }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function OwnerDashboard({
  dashboard,
  metricsError,
  isCoreDataLoading,
  revenue,
  revenueHasData,
  newLeadsCount,
  todayAppointmentsCount,
  overdueTasks,
  workQueues,
  workQueuesError,
  isWorkQueuesLoading,
  retryWorkQueues,
  ownerBrief,
  ownerBriefError,
  isOwnerBriefLoading,
  canViewAiAnalyst,
  canViewAiAssistant,
  canViewConversations,
  canViewDeals,
  canViewIntegrations,
  canViewLeads,
  canViewAppointments,
  canViewTasks,
  aiStatus,
}: OwnerDashboardProps) {
  const { t } = useI18n();
  const visibleConversations = uniqueQueueItems<WorkQueueConversationItem>([
    ...(workQueues?.queues.unread_sla_overdue_conversations || []),
    ...(workQueues?.queues.handoff_sla_overdue_conversations || []),
    ...(workQueues?.queues.unread_conversations || []),
    ...(workQueues?.queues.handoff_conversations || []),
  ]);
  const staleDeals = uniqueQueueItems<WorkQueueDealItem>([
    ...(workQueues?.queues.sla_overdue_deals || []),
    ...(workQueues?.queues.no_next_action_deals || []),
  ]);
  const noAnswerCount = workQueues
    ? workQueues.summary.unread_conversations +
      workQueues.summary.handoff_conversations
    : visibleConversations.length;
  const failedConnectors = dashboard?.connector_health?.error || 0;
  const attentionItems: AttentionItem[] = [
    ...(canViewTasks && overdueTasks > 0
      ? [
          {
            key: "tasks",
            title: t("dashboard.closeOverdue"),
            text: t("dashboard.overdueTasksCount", { count: overdueTasks }),
            count: overdueTasks,
            href: "/app/tasks",
            icon: AlertTriangle,
            tone: "red" as const,
          },
        ]
      : []),
    ...(canViewConversations && noAnswerCount > 0
      ? [
          {
            key: "conversations",
            title: t("dashboard.managerNoAnswer"),
            text: t("dashboard.managerNoAnswerText", { count: noAnswerCount }),
            count: noAnswerCount,
            href: "/app/conversations",
            icon: MessageSquareText,
            tone: "red" as const,
          },
        ]
      : []),
    ...(canViewDeals && staleDeals.length > 0
      ? [
          {
            key: "deals",
            title: t("dashboard.staleDeals"),
            text: t("dashboard.staleDealsText", { count: staleDeals.length }),
            count: staleDeals.length,
            href: "/app/deals",
            icon: CircleDollarSign,
            tone: "amber" as const,
          },
        ]
      : []),
    ...(canViewIntegrations && failedConnectors > 0
      ? [
          {
            key: "connectors",
            title: t("dashboard.failedConnectors"),
            text: t("dashboard.failedConnectorsText", {
              count: failedConnectors,
            }),
            count: failedConnectors,
            href: "/app/integrations",
            icon: PlugZap,
            tone: "red" as const,
          },
        ]
      : []),
  ];
  const briefItems = buildBriefItems({
    ownerBrief,
    ownerBriefError,
    isOwnerBriefLoading,
    canViewAiAnalyst,
    canViewAiAssistant,
    aiStatus,
    t,
  });
  const revenueToday = Number(dashboard?.revenue?.today || revenue || 0);

  if (isCoreDataLoading) {
    return (
      <div className="space-y-4 pb-8">
        <Surface
          className="border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700"
          padding="none"
        >
          {t("dashboard.loadingCoreData")}
        </Surface>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8" data-testid="dashboard-workspace-ready">
      {metricsError ? (
        <Surface
          className="border-[rgba(151,90,22,0.24)] bg-[var(--zani-warning-soft)] px-4 py-3 text-sm font-semibold text-zani-warning"
          padding="none"
        >
          {t("dashboard.ownerAnalyticsError")}
        </Surface>
      ) : null}
      {isWorkQueuesLoading ? (
        <LoadingState label={t("dashboard.loadingPriorities")} />
      ) : null}
      {workQueuesError ? (
        <div data-testid="dashboard-priority-error">
          <ErrorState
            message={t("dashboard.priorityQueueError")}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={retryWorkQueues}
              >
                {t("common.retry")}
              </Button>
            }
          />
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          label={t("dashboard.revenue")}
          value={
            revenueHasData
              ? formatMoney(revenueToday)
              : t("dashboard.revenueMissingValue")
          }
          hint={
            revenueHasData
              ? t("dashboard.revenueExactText")
              : t("dashboard.revenueMissingShort")
          }
          href={revenueHasData ? "/app/analytics" : "/app/settings#data-tools"}
          icon={CircleDollarSign}
          tone="brand"
        />
        {canViewLeads ? (
          <DashboardMetric
            label={t("dashboard.newLeadsShort")}
            value={newLeadsCount}
            hint={t("dashboard.businessScopeNeedsProcess")}
            href="/app/leads"
            icon={UserPlus}
            tone="brand"
          />
        ) : null}
        {canViewAppointments ? (
          <DashboardMetric
            label={t("dashboard.todayBookings")}
            value={todayAppointmentsCount}
            hint={t("common.today")}
            href="/app/calendar"
            icon={CalendarCheck}
            tone="green"
          />
        ) : null}
        {canViewTasks ? (
          <DashboardMetric
            label={t("dashboard.overdueTasks")}
            value={overdueTasks}
            hint={
              overdueTasks
                ? t("dashboard.overdueTasksCount", { count: overdueTasks })
                : t("dashboard.noPrioritiesTitle")
            }
            href="/app/tasks"
            icon={AlertTriangle}
            tone={overdueTasks ? "amber" : "slate"}
          />
        ) : null}
      </section>

      <section className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <AttentionList items={attentionItems} />
        <AiBriefCard items={briefItems} />
        <TeamPerformanceCard dashboard={dashboard} />
      </section>
    </div>
  );
}
