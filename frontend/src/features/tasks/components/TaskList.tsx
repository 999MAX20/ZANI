import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Clock3,
  Pause,
  Play,
  Plus,
  Search,
  SquareArrowOutUpRight,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { CRM_TABLE_ROW_HEIGHT, CrmTableSurface } from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { EmptyState } from "../../../components/ui/StateViews";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import { TaskActiveFilters, type TaskFilterActions, type TaskFilterState, type TaskTabFilter } from "./TaskHeaderFilters";
import { TaskWorkloadPanel } from "./TaskWorkloadPanel";
import type { CrmDrawerEntity } from "../../../components/crm/CrmEntityDrawer";
import type { TaskSummary, TaskWorkloadResponse } from "../../../api/tasks";
import type { Task, TeamMember } from "../../../types";

type TaskListProps = {
  tasks: Task[];
  selectedTaskId?: Task["id"] | null;
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
  onSelectTask: (task: Task) => void;
  onOpenTask: (task: Task) => void;
  onOpenEntity: (entity: CrmDrawerEntity) => void;
  onCreateTask: () => void;
};

export function TaskList({
  tasks,
  selectedTaskId,
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
  onSelectTask,
  onOpenTask,
  onOpenEntity,
  onCreateTask,
}: TaskListProps) {
  const { t } = useI18n();
  const stats = getTaskStats(summary, t);

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid w-full gap-2 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.key} className="min-h-[84px] rounded-card border border-zani-border bg-surface-card p-3 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-control ${stat.iconClass}`}>
                  <Icon size={18} />
                </div>
                <span className="text-xl font-semibold text-zani-text">{stat.count}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zani-text">{stat.title}</p>
              <p className="mt-1 line-clamp-1 text-xs font-semibold text-zani-muted">{stat.description}</p>
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
        selectedTaskId={selectedTaskId}
        onSelectTask={onSelectTask}
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
        <div className="overflow-hidden rounded-card border border-zani-border bg-surface-card shadow-card">
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
        </div>
      ) : null}
    </div>
  );
}

