import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Flame,
  ListChecks,
  MessageCircle,
  MessageSquareText,
  Package,
  PlugZap,
  Plus,
  Rocket,
  ShieldCheck,
  Smartphone,
  Store,
  Target,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { analyticsApi } from "../../api/analytics";
import { billingApi } from "../../api/billing";
import { onboardingApi } from "../../api/onboarding";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { MetricTile, type UiTone } from "../../components/ui/Primitives";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState, ErrorState, PageSkeleton } from "../../components/ui/StateViews";
import { formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Client, Lead, Service, Task } from "../../types";
import { useAuth } from "../auth/AuthProvider";

function Metric({
  label,
  value,
  hint,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Flame;
  tone?: UiTone;
}) {
  return <MetricTile label={label} value={value} hint={hint} icon={Icon} tone={tone} />;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} ₸`;
}

function isOwnerDashboardRole(role: string) {
  return ["owner", "admin", "business_owner"].includes(role);
}

function isTodayDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function BusinessBankingHero({
  businessName,
  isOwnerView,
  revenue,
  newLeadsCount,
  todayAppointmentsCount,
  openTasks,
  overdueTasks,
  conversion,
  managerLeadsCount,
  managerTasksCount,
}: {
  businessName: string;
  isOwnerView: boolean;
  revenue: number;
  newLeadsCount: number;
  todayAppointmentsCount: number;
  openTasks: number;
  overdueTasks: number;
  conversion: number;
  managerLeadsCount: number;
  managerTasksCount: number;
}) {
  const { t } = useI18n();
  const urgency = overdueTasks
    ? `${overdueTasks} ${t("dashboard.overdueCount")}`
    : newLeadsCount
      ? `${newLeadsCount} ${t("dashboard.newLeadsCount")}`
      : t("dashboard.dayUnderControl");
  const heroValue = isOwnerView ? formatMoney(revenue) : `${managerLeadsCount}`;
  const heroLabel = isOwnerView ? t("dashboard.moneyUnderControl") : t("dashboard.myActiveLeads");
  const heroHint = isOwnerView
    ? t("dashboard.ownerHeroHint")
    : `${managerTasksCount} ${t("dashboard.managerHeroHint")}.`;

  return (
    <section className="mb-5 overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 text-white shadow-premium">
      <div className="relative p-5 sm:p-6 lg:p-7">
        <div className="absolute -right-12 -top-16 h-48 w-72 rotate-12 rounded-[2rem] bg-brand-400/20 blur-2xl" />
        <div className="absolute bottom-0 left-1/2 h-40 w-80 -translate-x-1/2 -rotate-6 rounded-[2rem] bg-ai-500/18 blur-2xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white/70 ring-1 ring-white/15">
                {isOwnerView ? t("dashboard.ownerCockpit") : t("dashboard.managerCockpit")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-100 ring-1 ring-amber-200/20">
                <AlertTriangle size={14} />
                {urgency}
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              {businessName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              {isOwnerView
                ? t("dashboard.ownerHeroCopy")
                : t("dashboard.managerHeroCopy")}
            </p>
          </div>

          <div className="relative min-w-[min(100%,22rem)] rounded-[1.75rem] bg-white p-4 text-midnight shadow-soft">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{heroLabel}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-4xl font-black tracking-tight sm:text-5xl">{heroValue}</p>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                {isOwnerView ? <WalletCards size={23} /> : <Target size={23} />}
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{heroHint}</p>
          </div>
          </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          <Link to="/dashboard/leads" className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:bg-white/15">
            <p className="text-sm font-bold text-white/60">{t("dashboard.newLeadsShort")}</p>
            <p className="mt-2 text-3xl font-black">{newLeadsCount}</p>
          </Link>
          <Link to="/dashboard/calendar" className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:bg-white/15">
            <p className="text-sm font-bold text-white/60">{t("dashboard.todayBookings")}</p>
            <p className="mt-2 text-3xl font-black">{todayAppointmentsCount}</p>
          </Link>
          <Link to="/dashboard/tasks" className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/15 transition hover:bg-white/15">
            <p className="text-sm font-bold text-white/60">{isOwnerView ? t("dashboard.openTasks") : t("dashboard.myTasks")}</p>
            <p className="mt-2 text-3xl font-black">{isOwnerView ? openTasks : managerTasksCount}</p>
            {isOwnerView ? <p className="mt-1 text-xs font-bold text-white/45">{t("dashboard.conversion")} {conversion}%</p> : null}
          </Link>
        </div>
      </div>
    </section>
  );
}

function QuickActionDock({ isOwnerView }: { isOwnerView: boolean }) {
  const { t } = useI18n();
  const actions = [
    { label: t("dashboard.quickLead"), href: "/dashboard/leads?create=1", icon: Plus, variant: "ai" as const },
    { label: t("dashboard.quickBooking"), href: "/dashboard/appointments", icon: CalendarPlus, variant: "secondary" as const },
    { label: t("dashboard.quickDialogs"), href: "/dashboard/conversations", icon: MessageSquareText, variant: "secondary" as const },
    ...(isOwnerView ? [{ label: t("dashboard.quickImport"), href: "/dashboard/integrations", icon: FileSpreadsheet, variant: "secondary" as const }] : []),
  ];

  return (
    <div className="mb-5 flex gap-3 overflow-x-auto pb-1 no-scrollbar">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.label} to={action.href} className="min-w-[9.5rem] sm:min-w-0">
            <Button variant={action.variant} className="h-13 w-full rounded-3xl px-5 text-sm shadow-soft">
              <Icon size={18} />
              {action.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}

function FocusStrip({
  isOwnerView,
  newLeadsCount,
  todayAppointmentsCount,
  openTasks,
  overdueTasks,
  source,
}: {
  isOwnerView: boolean;
  newLeadsCount: number;
  todayAppointmentsCount: number;
  openTasks: number;
  overdueTasks: number;
  source?: string;
}) {
  const { t } = useI18n();
  const items = [
    {
      title: t("dashboard.answerNewLeads"),
      text: t("dashboard.newLeadsWaiting").replace("{count}", String(newLeadsCount)),
      href: "/dashboard/leads",
      tone: newLeadsCount ? "bg-amber-50 text-amber-900 ring-amber-100" : "bg-white text-slate-700 ring-slate-100",
    },
    {
      title: t("dashboard.checkBookings"),
      text: t("dashboard.todayBookingsCount").replace("{count}", String(todayAppointmentsCount)),
      href: "/dashboard/calendar",
      tone: "bg-white text-slate-700 ring-slate-100",
    },
    {
      title: overdueTasks ? t("dashboard.closeOverdue") : t("dashboard.openClientTasks"),
      text: overdueTasks
        ? t("dashboard.overdueTasksCount").replace("{count}", String(overdueTasks))
        : t("dashboard.openTasksCount").replace("{count}", String(openTasks)),
      href: "/dashboard/tasks",
      tone: overdueTasks ? "bg-red-50 text-red-900 ring-red-100" : "bg-white text-slate-700 ring-slate-100",
    },
    ...(isOwnerView
      ? [{
          title: t("dashboard.demandSource"),
          text: t("dashboard.checkChannels").replace("{source}", source || t("dashboard.notEnoughData")),
          href: "/dashboard/analytics",
          tone: "bg-white text-slate-700 ring-slate-100",
        }]
      : []),
  ];

  return (
    <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Link key={item.title} to={item.href} className={`rounded-3xl p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-soft ${item.tone}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black">{item.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-70">{item.text}</p>
            </div>
            <ArrowUpRight size={18} className="shrink-0 opacity-55" />
          </div>
        </Link>
      ))}
    </div>
  );
}

