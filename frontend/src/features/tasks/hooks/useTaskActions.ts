import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tasksApi, type TaskCreatePayload, type TaskDetailsUpdatePayload } from "../../../api/tasks";
import { useActionConfirm } from "../../../components/actions/ActionConfirmProvider";
import { useActionFeedback } from "../../../components/actions/useActionFeedback";
import { useUndoToast } from "../../../components/actions/UndoToastProvider";
import { useI18n } from "../../../lib/i18n";
import type { Id, Task, TaskComment } from "../../../types";
import type { TaskFormState } from "../components/TaskFormModal";
import { emptyTaskForm, taskFormToDetailsPayload } from "../taskFormUtils";

export function useTaskActions({
  businessId,
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
}: {
  businessId: Id;
  form: TaskFormState;
  editingTask: Task | null;
  selectedTask: Task | null;
  commentText: string;
  openTaskDrawer: (task: Task) => void;
  setOpen: Dispatch<SetStateAction<boolean>>;
  setEditingTask: Dispatch<SetStateAction<Task | null>>;
  setForm: Dispatch<SetStateAction<TaskFormState>>;
  setCommentText: Dispatch<SetStateAction<string>>;
  setSelectedTask: Dispatch<SetStateAction<Task | null>>;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const confirmAction = useActionConfirm();
  const showUndoToast = useUndoToast();
  const { notifyError, notifySuccess } = useActionFeedback();

  const handleTaskChanged = useCallback(
    (task: Task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", task.id] });
      setSelectedTask((current) => (current?.id === task.id ? task : current));
      notifySuccess(t("tasks.savedNotice"));
    },
    [notifySuccess, queryClient, setSelectedTask, t],
  );

  const createMutation = useMutation({
    mutationFn: (payload: TaskCreatePayload) => tasksApi.create(payload),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      openTaskDrawer(task);
      setOpen(false);
      setForm(emptyTaskForm);
      notifySuccess(t("tasks.savedNotice"));
    },
    onError: (error) => notifyError(error),
  });

  const updateDetailsMutation = useMutation({
    mutationFn: ({ id, payload }: { id: Task["id"]; payload: TaskDetailsUpdatePayload }) => tasksApi.updateDetails({ id, payload }),
    onSuccess: (task) => {
      handleTaskChanged(task);
      setOpen(false);
      setEditingTask(null);
      setForm(emptyTaskForm);
    },
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      }),
  });

  const completeMutation = useMutation({
    mutationFn: tasksApi.complete,
    onSuccess: handleTaskChanged,
    onError: (error) => notifyError(error),
  });
  const startMutation = useMutation({
    mutationFn: tasksApi.start,
    onSuccess: handleTaskChanged,
    onError: (error) => notifyError(error),
  });
  const reopenMutation = useMutation({
    mutationFn: tasksApi.reopen,
    onSuccess: handleTaskChanged,
    onError: (error) => notifyError(error),
  });
  const assignToMeMutation = useMutation({
    mutationFn: tasksApi.assignToMe,
    onSuccess: handleTaskChanged,
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      }),
  });
  const dueTodayMutation = useMutation({
    mutationFn: tasksApi.dueToday,
    onSuccess: handleTaskChanged,
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      }),
  });
  const dueTomorrowMutation = useMutation({
    mutationFn: tasksApi.dueTomorrow,
    onSuccess: handleTaskChanged,
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      }),
  });
  const watcherMutation = useMutation({
    mutationFn: tasksApi.addWatcher,
    onSuccess: handleTaskChanged,
    onError: (error) => notifyError(error),
  });
  const snoozeMutation = useMutation({
    mutationFn: tasksApi.snooze,
    onSuccess: handleTaskChanged,
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      }),
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
    onError: (error) => notifyError(error),
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
      notifySuccess(t("tasks.savedNotice"));
    },
    onError: (error) => notifyError(error),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: tasksApi.deleteComment,
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task-comments", variables.id] }),
        queryClient.invalidateQueries({ queryKey: ["task-activity", variables.id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
      notifySuccess(t("tasks.savedNotice"));
    },
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      }),
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

  const submitTaskForm = useCallback(() => {
    const detailsPayload = taskFormToDetailsPayload(form);
    if (editingTask) {
      updateDetailsMutation.mutate({ id: editingTask.id, payload: detailsPayload });
      return;
    }
    createMutation.mutate({ ...detailsPayload, business: businessId });
  }, [businessId, createMutation, editingTask, form, updateDetailsMutation]);

  const addSelectedTaskComment = useCallback(() => {
    if (selectedTask && commentText.trim()) {
      commentMutation.mutate({ id: selectedTask.id, text: commentText.trim() });
    }
  }, [commentMutation, commentText, selectedTask]);

  return {
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
  };
}
