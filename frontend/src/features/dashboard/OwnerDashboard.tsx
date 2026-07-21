import {
  ArrowRight,
  Bolt,
  Bot,
  CalendarCheck,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  MessageSquareText,
  Phone,
  PlugZap,
  Send,
  Sparkles,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { AIAssistantStatusResponse, AIOwnerDailyBriefResponse } from "../../api/ai";
import type { WorkQueuesResponse } from "../../api/workQueues";
import { Surface } from "../../components/ui/Card";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Client, Lead, OwnerDashboardMetrics, Service, Task } from "../../types";
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

type KpiTone = "blue" | "green" | "red";

const sparkPaths: Record<KpiTone, string> = {
  blue: "M8 54 C28 50 45 44 64 36 C83 28 102 26 122 30",
  green: "M8 54 C30 54 48 50 70 44 C92 38 108 36 122 36",
  red: "M8 30 C34 34 56 38 78 46 C98 53 113 59 122 64",
};

function trendColor(tone: KpiTone) {
  if (tone === "red") return "text-red-600 bg-red-50";
  return "text-emerald-600 bg-emerald-50";
}

function initials(value?: string | null) {
  const source = (value || "ZANI").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function KpiCard({ label, value, trend, tone = "blue" }: { label: string; value: string | number; trend: string; tone?: KpiTone }) {
  const stroke = tone === "red" ? "#EFB8B8" : "#A9C7F8";
  return (
    <Surface as="section" className="min-h-[188px] rounded-xl" padding="lg">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-700">{label}</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${trendColor(tone)}`}>{trend}</span>
      </div>
      <p className="mt-6 text-4xl font-bold leading-none text-midnight">{value}</p>
      <svg className="mt-8 h-12 w-full" viewBox="0 0 130 72" fill="none" aria-hidden="true">
        <path d={sparkPaths[tone]} stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </Surface>
  );
}

function IntegrationRow({ name, ready, icon: Icon, tone }: { name: string; ready: boolean; icon: LucideIcon; tone: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
          <Icon size={18} />
        </span>
        <span className="truncate text-sm font-medium text-slate-900">{name}</span>
      </div>
      <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase ${ready ? "text-emerald-600" : "text-amber-600"}`}>
        <span className={`h-2 w-2 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-400"}`} />
        {ready ? t("dashboard.connectionActive") : t("dashboard.statusConnect")}
      </span>
    </div>
  );
}

function UrgentAction({
  icon: Icon,
  title,
  action,
  href,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  action: string;
  href: string;
  tone: "blue" | "amber" | "violet";
}) {
  const accent = {
    blue: "border-brand-600 text-brand-700",
    amber: "border-amber-400 text-amber-700",
    violet: "border-violet-900 text-violet-900",
  }[tone];
  const button = {
    blue: "bg-brand-50 text-brand-700",
    amber: "bg-slate-200 text-slate-800",
    violet: "bg-violet-900 text-white",
  }[tone];

  return (
    <Link to={href} className={`flex min-h-[58px] items-center gap-4 rounded-xl border-l-4 bg-slate-100/80 px-4 py-3 transition-colors hover:bg-slate-100 ${accent}`}>
      <Icon className="shrink-0" size={22} />
      <span className="min-w-0 flex-1 truncate text-base font-medium text-midnight">{title}</span>
      <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${button}`}>{action}</span>
    </Link>
  );
}

function ChatPreview({ name, text, time, tone }: { name: string; text: string; time: string; tone: "green" | "pink" }) {
  return (
    <div className="flex items-center gap-4 border-b border-slate-200 py-4 last:border-b-0">
      <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-midnight">
        {initials(name)}
        <span className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white ${tone === "green" ? "bg-emerald-500" : "bg-pink-500"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-midnight">{name}</p>
        <p className="mt-0.5 truncate text-sm text-slate-600">{text}</p>
      </div>
      <span className="shrink-0 text-xs font-bold text-red-600">{time}</span>
    </div>
  );
}

function RevenueChartCard({ revenue, revenueHasData }: { revenue: number; revenueHasData: boolean }) {
  const { t } = useI18n();
  const displayRevenue = revenueHasData ? revenue : 1245000;
  const previousRevenue = Math.max(0, Math.round(displayRevenue * 0.89));

  return (
    <Surface as="section" className="relative min-h-[280px] overflow-hidden p-6 text-slate-900" padding="none">
      <div className="relative z-10 flex h-full min-h-[232px] flex-col justify-between">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">{t("dashboard.revenue")}</p>
            <p className="mt-3 text-4xl font-bold leading-none sm:text-5xl">{formatMoney(displayRevenue)}</p>
            <p className="mt-3 text-sm font-medium text-slate-500">{t("dashboard.yesterday")}: {formatMoney(previousRevenue)}</p>
          </div>
          <div className="rounded-control border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            {t("dashboard.periodToday")}
          </div>
        </div>

        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
            +12% <span className="font-medium text-white">{t("dashboard.toYesterday")}</span>
          </div>
          <svg className="h-24 w-full" viewBox="0 0 640 120" fill="none" aria-hidden="true">
            <path d="M0 92 C80 84 112 66 176 72 C256 80 300 28 376 36 C456 44 496 18 640 24 L640 120 L0 120 Z" fill="url(#revenueFill)" />
            <path d="M0 92 C80 84 112 66 176 72 C256 80 300 28 376 36 C456 44 496 18 640 24" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
            <defs>
              <linearGradient id="revenueFill" x1="320" y1="24" x2="320" y2="120" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563eb" stopOpacity="0.18" />
                <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-400">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:59</span>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  change,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change: string;
  tone: "blue" | "purple" | "amber" | "green";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  }[tone];

  return (
    <Surface as="section" className="rounded-xl transition duration-150 hover:shadow-md" padding="lg">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneClass}`}>
          <Icon size={21} />
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">{change}</span>
      </div>
      <p className="mt-5 text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold leading-none text-midnight">{value}</p>
    </Surface>
  );
}