type SetupModuleStatus = "connected" | "connect" | "beta" | "soon" | "request";

function SetupStatusPill({ status }: { status: SetupModuleStatus }) {
  const { t } = useI18n();
  const statusMap: Record<SetupModuleStatus, { labelKey: string; className: string }> = {
    connected: { labelKey: "dashboard.statusConnected", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    connect: { labelKey: "dashboard.statusConnect", className: "bg-brand-50 text-brand-700 ring-brand-100" },
    beta: { labelKey: "dashboard.statusBeta", className: "bg-ai-50 text-ai-700 ring-ai-100" },
    soon: { labelKey: "dashboard.statusSoon", className: "bg-slate-100 text-slate-600 ring-slate-200" },
    request: { labelKey: "dashboard.statusRequest", className: "bg-amber-50 text-amber-700 ring-amber-100" },
  };
  const current = statusMap[status];

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] ring-1 ${current.className}`}>
      {t(current.labelKey)}
    </span>
  );
}

function ActivationDashboard({
  businessName,
  setupScore,
  trialEndsAt,
  landingDomain,
  landingPreviewUrl,
  modules,
}: {
  businessName: string;
  setupScore: number;
  trialEndsAt?: string | null;
  landingDomain?: string;
  landingPreviewUrl?: string;
  modules: Array<{
    title: string;
    description: string;
    status: SetupModuleStatus;
    icon: typeof Flame;
    href?: string;
  }>;
}) {
  const { t } = useI18n();
  const cappedScore = Math.max(0, Math.min(setupScore, 100));
  const activeUntilText = trialEndsAt
    ? ` ${t("dashboard.activeUntil").replace("{date}", new Date(trialEndsAt).toLocaleDateString("ru-RU"))}`
    : "";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-brand-100 bg-white/85">
        <CardBody className="relative grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
          <div className="absolute right-0 top-0 h-36 w-64 rotate-6 rounded-[2rem] bg-brand-100/70 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 h-28 w-56 -rotate-6 rounded-[2rem] bg-ai-100/60 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700 ring-1 ring-emerald-100">
              <ShieldCheck size={16} />
              {t("dashboard.businessActivated")}
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-midnight sm:text-4xl">
              {t("dashboard.acceptsLeads").replace("{business}", businessName)}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {t("dashboard.trialCopy")}
              {activeUntilText}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {landingPreviewUrl ? (
                <a href={landingPreviewUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary"><Store size={17} />{t("dashboard.openLanding")}</Button>
                </a>
              ) : null}
              <Link to="/dashboard/settings"><Button variant="ai"><PlugZap size={17} />{t("dashboard.connectData")}</Button></Link>
            </div>
            {landingDomain ? <p className="mt-3 text-sm font-semibold text-slate-500">{t("dashboard.source")}: {landingDomain}</p> : null}
          </div>
          <div className="relative rounded-[28px] border border-slate-100 bg-white/80 p-5 shadow-soft">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">{t("dashboard.setupScore")}</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-6xl font-black tracking-tight text-midnight">{cappedScore}</span>
              <span className="pb-2 text-2xl font-black text-slate-400">%</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{t("dashboard.setupScoreText").replace("{score}", String(cappedScore))}</p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-ai-500 transition-all" style={{ width: `${cappedScore}%` }} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-midnight">{t("dashboard.connectNext")}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{t("dashboard.connectNextHint")}</p>
            </div>
            <Link to="/dashboard/onboarding" className="text-sm font-black text-brand-700 hover:text-brand-800">{t("dashboard.openQuickStart")}</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;
              const content = (
                <div className="h-full rounded-3xl border border-slate-100 bg-white/75 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-midnight">
                      <Icon size={19} />
                    </div>
                    <SetupStatusPill status={module.status} />
                  </div>
                  <p className="mt-4 font-black text-midnight">{module.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{module.description}</p>
                </div>
              );

              return module.href ? <Link key={module.title} to={module.href}>{content}</Link> : <div key={module.title}>{content}</div>;
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


function OwnerPulseCard({ dashboard }: { dashboard: NonNullable<Awaited<ReturnType<typeof analyticsApi.ownerDashboard>>> }) {
  const { t } = useI18n();
  const pulse = dashboard.business_pulse;
  const recommendations = dashboard.recommendations || [];
  const quickConnect = dashboard.quick_connect || [];
  const toneClass = {
    setup: "border-brand-100 bg-brand-50/70 text-brand-900",
    warning: "border-amber-100 bg-amber-50/80 text-amber-900",
    attention: "border-ai-100 bg-ai-50/70 text-ai-900",
    growth: "border-emerald-100 bg-emerald-50/80 text-emerald-900",
  }[pulse?.tone || "setup"];

  if (!pulse) return null;

  return (
    <Card className={`mt-6 overflow-hidden ${toneClass}`}>
      <CardBody className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ring-1 ring-white/80">
            <Bot size={15} /> {t("dashboard.aiPulse")}
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight">{pulse.title}</h2>
          <p className="mt-2 text-sm leading-6 opacity-80">{pulse.text}</p>
          {pulse.primary_action ? (
            <Link to={pulse.primary_action.href} className="mt-4 inline-flex">
              <Button variant="ai"><PlugZap size={16} />{pulse.primary_action.label}</Button>
            </Link>
          ) : null}
          {dashboard.setup ? (
            <p className="mt-4 text-xs font-bold opacity-70">{t("dashboard.connectionReadiness", { score: dashboard.setup.score })}</p>
          ) : null}
        </div>
        <div className="grid gap-3">
          <div className="rounded-3xl bg-white/70 p-4 ring-1 ring-white/80">
            <p className="text-sm font-black text-midnight">{t("dashboard.zaniRecommendations")}</p>
            <div className="mt-3 space-y-3">
              {recommendations.slice(0, 3).map((item) => (
                <Link key={item.key} to={item.href} className="block rounded-2xl bg-white/70 p-3 transition hover:bg-white hover:shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-midnight">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.priority === "high" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{item.priority}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {quickConnect.map((item) => (
              <Link key={item.key} to={item.href} className="rounded-2xl bg-white/70 p-3 ring-1 ring-white/80 transition hover:bg-white hover:shadow-soft">
                <p className="text-sm font-black text-midnight">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                <div className="mt-2"><SetupStatusPill status={item.status} /></div>
              </Link>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}


function MobileOwnerOnboardingCard({ dashboard }: { dashboard: NonNullable<Awaited<ReturnType<typeof analyticsApi.ownerDashboard>>> }) {
  const { t } = useI18n();
  const onboarding = dashboard.mobile_onboarding;
  if (!onboarding) return null;
  const completed = onboarding.steps.filter((step) => step.status === "done").length;
  const total = onboarding.steps.length || 1;

  return (
    <Card className="mb-6 overflow-hidden border-brand-100 bg-white/90 lg:hidden">
      <CardBody className="relative space-y-5">
        <div className="absolute -right-10 -top-10 h-28 w-48 rotate-6 rounded-[2rem] bg-brand-100/80 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-midnight text-white shadow-soft">
            <Smartphone size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("dashboard.ownerMobileStart")}</p>
            <h2 className="mt-1 text-xl font-black leading-tight text-midnight">{onboarding.headline}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{onboarding.subtext}</p>
          </div>
        </div>

        <div className="relative rounded-3xl bg-slate-950 p-4 text-white">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">{t("dashboard.businessReadiness")}</p>
              <p className="mt-1 text-4xl font-black">{onboarding.score}%</p>
            </div>
            <p className="pb-1 text-right text-xs font-semibold text-white/60">{t("dashboard.stepsReady", { completed, total })}</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.max(0, Math.min(onboarding.score, 100))}%` }} />
          </div>
        </div>

        <div className="relative flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {onboarding.steps.map((step) => (
            <Link
              key={step.key}
              to={step.href}
              className="min-w-[78%] rounded-3xl border border-slate-100 bg-white p-4 shadow-sm transition active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-midnight">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${step.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"}`}>
                  {step.status === "done" ? t("dashboard.stepDone") : t("dashboard.step")}
                </span>
              </div>
              <p className="mt-3 text-xs font-black text-brand-700">{step.cta}</p>
            </Link>
          ))}
        </div>

        <Link to={onboarding.primary_action.href} className="relative block">
          <Button variant="ai" className="h-12 w-full rounded-2xl text-base">
            {onboarding.primary_action.label}
          </Button>
        </Link>
      </CardBody>
    </Card>
  );
}

