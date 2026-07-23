import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { CrmWorkspaceGrid, CrmWorkspacePage } from "../../components/crm";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { TaskFormModal } from "./components/TaskFormModal";
import type { TaskTabFilter } from "./components/TaskHeaderFilters";
import { TaskList } from "./components/TaskList";
import { TaskQuickInspector } from "./components/TaskQuickInspector";
import { useTaskActions } from "./hooks/useTaskActions";
import { useTaskFilters } from "./hooks/useTaskFilters";
import { useTaskQueries } from "./hooks/useTaskQueries";
import { emptyTaskForm } from "./taskFormUtils";
import type { Task } from "../../types";

export function TasksPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setPageHeader } = usePageHeader();
  const { business } = useActiveBusiness();
  const { appointments, botConversations, clients, deals, leads, services } =
    useEntityData({
      appointments: true,
      botConversations: true,
      clients: true,
      deals: true,
      leads: true,
      services: true,
    });
  const {
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
  const {
    tasksQuery,
    taskSummary,
    taskWorkload,
    teamMembers,
    taskTemplates,
    loadedTasks,
  } = useTaskQueries({
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

  const openTaskWorkspace = useCallback(
    (task: Task) => {
      navigate(`/app/tasks/${task.id}`);
    },
    [navigate],
  );

  const selectTask = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

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
    requestCancelTask,
    submitTaskForm,
  } = useTaskActions({
    businessId: business?.id ?? 0,
    form,
    editingTask,
    selectedTask,
    commentText,
    openTaskDrawer: openTaskWorkspace,
    setOpen,
    setEditingTask,
    setForm,
    setCommentText,
    setSelectedTask,
  });

  useEffect(() => {
    if (!loadedTasks.length) {
      if (selectedTask) setSelectedTask(null);
      return;
    }
    const current = selectedTask
      ? loadedTasks.find((task) => task.id === selectedTask.id)
      : null;
    if (current && current !== selectedTask) {
      setSelectedTask(current);
      return;
    }
    if (!current) setSelectedTask(loadedTasks[0]);
  }, [loadedTasks, selectedTask]);

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
  if (taskIdParam) return <Navigate to={`/app/tasks/${taskIdParam}`} replace />;
  if (
    taskSummary.isLoading ||
    taskWorkload.isLoading ||
    tasksQuery.isLoading ||
    taskTemplates.isLoading ||
    clients.isLoading ||
    leads.isLoading ||
    deals.isLoading ||
    appointments.isLoading ||
    botConversations.isLoading ||
    services.isLoading
  )
    return <LoadingState />;
  if (taskSummary.error)
    return <ErrorState message={getApiErrorMessage(taskSummary.error)} />;
  if (taskWorkload.error)
    return <ErrorState message={getApiErrorMessage(taskWorkload.error)} />;
  if (tasksQuery.error)
    return <ErrorState message={getApiErrorMessage(tasksQuery.error)} />;
  if (taskTemplates.error)
    return <ErrorState message={getApiErrorMessage(taskTemplates.error)} />;
  if (botConversations.error)
    return <ErrorState message={getApiErrorMessage(botConversations.error)} />;

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
      <CrmWorkspacePage maxWidthClassName="max-w-[1520px]">
        <CrmWorkspaceGrid inspectorOpen={Boolean(selectedTask)}>
          <main className="min-w-0 space-y-3">
            <TaskList
              tasks={visibleTasks}
              selectedTaskId={selectedTask?.id ?? null}
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
              onSelectTask={selectTask}
              onOpenTask={openTaskWorkspace}
              onOpenEntity={(entity) =>
                navigate(`/app/${entity.type === "appointment" ? "calendar" : `${entity.type}s`}/${entity.id}`)
              }
              onCreateTask={openQuickTask}
            />
            {tasksQuery.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  variant="secondary"
                  isLoading={tasksQuery.isFetchingNextPage}
                  onClick={() => void tasksQuery.fetchNextPage()}
                >
                  {t("tasks.loadMore")}
                </Button>
              </div>
            ) : null}
          </main>

          <TaskQuickInspector
            task={selectedTask}
            t={t}
            onOpen={openTaskWorkspace}
            onOpenRelated={(path) => navigate(path)}
            onStart={(task) => startMutation.mutate(task.id)}
            onComplete={(task) => completeMutation.mutate(task.id)}
            onCancel={(task) => void requestCancelTask(task)}
            onReopen={(task) => reopenMutation.mutate(task.id)}
            onAssignToMe={(task) => assignToMeMutation.mutate(task.id)}
            onDueToday={(task) => dueTodayMutation.mutate(task.id)}
            onDueTomorrow={(task) => dueTomorrowMutation.mutate(task.id)}
            pending={{
              start: startMutation.isPending,
              complete: completeMutation.isPending,
              cancel: cancelMutation.isPending,
              reopen: reopenMutation.isPending,
              assignToMe: assignToMeMutation.isPending,
              dueToday: dueTodayMutation.isPending,
              dueTomorrow: dueTomorrowMutation.isPending,
            }}
          />
        </CrmWorkspaceGrid>
      </CrmWorkspacePage>

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
    </>
  );
}

function getTaskEmptyState({
  tabFilter,
  hasFilters,
  t,
}: {
  tabFilter: TaskTabFilter;
  hasFilters: boolean;
  t: (key: string) => string;
}) {
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
