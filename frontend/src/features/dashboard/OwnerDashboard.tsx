import {
  CalendarCheck,
  Clock3,
  FileSpreadsheet,
  Filter,
  MessageCircle,
  PlugZap,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { AiInsightCard } from "../../components/ai/AiInsightCard";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Client, Lead, OwnerDashboardMetrics, Service, Task } from "../../types";
import { isTodayDate, isWithinPeriod, type DashboardPeriod } from "./dashboardUtils";

type OwnerDashboardProps = {
  businessName: string;
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
};

function PeriodSelector({ value, onChange }: { value: DashboardPeriod; onChange: (period: DashboardPeriod) => void }) {
  const { t } = useI18n();
  const options: Array<{ value: DashboardPeriod; label: string }> = [
    { value: "today", label: t("dashboard.periodToday") },
    { value: "week", label: t("dashboard.periodWeek") },
    { value: "month", label: t("dashboard.periodMonth") },
  ];

  return (
    <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`min-h-10 rounded-lg px-3 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${active ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-midnight"}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({
  title,
  value,
  delta,
  icon: Icon,
  tone,
  href,
  compact = false,
}: {
  title: string;
  value: string | number;
  delta: string;
  icon: LucideIcon;
  tone: "blue" | "amber" | "violet" | "green" | "red";
  href: string;
  compact?: boolean;
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
  }[tone];

  return (
    <Link to={href} className={`rounded-xl border border-slate-200 bg-white shadow-soft transition-colors hover:border-brand-200 ${compact ? "p-2 sm:p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`grid shrink-0 place-items-center rounded-xl ${toneClass} ${compact ? "h-8 w-8 sm:h-9 sm:w-9" : "h-12 w-12"}`}>
          <Icon size={compact ? 16 : 22} />
        </div>
      </div>
      <p className={`mt-3 font-medium leading-tight text-slate-700 ${compact ? "text-[10px] sm:text-xs" : "text-sm"}`}>{title}</p>
      <p className={`mt-1 font-black text-midnight ${compact ? "text-xl sm:text-2xl" : "text-4xl"}`}>{value}</p>
      <p className={`mt-2 text-[10px] font-semibold sm:text-xs ${delta.startsWith("+") || delta.startsWith("-3") ? "text-emerald-600" : "text-red-500"}`}>{delta}</p>
    </Link>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-midnight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AttentionRow({ title, text, tone, href }: { title: string; text: string; tone: "red" | "amber" | "blue"; href: string }) {
  const toneClass = {
    red: "bg-red-500",
    amber: "bg-amber-400",
    blue: "bg-blue-500",
  }[tone];
  return (
    <Link to={href} className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50">
      <span className="flex min-w-0 items-start gap-3">
        <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${toneClass}`} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-midnight">{title}</span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{text}</span>
        </span>
      </span>
      <span className="text-slate-300">›</span>
    </Link>
  );
}

function ConnectStrip({ salesReady, communicationsReady }: { salesReady: boolean; communicationsReady: boolean }) {
  const { t } = useI18n();
  const items = [
    { title: "WhatsApp", icon: MessageCircle, ready: communicationsReady, tone: "text-emerald-600 bg-emerald-50" },
    { title: "Telegram", icon: Send, ready: communicationsReady, tone: "text-sky-600 bg-sky-50" },
    { title: "1C", icon: FileSpreadsheet, ready: salesReady, tone: "text-amber-600 bg-amber-50" },
    { title: t("dashboard.moduleWarehouse"), icon: PlugZap, ready: false, tone: "text-blue-600 bg-blue-50" },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black text-midnight">{t("dashboard.connectMoreData")}</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} to="/dashboard/integrations" className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${item.tone}`}>
                    <Icon size={18} />
                  </span>
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
        <Link to="/dashboard/integrations" className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-sm font-black text-white shadow-sm transition-colors hover:bg-brand-700">
          {t("dashboard.connectionConnect")}
        </Link>
      </div>
    </section>
  );
}

export function OwnerDashboard({
  businessName,
  dashboard,
  metricsError,
  isCoreDataLoading,
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
}: OwnerDashboardProps) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const periodLeads = useMemo(() => leads.filter((lead) => isWithinPeriod(lead.created_at, period)), [leads, period]);
  const periodAppointments = useMemo(() => appointments.filter((appointment) => isWithinPeriod(appointment.start_at, period)), [appointments, period]);
  const todayBookings = appointments.filter((appointment) => isTodayDate(appointment.start_at)).slice(0, 3);
  const latestLeads = periodLeads.slice(0, 3);
  const noAnswerCount = leads.filter((lead) => ["contacted", "in_progress"].includes(lead.status)).length;
  const unassignedCount = leads.filter((lead) => !lead.responsible_user && ["new", "contacted", "in_progress"].includes(lead.status)).length;
  const staleDealsProxy = leads.filter((lead) => lead.status === "in_progress").length;
  const averageResponse = noAnswerCount ? t("dashboard.avgResponseValue") : "—";
  const communicationsReady = Boolean(dashboard?.setup?.sources?.communications);
  const salesReady = Boolean(dashboard?.setup?.sources?.sales_data || revenueHasData);

  return (
    <div className="pb-8">
      <section className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-midnight sm:text-3xl">{t("dashboard.greetingBusiness")}</h1>
          <p className="mt-2 text-base font-medium text-slate-500">{t("dashboard.directorSubtitle", { business: businessName })}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <PeriodSelector value={period} onChange={setPeriod} />
          <Link to="/dashboard/leads" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-midnight shadow-sm">
            <Filter size={17} />
            {t("dashboard.filters")}
          </Link>
        </div>
      </section>

      {isCoreDataLoading ? (
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          {t("dashboard.loadingCoreData")}
        </div>
      ) : null}

      {metricsError ? (
        <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {t("dashboard.ownerAnalyticsError")}
        </div>
      ) : null}

      <section className="mb-5">
        <AiInsightCard
          icon={Sparkles}
          severity={overdueTasks || unassignedCount || noAnswerCount ? "warning" : "good"}
          title={t("dashboard.aiBrief.title")}
          description={t("dashboard.ownerSignalText", {
            setup: setupScore,
            conversion,
            leads: unassignedCount,
            chats: noAnswerCount,
          })}
          actionLabel={t("dashboard.aiBrief.openLeads")}
          href="/dashboard/leads"
        />
      </section>

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="mb-4 text-lg font-black text-midnight">{t("dashboard.underControlToday")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <MetricCard compact title={t("dashboard.metricNewShort")} value={periodLeads.length || newLeadsCount} delta={t("dashboard.deltaLeads")} icon={FileSpreadsheet} tone="blue" href="/dashboard/leads" />
          <MetricCard compact title={t("dashboard.metricNoAnswerShort")} value={noAnswerCount} delta={t("dashboard.deltaNoAnswer")} icon={MessageCircle} tone="amber" href="/dashboard/conversations" />
          <MetricCard compact title={t("dashboard.metricUnassignedShort")} value={unassignedCount} delta={t("dashboard.deltaUnassigned")} icon={Users} tone="violet" href="/dashboard/leads" />
          <MetricCard compact title={t("dashboard.metricAvgResponseShort")} value={averageResponse} delta={t("dashboard.deltaAvgResponse")} icon={Clock3} tone="green" href="/dashboard/analytics" />
        </div>
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title={t("dashboard.requiresAttention")} action={<Link to="/dashboard/tasks" className="text-sm font-black text-blue-600">{t("common.all")}</Link>}>
          <div className="space-y-2">
            <AttentionRow title={t("dashboard.unassignedLeads")} text={t("dashboard.unassignedLeadsText", { count: unassignedCount })} tone="red" href="/dashboard/leads" />
            <AttentionRow title={t("dashboard.managerNoAnswer")} text={t("dashboard.managerNoAnswerText", { count: noAnswerCount })} tone="amber" href="/dashboard/conversations" />
            <AttentionRow title={t("dashboard.staleDeals")} text={t("dashboard.staleDealsText", { count: staleDealsProxy })} tone="amber" href="/dashboard/deals" />
            <AttentionRow title={t("dashboard.overdueTasks")} text={`${overdueTasks}`} tone="blue" href="/dashboard/tasks" />
          </div>
        </Panel>

        <Panel title={t("dashboard.aiBrief.eyebrow")} action={<Link to="/dashboard/ai-assistant" className="text-slate-300">›</Link>}>
          <div className="space-y-2 text-sm font-semibold leading-6 text-slate-700">
            <p>{t("dashboard.unassignedLeadsText", { count: unassignedCount })}</p>
            <p>{t("dashboard.managerNoAnswerText", { count: noAnswerCount })}</p>
            <p>{t("dashboard.staleDealsText", { count: staleDealsProxy })}</p>
            <p>{t("dashboard.ownerReadinessLine", { setup: setupScore, conversion })}</p>
          </div>
        </Panel>
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-2">
        <Panel title={t("dashboard.latestLeads")} action={<Link to="/dashboard/leads" className="text-sm font-black text-blue-600">{t("common.all")}</Link>}>
          <div className="space-y-3">
            {latestLeads.map((lead) => {
              const client = clients.find((item) => item.id === lead.client);
              const service = services.find((item) => item.id === lead.service);
              return (
                <Link key={lead.id} to="/dashboard/leads" className="block rounded-xl border border-slate-100 p-3 transition hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">{client?.full_name || t("dashboard.leadNumber", { id: lead.id })}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{service?.name || lead.source} · {formatDateTime(lead.created_at)}</p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                </Link>
              );
            })}
            {!latestLeads.length ? <EmptyState title={t("dashboard.noLeads")} description={t("dashboard.noLeadsText")} /> : null}
          </div>
        </Panel>

        <Panel title={t("dashboard.upcomingBookings")} action={<Link to="/dashboard/calendar" className="text-sm font-black text-blue-600">{t("nav.calendar")}</Link>}>
          <div className="space-y-3">
            {todayBookings.map((appointment) => {
              const client = clients.find((item) => item.id === appointment.client);
              const service = services.find((item) => item.id === appointment.service);
              return (
                <Link key={appointment.id} to="/dashboard/calendar" className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 transition hover:bg-slate-50">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                    <CalendarCheck size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-black text-slate-950">{client?.full_name || t("common.client")}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">{service?.name || t("common.service")} · {formatDateTime(appointment.start_at)}</span>
                  </span>
                </Link>
              );
            })}
            {!todayBookings.length ? <EmptyState title={t("dashboard.noBookingsToday")} description={t("dashboard.noBookingsTodayText")} /> : null}
          </div>
        </Panel>
      </section>

      <ConnectStrip salesReady={salesReady} communicationsReady={communicationsReady} />
    </div>
  );
}