function TaskTableSection({
  title,
  description,
  tasks,
  totalCount,
  selectedTaskId,
  onSelectTask,
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
  selectedTaskId?: Task["id"] | null;
  onSelectTask: (task: Task) => void;
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
    <CrmTableSurface
      filters={
        <TaskTableFilters
          filterState={filterState}
          filterActions={filterActions}
          activeFilterCount={activeFilterCount}
          teamMembers={teamMembers}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zani-border px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-zani-text">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-zani-muted">{description}</p>
        </div>
        <div className="flex items-center rounded-control bg-surface-muted p-1">
          <span className="inline-flex h-8 items-center gap-2 rounded-control bg-zani-card px-3 text-sm font-bold text-brand-700 shadow-sm">
            <span className="rounded-control bg-brand-600 px-1.5 py-0.5 text-xs text-white">{totalCount ?? tasks.length}</span>
            {t("tasks.all")}
          </span>
          <span className="inline-flex h-8 items-center gap-2 rounded-control px-3 text-sm font-bold text-zani-muted">
            <span className="rounded-control bg-zani-card px-1.5 py-0.5 text-xs text-zani-text">{tasks.filter((task) => task.status === "in_progress").length}</span>
            {t("tasks.inProgress")}
          </span>
        </div>
      </div>

      {tasks.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-zani-card">
              <tr className="h-10 border-b border-zani-border text-xs font-semibold text-zani-muted">
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
                <TaskTableRow
                  key={task.id}
                  task={task}
                  selected={task.id === selectedTaskId}
                  onSelectTask={onSelectTask}
                  onOpenTask={onOpenTask}
                  onOpenEntity={onOpenEntity}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </CrmTableSurface>
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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {tabOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={filterState.tabFilter === option.value ? "primary" : "secondary"}
              className="h-9 min-h-9 rounded-control px-3 text-sm"
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
            rightIcon={searchQuery ? <button type="button" onClick={() => onSearchChange("")} className="rounded-full p-1 text-zani-muted hover:bg-surface-muted" aria-label={t("search.close")}><X size={13} /></button> : null}
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

function TaskTableRow({
  task,
  selected,
  onSelectTask,
  onOpenTask,
  onOpenEntity,
}: {
  task: Task;
  selected: boolean;
  onSelectTask: (task: Task) => void;
  onOpenTask: (task: Task) => void;
  onOpenEntity: (entity: CrmDrawerEntity) => void;
}) {
  const { t } = useI18n();
  const StatusIcon = task.status === "in_progress" ? Pause : Play;
  return (
    <tr
      className={`group cursor-pointer border-b border-zani-border transition hover:bg-surface-hover focus-within:bg-surface-hover ${selected ? "bg-brand-50/70 ring-1 ring-inset ring-brand-200" : ""}`}
      style={{ minHeight: CRM_TABLE_ROW_HEIGHT }}
      onClick={() => onSelectTask(task)}
      tabIndex={0}
      aria-selected={selected}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectTask(task);
        }
      }}
    >
      <td className="px-3 py-2 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-control ${task.status === "in_progress" ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>
            <StatusIcon size={15} fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 font-bold text-zani-text">{task.title}</p>
            {task.description ? <p className="mt-1 line-clamp-1 text-sm font-medium text-zani-muted">{task.description}</p> : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 align-middle">
        <StatusBadge status={task.status} />
      </td>
      <td className="px-3 py-2 align-middle text-sm font-semibold text-zani-muted">{task.due_at ? formatDateTime(task.due_at) : t("tasks.groupNoDue")}</td>
      <td className="px-3 py-2 align-middle">
        <DotLabel colorClass={priorityDotClass(task.priority)}>{priorityLabel(task.priority, t)}</DotLabel>
      </td>
      <td className="px-3 py-2 align-middle">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <RelatedEntities task={task} onOpenEntity={onOpenEntity} />
        </div>
      </td>
      <td className="max-w-[190px] truncate px-3 py-2 align-middle text-sm font-semibold text-zani-muted">{task.assignee_name || task.assignee_email || t("tasks.noAssignee")}</td>
      <td className="px-3 py-2 align-middle">
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-zani-muted">
          <span className="min-w-0">
            <span className="block truncate">{t("tasks.commentsCount", { count: task.comments_count || 0 })}</span>
            <span className="block truncate">{t("tasks.watchersCount", { count: task.watchers_count || 0 })}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 rounded-control px-0"
            data-testid="task-row-action-open"
            aria-label={t("tasks.details")}
            title={t("tasks.details")}
            onClick={(event) => {
              event.stopPropagation();
              onOpenTask(task);
            }}
          >
            <SquareArrowOutUpRight size={15} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function DotLabel({ colorClass, children }: { colorClass: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-zani-text">
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
          href: `/app/conversations/${task.conversation}`,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; entity?: CrmDrawerEntity; href?: string }>;

  if (!entities.length) return <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-zani-muted">{t("tasks.noClient")}</span>;

  const visibleEntities = entities.slice(0, 1);
  const hiddenCount = entities.length - visibleEntities.length;
  return (
    <>
      {visibleEntities.map((item) => (
        <RelatedAction key={item.key} href={item.href} onClick={item.entity ? () => onOpenEntity(item.entity!) : undefined}>
          {item.label}
        </RelatedAction>
      ))}
      {hiddenCount > 0 ? <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-zani-muted">+{hiddenCount}</span> : null}
    </>
  );
}

function RelatedAction({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  if (href) {
    return (
      <a
        href={href}
        className="max-w-full truncate rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-zani-muted transition hover:bg-brand-50 hover:text-brand-700"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="max-w-full truncate rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-zani-muted transition hover:bg-brand-50 hover:text-brand-700"
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
    createStat("todo", t("tasks.statTodo"), t("tasks.statTodoText"), summary?.open || 0, "bg-brand-50 text-brand-700", CircleDashed),
    createStat("completed", t("tasks.statCompleted"), t("tasks.statCompletedText"), summary?.closed || 0, "bg-[var(--zani-success-soft)] text-zani-success", CheckCircle2),
    createStat("review", t("tasks.statInReview"), t("tasks.statInReviewText"), summary?.inProgress || 0, "bg-[var(--zani-warning-soft)] text-zani-warning", Clock3),
    createStat("blocker", t("tasks.statBlocker"), t("tasks.statBlockerText"), summary?.overdue || 0, "bg-[var(--zani-danger-soft)] text-zani-danger", CircleAlert),
  ];
}

function createStat(key: string, title: string, description: string, count: number, iconClass: string, icon: typeof CircleDashed): TaskStat {
  return { key, title, description, count, iconClass, icon };
}

function priorityLabel(priority: Task["priority"], t: (key: string) => string) {
  const key = `status.${priority}`;
  const value = t(key);
  return value === key ? priority : value;
}

function priorityDotClass(priority: Task["priority"]) {
  if (priority === "urgent") return "bg-zani-danger";
  if (priority === "high") return "bg-zani-danger";
  if (priority === "low") return "bg-purple-500";
  return "bg-zani-warning";
}
