import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "../../../api/client";
import { tasksApi, type TaskCreatePayload, type TaskDetailsUpdatePayload } from "../../../api/tasks";
import { useActionConfirm } from "../../../components/actions/ActionConfirmProvider";
import { useUndoToast } from "../../../components/actions/UndoToastProvider";
import { useNotification } from "../../../components/notifications/NotificationProvider";
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
  const showNotification = useNotification();

  const handleTaskChanged = useCallback(
    (task: Task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", task.id] });
      setSelectedTask((current) => (current?.id === task.id ? task : current));
    },
    [queryClient, setSelectedTask],
  );

  const createMutation = useMutation({
    mutationFn: (payload: TaskCreatePayload) => tasksApi.create(payload),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      openTaskDrawer(task);
      setOpen(false);
      setForm(emptyTaskForm);
    },
  });

  const updateDetailsMutation = useMutation({
    mutationFn: ({ id, payload }: { id: Task["id"]; payload: TaskDetailsUpdatePayload }) => tasksApi.updateDetails({ id, payload }),
    onSuccess: (task) => {
      handleTaskChanged(task);
      setOpen(false);
      setEditingTask(null);
      setForm(emptyTaskForm);
    },
  });

  const completeMutation = useMutation({ mutationFn: tasksApi.complete, onSuccess: handleTaskChanged });
  const startMutation = useMutation({ mutationFn: tasksApi.start, onSuccess: handleTaskChanged });
  const reopenMutation = useMutation({ mutationFn: tasksApi.reopen, onSuccess: handleTaskChanged });
  const assignToMeMutation = useMutation({ mutationFn: tasksApi.assignToMe, onSuccess: handleTaskChanged });
  const dueTodayMutation = useMutation({ mutationFn: tasksApi.dueToday, onSuccess: handleTaskChanged });
  const dueTomorrowMutation = useMutation({ mutationFn: tasksApi.dueTomorrow, onSuccess: handleTaskChanged });
  const watcherMutation = useMutation({ mutationFn: tasksApi.addWatcher, onSuccess: handleTaskChanged });
  const snoozeMutation = useMutation({ mutationFn: tasksApi.snooze, onSuccess: handleTaskChanged });

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
