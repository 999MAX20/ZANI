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
  WorkQueueConversationItem,
  WorkQueueLeadItem,
  WorkQueueTaskItem,
  WorkQueuesResponse,
} from "../../api/workQueues";
import { Surface } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { IconBubble, MetricTile } from "../../components/ui/Primitives";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/ui/StateViews";
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
  workQueuesError?: unknown;
  isWorkQueuesLoading: boolean;
  retryWorkQueues: () => void;
  role: string;
  access: {
    leads: boolean;
    clients: boolean;
    appointments: boolean;
    tasks: boolean;
    conversations: boolean;
    deals: boolean;
    integrations: boolean;
  };
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

function ConversationWorkRow({
  conversation,
}: {
  conversation: WorkQueueConversationItem;
}) {
  const { t } = useI18n();
  const status =
    conversation.sla_overdue_minutes > 0
      ? "critical"
      : conversation.handoff_required
        ? "high"
        : conversation.priority;

  return (
    <Surface
      as={Link}
      to={conversation.href}
      padding="sm"
      interactive
      className="flex items-start justify-between gap-3 rounded-control"
    >
      <div className="min-w-0">
        <p className="truncate font-bold text-zani-text">{conversation.title}</p>
        <p className="mt-1 truncate text-xs font-semibold text-zani-subtle">
          {conversation.unread_count
            ? t("dashboard.unreadConversationCount", {
                count: conversation.unread_count,
              })
            : conversation.handoff_reason || t("conversations.needsOperator")}
        </p>
      </div>
      <StatusBadge status={status} size="sm" />
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
  workQueuesError,
  isWorkQueuesLoading,
  retryWorkQueues,
  role,
  access,
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
  const queueConversations = Array.from(
    new Map(
      [
        ...(workQueues?.queues.unread_sla_overdue_conversations || []),
        ...(workQueues?.queues.handoff_sla_overdue_conversations || []),
        ...(workQueues?.queues.unread_conversations || []),
        ...(workQueues?.queues.handoff_conversations || []),
      ].map((item) => [item.id, item]),
    ).values(),
  ).slice(0, 4);
  const leadAttentionCount = workQueues?.summary.stale_leads ?? newLeadsCount;
  const appointmentAttentionCount =
    workQueues?.summary.appointment_confirmations ?? todayAppointmentsCount;
  const taskAttentionCount = workQueues?.summary.overdue_tasks ?? openTasks;
  const conversationAttentionCount = workQueues
    ? workQueues.summary.unread_conversations +
      workQueues.summary.handoff_conversations
    : 0;
  const isIndividualWorkspace = [
    "operator",
    "staff",
    "doctor",
    "business_operator",
  ].includes(role);

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

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="role-daily-metrics"
      >
        {access.leads ? (
          <MetricTile
            label={t("dashboard.newLeads")}
            value={leadAttentionCount}
            hint={t("dashboard.needProcess")}
            icon={Flame}
            tone="amber"
          />
        ) : null}
        {access.appointments ? (
          <MetricTile
            label={t("dashboard.appointments")}
            value={appointmentAttentionCount}
            hint={t("dashboard.upcomingWork")}
            icon={CalendarCheck}
            tone="brand"
          />
        ) : null}
        {access.conversations ? (
          <MetricTile
            label={t("nav.conversations")}
            value={conversationAttentionCount}
            hint={t("dashboard.needReply")}
            icon={MessageSquareText}
            tone={conversationAttentionCount ? "amber" : "slate"}
          />
        ) : access.clients ? (
          <MetricTile
            label={t("nav.clients")}
            value={clients.length}
            hint={t("dashboard.inCrmBase")}
            icon={Users}
            tone="green"
          />
        ) : null}
        {access.tasks ? (
          <MetricTile
            label={isIndividualWorkspace ? t("tasks.my") : t("nav.tasks")}
            value={taskAttentionCount}
            hint={
              overdueTasks
                ? `${t("dashboard.overdueCount")}: ${overdueTasks}`
                : t("dashboard.openFollowups")
            }
            icon={ListChecks}
            tone={overdueTasks ? "amber" : "slate"}
          />
        ) : null}
      </section>

      <Surface as="section" padding="lg" data-testid="role-daily-actions">
        <div className="grid gap-2 text-center sm:grid-cols-2 lg:grid-cols-4">
          {access.leads ? (
            <SummaryLink
              href="/app/leads"
              icon={Flame}
              value={leadAttentionCount}
              label={t("dashboard.leadsLabel")}
              tone="brand"
            />
          ) : null}
          {access.conversations ? (
            <SummaryLink
              href="/app/conversations?unread=true&sort=unread"
              icon={MessageSquareText}
              value={conversationAttentionCount}
              label={t("dashboard.chatsLabel")}
              tone={conversationAttentionCount ? "amber" : "brand"}
            />
          ) : null}
          {access.appointments ? (
            <SummaryLink
              href="/app/calendar?view=day"
              icon={CalendarCheck}
              value={appointmentAttentionCount}
              label={t("nav.calendar")}
              tone="green"
            />
          ) : null}
          {access.tasks ? (
            <SummaryLink
              href="/app/tasks?tab=overdue"
              icon={ListChecks}
              value={taskAttentionCount}
              label={t("dashboard.overdueWork")}
              tone={taskAttentionCount ? "amber" : "slate"}
            />
          ) : access.deals ? (
            <SummaryLink
              href="/app/deals?quick=overdue"
              icon={Target}
              label={t("nav.deals")}
              tone="ai"
            />
          ) : null}
        </div>
      </Surface>

      <section className="grid gap-4 xl:grid-cols-3">
        {access.leads ? <WorkListCard
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
        </WorkListCard> : null}

        {access.appointments ? <WorkListCard
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
        </WorkListCard> : null}

        {access.tasks ? <WorkListCard
          eyebrow={t("dashboard.followUp")}
          title={t("dashboard.myTasks")}
          href="/app/tasks"
          emptyTitle={t("dashboard.noOpenTasks")}
          emptyDescription={t("dashboard.noOpenTasksText")}
        >
          {(queueTasks.length ? queueTasks : openTaskItems).map((task) => (
            <TaskWorkRow key={task.id} task={task} />
          ))}
        </WorkListCard> : null}

        {access.conversations ? (
          <WorkListCard
            eyebrow={t("dashboard.queue")}
            title={t("dashboard.managerNoAnswer")}
            href="/app/conversations?unread=true&sort=unread"
            emptyTitle={t("dashboard.noUnreadConversations")}
            emptyDescription={t("dashboard.noUnreadConversationsText")}
          >
            {queueConversations.map((conversation) => (
              <ConversationWorkRow
                key={conversation.id}
                conversation={conversation}
              />
            ))}
          </WorkListCard>
        ) : null}
      </section>
    </div>
  );
}
