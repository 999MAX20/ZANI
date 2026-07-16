import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { activityEventsApi } from "../../api/activities";
import { getApiErrorMessage } from "../../api/client";
import { teamApi } from "../../api/team";
import { tasksApi, type TaskCreatePayload, type TaskDetailsUpdatePayload, type TaskListParams } from "../../api/tasks";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { useUndoToast } from "../../components/actions/UndoToastProvider";
import type { CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { TaskDrawer } from "./components/TaskDrawer";
import { TaskFormModal, type TaskFormState } from "./components/TaskFormModal";
import { getActiveTaskFilterCount, type TaskTabFilter } from "./components/TaskHeaderFilters";
import { TaskList } from "./components/TaskList";
import { emptyTaskForm, taskToForm } from "./taskFormUtils";
import type { Task, TaskComment } from "../../types";

export function TasksPage() {
  const { t } = useI18n();
  const { setPageHeader } = usePageHeader();
  const queryClient = useQueryClient();
  const confirmAction = useActionConfirm();
  const showUndoToast = useUndoToast();
  const showNotification = useNotification();
  const { business } = useActiveBusiness();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const { appointments, clients, deals, leads, services } = useEntityData({
    enabled: open,
    appointments: true,
    clients: true,
    deals: true,
    leads: true,
    services: true,
  });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [tabFilter, setTabFilter] = useState<TaskTabFilter>(() => normalizeTaskTab(searchParams.get("tab")));
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "all");
  const [priorityFilter, setPriorityFilter] = useState(() => searchParams.get("priority") || "");
  const [assigneeFilter, setAssigneeFilter] = useState(() => searchParams.get("assignee") || "");
  const [dueFilter, setDueFilter] = useState(() => searchParams.get("due") || "");
  const [relationFilter, setRelationFilter] = useState(() => searchParams.get("relation") || "");
  const [dueFromFilter, setDueFromFilter] = useState(() => toDateTimeLocal(searchParams.get("due_from")));
  const [dueToFilter, setDueToFilter] = useState(() => toDateTimeLocal(searchParams.get("due_to")));
  const [commentText, setCommentText] = useState("");
  const [form, setForm] = useState(emptyTaskForm);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const searchFilter = (searchParams.get("search") || "").trim();
  const taskIdParam = Number(searchParams.get("task") || "");
  const taskOrdering = "smart";
  const selectedTaskQuery = useQuery({
    queryKey: ["task", taskIdParam],
    queryFn: () => tasksApi.get(taskIdParam),
    enabled: Boolean(taskIdParam),
  });
  const taskComments = useQuery({
    queryKey: ["task-comments", selectedTask?.id],
    queryFn: () => tasksApi.comments(selectedTask!.id),
    enabled: Boolean(selectedTask?.id),
  });
  const taskActivity = useQuery({
    queryKey: ["task-activity", selectedTask?.id],
    queryFn: () => activityEventsApi.listForEntity({ entity_type: "Task", entity_id: selectedTask!.id }),
    enabled: Boolean(selectedTask?.id),
  });
  const taskListParams: TaskListParams = {
    tab: tabFilter === "team" ? undefined : tabFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter || undefined,
    assignee: assigneeFilter || undefined,
    search: searchFilter || undefined,
    due: dueFilter || undefined,
    relation: relationFilter || undefined,
    due_from: dueFromFilter ? new Date(dueFromFilter).toISOString() : undefined,
    due_to: dueToFilter ? new Date(dueToFilter).toISOString() : undefined,
    ordering: taskOrdering,
  };
  const tasksQuery = useInfiniteQuery({
    queryKey: [
      "tasks",
      { tab: tabFilter, status: statusFilter, priority: priorityFilter, assignee: assigneeFilter, due: dueFilter, relation: relationFilter, dueFrom: dueFromFilter, dueTo: dueToFilter, search: searchFilter, ordering: taskOrdering },
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => tasksApi.listPage({ ...taskListParams, page: Number(pageParam) }),
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
    enabled: true,
  });
  const taskSummaryParams: TaskListParams = {
    tab: tabFilter === "team" ? undefined : tabFilter,
    priority: priorityFilter || undefined,
    assignee: assigneeFilter || undefined,
    search: searchFilter || undefined,
    due: dueFilter || undefined,
    relation: relationFilter || undefined,
    due_from: dueFromFilter ? new Date(dueFromFilter).toISOString() : undefined,
    due_to: dueToFilter ? new Date(dueToFilter).toISOString() : undefined,
  };
  const taskSummary = useQuery({
    queryKey: ["tasks-summary", taskSummaryParams],
    queryFn: () => tasksApi.summary(taskSummaryParams),
  });
  const loadedTasks = useMemo(() => tasksQuery.data?.pages.flatMap((page) => page.results) || [], [tasksQuery.data]);
  const teamMembers = useQuery({
    queryKey: ["team-members"],
    queryFn: teamApi.members,
  });
  const taskFilterState = { tabFilter, statusFilter, priorityFilter, assigneeFilter, dueFilter, relationFilter, dueFromFilter, dueToFilter };
  const taskFilterActions = { setTabFilter, setStatusFilter, setPriorityFilter, setAssigneeFilter, setDueFilter, setRelationFilter, setDueFromFilter, setDueToFilter };
  const activeFilterCount = getActiveTaskFilterCount(taskFilterState);

  const openQuickTask = useCallback(() => {
    setEditingTask(null);
    setForm(emptyTaskForm);
    setOpen(true);
  }, []);

  const closeTaskDrawer = useCallback(() => {
    setSelectedTask(null);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openTaskDrawer = useCallback(
    (task: Task) => {
      setSelectedTask(task);
      const next = new URLSearchParams(searchParams);
      next.set("task", String(task.id));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const taskId = Number(searchParams.get("task") || "");
    if (!taskId) return;
    const task = loadedTasks.find((item) => item.id === taskId);
    if (task && selectedTask?.id !== task.id) setSelectedTask(task);
  }, [loadedTasks, searchParams, selectedTask?.id]);

  useEffect(() => {
    const task = selectedTaskQuery.data;
    if (task && selectedTask?.id !== task.id) setSelectedTask(task);
  }, [selectedTask?.id, selectedTaskQuery.data]);

  useEffect(() => {
    setPageHeader({
      title: t("tasks.title"),
      primaryAction: {
        label: t("tasks.quickTask"),
        icon: Plus,
        onClick: openQuickTask,
      },
      filterLabel: undefined,
      filters: undefined,
      activeFilterCount: 0,
      activeFilters: null,
    });
    return () => setPageHeader(null);
  }, [openQuickTask, setPageHeader, t]);

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
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [assigneeFilter, dueFilter, dueFromFilter, dueToFilter, priorityFilter, relationFilter, searchParams, setSearchParams, statusFilter, tabFilter]);

  const createMutation = useMutation({
    mutationFn: (payload: TaskCreatePayload) => tasksApi.create(payload),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      openTaskDrawer(task);
      setOpen(false);
      setForm(emptyTaskForm);
    },
  });
  const handleTaskChanged = useCallback(
    (task: Task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", task.id] });
      setSelectedTask((current) => (current?.id === task.id ? task : current));
    },
    [queryClient],
  );
  const updateDetailsMutation = useMutation({
    mutationFn: ({ id, payload }: { id: Task["id"]; payload: TaskDetailsUpdatePayload }) => tasksApi.updateDetails({ id, payload }),
    onSuccess: (task) => {
      handleTaskChanged(task);
      setOpen(false);
      setEditingTask(null);
      setForm(emptyTaskForm);
    },
  });
  const completeMutation = useMutation({
    mutationFn: tasksApi.complete,
    onSuccess: handleTaskChanged,
  });
  const startMutation = useMutation({
    mutationFn: tasksApi.start,
    onSuccess: handleTaskChanged,
  });
  const cancelMutation = useMutation({
    mutationFn: tasksApi.cancel,
    onSuccess: (task) => {
      handleTaskChanged(task);
      showUndoToast({
        message: t("tasks.cancelledNotice"),
        onUndo: async () => {
          const restoredTask = await tasksApi.undoCancel(task.id);
          handleTaskChanged(restoredTask);
        },
      });
    },
  });
  const reopenMutation = useMutation({
    mutationFn: tasksApi.reopen,
    onSuccess: handleTaskChanged,
  });
  const assignToMeMutation = useMutation({
    mutationFn: tasksApi.assignToMe,
    onSuccess: handleTaskChanged,
  });
  const dueTodayMutation = useMutation({
    mutationFn: tasksApi.dueToday,
    onSuccess: handleTaskChanged,
  });
  const dueTomorrowMutation = useMutation({
    mutationFn: tasksApi.dueTomorrow,
    onSuccess: handleTaskChanged,
  });
  const watcherMutation = useMutation({
    mutationFn: tasksApi.addWatcher,
    onSuccess: handleTaskChanged,
  });
  const snoozeMutation = useMutation({
    mutationFn: tasksApi.snooze,
    onSuccess: handleTaskChanged,
  });
  const commentMutation = useMutation({
    mutationFn: tasksApi.addComment,
    onSuccess: async () => {
      setCommentText("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task-comments", selectedTask?.id] }),
        queryClient.invalidateQueries({ queryKey: ["task-activity", selectedTask?.id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
    },
  });
  const deleteCommentMutation = useMutation({
    mutationFn: tasksApi.deleteComment,
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task-comments", variables.id] }),
        queryClient.invalidateQueries({ queryKey: ["task-activity", variables.id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
    },
  });

  const requestCancelTask = useCallback(
    async (task: Task) => {
      const result = await confirmAction({
        title: t("tasks.cancelConfirmTitle"),
        description: t("tasks.cancelConfirmText"),
        confirmLabel: t("tasks.cancel"),
        variant: "danger",
        reason: {
          label: t("tasks.cancelReasonLabel"),
          placeholder: t("tasks.cancelReasonPlaceholder"),
          required: true,
          minLength: 3,
        },
      });
      if (!result.confirmed || !result.reason) return;
      cancelMutation.mutate({ id: task.id, reason: result.reason });
    },
    [cancelMutation, confirmAction, t],
  );
  const requestDeleteComment = useCallback(
    async (task: Task, comment: TaskComment) => {
      const result = await confirmAction({
        title: t("tasks.deleteCommentConfirmTitle"),
        description: t("tasks.deleteCommentConfirmText"),
        confirmLabel: t("tasks.deleteComment"),
        variant: "danger",
      });
      if (!result.confirmed) return;
      deleteCommentMutation.mutate({ id: task.id, commentId: comment.id });
    },
    [confirmAction, deleteCommentMutation, t],
  );

  const actionError =
    startMutation.error ||
    completeMutation.error ||
    cancelMutation.error ||
    reopenMutation.error ||
    assignToMeMutation.error ||
    dueTodayMutation.error ||
    dueTomorrowMutation.error ||
    watcherMutation.error ||
    snoozeMutation.error ||
    commentMutation.error ||
    deleteCommentMutation.error;
  const actionErrorMessage = actionError ? getApiErrorMessage(actionError) : "";

  useEffect(() => {
    if (!actionErrorMessage) return;
    showNotification({ message: actionErrorMessage, tone: "danger" });
  }, [actionErrorMessage, showNotification]);

  if (!business) return <ErrorState message={t("tasks.noBusiness")} />;
  if (taskSummary.isLoading || tasksQuery.isLoading) return <LoadingState />;
  if (taskSummary.error) return <ErrorState message={getApiErrorMessage(taskSummary.error)} />;
  if (tasksQuery.error) return <ErrorState message={getApiErrorMessage(tasksQuery.error)} />;
  if (selectedTaskQuery.error) return <ErrorState message={getApiErrorMessage(selectedTaskQuery.error)} />;

  const visibleTasks = loadedTasks;
  const totalTasks = tasksQuery.data?.pages[0]?.count ?? visibleTasks.length;
  const formReferencesLoading = open && (clients.isLoading || leads.isLoading || deals.isLoading || appointments.isLoading || services.isLoading);
  const formError =
    createMutation.error ||
    updateDetailsMutation.error ||
    (open ? clients.error || leads.error || deals.error || appointments.error || services.error : null);
  const emptyState = getTaskEmptyState({
    tabFilter,
    hasFilters: activeFilterCount > 0 || Boolean(searchFilter),
    t,
  });
  const submitTaskForm = () => {
    const detailsPayload: TaskDetailsUpdatePayload = {
      title: form.title.trim(),
      description: form.description,
      client: form.client ? Number(form.client) : null,
      lead: form.lead ? Number(form.lead) : null,
      deal: form.deal ? Number(form.deal) : null,
      appointment: form.appointment ? Number(form.appointment) : null,
      priority: form.priority as Task["priority"],
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : null,
      assignee: form.assignee ? Number(form.assignee) : null,
    };
    if (editingTask) {
      updateDetailsMutation.mutate({ id: editingTask.id, payload: detailsPayload });
      return;
    }
    createMutation.mutate({
      ...detailsPayload,
      business: business.id,
    });
  };

  return (
    <>
      <TaskList
        tasks={visibleTasks}
        totalCount={totalTasks}
        summary={taskSummary.data}
        searchQuery={searchFilter}
        emptyTitle={emptyState.title}
        emptyDescription={emptyState.description}
        filterState={taskFilterState}
        filterActions={taskFilterActions}
        activeFilterCount={activeFilterCount}
        teamMembers={teamMembers.data || []}
        onOpenTask={openTaskDrawer}
        onOpenEntity={setDrawerEntity}
        onCreateTask={openQuickTask}
      />
      {tasksQuery.hasNextPage ? (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" isLoading={tasksQuery.isFetchingNextPage} onClick={() => void tasksQuery.fetchNextPage()}>
            {t("tasks.loadMore")}
          </Button>
        </div>
      ) : null}

      <TaskFormModal
        open={open}
        editingTask={editingTask}
        form={form}
        clients={clients.data || []}
        leads={leads.data || []}
        deals={deals.data || []}
        appointments={appointments.data || []}
        services={services.data || []}
        teamMembers={teamMembers.data || []}
        isSaving={createMutation.isPending || updateDetailsMutation.isPending || formReferencesLoading}
        errorMessage={formError ? getApiErrorMessage(formError) : null}
        onClose={() => {
          setOpen(false);
          setEditingTask(null);
          setForm(emptyTaskForm);
        }}
        onFormChange={setForm}
        onSubmit={submitTaskForm}
      />

      <TaskDrawer
        task={selectedTask}
        comments={taskComments.data || []}
        commentsLoading={taskComments.isLoading}
        activityEvents={taskActivity.data || []}
        activityLoading={taskActivity.isLoading}
        commentText={commentText}
        teamMembers={teamMembers.data || []}
        isAddingComment={commentMutation.isPending}
        detailsErrorMessage={updateDetailsMutation.error ? getApiErrorMessage(updateDetailsMutation.error) : null}
        drawerEntity={drawerEntity}
        onCommentTextChange={setCommentText}
        onAddComment={() => {
          if (selectedTask && commentText.trim()) commentMutation.mutate({ id: selectedTask.id, text: commentText.trim() });
        }}
        onClose={closeTaskDrawer}
        onOpenEntity={setDrawerEntity}
        onCloseEntity={() => setDrawerEntity(null)}
        onStart={(task) => startMutation.mutate(task.id)}
        onComplete={(task) => completeMutation.mutate(task.id)}
        onCancel={(task) => void requestCancelTask(task)}
        onReopen={(task) => reopenMutation.mutate(task.id)}
        onDeleteComment={(task, comment) => void requestDeleteComment(task, comment)}
        onUpdateDetails={(task, payload) => updateDetailsMutation.mutateAsync({ id: task.id, payload })}
        onAssignToMe={(task) => assignToMeMutation.mutate(task.id)}
        onWatch={(task) => watcherMutation.mutate({ id: task.id })}
        onSnoozeTomorrow={(task) => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(10, 0, 0, 0);
          snoozeMutation.mutate({ id: task.id, snoozed_until: tomorrow.toISOString() });
        }}
        onDueToday={(task) => dueTodayMutation.mutate(task.id)}
        onDueTomorrow={(task) => dueTomorrowMutation.mutate(task.id)}
        pending={{
          start: startMutation.isPending,
          complete: completeMutation.isPending,
          cancel: cancelMutation.isPending,
          reopen: reopenMutation.isPending,
          updateDetails: updateDetailsMutation.isPending,
          assignToMe: assignToMeMutation.isPending,
          watch: watcherMutation.isPending,
          snooze: snoozeMutation.isPending,
          dueToday: dueTodayMutation.isPending,
          dueTomorrow: dueTomorrowMutation.isPending,
          deleteComment: deleteCommentMutation.isPending,
        }}
      />
    </>
  );
}

function getTaskEmptyState({ tabFilter, hasFilters, t }: { tabFilter: TaskTabFilter; hasFilters: boolean; t: (key: string) => string }) {
  if (hasFilters) {
    return {
      title: t("tasks.emptyFilteredTitle"),
      description: t("tasks.emptyFilteredText"),
    };
  }
  if (tabFilter === "today") {
    return {
      title: t("tasks.emptyTodayTitle"),
      description: t("tasks.emptyTodayText"),
    };
  }
  if (tabFilter === "overdue") {
    return {
      title: t("tasks.emptyOverdueTitle"),
      description: t("tasks.emptyOverdueText"),
    };
  }
  if (tabFilter === "team") {
    return {
      title: t("tasks.emptyTeamTitle"),
      description: t("tasks.emptyTeamText"),
    };
  }
  return {
    title: t("tasks.emptyTitle"),
    description: t("tasks.emptyText"),
  };
}

function normalizeTaskTab(value: string | null): TaskTabFilter {
  return value === "my" || value === "today" || value === "overdue" || value === "team" ? value : "team";
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}
