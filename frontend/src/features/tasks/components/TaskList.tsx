import { CheckCircle2, CircleAlert, CircleDashed, Clock3, Pause, Play, Plus, Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { CRM_TABLE_ROW_HEIGHT } from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { EmptyState } from "../../../components/ui/StateViews";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import { TaskActiveFilters, type TaskFilterActions, type TaskFilterState, type TaskTabFilter } from "./TaskHeaderFilters";
import { TaskWorkloadPanel } from "./TaskWorkloadPanel";
import type { CrmDrawerEntity } from "../../../components/crm/CrmEntityDrawer";
import type { TaskSummary, TaskWorkloadResponse } from "../../../api/tasks";
import type { Task, TeamMember } from "../../../types";

type TaskListProps = {
  tasks: Task[];
  totalCount?: number;
  summary?: TaskSummary;
  workload?: TaskWorkloadResponse;
  searchQuery?: string;
  onSearchChange: (value: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  filterState: TaskFilterState;
  filterActions: TaskFilterActions;
  activeFilterCount: number;
  teamMembers: TeamMember[];
  onOpenTask: (task: Task) => void;
  onOpenEntity: (entity: CrmDrawerEntity) => void;
  onCreateTask: () => void;
};

export function TaskList({
  tasks,
  totalCount,
  summary,
  workload,
  searchQuery = "",
  onSearchChange,
  emptyTitle,
  emptyDescription,
  filterState,
  filterActions,
  activeFilterCount,
  teamMembers,
  onOpenTask,
  onOpenEntity,
  onCreateTask,
}: TaskListProps) {
  const { t } = useI18n();
  const stats = getTaskStats(summary, t);

  return (
    <div className="px-4 pb-6 sm:px-6 lg:px-8">
      <section className="mb-4 grid w-full gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.key} className="min-h-[94px] rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${stat.iconClass}`}>
                  <Icon size={18} />
                </div>
                <span className="text-2xl font-black text-midnight">{stat.count}</span>
              </div>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.08em] text-midnight">{stat.title}</p>
              <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{stat.description}</p>
            </div>
          );
        })}
      </section>

      <TaskWorkloadPanel workload={workload} selectedAssignee={filterState.assigneeFilter} onSelectAssignee={filterActions.setAssigneeFilter} />

      <TaskTableSection
        title={searchQuery ? t("tasks.searchResults") : t("tasks.allTasks")}
        description={
          searchQuery
            ? t("tasks.searchResultsMeta", { query: searchQuery, count: totalCount ?? tasks.length })
            : t("tasks.allTasksMeta", { count: totalCount ?? tasks.length })
        }
        tasks={tasks}
        totalCount={totalCount}
        onOpenTask={onOpenTask}
        onOpenEntity={onOpenEntity}
        filterState={filterState}
        filterActions={filterActions}
        activeFilterCount={activeFilterCount}
        teamMembers={teamMembers}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      {!tasks.length ? (
        <Card variant="outlined" className="mt-3 overflow-hidden">
          <EmptyState
            title={emptyTitle || t("tasks.emptyTitle")}
            description={emptyDescription || t("tasks.emptyText")}
            action={
              <Button variant="secondary" onClick={onCreateTask}>
                <Plus size={16} />
                {t("tasks.create")}
              </Button>
            }
          />
        </Card>
      ) : null}
    </div>
  );
}

function TaskTableSection({
  title,
  description,
  tasks,
  totalCount,
  onOpenTask,
  onOpenEntity,
  filterState,
  filterActions,
  activeFilterCount,
  teamMembers,
  searchQuery,
  onSearchChange,
}: {
  title: string;
  description: string;
  tasks: Task[];
  totalCount?: number;
  onOpenTask: (task: Task) => void;
  onOpenEntity: (entity: CrmDrawerEntity) => void;
  filterState: TaskFilterState;
  filterActions: TaskFilterActions;
  activeFilterCount: number;
  teamMembers: TeamMember[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
        </div>
        <div className="flex items-center rounded-lg bg-slate-100 p-1">
          <span className="inline-flex h-8 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-brand-700 shadow-sm">
            <span className="rounded bg-brand-600 px-1.5 py-0.5 text-xs text-white">{totalCount ?? tasks.length}</span>
            {t("tasks.all")}
          </span>
          <span className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-black text-slate-500">
            <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600">{tasks.filter((task) => task.status === "in_progress").length}</span>
            {t("tasks.inProgress")}
          </span>
        </div>
      </div>

      <TaskTableFilters
        filterState={filterState}
        filterActions={filterActions}
        activeFilterCount={activeFilterCount}
        teamMembers={teamMembers}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      {tasks.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="h-10 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="w-[34%] px-3 py-2">{t("tasks.tableTask")}</th>
                <th className="w-[13%] px-3 py-2">{t("tasks.tableStatus")}</th>
                <th className="w-[13%] px-3 py-2">{t("tasks.tableDue")}</th>
                <th className="w-[12%] px-3 py-2">{t("tasks.tablePriority")}</th>
                <th className="w-[16%] px-3 py-2">{t("tasks.tableLink")}</th>
                <th className="w-[14%] px-3 py-2">{t("tasks.tableAssignee")}</th>
                <th className="w-[10%] px-3 py-2">{t("tasks.tableActivity")}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <TaskTableRow key={task.id} task={task} onOpenTask={onOpenTask} onOpenEntity={onOpenEntity} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function TaskTableFilters({
  filterState,
  filterActions,
  activeFilterCount,
  teamMembers,
  searchQuery,
  onSearchChange,
}: {
  filterState: TaskFilterState;
  filterActions: TaskFilterActions;
  activeFilterCount: number;
  teamMembers: TeamMember[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const tabOptions: Array<{ value: TaskTabFilter; label: string }> = [
    { value: "team", label: t("tasks.all") },
    { value: "my", label: t("tasks.my") },
    { value: "today", label: t("common.today") },
    { value: "overdue", label: t("tasks.overdue") },
  ];

  return (
    <div className="border-b border-slate-100 bg-white px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {tabOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={filterState.tabFilter === option.value ? "primary" : "secondary"}
              className="h-9 min-h-9 rounded-lg px-3 text-sm"
              onClick={() => filterActions.setTabFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[220px_150px_160px_190px_150px_160px]">
          <Input
            className="h-9 text-sm"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("search.placeholder.tasks")}
            leftIcon={<Search size={15} />}
            rightIcon={searchQuery ? <button type="button" onClick={() => onSearchChange("")} className="rounded-full p-1 text-slate-500 hover:bg-slate-100" aria-label={t("search.close")}><X size={13} /></button> : null}
            aria-label={t("common.search")}
          />
          <Select
            className="min-h-9 rounded-lg py-1.5 text-sm"
            value={filterState.statusFilter}
            onChange={(event) => filterActions.setStatusFilter(event.target.value)}
            options={[
              { value: "all", label: t("tasks.all") },
              { value: "active", label: t("tasks.active") },
              { value: "open", label: t("tasks.open") },
              { value: "in_progress", label: t("tasks.inProgress") },
              { value: "done", label: t("tasks.done") },
              { value: "cancelled", label: t("tasks.cancelled") },
            ]}
          />
          <Select
            className="min-h-9 rounded-lg py-1.5 text-sm"
            value={filterState.priorityFilter}
            onChange={(event) => filterActions.setPriorityFilter(event.target.value)}
            options={[
              { value: "", label: t("tasks.allPriorities") },
              { value: "urgent", label: t("tasks.priorityUrgent") },
              { value: "high", label: t("tasks.priorityHigh") },
              { value: "normal", label: t("tasks.priorityNormal") },
              { value: "low", label: t("tasks.priorityLow") },
            ]}
          />
          <Select
            className="min-h-9 rounded-lg py-1.5 text-sm"
            value={filterState.assigneeFilter}
            onChange={(event) => filterActions.setAssigneeFilter(event.target.value)}
            options={[
              { value: "", label: t("tasks.allAssignees") },
              { value: "unassigned", label: t("tasks.noAssignee") },
              ...teamMembers.filter((member) => member.is_active).map((member) => ({
                value: String(member.user.id),
                label: member.user.full_name || member.user.email,
              })),
            ]}
          />
          <Select
            className="min-h-9 rounded-lg py-1.5 text-sm"
            value={filterState.dueFilter}
            onChange={(event) => {
              filterActions.setDueFilter(event.target.value);
              if (event.target.value) {
                filterActions.setDueFromFilter("");
                filterActions.setDueToFilter("");
              }
            }}
            options={[
              { value: "", label: t("tasks.allDue") },
              { value: "past", label: t("tasks.duePast") },
              { value: "today", label: t("tasks.dueToday") },
              { value: "future", label: t("tasks.dueFuture") },
              { value: "none", label: t("tasks.dueNone") },
            ]}
          />
          <Select
            className="min-h-9 rounded-lg py-1.5 text-sm"
            value={filterState.relationFilter}
            onChange={(event) => filterActions.setRelationFilter(event.target.value)}
            options={[
              { value: "", label: t("tasks.allRelations") },
              { value: "client", label: t("common.client") },
              { value: "lead", label: t("nav.leads") },
              { value: "deal", label: t("nav.deals") },
              { value: "appointment", label: t("nav.calendar") },
              { value: "conversation", label: t("nav.conversations") },
              { value: "none", label: t("tasks.noLinkedEntities") },
            ]}
          />
        </div>
      </div>
      {activeFilterCount ? (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          <TaskActiveFilters {...filterState} {...filterActions} teamMembers={teamMembers} />
        </div>
      ) : null}
    </div>
  );
}

function TaskTableRow({ task, onOpenTask, onOpenEntity }: { task: Task; onOpenTask: (task: Task) => void; onOpenEntity: (entity: CrmDrawerEntity) => void }) {
  const { t } = useI18n();
  const StatusIcon = task.status === "in_progress" ? Pause : Play;
  return (
    <tr
      className="group cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/80 focus-within:bg-slate-50"
      style={{ minHeight: CRM_TABLE_ROW_HEIGHT }}
      onClick={() => onOpenTask(task)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenTask(task);
        }
      }}
    >
      <td className="px-3 py-2 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${task.status === "in_progress" ? "bg-brand-600 text-white" : "bg-slate-100 text-brand-700"}`}>
            <StatusIcon size={15} fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 font-black text-midnight">{task.title}</p>
            {task.description ? <p className="mt-1 line-clamp-1 text-sm font-medium text-slate-500">{task.description}</p> : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 align-middle">
        <DotLabel colorClass={statusDotClass(task.status)}>{statusLabel(task.status, t)}</DotLabel>
      </td>
      <td className="px-3 py-2 align-middle text-sm font-semibold text-slate-600">{task.due_at ? formatDateTime(task.due_at) : t("tasks.groupNoDue")}</td>
      <td className="px-3 py-2 align-middle">
        <DotLabel colorClass={priorityDotClass(task.priority)}>{priorityLabel(task.priority, t)}</DotLabel>
      </td>
      <td className="px-3 py-2 align-middle">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <RelatedEntities task={task} onOpenEntity={onOpenEntity} />
        </div>
      </td>
      <td className="max-w-[190px] truncate px-3 py-2 align-middle text-sm font-semibold text-slate-600">{task.assignee_name || task.assignee_email || t("tasks.noAssignee")}</td>
      <td className="px-3 py-2 align-middle">
        <div className="flex flex-col gap-1 text-xs font-bold text-slate-500">
          <span>{t("tasks.commentsCount", { count: task.comments_count || 0 })}</span>
          <span>{t("tasks.watchersCount", { count: task.watchers_count || 0 })}</span>
        </div>
      </td>
    </tr>
  );
}

function DotLabel({ colorClass, children }: { colorClass: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
      <span className={`h-1.5 w-1.5 rounded-full ${colorClass}`} />
      {children}
    </span>
  );
}

function RelatedEntities({ task, onOpenEntity }: { task: Task; onOpenEntity: (entity: CrmDrawerEntity) => void }) {
  const { t } = useI18n();
  const entities = [
    task.client ? { key: "client", label: task.client_name || t("common.client"), entity: { type: "client", id: Number(task.client) } as CrmDrawerEntity } : null,
    task.lead ? { key: "lead", label: task.lead_title || t("crmCard.leadNumber", { id: task.lead }), entity: { type: "lead", id: Number(task.lead) } as CrmDrawerEntity } : null,
    task.deal ? { key: "deal", label: task.deal_title || t("nav.deals"), entity: { type: "deal", id: Number(task.deal) } as CrmDrawerEntity } : null,
    task.appointment
      ? {
          key: "appointment",
          label: `${task.appointment_service_name || t("nav.appointments")}${task.appointment_start_at ? ` · ${formatDateTime(task.appointment_start_at)}` : ""}`,
          entity: { type: "appointment", id: Number(task.appointment) } as CrmDrawerEntity,
        }
      : null,
    task.conversation
      ? {
          key: "conversation",
          label: task.conversation_label || task.conversation_external_user_id || t("nav.conversations"),
          href: `/app/conversations?conversation=${task.conversation}`,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; entity?: CrmDrawerEntity; href?: string }>;

  if (!entities.length) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{t("tasks.noClient")}</span>;

  const visibleEntities = entities.slice(0, 1);
  const hiddenCount = entities.length - visibleEntities.length;
  return (
    <>
      {visibleEntities.map((item) => (
        <RelatedAction key={item.key} href={item.href} onClick={item.entity ? () => onOpenEntity(item.entity!) : undefined}>
          {item.label}
        </RelatedAction>
      ))}
      {hiddenCount > 0 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">+{hiddenCount}</span> : null}
    </>
  );
}

function RelatedAction({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  if (href) {
    return (
      <a
        href={href}
        className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

type TaskStat = {
  key: string;
  title: string;
  description: string;
  count: number;
  iconClass: string;
  icon: typeof CircleDashed;
};

function getTaskStats(summary: TaskSummary | undefined, t: (key: string) => string): TaskStat[] {
  return [
    createStat("todo", t("tasks.statTodo"), t("tasks.statTodoText"), summary?.open || 0, "bg-blue-50 text-blue-600", CircleDashed),
    createStat("completed", t("tasks.statCompleted"), t("tasks.statCompletedText"), summary?.closed || 0, "bg-emerald-50 text-emerald-600", CheckCircle2),
    createStat("review", t("tasks.statInReview"), t("tasks.statInReviewText"), summary?.inProgress || 0, "bg-amber-50 text-amber-600", Clock3),
    createStat("blocker", t("tasks.statBlocker"), t("tasks.statBlockerText"), summary?.overdue || 0, "bg-red-50 text-red-600", CircleAlert),
  ];
}

function createStat(key: string, title: string, description: string, count: number, iconClass: string, icon: typeof CircleDashed): TaskStat {
  return { key, title, description, count, iconClass, icon };
}

function statusLabel(status: Task["status"], t: (key: string) => string) {
  const key = `status.${status}`;
  const value = t(key);
  return value === key ? status : value;
}

function priorityLabel(priority: Task["priority"], t: (key: string) => string) {
  const key = `status.${priority}`;
  const value = t(key);
  return value === key ? priority : value;
}

function statusDotClass(status: Task["status"]) {
  if (status === "done") return "bg-emerald-500";
  if (status === "in_progress") return "bg-brand-600";
  if (status === "cancelled") return "bg-red-500";
  return "bg-slate-700";
}

function priorityDotClass(priority: Task["priority"]) {
  if (priority === "urgent") return "bg-red-500";
  if (priority === "high") return "bg-red-500";
  if (priority === "low") return "bg-purple-500";
  return "bg-amber-500";
}
