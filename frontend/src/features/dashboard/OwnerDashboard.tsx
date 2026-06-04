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

import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Client, Lead, OwnerDashboardMetrics, Service, Task } from "../../types";
import { formatMoney } from "./dashboardUtils";

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
    <section className="min-h-[188px] rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-700">{label}</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${trendColor(tone)}`}>{trend}</span>
      </div>
      <p className="mt-6 text-4xl font-bold leading-none text-midnight">{value}</p>
      <svg className="mt-8 h-12 w-full" viewBox="0 0 130 72" fill="none" aria-hidden="true">
        <path d={sparkPaths[tone]} stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </section>
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
    <div className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-b-0">
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

export function OwnerDashboard({
  businessName,
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
}: OwnerDashboardProps) {
  const { t } = useI18n();
  const activeLeads = leads.filter((lead) => ["new", "contacted", "in_progress"].includes(lead.status));
  const unassignedCount = activeLeads.filter((lead) => !lead.responsible_user).length;
  const noAnswerLeads = leads.filter((lead) => ["contacted", "in_progress"].includes(lead.status));
  const staleDealsProxy = leads.filter((lead) => lead.status === "in_progress").length;
  const communicationsReady = Boolean(dashboard?.setup?.sources?.communications);
  const salesReady = Boolean(dashboard?.setup?.sources?.sales_data || revenueHasData);
  const clientCount = clients.length;
  const salesCount = todayAppointmentsCount || appointments.filter((appointment) => appointment.status === "completed").length;
  const visibleChats = noAnswerLeads.slice(0, 2);

  return (
    <div className="pb-8">
      <section className="mb-8">
        <h1 className="text-[28px] font-extrabold leading-tight text-midnight">{t("dashboard.greetingBusiness")}, {businessName}.</h1>
        <p className="mt-1 text-lg leading-7 text-slate-700">{t("dashboard.stitchSubtitle")}</p>
      </section>

      {isCoreDataLoading ? (
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          {t("dashboard.loadingCoreData")}
        </div>
      ) : null}

      {metricsError ? (
        <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {t("dashboard.ownerAnalyticsError")}
        </div>
      ) : null}

      <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="zani-ai-surface relative overflow-hidden rounded-xl p-7 shadow-soft lg:col-span-2">
          <div className="mb-5 flex items-center gap-3">
            <Sparkles className="text-violet-600" size={26} />
            <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-midnight">{t("dashboard.smartTitle")}</h2>
          </div>
          <p className="max-w-3xl text-xl leading-9 text-slate-900">{t("dashboard.smartSummary")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/dashboard/conversations" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-700">
              {t("dashboard.smartPrimaryAction")}
              <Bolt size={18} />
            </Link>
            <Link to="/dashboard/deals" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-200 px-5 py-2 text-sm font-bold text-midnight transition-colors hover:bg-slate-300">
              {t("dashboard.smartSecondaryAction")}
            </Link>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-7 shadow-soft">
          <h2 className="mb-6 text-xl font-bold text-midnight">{t("dashboard.integrationStatus")}</h2>
          <div className="space-y-5">
            <IntegrationRow name="WhatsApp" ready={communicationsReady} icon={MessageSquareText} tone="bg-emerald-50 text-emerald-700" />
            <IntegrationRow name="Kaspi" ready={salesReady} icon={CircleDollarSign} tone="bg-slate-100 text-midnight" />
            <IntegrationRow name="Instagram" ready={communicationsReady} icon={Send} tone="bg-pink-50 text-pink-600" />
          </div>
          <Link to="/dashboard/integrations" className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-bold text-midnight transition-colors hover:bg-slate-200">
            {t("dashboard.manageAll")}
          </Link>
        </section>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("dashboard.kpiRevenue")} value={revenueHasData ? formatMoney(revenue) : t("dashboard.revenueMissingValue")} trend="+5%" tone="green" />
        <KpiCard label={t("dashboard.kpiLeads")} value={newLeadsCount || activeLeads.length} trend="+12%" tone="blue" />
        <KpiCard label={t("dashboard.kpiSales")} value={salesCount} trend="-2%" tone="red" />
        <KpiCard label={t("dashboard.kpiClients")} value={clientCount} trend="+3%" tone="blue" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-7 shadow-soft">
          <div className="mb-6 flex items-center gap-3">
            <span className="text-3xl font-bold text-amber-500">!</span>
            <h2 className="text-2xl font-bold text-midnight">{t("dashboard.urgentActions")}</h2>
          </div>
          <div className="space-y-3">
            <UrgentAction icon={UserPlus} title={t("dashboard.assignNewLeads", { count: unassignedCount || newLeadsCount })} action={t("dashboard.assign")} href="/dashboard/leads" tone="blue" />
            <UrgentAction icon={CircleDollarSign} title={t("dashboard.approveMarketingBudget")} action={t("dashboard.check")} href="/dashboard/deals" tone="amber" />
            <UrgentAction icon={Star} title={t("dashboard.contactVipClient")} action={t("dashboard.call")} href="/dashboard/clients" tone="violet" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-500">
            <span>{t("dashboard.overdueTasks")}: {overdueTasks}</span>
            <span>{t("dashboard.openTasks")}: {openTasks}</span>
            <span>{t("dashboard.conversion")}: {conversion}%</span>
            <span>{t("dashboard.setupScore")}: {setupScore}%</span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-7 shadow-soft">
          <div className="mb-6 flex items-center gap-3">
            <MessageSquareText className="text-brand-600" size={27} />
            <h2 className="text-2xl font-bold text-midnight">{t("dashboard.unansweredChats")}</h2>
          </div>
          <div className="min-h-[180px]">
            {visibleChats.length ? visibleChats.map((lead, index) => {
              const client = clients.find((item) => item.id === lead.client);
              const service = services.find((item) => item.id === lead.service);
              return (
                <ChatPreview
                  key={lead.id}
                  name={client?.full_name || t("dashboard.leadNumber", { id: lead.id })}
                  text={service?.name || lead.source || t("dashboard.noMessage")}
                  time={formatDateTime(lead.updated_at || lead.created_at)}
                  tone={index === 0 ? "green" : "pink"}
                />
              );
            }) : (
              <div className="flex h-[180px] items-center justify-center rounded-xl bg-slate-50 text-center text-sm font-semibold leading-6 text-slate-500">
                {t("dashboard.noUrgentLeadsText")}
              </div>
            )}
          </div>
          <Link to="/dashboard/conversations" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-600 px-4 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50">
            {t("dashboard.openMessageCenter")}
            <ArrowRight size={17} />
          </Link>
        </section>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <Bot className="text-violet-600" size={22} />
            <div>
              <p className="font-bold text-midnight">{t("dashboard.aiNavigator")}</p>
              <p className="text-sm text-slate-500">{t("dashboard.ownerReadinessLine", { setup: setupScore, conversion })}</p>
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <CalendarCheck className="text-brand-600" size={22} />
            <div>
              <p className="font-bold text-midnight">{t("dashboard.upcomingBookings")}</p>
              <p className="text-sm text-slate-500">{todayAppointmentsCount} · {appointments[0] ? formatDateTime(appointments[0].start_at) : t("dashboard.noBookingsToday")}</p>
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <ChartNoAxesColumnIncreasing className="text-emerald-600" size={22} />
            <div>
              <p className="font-bold text-midnight">{t("dashboard.connectMoreData")}</p>
              <p className="text-sm text-slate-500">{tasks.length + services.length} · {t("dashboard.connectionReadiness", { score: setupScore })}</p>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
