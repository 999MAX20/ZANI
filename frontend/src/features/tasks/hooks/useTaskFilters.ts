import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { TaskListParams } from "../../../api/tasks";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { getActiveTaskFilterCount, type TaskFilterActions, type TaskFilterState, type TaskTabFilter } from "../components/TaskHeaderFilters";
import { toDateTimeLocal } from "../taskFormUtils";

const TASK_ORDERING = "smart";

export function useTaskFilters(defaultTab: TaskTabFilter = "team") {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tabFilter, setTabFilter] = useState<TaskTabFilter>(() => normalizeTaskTab(searchParams.get("tab"), defaultTab));
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "all");
  const [priorityFilter, setPriorityFilter] = useState(() => searchParams.get("priority") || "");
  const [assigneeFilter, setAssigneeFilter] = useState(() => searchParams.get("assignee") || "");
  const [dueFilter, setDueFilter] = useState(() => searchParams.get("due") || "");
  const [relationFilter, setRelationFilter] = useState(() => searchParams.get("relation") || "");
  const [dueFromFilter, setDueFromFilter] = useState(() => toDateTimeLocal(searchParams.get("due_from")));
  const [dueToFilter, setDueToFilter] = useState(() => toDateTimeLocal(searchParams.get("due_to")));
  const [searchFilter, setSearchFilterState] = useState(() => searchParams.get("search") || "");
  const debouncedSearchFilter = useDebouncedValue(searchFilter, 300);
  const searchParamValue = searchParams.get("search") || "";
  const taskIdParam = Number(searchParams.get("task") || "");

  useEffect(() => {
    setSearchFilterState((current) =>
      current === searchParamValue ? current : searchParamValue,
    );
  }, [searchParamValue]);

  const taskFilterState = useMemo<TaskFilterState>(
    () => ({ tabFilter, statusFilter, priorityFilter, assigneeFilter, dueFilter, relationFilter, dueFromFilter, dueToFilter }),
    [assigneeFilter, dueFilter, dueFromFilter, dueToFilter, priorityFilter, relationFilter, statusFilter, tabFilter],
  );

  const taskFilterActions = useMemo<TaskFilterActions>(
    () => ({ setTabFilter, setStatusFilter, setPriorityFilter, setAssigneeFilter, setDueFilter, setRelationFilter, setDueFromFilter, setDueToFilter }),
    [],
  );

  const activeFilterCount = getActiveTaskFilterCount(taskFilterState);

  const taskListParams = useMemo<TaskListParams>(
    () => ({
      tab: tabFilter === "team" ? undefined : tabFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      priority: priorityFilter || undefined,
      assignee: assigneeFilter || undefined,
      search: debouncedSearchFilter.trim() || undefined,
      due: dueFilter || undefined,
      relation: relationFilter || undefined,
      due_from: dueFromFilter ? new Date(dueFromFilter).toISOString() : undefined,
      due_to: dueToFilter ? new Date(dueToFilter).toISOString() : undefined,
      ordering: TASK_ORDERING,
    }),
    [assigneeFilter, debouncedSearchFilter, dueFilter, dueFromFilter, dueToFilter, priorityFilter, relationFilter, statusFilter, tabFilter],
  );

  const taskSummaryParams = useMemo<TaskListParams>(
    () => ({
      tab: tabFilter === "team" ? undefined : tabFilter,
      priority: priorityFilter || undefined,
      assignee: assigneeFilter || undefined,
      search: debouncedSearchFilter.trim() || undefined,
      due: dueFilter || undefined,
      relation: relationFilter || undefined,
      due_from: dueFromFilter ? new Date(dueFromFilter).toISOString() : undefined,
      due_to: dueToFilter ? new Date(dueToFilter).toISOString() : undefined,
    }),
    [assigneeFilter, debouncedSearchFilter, dueFilter, dueFromFilter, dueToFilter, priorityFilter, relationFilter, tabFilter],
  );

  const taskWorkloadParams = useMemo<TaskListParams>(
    () => ({
      tab: tabFilter === "team" ? undefined : tabFilter,
      priority: priorityFilter || undefined,
      search: debouncedSearchFilter.trim() || undefined,
      due: dueFilter || undefined,
      relation: relationFilter || undefined,
      due_from: dueFromFilter ? new Date(dueFromFilter).toISOString() : undefined,
      due_to: dueToFilter ? new Date(dueToFilter).toISOString() : undefined,
    }),
    [debouncedSearchFilter, dueFilter, dueFromFilter, dueToFilter, priorityFilter, relationFilter, tabFilter],
  );

  const setSearchFilter = useCallback(
    (value: string) => {
      setSearchFilterState(value);
    },
    [],
  );

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    setOrDelete(next, "tab", tabFilter === "team" ? "" : tabFilter);
    setOrDelete(next, "status", statusFilter === "all" ? "" : statusFilter);
    setOrDelete(next, "priority", priorityFilter);
    setOrDelete(next, "assignee", assigneeFilter);
    setOrDelete(next, "due", dueFilter);
    setOrDelete(next, "relation", relationFilter);
    setOrDelete(next, "due_from", dueFromFilter ? new Date(dueFromFilter).toISOString() : "");
    setOrDelete(next, "due_to", dueToFilter ? new Date(dueToFilter).toISOString() : "");
    setOrDelete(next, "search", debouncedSearchFilter.trim());
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [assigneeFilter, debouncedSearchFilter, dueFilter, dueFromFilter, dueToFilter, priorityFilter, relationFilter, searchParams, setSearchParams, statusFilter, tabFilter]);

  return {
    searchParams,
    setSearchParams,
    searchFilter,
    taskIdParam,
    taskOrdering: TASK_ORDERING,
    taskListParams,
    taskSummaryParams,
    taskWorkloadParams,
    taskFilterState,
    taskFilterActions,
    activeFilterCount,
    setSearchFilter,
  };
}

function normalizeTaskTab(value: string | null, fallback: TaskTabFilter): TaskTabFilter {
  return value === "my" || value === "today" || value === "overdue" || value === "team" ? value : fallback;
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}
