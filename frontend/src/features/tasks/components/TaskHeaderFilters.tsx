import { X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useI18n } from "../../../lib/i18n";
import type { TeamMember } from "../../../types";

export type TaskTabFilter = "my" | "today" | "overdue" | "team";

export type TaskFilterState = {
  tabFilter: TaskTabFilter;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  dueFilter: string;
  relationFilter: string;
  dueFromFilter: string;
  dueToFilter: string;
};

export type TaskFilterActions = {
  setTabFilter: (value: TaskTabFilter) => void;
  setStatusFilter: (value: string) => void;
  setPriorityFilter: (value: string) => void;
  setAssigneeFilter: (value: string) => void;
  setDueFilter: (value: string) => void;
  setRelationFilter: (value: string) => void;
  setDueFromFilter: (value: string) => void;
  setDueToFilter: (value: string) => void;
};

type TaskHeaderFiltersProps = TaskFilterState &
  TaskFilterActions & {
    teamMembers: TeamMember[];
    showScopeTabs?: boolean;
  };

export function getActiveTaskFilterCount(filters: TaskFilterState) {
  return [
    filters.tabFilter !== "team",
    filters.statusFilter !== "all",
    Boolean(filters.priorityFilter),
    Boolean(filters.assigneeFilter),
    Boolean(filters.dueFilter),
    Boolean(filters.relationFilter),
    Boolean(filters.dueFromFilter),
    Boolean(filters.dueToFilter),
  ].filter(Boolean).length;
}

export function getAssigneeFilterLabel(assigneeFilter: string, teamMembers: TeamMember[], noAssigneeLabel: string) {
  if (assigneeFilter === "unassigned") return noAssigneeLabel;
  const member = teamMembers.find((item) => String(item.user.id) === assigneeFilter);
  return member?.user.full_name || member?.user.email || "";
}