function InsightListCard({
  title,
  items,
  footer,
  href,
  meta,
}: {
  title: string;
  items: Array<{ tone: "green" | "amber" | "red" | "blue"; title: string; text: string; sourceIds?: string[] }>;
  footer: string;
  href: string;
  meta?: string;
}) {
  const { t } = useI18n();
  const toneClass = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
  };

  return (
    <Surface as="section" className="rounded-xl" padding="lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles size={20} className="shrink-0 text-violet-600" />
          <h2 className="truncate text-base font-semibold text-midnight">{title}</h2>
        </div>
        {meta ? <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">{meta}</span> : null}
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.title} className="flex gap-3">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneClass[item.tone]}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-midnight">{item.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.text}</p>
              {item.sourceIds?.length ? (
                <p className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-500">
                  {t("dashboard.ownerBriefSourceIds", { ids: item.sourceIds.join(", ") })}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <Link to={href} className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-midnight transition hover:bg-slate-50">
        {footer}
      </Link>
    </Surface>
  );
}

function AttentionCard({ unassignedCount, overdueTasks, noAnswerCount }: { unassignedCount: number; overdueTasks: number; noAnswerCount: number }) {
  const { t } = useI18n();
  const items = [
    { icon: UserPlus, title: t("dashboard.unassignedLeads"), subtitle: t("dashboard.unassignedLeadsText", { count: unassignedCount }), href: "/app/leads", tone: "bg-blue-50 text-blue-600" },
    { icon: CalendarCheck, title: t("dashboard.overdueTasks"), subtitle: t("dashboard.overdueTasks"), href: "/app/tasks", tone: "bg-amber-50 text-amber-600" },
    { icon: MessageSquareText, title: t("dashboard.managerNoAnswer"), subtitle: t("dashboard.managerNoAnswerText", { count: noAnswerCount }), href: "/app/conversations", tone: "bg-red-50 text-red-600" },
  ];

  return (
    <Surface as="section" className="rounded-xl" padding="lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-midnight">{t("dashboard.requiresAttention")}</h2>
        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">{unassignedCount + overdueTasks + noAnswerCount}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} to={item.href} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-slate-50">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${item.tone}`}>
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-midnight">{item.title}</span>
                <span className="block truncate text-xs text-slate-500">{item.subtitle}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-slate-400" />
            </Link>
          );
        })}
      </div>
    </Surface>
  );
}

function ConnectionsCard({ communicationsReady, salesReady }: { communicationsReady: boolean; salesReady: boolean }) {
  const { t } = useI18n();
  return (
    <Surface as="section" className="rounded-xl" padding="lg">
      <div className="mb-1 flex items-center gap-2">
        <PlugZap size={20} className="text-brand-600" />
        <h2 className="text-base font-semibold text-midnight">{t("dashboard.connections")}</h2>
      </div>
      <p className="mb-4 text-xs leading-5 text-slate-500">{t("dashboard.connectMoreData")}</p>
      <div className="space-y-3">
        <IntegrationRow name="WhatsApp" ready={communicationsReady} icon={MessageSquareText} tone="bg-emerald-50 text-emerald-700" />
        <IntegrationRow name="1C" ready={salesReady} icon={CircleDollarSign} tone="bg-violet-50 text-violet-700" />
        <IntegrationRow name={t("dashboard.warehouse")} ready={salesReady} icon={PlugZap} tone="bg-blue-50 text-blue-700" />
      </div>
      <Link to="/app/integrations" className="mt-5 inline-flex w-full items-center justify-between rounded-lg px-1 text-sm font-semibold text-brand-700">
        {t("dashboard.allConnections")}
        <ArrowRight size={16} />
      </Link>
    </Surface>
  );
}

function NewLeadsCard({ leads, clients, services }: { leads: Lead[]; clients: Client[]; services: Service[] }) {
  const { t } = useI18n();
  const visibleLeads = leads.slice(0, 3);
  return (
    <Surface as="section" className="rounded-xl" padding="lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-midnight">{t("dashboard.newLeads")}</h2>
        <Link to="/app/leads" className="text-sm font-semibold text-brand-700">{t("dashboard.allLeads")}</Link>
      </div>
      <div className="space-y-3">
        {visibleLeads.length ? visibleLeads.map((lead) => {
          const client = clients.find((item) => item.id === lead.client);
          const service = services.find((item) => item.id === lead.service);
          return (
            <Link key={lead.id} to={`/app/leads/${lead.id}`} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-slate-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-100 text-sm font-bold text-brand-700">{initials(client?.full_name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-midnight">{client?.full_name || t("dashboard.leadNumber", { id: lead.id })}</span>
                <span className="block truncate text-xs text-slate-500">{service?.name || lead.source}</span>
              </span>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{t("dashboard.newLead")}</span>
            </Link>
          );
        }) : (
          <div className="rounded-lg bg-slate-50 p-4 text-center text-sm font-medium text-slate-500">{t("dashboard.noUrgentLeadsText")}</div>
        )}
      </div>
    </Surface>
  );
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
  const activeLeads = leads.filter((lead) => ["new", "contacted", "in_progress"].includes(lead.status));
  const unassignedCount = workQueues?.summary.stale_leads ?? activeLeads.filter((lead) => !lead.responsible_user).length;
  const noAnswerLeads = leads.filter((lead) => ["contacted", "in_progress"].includes(lead.status));
  const noAnswerCount = workQueues ? workQueues.summary.unread_conversations + workQueues.summary.handoff_conversations : noAnswerLeads.length;
  const staleDealsProxy = leads.filter((lead) => lead.status === "in_progress").length;
  const communicationsReady = Boolean(dashboard?.setup?.sources?.communications);
  const salesReady = Boolean(dashboard?.setup?.sources?.sales_data || revenueHasData);
  const clientCount = clients.length;
  const salesCount = todayAppointmentsCount || appointments.filter((appointment) => appointment.status === "completed").length;
  const visibleChats = noAnswerLeads.slice(0, 2);
  const averageCheck = salesCount ? Math.round((revenue || 0) / Math.max(1, salesCount)) : 15960;
  const ownerBriefItems = ownerBrief?.recommendations.slice(0, 4).map((recommendation) => ({
    tone: recommendation.priority === "high" ? "red" as const : recommendation.priority === "medium" ? "amber" as const : "blue" as const,
    title: recommendation.label,
    text: recommendation.description,
    sourceIds: recommendation.source_ids,
  })) || [];
  const aiSummaryItems = ownerBrief
    ? ownerBrief.summary.no_data
      ? [{ tone: "blue" as const, title: t("dashboard.ownerBriefNoDataTitle"), text: t("dashboard.ownerBriefNoDataText") }]
      : ownerBriefItems.length
        ? ownerBriefItems
        : [{ tone: "blue" as const, title: t("dashboard.ownerBriefNoDataTitle"), text: t("dashboard.ownerBriefNoDataText") }]
    : isOwnerBriefLoading
      ? [{ tone: "blue" as const, title: t("dashboard.ownerBriefLoadingTitle"), text: t("dashboard.ownerBriefLoadingText") }]
      : ownerBriefError
        ? [{ tone: "amber" as const, title: t("dashboard.ownerBriefUnavailableTitle"), text: t("dashboard.ownerBriefUnavailableText") }]
        : canViewAiAnalyst
          ? [{ tone: "blue" as const, title: t("dashboard.ownerBriefNoDataTitle"), text: t("dashboard.ownerBriefNoDataText") }]
          : [{ tone: "amber" as const, title: t("dashboard.ownerBriefNoAccessTitle"), text: t("dashboard.ownerBriefNoAccessText") }];
  const aiSummaryHref = ownerBrief?.recommendations[0]?.href || (canViewAiAnalyst ? "/app/ai-assistant" : "/app/settings/team");
  const aiSummaryFooter = ownerBrief?.recommendations[0] ? t("dashboard.openPrioritySource") : canViewAiAnalyst ? t("dashboard.openAiAnalyst") : t("dashboard.openTeamSettings");
  const providerMode = aiStatus?.mode === "live" ? t("aiAssistant.modeLive") : t("aiAssistant.modeMock");
  const providerLabel = aiStatus
    ? t("dashboard.aiProviderStatus", { provider: aiStatus.provider, mode: providerMode })
    : t("aiAssistant.providerChecking");
  const ownerBriefMeta = isOwnerBriefLoading
    ? t("common.loading")
    : ownerBrief
      ? t("dashboard.ownerBriefSources", { count: ownerBrief.summary.source_count })
      : providerLabel;

  return (
    <div className="pb-8">
      {isCoreDataLoading ? (
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          {t("dashboard.loadingCoreData")}
        </div>
      ) : null}

      {metricsError ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {t("dashboard.ownerAnalyticsError")}
        </div>
      ) : null}

      {ownerBriefError ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {t("dashboard.ownerBriefError")}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_580px]">
        <RevenueChartCard revenue={revenue} revenueHasData={revenueHasData} />
        <div className="grid gap-4 sm:grid-cols-2">
          <DashboardMetricCard icon={Users} label={t("dashboard.newLeadsShort")} value={newLeadsCount || activeLeads.length} change="+8%" tone="blue" />
          <DashboardMetricCard icon={CircleDollarSign} label={t("dashboard.averageCheck")} value={formatMoney(averageCheck)} change="+6%" tone="purple" />
          <DashboardMetricCard icon={MessageSquareText} label={t("dashboard.noAnswer")} value={noAnswerLeads.length} change="+20%" tone="amber" />
          <DashboardMetricCard icon={ChartNoAxesColumnIncreasing} label={t("dashboard.conversion")} value={`${conversion}%`} change="+3%" tone="green" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_320px_minmax(0,1fr)]">
        <InsightListCard title={t("dashboard.aiSummaryDay")} items={aiSummaryItems} footer={aiSummaryFooter} href={aiSummaryHref} meta={ownerBriefMeta} />
        <div className="space-y-5">
          <AttentionCard unassignedCount={unassignedCount || newLeadsCount} overdueTasks={overdueTasks} noAnswerCount={noAnswerCount} />
          <ConnectionsCard communicationsReady={communicationsReady} salesReady={salesReady} />
        </div>
        <div className="space-y-5">
          <NewLeadsCard leads={activeLeads} clients={clients} services={services} />
          <Surface as="section" className="rounded-xl" padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="text-violet-600" size={20} />
              <h2 className="text-base font-semibold text-midnight">{t("dashboard.aiNavigator")}</h2>
            </div>
            <p className="text-sm leading-6 text-slate-600">{t("dashboard.ownerReadinessLine", { setup: setupScore, conversion })}</p>
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">{providerLabel}</p>
            {ownerBrief?.summary.no_data ? (
              <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                {ownerBrief.summary.no_data_reason || t("dashboard.ownerBriefNoDataText")}
              </p>
            ) : null}
            {aiStatus && !aiStatus.ready ? (
              <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                {t("dashboard.aiProviderUnavailable")}
              </p>
            ) : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <p className="text-2xl font-bold text-midnight">{openTasks}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{t("dashboard.openTasks")}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <p className="text-2xl font-bold text-midnight">{todayAppointmentsCount}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{t("dashboard.appointments")}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <p className="text-2xl font-bold text-midnight">{setupScore}%</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{t("dashboard.setupScore")}</p>
              </div>
            </div>
          </Surface>
        </div>
      </section>
    </div>
  );
}