function ManagerWorkQueue({
  leads,
  appointments,
  tasks,
  clients,
  services,
}: {
  leads: Lead[];
  appointments: Appointment[];
  tasks: Task[];
  clients: Client[];
  services: Service[];
}) {
  const { t } = useI18n();
  const urgentLeads = leads.filter((lead) => ["new", "in_progress", "contacted"].includes(lead.status)).slice(0, 4);
  const todayAppointments = appointments.filter((appointment) => isTodayDate(appointment.start_at)).slice(0, 4);
  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").slice(0, 4);

  return (
    <div className="mb-6 grid gap-4 xl:grid-cols-3">
      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">{t("dashboard.queue")}</p>
              <h2 className="mt-1 text-lg font-black text-midnight">{t("dashboard.leadsToAnswer")}</h2>
            </div>
            <Link to="/dashboard/leads" className="text-sm font-black text-brand-700">{t("common.all")}</Link>
          </div>
          <div className="mt-4 space-y-3">
            {urgentLeads.map((lead) => {
              const client = clients.find((item) => item.id === lead.client);
              const service = services.find((item) => item.id === lead.service);
              return (
                <Link key={lead.id} to="/dashboard/leads" className="block rounded-2xl border border-slate-100 bg-white/75 p-3 transition hover:bg-white hover:shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-midnight">{client?.full_name || t("dashboard.leadNumber", { id: lead.id })}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{service?.name || lead.source} · {lead.message || t("dashboard.noMessage")}</p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                </Link>
              );
            })}
            {!urgentLeads.length ? <EmptyState title={t("dashboard.noUrgentLeads")} description={t("dashboard.noUrgentLeadsText")} /> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("common.today")}</p>
              <h2 className="mt-1 text-lg font-black text-midnight">{t("nav.appointments")}</h2>
            </div>
            <Link to="/dashboard/calendar" className="text-sm font-black text-brand-700">{t("nav.calendar")}</Link>
          </div>
          <div className="mt-4 space-y-3">
            {todayAppointments.map((appointment) => {
              const client = clients.find((item) => item.id === appointment.client);
              const service = services.find((item) => item.id === appointment.service);
              return (
                <Link key={appointment.id} to="/dashboard/calendar" className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white/75 p-3 transition hover:bg-white hover:shadow-soft">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                    <CalendarCheck size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-midnight">{client?.full_name || t("common.client")}</p>
                    <p className="mt-1 text-xs text-slate-500">{service?.name || t("common.service")} · {formatDateTime(appointment.start_at)}</p>
                  </div>
                </Link>
              );
            })}
            {!todayAppointments.length ? <EmptyState title={t("dashboard.noBookingsToday")} description={t("dashboard.noBookingsTodayText")} /> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ai-700">Follow-up</p>
              <h2 className="mt-1 text-lg font-black text-midnight">{t("dashboard.myTasks")}</h2>
            </div>
            <Link to="/dashboard/tasks" className="text-sm font-black text-brand-700">{t("nav.tasks")}</Link>
          </div>
          <div className="mt-4 space-y-3">
            {openTasks.map((task) => (
              <Link key={task.id} to="/dashboard/tasks" className="block rounded-2xl border border-slate-100 bg-white/75 p-3 transition hover:bg-white hover:shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-midnight">{task.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{task.due_at ? formatDateTime(task.due_at) : t("dashboard.noDueDate")}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{task.priority}</span>
                </div>
              </Link>
            ))}
            {!openTasks.length ? <EmptyState title={t("dashboard.noOpenTasks")} description={t("dashboard.noOpenTasksText")} /> : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const { business, isLoading: businessLoading } = useActiveBusiness();
  const { clients, leads, appointments, services, tasks } = useEntityData({
    clients: true,
    leads: true,
    appointments: true,
    services: true,
    tasks: true,
  });
  const { t } = useI18n();
  const { user } = useAuth();
  const activeMembership = user?.memberships?.find((membership) => Number(membership.business) === Number(business?.id));
  const businessRole = activeMembership?.role || user?.role || "staff";
  const isOwnerView = isOwnerDashboardRole(businessRole);
  const metrics = useQuery({
    queryKey: ["owner-dashboard", business?.id],
    queryFn: () => analyticsApi.ownerDashboard(business?.id),
    enabled: Boolean(business && isOwnerView),
  });
  const onboarding = useQuery({
    queryKey: ["onboarding-status", business?.id],
    queryFn: () => onboardingApi.status(business!.id),
    enabled: Boolean(business),
    retry: false,
  });
  const subscription = useQuery({
    queryKey: ["current-subscription", business?.id],
    queryFn: billingApi.currentSubscription,
    enabled: Boolean(business),
    retry: false,
  });

  if (businessLoading || clients.isLoading || leads.isLoading || appointments.isLoading || services.isLoading || tasks.isLoading || (isOwnerView && metrics.isLoading)) return <PageSkeleton />;
  if (!business) {
    return <ErrorState message={t("dashboard.noBusiness")} />;
  }

  const leadList = leads.data || [];
  const appointmentList = appointments.data || [];
  const taskList = tasks.data || [];
  const serviceList = services.data || [];
  const clientList = clients.data || [];
  const dashboard = metrics.data;
  const setupItems = [
    Boolean(business.landing_id || business.landing_domain || business.landing_preview_url),
    serviceList.length > 0,
    clientList.length > 0,
    leadList.length > 0,
    appointmentList.length > 0,
    taskList.length > 0,
    (onboarding.data?.progress || 0) >= 60,
  ];
  const setupScore = Math.round((setupItems.filter(Boolean).length / setupItems.length) * 100);
  const isLandingActivated = Boolean(business.landing_id || business.landing_domain || business.landing_preview_url);
  const shouldShowActivationDashboard = isOwnerView && isLandingActivated && (onboarding.data?.progress || 0) < 100;
  const activationModules = [
    {
      title: "WhatsApp",
      description: t("dashboard.moduleWhatsapp"),
      status: "connect" as const,
      icon: MessageCircle,
      href: "/dashboard/integrations",
    },
    {
      title: t("dashboard.moduleAiBot"),
      description: t("dashboard.moduleAiBotText"),
      status: "beta" as const,
      icon: Bot,
      href: "/dashboard/ai",
    },
    {
      title: t("dashboard.moduleTeam"),
      description: t("dashboard.moduleTeamText"),
      status: "connect" as const,
      icon: Users,
      href: "/dashboard/settings",
    },
    {
      title: t("nav.services"),
      description: t("dashboard.moduleServicesText"),
      status: serviceList.length ? "connected" as const : "connect" as const,
      icon: ClipboardList,
      href: "/dashboard/services",
    },
    {
      title: t("dashboard.moduleSales"),
      description: t("dashboard.moduleSalesText"),
      status: leadList.length ? "connected" as const : "connect" as const,
      icon: Flame,
      href: "/dashboard/leads",
    },
    {
      title: "Excel / CSV",
      description: t("dashboard.moduleImportText"),
      status: "connect" as const,
      icon: FileSpreadsheet,
      href: "/dashboard/settings",
    },
    {
      title: "1C export",
      description: t("dashboard.module1cText"),
      status: "request" as const,
      icon: Package,
    },
    {
      title: t("dashboard.moduleWarehouse"),
      description: t("dashboard.moduleWarehouseText"),
      status: "soon" as const,
      icon: Store,
    },
  ];
  const assignedTasks = taskList.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const myPendingLeads = leadList.filter((lead) => ["new", "contacted", "in_progress"].includes(lead.status));
  const todayAppointmentsLocal = appointmentList.filter((appointment) => isTodayDate(appointment.start_at));
  const closedLeadCount = leadList.filter((lead) => lead.status === "appointment_created" || lead.status === "closed").length;
  const newLeadsCount = isOwnerView ? dashboard?.new_leads ?? myPendingLeads.length : myPendingLeads.length;
  const todayAppointmentsCount = isOwnerView ? dashboard?.appointments_today ?? todayAppointmentsLocal.length : todayAppointmentsLocal.length;
  const conversion = isOwnerView ? dashboard?.conversion_lead_to_appointment ?? (leadList.length ? Math.round((closedLeadCount / leadList.length) * 100) : 0) : 0;
  const openTasks = isOwnerView ? dashboard?.open_tasks ?? assignedTasks.length : assignedTasks.length;
  const overdueTasks = dashboard?.overdue_tasks || 0;
  const revenue = Number(dashboard?.revenue_estimate || 0);

  return (
    <>
      <PageHeader
        title={isOwnerView ? t("dashboard.title") : t("dashboard.managerTitle")}
        description={isOwnerView ? t("dashboard.ownerPageDescription") : t("dashboard.managerPageDescription")}
      />

      <BusinessBankingHero
        businessName={business.name}
        isOwnerView={isOwnerView}
        revenue={revenue}
        newLeadsCount={newLeadsCount}
        todayAppointmentsCount={todayAppointmentsCount}
        openTasks={openTasks}
        overdueTasks={overdueTasks}
        conversion={conversion}
        managerLeadsCount={myPendingLeads.length}
        managerTasksCount={assignedTasks.length}
      />

      <QuickActionDock isOwnerView={isOwnerView} />

      {metrics.error ? (
        <div className="mb-5 rounded-3xl border border-amber-100 bg-amber-50/80 px-5 py-4 text-sm font-semibold text-amber-800">
          {t("dashboard.ownerAnalyticsError")}
        </div>
      ) : null}

      {!shouldShowActivationDashboard ? (
        <FocusStrip
          isOwnerView={isOwnerView}
          newLeadsCount={newLeadsCount}
          todayAppointmentsCount={todayAppointmentsCount}
          openTasks={openTasks}
          overdueTasks={overdueTasks}
          source={dashboard?.leads_by_source?.[0]?.source}
        />
      ) : null}

      {isOwnerView && dashboard?.mobile_onboarding ? <MobileOwnerOnboardingCard dashboard={dashboard} /> : null}

      {shouldShowActivationDashboard ? (
        <ActivationDashboard
          businessName={business.name}
          setupScore={setupScore}
          trialEndsAt={subscription.data?.next_payment_at}
          landingDomain={business.landing_domain}
          landingPreviewUrl={business.landing_preview_url}
          modules={activationModules}
        />
      ) : null}

      {!shouldShowActivationDashboard ? (
      <>
      {!isOwnerView ? (
        <ManagerWorkQueue
          leads={leadList}
          appointments={appointmentList}
          tasks={taskList}
          clients={clientList}
          services={serviceList}
        />
      ) : null}

      {!isOwnerView ? (
        <Card className="mb-5 overflow-hidden border-brand-100">
          <CardBody className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">{t("dashboard.operatorWorkspace")}</p>
              <h2 className="mt-2 text-2xl font-black text-midnight">{t("dashboard.operatorFocus")}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                {t("dashboard.operatorFocusText")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Link to="/dashboard/leads" className="rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-white hover:shadow-soft">
                <p className="text-2xl font-black text-midnight">{myPendingLeads.length}</p>
                <p className="text-xs font-bold text-slate-500">{t("dashboard.leadsLabel")}</p>
              </Link>
              <Link to="/dashboard/conversations" className="rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-white hover:shadow-soft">
                <MessageSquareText className="mx-auto text-brand-600" size={22} />
                <p className="mt-1 text-xs font-bold text-slate-500">{t("dashboard.chatsLabel")}</p>
              </Link>
              <Link to="/dashboard/tasks" className="rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-white hover:shadow-soft">
                <p className="text-2xl font-black text-midnight">{assignedTasks.length}</p>
                <p className="text-xs font-bold text-slate-500">{t("dashboard.tasksLabel")}</p>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label={t("dashboard.newLeads")} value={newLeadsCount} hint={t("dashboard.needProcess")} icon={Flame} tone="amber" />
        <Metric label={t("dashboard.appointments")} value={todayAppointmentsCount} hint={t("common.today")} icon={CalendarCheck} tone="brand" />
        <Metric label={t("nav.clients")} value={clients.data?.length || 0} hint={t("dashboard.inCrmBase")} icon={Users} tone="green" />
        {isOwnerView ? <Metric label={t("dashboard.conversion")} value={`${conversion}%`} hint={t("dashboard.leadToBooking")} icon={CheckCircle2} tone="ai" /> : null}
        <Metric label={t("nav.tasks")} value={openTasks} hint={overdueTasks ? `${t("dashboard.overdueCount")}: ${overdueTasks}` : t("dashboard.openFollowups")} icon={ListChecks} />
      </div>

      {isOwnerView && dashboard?.business_pulse ? <OwnerPulseCard dashboard={dashboard} /> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-midnight">{t("dashboard.attention")}</h2>
                <p className="mt-1 text-sm text-slate-500">{t("dashboard.attentionText")}</p>
              </div>
            </div>
            <div className="space-y-3">
              <Link to="/dashboard/leads" className="block rounded-2xl border border-slate-100 bg-white/70 p-4 transition hover:bg-slate-50">
                <p className="font-semibold text-midnight">{t("dashboard.answerNewLeads")}</p>
                <p className="mt-1 text-sm text-slate-500">{t("dashboard.newLeadsWaiting", { count: newLeadsCount })}</p>
              </Link>
              <Link to="/dashboard/appointments" className="block rounded-2xl border border-slate-100 bg-white/70 p-4 transition hover:bg-slate-50">
                <p className="font-semibold text-midnight">{t("dashboard.checkBookingsToday")}</p>
                <p className="mt-1 text-sm text-slate-500">{t("dashboard.bookingsInCalendar", { count: todayAppointmentsCount })}</p>
              </Link>
              <Link to="/dashboard/tasks" className="block rounded-2xl border border-slate-100 bg-white/70 p-4 transition hover:bg-slate-50">
                <p className="font-semibold text-midnight">{t("dashboard.openTeamTasks")}</p>
                <p className="mt-1 text-sm text-slate-500">{t("dashboard.openClientTasksCount", { count: openTasks })}</p>
              </Link>
              {isOwnerView ? (
                <Link to="/dashboard/analytics" className="block rounded-2xl border border-slate-100 bg-white/70 p-4 transition hover:bg-slate-50">
                  <p className="font-semibold text-midnight">{t("dashboard.checkLeadSources")}</p>
                  <p className="mt-1 text-sm text-slate-500">{t("dashboard.leadSourcesHint", { source: dashboard?.leads_by_source?.[0]?.source || t("dashboard.sources") })}</p>
                </Link>
              ) : null}
              {isOwnerView && dashboard?.data_quality && !dashboard.data_quality.has_sales_data ? (
                <Link to="/dashboard/settings#data-tools" className="block rounded-2xl border border-amber-100 bg-amber-50 p-4 transition hover:bg-amber-100/70">
                  <p className="font-semibold text-amber-900">{t("dashboard.connectSalesData")}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">{dashboard.data_quality.recommendation}</p>
                </Link>
              ) : null}
              {onboarding.data && onboarding.data.progress < 100 ? (
                <Link to="/dashboard/onboarding" className="block rounded-2xl border border-brand-100 bg-brand-50 p-4 transition hover:bg-brand-100/70">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-brand-700">
                      <Rocket size={17} />
                    </div>
                    <div>
                      <p className="font-semibold text-midnight">{t("dashboard.finishQuickStart")}</p>
                      <p className="mt-1 text-sm text-slate-600">{t("dashboard.crmReadiness", { progress: onboarding.data.progress })}</p>
                    </div>
                  </div>
                </Link>
              ) : null}
              {isOwnerView ? (
                <Link to="/dashboard/pilot-readiness" className="block rounded-2xl border border-emerald-100 bg-emerald-50 p-4 transition hover:bg-emerald-100/70">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-emerald-700">
                      <ShieldCheck size={17} />
                    </div>
                    <div>
                      <p className="font-semibold text-midnight">{t("dashboard.checkPilotReadiness")}</p>
                      <p className="mt-1 text-sm text-slate-600">{t("dashboard.pilotReadinessText")}</p>
                    </div>
                  </div>
                </Link>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">{t("dashboard.latestLeads")}</h2>
            <div className="mt-4 space-y-3">
              {leadList.slice(0, 6).map((lead) => {
                const client = clients.data?.find((item) => item.id === lead.client);
                const service = services.data?.find((item) => item.id === lead.service);
                return (
                  <Link key={lead.id} to="/dashboard/leads" className="block rounded-2xl border border-slate-100 bg-white/70 p-3 transition hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-midnight">{client?.full_name || t("dashboard.leadNumber", { id: lead.id })}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{service?.name || lead.source} · {formatDateTime(lead.created_at)}</p>
                      </div>
                      <StatusBadge status={lead.status} />
                    </div>
                  </Link>
                );
              })}
              {!leadList.length ? (
                <EmptyState
                  title={t("dashboard.noLeads")}
                  description={t("dashboard.noLeadsText")}
                  action={<Link to="/dashboard/leads"><Button variant="secondary"><Plus size={16} />{t("dashboard.goLeads")}</Button></Link>}
                />
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold text-midnight">{t("dashboard.upcomingBookings")}</h2>
            <div className="mt-4 space-y-4">
              {appointmentList.slice(0, 6).map((appointment) => {
                const client = clients.data?.find((item) => item.id === appointment.client);
                const service = services.data?.find((item) => item.id === appointment.service);
                return (
                  <div key={appointment.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white/70 p-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                      <CalendarCheck size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-midnight">{client?.full_name || t("dashboard.client")}</p>
                      <p className="mt-1 text-sm text-slate-500">{service?.name || t("common.service")} · {formatDateTime(appointment.start_at)}</p>
                    </div>
                  </div>
                );
              })}
              {!appointmentList.length ? (
                <EmptyState
                  title={t("dashboard.noBookings")}
                  description={t("dashboard.noBookingsText")}
                  action={<Link to="/dashboard/appointments"><Button variant="secondary"><CalendarPlus size={16} />{t("appointment.create")}</Button></Link>}
                />
              ) : null}
            </div>
          </CardBody>
        </Card>

        {isOwnerView ? <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-midnight">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-midnight">{t("dashboard.clientBase")}</h2>
                <p className="text-sm text-slate-500">{t("dashboard.clientsInCrm", { count: clients.data?.length || 0 })}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                <p className="text-sm font-semibold text-midnight">{t("dashboard.quickStart")}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{t("dashboard.quickStartText")}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                <p className="text-sm font-semibold text-midnight">{t("dashboard.revenue")}</p>
                <p className="mt-1 text-2xl font-bold text-midnight">{`${revenue.toLocaleString("ru-RU")} ₸`}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {dashboard?.sales_events_count ? t("dashboard.revenueExactText") : t("dashboard.revenueEstimateText")}
                </p>
              </div>
            </div>
          </CardBody>
        </Card> : null}
      </div>
      </>
      ) : null}
    </>
  );
}