export function TaskHeaderFilters({
  tabFilter,
  statusFilter,
  priorityFilter,
  assigneeFilter,
  dueFilter,
  relationFilter,
  dueFromFilter,
  dueToFilter,
  teamMembers,
  showScopeTabs = true,
  setTabFilter,
  setStatusFilter,
  setPriorityFilter,
  setAssigneeFilter,
  setDueFilter,
  setRelationFilter,
  setDueFromFilter,
  setDueToFilter,
}: TaskHeaderFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      {showScopeTabs ? (
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "my", label: t("tasks.my") },
            { value: "today", label: t("common.today") },
            { value: "overdue", label: t("tasks.overdue") },
            { value: "team", label: t("tasks.team") },
          ].map((tab) => (
            <Button
              key={tab.value}
              type="button"
              variant={tabFilter === tab.value ? "primary" : "secondary"}
              className="h-9 min-h-9 rounded-lg px-3 text-sm"
              onClick={() => setTabFilter(tab.value as TaskTabFilter)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          className="min-h-9 rounded-lg py-1.5 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
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
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
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
          value={assigneeFilter}
          onChange={(event) => setAssigneeFilter(event.target.value)}
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
          value={dueFilter}
          onChange={(event) => {
            setDueFilter(event.target.value);
            if (event.target.value) {
              setDueFromFilter("");
              setDueToFilter("");
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
          value={relationFilter}
          onChange={(event) => setRelationFilter(event.target.value)}
          options={[
            { value: "", label: t("tasks.allRelations") },
            { value: "client", label: t("common.client") },
            { value: "lead", label: t("nav.leads") },
            { value: "deal", label: t("nav.deals") },
            { value: "appointment", label: t("nav.calendar") },
            { value: "none", label: t("tasks.noLinkedEntities") },
          ]}
        />
        <Input
          aria-label={t("tasks.dueFrom")}
          className="h-9 rounded-lg text-sm"
          type="datetime-local"
          value={dueFromFilter}
          onChange={(event) => setDueFromFilter(event.target.value)}
        />
        <Input
          aria-label={t("tasks.dueTo")}
          className="h-9 rounded-lg text-sm"
          type="datetime-local"
          value={dueToFilter}
          onChange={(event) => setDueToFilter(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          className="h-9 min-h-9 justify-center rounded-lg px-3 text-sm"
          onClick={() => resetTaskFilters({ setTabFilter, setStatusFilter, setPriorityFilter, setAssigneeFilter, setDueFilter, setRelationFilter, setDueFromFilter, setDueToFilter })}
        >
          {t("tasks.resetFilters")}
        </Button>
      </div>
    </div>
  );
}

export function TaskActiveFilters({
  tabFilter,
  statusFilter,
  priorityFilter,
  assigneeFilter,
  dueFilter,
  relationFilter,
  dueFromFilter,
  dueToFilter,
  teamMembers,
  showScopeTabs = true,
  setTabFilter,
  setStatusFilter,
  setPriorityFilter,
  setAssigneeFilter,
  setDueFilter,
  setRelationFilter,
  setDueFromFilter,
  setDueToFilter,
}: TaskHeaderFiltersProps) {
  const { t } = useI18n();
  const assigneeLabel = getAssigneeFilterLabel(assigneeFilter, teamMembers, t("tasks.noAssignee"));

  return (
    <>
      {showScopeTabs && tabFilter !== "team" ? (
        <FilterChip
          label={(
            {
              today: t("common.today"),
              overdue: t("tasks.overdue"),
              team: t("tasks.team"),
            } as Record<TaskTabFilter, string>
          )[tabFilter] || t("tasks.my")}
          onRemove={() => setTabFilter("team")}
        />
      ) : null}
      {statusFilter !== "all" ? (
        <FilterChip
          label={(
            {
              open: t("tasks.open"),
              in_progress: t("tasks.inProgress"),
              done: t("tasks.done"),
              cancelled: t("tasks.cancelled"),
              all: t("tasks.all"),
            } as Record<string, string>
          )[statusFilter] || t("tasks.active")}
          onRemove={() => setStatusFilter("all")}
        />
      ) : null}
      {priorityFilter ? (
        <FilterChip
          label={(
            {
              urgent: t("tasks.priorityUrgent"),
              high: t("tasks.priorityHigh"),
              normal: t("tasks.priorityNormal"),
              low: t("tasks.priorityLow"),
            } as Record<string, string>
          )[priorityFilter] || priorityFilter}
          onRemove={() => setPriorityFilter("")}
        />
      ) : null}
      {assigneeFilter ? <FilterChip label={assigneeLabel} onRemove={() => setAssigneeFilter("")} /> : null}
      {dueFilter ? (
        <FilterChip
          label={(
            {
              past: t("tasks.duePast"),
              today: t("tasks.dueToday"),
              future: t("tasks.dueFuture"),
              none: t("tasks.dueNone"),
            } as Record<string, string>
          )[dueFilter] || dueFilter}
          onRemove={() => setDueFilter("")}
        />
      ) : null}
      {relationFilter ? (
        <FilterChip
          label={(
            {
              client: t("common.client"),
              lead: t("nav.leads"),
              deal: t("nav.deals"),
              appointment: t("nav.calendar"),
              none: t("tasks.noLinkedEntities"),
            } as Record<string, string>
          )[relationFilter] || relationFilter}
          onRemove={() => setRelationFilter("")}
        />
      ) : null}
      {dueFromFilter ? <FilterChip label={`${t("tasks.dueFrom")}: ${dueFromFilter}`} onRemove={() => setDueFromFilter("")} /> : null}
      {dueToFilter ? <FilterChip label={`${t("tasks.dueTo")}: ${dueToFilter}`} onRemove={() => setDueToFilter("")} /> : null}
      <Button
        type="button"
        variant="ghost"
        className="h-8 min-h-8 shrink-0 rounded-full px-3 text-xs"
        onClick={() => resetTaskFilters({ setTabFilter, setStatusFilter, setPriorityFilter, setAssigneeFilter, setDueFilter, setRelationFilter, setDueFromFilter, setDueToFilter })}
      >
        {t("tasks.resetFilters")}
      </Button>
    </>
  );
}

function resetTaskFilters(actions: TaskFilterActions) {
  actions.setTabFilter("team");
  actions.setStatusFilter("all");
  actions.setPriorityFilter("");
  actions.setAssigneeFilter("");
  actions.setDueFilter("");
  actions.setRelationFilter("");
  actions.setDueFromFilter("");
  actions.setDueToFilter("");
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-xs font-black text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-100"
      onClick={onRemove}
    >
      <span>{label}</span>
      <X size={14} />
    </button>
  );
}
