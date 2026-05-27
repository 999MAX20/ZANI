import { CalendarCheck, Flame, ListChecks, MessageSquareText, Target, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardBody } from "../../components/ui/Card";
import { MetricTile } from "../../components/ui/Primitives";
import { EmptyState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Client, Lead, Service, Task } from "../../types";
import { isTodayDate } from "./dashboardUtils";

type ManagerDashboardProps = {
  businessName: string;
  leads: Lead[];
  appointments: Appointment[];
  tasks: Task[];
  clients: Client[];
  services: Service[];
  newLeadsCount: number;
  todayAppointmentsCount: number;
  openTasks: number;
  overdueTasks: number;
  isCoreDataLoading: boolean;
};

function WorkListCard({
  eyebrow,
  title,
  href,
  children,
}: {
  eyebrow: string;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-black text-midnight">{title}</h2>
          </div>
          <Link to={href} className="text-sm font-black text-brand-700">{t("common.all")}</Link>
        </div>
        <div className="mt-4 space-y-3">{children}</div>
      </CardBody>
    </Card>
  );
}

export function ManagerDashboard({
  businessName,
  leads,
  appointments,
  tasks,
  clients,
  services,
  newLeadsCount,
  todayAppointmentsCount,
  openTasks,
  overdueTasks,
  isCoreDataLoading,
}: ManagerDashboardProps) {
  const { t } = useI18n();
  const urgentLeads = leads.filter((lead) => ["new", "in_progress", "contacted"].includes(lead.status)).slice(0, 4);
  const todayAppointments = appointments.filter((appointment) => isTodayDate(appointment.start_at)).slice(0, 4);
  const openTaskItems = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").slice(0, 4);

  return (
    <div className="pb-6">
      <section className="mb-5 flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-midnight">{t("dashboard.managerTitle")}</h1>
        <p className="text-sm font-semibold text-slate-500">{businessName}</p>
      </section>

      {isCoreDataLoading ? (
        <div className="mb-5 rounded-3xl border border-cyan-100 bg-white/82 px-5 py-4 text-sm font-semibold text-slate-600 shadow-soft">
          {t("dashboard.loadingCoreData")}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label={t("dashboard.newLeads")} value={newLeadsCount} hint={t("dashboard.needProcess")} icon={Flame} tone="amber" />
        <MetricTile label={t("dashboard.appointments")} value={todayAppointmentsCount} hint={t("common.today")} icon={CalendarCheck} tone="brand" />
        <MetricTile label={t("nav.clients")} value={clients.length} hint={t("dashboard.inCrmBase")} icon={Users} tone="green" />
        <MetricTile label={t("nav.tasks")} value={openTasks} hint={overdueTasks ? `${t("dashboard.overdueCount")}: ${overdueTasks}` : t("dashboard.openFollowups")} icon={ListChecks} />
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-white/78 bg-white/90 p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("dashboard.operatorWorkspace")}</p>
            <h2 className="mt-1 text-xl font-black text-midnight">{t("dashboard.operatorFocus")}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Link to="/dashboard/leads" className="rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-white hover:shadow-soft">
              <p className="text-2xl font-black text-midnight">{urgentLeads.length}</p>
              <p className="text-xs font-bold text-slate-500">{t("dashboard.leadsLabel")}</p>
            </Link>
            <Link to="/dashboard/conversations" className="rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-white hover:shadow-soft">
              <MessageSquareText className="mx-auto text-brand-600" size={22} />
              <p className="mt-1 text-xs font-bold text-slate-500">{t("dashboard.chatsLabel")}</p>
            </Link>
            <Link to="/dashboard/deals" className="rounded-2xl bg-slate-50 px-4 py-3 transition hover:bg-white hover:shadow-soft">
              <Target className="mx-auto text-ai-600" size={22} />
              <p className="mt-1 text-xs font-bold text-slate-500">{t("nav.deals")}</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-3">
        <WorkListCard eyebrow={t("dashboard.queue")} title={t("dashboard.leadsToAnswer")} href="/dashboard/leads">
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
        </WorkListCard>

        <WorkListCard eyebrow={t("common.today")} title={t("nav.appointments")} href="/dashboard/calendar">
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
        </WorkListCard>

        <WorkListCard eyebrow={t("dashboard.followUp")} title={t("dashboard.myTasks")} href="/dashboard/tasks">
          {openTaskItems.map((task) => (
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
          {!openTaskItems.length ? <EmptyState title={t("dashboard.noOpenTasks")} description={t("dashboard.noOpenTasksText")} /> : null}
        </WorkListCard>
      </section>
    </div>
  );
}
