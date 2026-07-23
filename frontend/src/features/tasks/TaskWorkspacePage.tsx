import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellPlus,
  CalendarClock,
  CalendarPlus,
  Check,
  MessageSquare,
  Play,
  RotateCcw,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { activityEventsApi } from "../../api/activities";
import { getApiErrorMessage } from "../../api/client";
import { teamApi } from "../../api/team";
import { tasksApi } from "../../api/tasks";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import {
  EntityWorkspaceEmptyState,
  EntityWorkspaceErrorState,
  EntityWorkspaceAside,
  EntityWorkspaceAvatar,
  EntityWorkspaceBody,
  EntityWorkspaceHeader,
  EntityWorkspaceLoadingState,
  EntityWorkspaceMain,
  EntityWorkspaceMetrics,
  EntityWorkspaceRoot,
} from "../../components/crm";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useNotification } from "../../components/notifications/NotificationProvider";
import type { ActivityEvent, Id, Task, TaskComment } from "../../types";

function asNumericId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function taskInitials(task: Task) {
  return (task.title || `#${task.id}`).slice(0, 2).toUpperCase();
}

export function TaskWorkspacePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const confirmAction = useActionConfirm();
  const showNotification = useNotification();
  const queryClient = useQueryClient();
  const { id: routeId } = useParams();
  const taskId = asNumericId(routeId);
  const [commentText, setCommentText] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("");

  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => tasksApi.get(taskId as number),
    enabled: Boolean(taskId),
  });
  const commentsQuery = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () => tasksApi.comments(taskId as number),
    enabled: Boolean(taskId),
  });
  const activityQuery = useQuery({
    queryKey: ["task-activity", taskId],
    queryFn: () =>
      activityEventsApi.listForEntity({
        entity_type: "Task",
        entity_id: taskId as number,
      }),
    enabled: Boolean(taskId),
  });
  const teamMembersQuery = useQuery({
    queryKey: ["team-members"],
    queryFn: teamApi.members,
  });

  const task = taskQuery.data || null;
  const isClosed = task ? ["done", "cancelled"].includes(task.status) : false;
  const activeTeamMembers = useMemo(
    () => (teamMembersQuery.data || []).filter((member) => member.is_active),
    [teamMembersQuery.data],
  );
  const selectedAssigneeId = assigneeDraft ? Number(assigneeDraft) : null;
  const assigneeChanged = task
    ? selectedAssigneeId !== (task.assignee ? Number(task.assignee) : null)
    : false;

  const invalidateTask = async (updatedTask?: Task) => {
    if (updatedTask)
      queryClient.setQueryData(["task", updatedTask.id], updatedTask);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["task", taskId] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["task-activity", taskId] }),
    ]);
  };

  const lifecycleMutation = useMutation<
    Task,
    Error,
    { action: "start" | "complete" | "cancel" | "reopen"; reason?: string }
  >({
    mutationFn: ({ action, reason }) => {
      if (!taskId) throw new Error(t("tasks.emptyTitle"));
      if (action === "start") return tasksApi.start(taskId);
      if (action === "complete") return tasksApi.complete(taskId);
      if (action === "cancel")
        return tasksApi.cancel({ id: taskId, reason: reason || "" });
      return tasksApi.reopen(taskId);
    },
    onSuccess: async (updatedTask) => {
      showNotification({ message: t("tasks.savedNotice"), tone: "success" });
      await invalidateTask(updatedTask);
    },
  });

  const quickMutation = useMutation<
    Task,
    Error,
    {
      action:
        "assign_to_me" | "watch" | "snooze" | "due_today" | "due_tomorrow";
    }
  >({
    mutationFn: ({ action }) => {
      if (!taskId) throw new Error(t("tasks.emptyTitle"));
      if (action === "assign_to_me") return tasksApi.assignToMe(taskId);
      if (action === "watch") return tasksApi.addWatcher({ id: taskId });
      if (action === "due_today") return tasksApi.dueToday(taskId);
      if (action === "due_tomorrow") return tasksApi.dueTomorrow(taskId);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      return tasksApi.snooze({
        id: taskId,
        snoozed_until: tomorrow.toISOString(),
      });
    },
    onSuccess: async (updatedTask) => {
      showNotification({ message: t("tasks.savedNotice"), tone: "success" });
      await invalidateTask(updatedTask);
    },
  });

  const assignMutation = useMutation<Task, Error, Id | null>({
    mutationFn: (userId) => {
      if (!taskId) throw new Error(t("tasks.emptyTitle"));
      return tasksApi.assign({ id: taskId, user_id: userId || undefined });
    },
    onSuccess: async (updatedTask) => {
      showNotification({ message: t("tasks.savedNotice"), tone: "success" });
      await invalidateTask(updatedTask);
    },
  });

  const commentMutation = useMutation<TaskComment, Error, string>({
    mutationFn: (text) => {
      if (!taskId) throw new Error(t("tasks.emptyTitle"));
      return tasksApi.addComment({ id: taskId, text });
    },
    onSuccess: async () => {
      setCommentText("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] }),
        queryClient.invalidateQueries({ queryKey: ["task-activity", taskId] }),
        queryClient.invalidateQueries({ queryKey: ["task", taskId] }),
      ]);
    },
  });

  const deleteCommentMutation = useMutation<void, Error, Id>({
    mutationFn: (commentId) => {
      if (!taskId) throw new Error(t("tasks.emptyTitle"));
      return tasksApi.deleteComment({ id: taskId, commentId });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] }),
        queryClient.invalidateQueries({ queryKey: ["task-activity", taskId] }),
        queryClient.invalidateQueries({ queryKey: ["task", taskId] }),
      ]);
    },
  });

  async function requestCancel() {
    if (!task) return;
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
    lifecycleMutation.mutate({ action: "cancel", reason: result.reason });
  }

  if (!taskId)
    return <EntityWorkspaceErrorState message={t("tasks.emptyTitle")} />;
  if (
    taskQuery.isLoading ||
    commentsQuery.isLoading ||
    activityQuery.isLoading ||
    teamMembersQuery.isLoading
  ) {
    return <EntityWorkspaceLoadingState />;
  }
  const pageError =
    taskQuery.error ||
    commentsQuery.error ||
    activityQuery.error ||
    teamMembersQuery.error;
  if (pageError)
    return (
      <EntityWorkspaceErrorState message={getApiErrorMessage(pageError)} />
    );
  if (!task) {
    return (
      <EntityWorkspaceEmptyState
        title={t("tasks.emptyTitle")}
        description={t("tasks.emptyText")}
      />
    );
  }

  const comments = commentsQuery.data || [];
  const activity = activityQuery.data || [];
  const subtitle = [
    task.assignee_name || task.assignee_email || t("tasks.noAssignee"),
    task.due_at ? formatDateTime(task.due_at) : t("tasks.groupNoDue"),
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <EntityWorkspaceRoot>
      <EntityWorkspaceHeader
        backLabel={t("common.back")}
        onBack={() => navigate("/app/tasks")}
        avatar={
          <EntityWorkspaceAvatar>{taskInitials(task)}</EntityWorkspaceAvatar>
        }
        title={task.title}
        subtitle={subtitle}
        status={task.status}
        actions={
          <>
            {task.client ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/app/clients/${task.client}`)}
              >
                {task.client_name || t("common.client")}
              </Button>
            ) : null}
            {task.lead ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/app/leads/${task.lead}`)}
              >
                {task.lead_title || t("tasks.lead")}
              </Button>
            ) : null}
            {task.deal ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/app/deals/${task.deal}`)}
              >
                {task.deal_title || t("tasks.deal")}
              </Button>
            ) : null}
          </>
        }
      />

      <EntityWorkspaceMetrics>
        <TaskMetric
          label={t("tasks.status")}
          value={t(`tasks.statusLabel.${task.status}`)}
        />
        <TaskMetric
          label={t("tasks.priority")}
          value={t(`tasks.priorityLabel.${task.priority}`)}
        />
        <TaskMetric
          label={t("tasks.dueAt")}
          value={
            task.due_at ? formatDateTime(task.due_at) : t("tasks.groupNoDue")
          }
        />
        <TaskMetric label={t("tasks.comments")} value={comments.length} />
        <TaskMetric label={t("tasks.history")} value={activity.length} />
      </EntityWorkspaceMetrics>

      <EntityWorkspaceBody>
        <EntityWorkspaceAside>
          <TaskSection title={t("tasks.taskSummary")}>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={task.status} />
              <StatusBadge status={task.priority} />
            </div>
            <p className="mt-3 text-sm font-medium leading-6 text-zani-subtle">
              {task.description || t("crmCard.noNotesText")}
            </p>
          </TaskSection>

          <TaskSection title={t("tasks.quickActions")}>
            <div className="grid gap-2">
              {task.status === "open" ? (
                <Button
                  data-task-action-id="start"
                  variant="secondary"
                  onClick={() => lifecycleMutation.mutate({ action: "start" })}
                  isLoading={lifecycleMutation.isPending}
                >
                  <Play size={16} /> {t("tasks.start")}
                </Button>
              ) : null}
              {!isClosed ? (
                <Button
                  data-task-action-id="complete"
                  onClick={() =>
                    lifecycleMutation.mutate({ action: "complete" })
                  }
                  isLoading={lifecycleMutation.isPending}
                >
                  <Check size={16} /> {t("tasks.complete")}
                </Button>
              ) : null}
              {!isClosed ? (
                <Button
                  data-task-action-id="cancel"
                  variant="danger"
                  onClick={() => void requestCancel()}
                  isLoading={lifecycleMutation.isPending}
                >
                  <X size={16} /> {t("tasks.cancel")}
                </Button>
              ) : null}
              {isClosed ? (
                <Button
                  data-task-action-id="reopen"
                  variant="secondary"
                  onClick={() => lifecycleMutation.mutate({ action: "reopen" })}
                  isLoading={lifecycleMutation.isPending}
                >
                  <RotateCcw size={16} /> {t("tasks.reopen")}
                </Button>
              ) : null}
            </div>
          </TaskSection>

          <TaskSection title={t("tasks.assignee")}>
            <div className="space-y-3">
              <Select
                value={
                  assigneeDraft || (task.assignee ? String(task.assignee) : "")
                }
                onChange={(event) => setAssigneeDraft(event.target.value)}
                disabled={isClosed}
                options={[
                  { value: "", label: t("tasks.noAssignee") },
                  ...activeTeamMembers.map((member) => ({
                    value: String(member.user.id),
                    label: member.user.full_name || member.user.email,
                  })),
                ]}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={isClosed || !assigneeChanged}
                isLoading={assignMutation.isPending}
                onClick={() => assignMutation.mutate(selectedAssigneeId)}
              >
                <UserPlus size={16} /> {t("tasks.saveAssignee")}
              </Button>
            </div>
          </TaskSection>

          <TaskSection title={t("tasks.dates")}>
            <div className="grid gap-2">
              <Button
                variant="secondary"
                disabled={isClosed}
                onClick={() => quickMutation.mutate({ action: "assign_to_me" })}
                isLoading={quickMutation.isPending}
              >
                <UserPlus size={16} /> {t("tasks.assignToMe")}
              </Button>
              <Button
                variant="secondary"
                disabled={isClosed}
                onClick={() => quickMutation.mutate({ action: "watch" })}
                isLoading={quickMutation.isPending}
              >
                <BellPlus size={16} /> {t("tasks.watch")}
              </Button>
              <Button
                variant="secondary"
                disabled={isClosed}
                onClick={() => quickMutation.mutate({ action: "due_today" })}
                isLoading={quickMutation.isPending}
              >
                <CalendarPlus size={16} /> {t("common.today")}
              </Button>
              <Button
                variant="secondary"
                disabled={isClosed}
                onClick={() => quickMutation.mutate({ action: "due_tomorrow" })}
                isLoading={quickMutation.isPending}
              >
                <CalendarPlus size={16} /> {t("tasks.tomorrow")}
              </Button>
            </div>
          </TaskSection>
        </EntityWorkspaceAside>

        <EntityWorkspaceMain>
          <TaskSection title={t("tasks.links")}>
            <div className="flex flex-wrap gap-2">
              {task.client ? (
                <EntityLink
                  onClick={() => navigate(`/app/clients/${task.client}`)}
                >
                  {task.client_name || t("common.client")}
                </EntityLink>
              ) : null}
              {task.lead ? (
                <EntityLink onClick={() => navigate(`/app/leads/${task.lead}`)}>
                  {task.lead_title || t("tasks.lead")}
                </EntityLink>
              ) : null}
              {task.deal ? (
                <EntityLink onClick={() => navigate(`/app/deals/${task.deal}`)}>
                  {task.deal_title || t("tasks.deal")}
                </EntityLink>
              ) : null}
              {task.appointment ? (
                <EntityLink
                  onClick={() =>
                    navigate(`/app/calendar?appointment=${task.appointment}`)
                  }
                >
                  {task.appointment_service_name || t("tasks.appointment")}
                </EntityLink>
              ) : null}
              {task.conversation ? (
                <EntityLink
                  onClick={() =>
                    navigate(
                      `/app/conversations?conversation=${task.conversation}`,
                    )
                  }
                >
                  {task.conversation_label ||
                    task.conversation_external_user_id ||
                    t("nav.conversations")}
                </EntityLink>
              ) : null}
              {!task.client &&
              !task.lead &&
              !task.deal &&
              !task.appointment &&
              !task.conversation ? (
                <p className="text-sm font-semibold text-zani-subtle">
                  {t("tasks.noLinkedEntities")}
                </p>
              ) : null}
            </div>
          </TaskSection>

          <TaskSection title={t("tasks.comments")}>
            <div className="space-y-3">
              {comments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  onDelete={() => deleteCommentMutation.mutate(comment.id)}
                  isDeleting={deleteCommentMutation.isPending}
                />
              ))}
              {!comments.length ? (
                <p className="text-sm font-semibold text-zani-subtle">
                  {t("tasks.noComments")}
                </p>
              ) : null}
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!commentText.trim()) return;
                  commentMutation.mutate(commentText.trim());
                }}
              >
                <Textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder={t("tasks.commentPlaceholder")}
                />
                <Button
                  type="submit"
                  isLoading={commentMutation.isPending}
                  disabled={!commentText.trim()}
                >
                  <MessageSquare size={16} /> {t("tasks.addComment")}
                </Button>
              </form>
            </div>
          </TaskSection>

          <TaskSection title={t("tasks.history")} className="lg:col-span-2">
            <div className="space-y-2">
              {activity.slice(0, 16).map((event) => (
                <ActivityRow key={event.id} event={event} />
              ))}
              {!activity.length ? (
                <p className="text-sm font-semibold text-zani-subtle">
                  {t("tasks.noHistory")}
                </p>
              ) : null}
            </div>
          </TaskSection>
        </EntityWorkspaceMain>
      </EntityWorkspaceBody>
    </EntityWorkspaceRoot>
  );
}

function TaskMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-zani-border bg-zani-card px-4 py-3">
      <p className="text-xs font-semibold uppercase text-zani-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zani-text">{value}</p>
    </div>
  );
}

function TaskSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <h2 className="mb-3 text-sm font-semibold text-zani-text">{title}</h2>
      <div className="rounded-card border border-zani-border bg-zani-card p-4 shadow-zani-card">
        {children}
      </div>
    </section>
  );
}

function EntityLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CommentRow({
  comment,
  onDelete,
  isDeleting,
}: {
  comment: TaskComment;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-card border border-zani-border bg-surface-subtle p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-6 text-zani-text">
            {comment.text}
          </p>
          <p className="mt-1 text-xs font-semibold text-zani-muted">
            {comment.author_name ||
              comment.author_email ||
              t("resources.typeStaff")}{" "}
            / {formatDateTime(comment.created_at)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={onDelete}
          isLoading={isDeleting}
        >
          {t("tasks.deleteComment")}
        </Button>
      </div>
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex gap-3 rounded-card bg-surface-subtle p-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-zani-card text-brand-600">
        <CalendarClock size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zani-text">
          {event.text || event.event_type}
        </p>
        <p className="mt-1 text-xs font-semibold text-zani-muted">
          {formatDateTime(event.created_at)}
        </p>
      </div>
    </div>
  );
}
