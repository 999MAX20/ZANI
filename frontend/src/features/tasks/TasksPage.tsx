import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getApiErrorMessage } from "../../api/client";
import type { CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { TaskDrawer } from "./components/TaskDrawer";
import { TaskFormModal } from "./components/TaskFormModal";
import type { TaskTabFilter } from "./components/TaskHeaderFilters";
import { TaskList } from "./components/TaskList";
import { useTaskActions } from "./hooks/useTaskActions";
import { useTaskFilters } from "./hooks/useTaskFilters";
import { useTaskQueries } from "./hooks/useTaskQueries";
import { emptyTaskForm } from "./taskFormUtils";
import type { Task } from "../../types";

export function TasksPage() {
  const { t } = useI18n();
  const { setPageHeader } = usePageHeader();
  const { business } = useActiveBusiness();
  const { appointments, botConversations, clients, deals, leads, services } = useEntityData({
    appointments: true,
    botConversations: true,
    clients: true,
    deals: true,
    leads: true,
    services: true,
  });
  const {
    searchParams,
    setSearchParams,
    searchFilter,
    taskIdParam,
    taskOrdering,
    taskListParams,
    taskSummaryParams,
    taskWorkloadParams,
    taskFilterState,
    taskFilterActions,
    activeFilterCount,
    setSearchFilter,
  } = useTaskFilters();
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState("");
  const [form, setForm] = useState(emptyTaskForm);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const { selectedTaskQuery, taskComments, taskActivity, tasksQuery, taskSummary, taskWorkload, teamMembers, taskTemplates, loadedTasks } = useTaskQueries({
    selectedTask,
    taskIdParam,
    taskListParams,
    taskSummaryParams,
    taskWorkloadParams,
    taskOrdering,
    businessId: business?.id ?? 0,
  });

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

  const {
    createMutation,
    updateDetailsMutation,
    completeMutation,
    startMutation,
    cancelMutation,
    reopenMutation,
    assignToMeMutation,
    dueTodayMutation,
    dueTomorrowMutation,
    watcherMutation,
    snoozeMutation,
    commentMutation,
    deleteCommentMutation,
    requestCancelTask,
    requestDeleteComment,
    submitTaskForm,
    addSelectedTaskComment,
  } = useTaskActions({
    businessId: business?.id ?? 0,
    form,
    editingTask,
    selectedTask,
    commentText,
    openTaskDrawer,
    setOpen,
    setEditingTask,
    setForm,
    setCommentText,
    setSelectedTask,
  });

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

  if (!business) return <ErrorState message={t("tasks.noBusiness")} />;
  if (taskSummary.isLoading || taskWorkload.isLoading || tasksQuery.isLoading || taskTemplates.isLoading || clients.isLoading || leads.isLoading || deals.isLoading || appointments.isLoading || botConversations.isLoading || services.isLoading) return <LoadingState />;
  if (taskSummary.error) return <ErrorState message={getApiErrorMessage(taskSummary.error)} />;
  if (taskWorkload.error) return <ErrorState message={getApiErrorMessage(taskWorkload.error)} />;
  if (tasksQuery.error) return <ErrorState message={getApiErrorMessage(tasksQuery.error)} />;
  if (taskTemplates.error) return <ErrorState message={getApiErrorMessage(taskTemplates.error)} />;
  if (botConversations.error) return <ErrorState message={getApiErrorMessage(botConversations.error)} />;
  if (selectedTaskQuery.error) return <ErrorState message={getApiErrorMessage(selectedTaskQuery.error)} />;

  const visibleTasks = loadedTasks;
  const totalTasks = tasksQuery.data?.pages[0]?.count ?? visibleTasks.length;
  const formError = createMutation.error || updateDetailsMutation.error;
  const emptyState = getTaskEmptyState({
    tabFilter: taskFilterState.tabFilter,
    hasFilters: activeFilterCount > 0 || Boolean(searchFilter),
    t,
  });

  return (
    <>
      <TaskList
        tasks={visibleTasks}
        totalCount={totalTasks}
        summary={taskSummary.data}
        workload={taskWorkload.data}
        searchQuery={searchFilter}
        onSearchChange={setSearchFilter}
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
        conversations={botConversations.data || []}
        taskTemplates={taskTemplates.data || []}
        services={services.data || []}
        teamMembers={teamMembers.data || []}
        isSaving={createMutation.isPending || updateDetailsMutation.isPending}
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
        onAddComment={addSelectedTaskComment}
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
