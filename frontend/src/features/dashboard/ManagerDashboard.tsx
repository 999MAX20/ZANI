import {
  CalendarCheck,
  Flame,
  ListChecks,
  MessageSquareText,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type {
  WorkQueueAppointmentItem,
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
import type { Appointment, Client, Lead, Service, Task } from "../../types";
import { isTodayDate } from "./dashboardUtils";

type ManagerDashboardProps = {
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
  workQueues?: WorkQueuesResponse;
};

function WorkListCard({
  eyebrow,
  title,
  href,
  children,
  emptyTitle,
  emptyDescription,
}: {
  eyebrow: string;
  title: string;
  href: string;
  children: React.ReactNode[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { t } = useI18n();

  return (
    <Surface as="section" padding="lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-base font-bold text-zani-text">{title}</h2>
        </div>
        <Link to={href} className="text-sm font-bold text-brand-700">
          {t("common.all")}
        </Link>
      </div>
      {children.length ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </Surface>
  );
}

function SummaryLink({
  href,
  icon: Icon,
  value,
  label,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  value?: number;
  label: string;
  tone: "brand" | "ai" | "green" | "amber" | "slate";
}) {
  return (
    <Surface
      as={Link}
      to={href}
      variant="muted"
      padding="none"
      interactive
      className="rounded-control px-4 py-3 text-center"
    >
      {typeof value === "number" ? (
        <p className="text-2xl font-bold tabular-nums text-zani-text">
          {value}
        </p>
      ) : (
        <Icon className="mx-auto text-brand-600" size={22} />
      )}
      <p className="mt-1 text-xs font-bold text-zani-subtle">{label}</p>
      <span
        className={`mx-auto mt-2 block h-1 w-8 rounded-full ${toneDot(tone)}`}
      />
    </Surface>
  );
}

function toneDot(tone: "brand" | "ai" | "green" | "amber" | "slate") {
  if (tone === "ai") return "bg-ai-600";
  if (tone === "green") return "bg-green-600";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "brand") return "bg-brand-600";
  return "bg-zani-border";
}

function LeadWorkRow({
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
  const subtitle =
    "age_hours" in lead
      ? `${lead.source} / ${lead.age_hours ? `${lead.age_hours}h` : t("dashboard.noMessage")}`
      : `${service?.name || lead.source} / ${lead.message || t("dashboard.noMessage")}`;

  return (
    <Surface
      key={lead.id}
      as={Link}
      to={`/app/leads/${lead.id}`}
      padding="sm"
      interactive
      className="flex items-start justify-between gap-3 rounded-control"
    >
      <div className="min-w-0">
        <p className="truncate font-bold text-zani-text">
          {title || t("dashboard.leadNumber", { id: lead.id })}
        </p>
        <p className="mt-1 truncate text-xs font-semibold text-zani-subtle">
          {subtitle}
        </p>
      </div>
      <StatusBadge status={lead.status} size="sm" />
    </Surface>
  );
}

function AppointmentWorkRow({
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
    <Surface
      key={appointment.id}
      as={Link}
      to={`/app/calendar/${appointment.id}`}
      padding="sm"
      interactive
      className="flex items-start gap-3 rounded-control"
    >
      <IconBubble
        icon={CalendarCheck}
        tone="brand"
        className="h-10 w-10 rounded-control"
      />
      <div className="min-w-0">
        <p className="truncate font-bold text-zani-text">
          {title || t("common.client")}
        </p>
        <p className="mt-1 truncate text-xs font-semibold text-zani-subtle">
          {service?.name || t("common.service")} /{" "}
          {formatDateTime(appointment.start_at)}
        </p>
      </div>
    </Surface>
  );
}

function TaskWorkRow({ task }: { task: Task | WorkQueueTaskItem }) {
  const { t } = useI18n();
  const href = "href" in task ? task.href : `/app/tasks/${task.id}`;
  const escalationLevel =
    "escalation_level" in task ? task.escalation_level : task.priority;

  return (
    <Surface
      key={task.id}
      as={Link}
      to={href}
      padding="sm"
      interactive
      className="flex items-start justify-between gap-3 rounded-control"
    >
      <div className="min-w-0">
        <p className="truncate font-bold text-zani-text">{task.title}</p>
        <p className="mt-1 truncate text-xs font-semibold text-zani-subtle">
          {task.due_at ? formatDateTime(task.due_at) : t("dashboard.noDueDate")}
        </p>
      </div>
      <StatusBadge status={escalationLevel} size="sm" />
    </Surface>
  );
}

export function ManagerDashboard({
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
  workQueues,
}: ManagerDashboardProps) {
  const { t } = useI18n();
  const urgentLeads = leads
    .filter((lead) => ["new", "in_progress", "contacted"].includes(lead.status))
    .slice(0, 4);
  const todayAppointments = appointments
    .filter((appointment) => isTodayDate(appointment.start_at))
    .slice(0, 4);
  const openTaskItems = tasks
    .filter((task) => task.status !== "done" && task.status !== "cancelled")
    .slice(0, 4);
  const queueLeads = workQueues?.queues.stale_leads || [];
  const queueAppointments = [
    ...(workQueues?.queues.appointment_confirmations || []),
    ...(workQueues?.queues.upcoming_appointments || []),
  ].slice(0, 4);
  const queueTasks = workQueues?.queues.overdue_tasks || [];
  const leadAttentionCount = workQueues?.summary.stale_leads ?? newLeadsCount;
  const appointmentAttentionCount =
    workQueues?.summary.appointment_confirmations ?? todayAppointmentsCount;
  const taskAttentionCount = workQueues?.summary.overdue_tasks ?? openTasks;

  return (
    <div className="space-y-5 pb-6">
      {isCoreDataLoading ? (
        <Surface
          className="border-brand-100 px-5 py-4 text-sm font-semibold text-zani-subtle"
          padding="none"
        >
          {t("dashboard.loadingCoreData")}
        </Surface>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label={t("dashboard.newLeads")}
          value={leadAttentionCount}
          hint={t("dashboard.needProcess")}
          icon={Flame}
          tone="amber"
        />
        <MetricTile
          label={t("dashboard.appointments")}
          value={appointmentAttentionCount}
          hint={t("common.today")}
          icon={CalendarCheck}
          tone="brand"
        />
        <MetricTile
          label={t("nav.clients")}
          value={clients.length}
          hint={t("dashboard.inCrmBase")}
          icon={Users}
          tone="green"
        />
        <MetricTile
          label={t("nav.tasks")}
          value={taskAttentionCount}
          hint={
            overdueTasks
              ? `${t("dashboard.overdueCount")}: ${overdueTasks}`
              : t("dashboard.openFollowups")
          }
          icon={ListChecks}
          tone={overdueTasks ? "amber" : "slate"}
        />
      </section>

      <Surface as="section" padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
              {t("dashboard.operatorWorkspace")}
            </p>
            <h2 className="mt-1 text-xl font-bold text-zani-text">
              {t("dashboard.operatorFocus")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zani-subtle">
              {t("dashboard.operatorFocusText")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <SummaryLink
              href="/app/leads"
              icon={Flame}
              value={leadAttentionCount}
              label={t("dashboard.leadsLabel")}
              tone="brand"
            />
            <SummaryLink
              href="/app/conversations"
              icon={MessageSquareText}
              label={t("dashboard.chatsLabel")}
              tone="brand"
            />
            <SummaryLink
              href="/app/deals"
              icon={Target}
              label={t("nav.deals")}
              tone="ai"
            />
          </div>
        </div>
      </Surface>

      <section className="grid gap-4 xl:grid-cols-3">
        <WorkListCard
          eyebrow={t("dashboard.queue")}
          title={t("dashboard.leadsToAnswer")}
          href="/app/leads"
          emptyTitle={t("dashboard.noUrgentLeads")}
          emptyDescription={t("dashboard.noUrgentLeadsText")}
        >
          {(queueLeads.length ? queueLeads : urgentLeads).map((lead) => {
            const client =
              "client_id" in lead
                ? clients.find((item) => item.id === lead.client_id)
                : clients.find((item) => item.id === lead.client);
            const service =
              "service" in lead
                ? services.find((item) => item.id === lead.service)
                : undefined;
            return (
              <LeadWorkRow
                key={lead.id}
                lead={lead}
                client={client}
                service={service}
              />
            );
          })}
        </WorkListCard>

        <WorkListCard
          eyebrow={t("common.today")}
          title={t("nav.appointments")}
          href="/app/calendar"
          emptyTitle={t("dashboard.noBookingsToday")}
          emptyDescription={t("dashboard.noBookingsTodayText")}
        >
          {(queueAppointments.length
            ? queueAppointments
            : todayAppointments
          ).map((appointment) => {
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
              <AppointmentWorkRow
                key={appointment.id}
                appointment={appointment}
                client={client}
                service={service}
              />
            );
          })}
        </WorkListCard>

        <WorkListCard
          eyebrow={t("dashboard.followUp")}
          title={t("dashboard.myTasks")}
          href="/app/tasks"
          emptyTitle={t("dashboard.noOpenTasks")}
          emptyDescription={t("dashboard.noOpenTasksText")}
        >
          {(queueTasks.length ? queueTasks : openTaskItems).map((task) => (
            <TaskWorkRow key={task.id} task={task} />
          ))}
        </WorkListCard>
      </section>
    </div>
  );
}
