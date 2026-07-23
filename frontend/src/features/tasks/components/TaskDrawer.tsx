import { BellPlus, CalendarClock, CalendarPlus, Check, Clock, Link2, MessageSquare, Pencil, Play, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { CrmEntityDrawer, type CrmDrawerEntity } from "../../../components/crm/CrmEntityDrawer";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Textarea } from "../../../components/ui/Textarea";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import { cn } from "../../../lib/cn";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { TaskDetailsUpdatePayload } from "../../../api/tasks";
import type { ActivityEvent, Task, TaskComment, TeamMember } from "../../../types";
import { toDateTimeLocal } from "../taskFormUtils";

type TaskDrawerProps = {
  task: Task | null;
  comments: TaskComment[];
  commentsLoading: boolean;
  activityEvents: ActivityEvent[];
  activityLoading: boolean;
  commentText: string;
  teamMembers: TeamMember[];
  isAddingComment: boolean;
  detailsErrorMessage?: string | null;
  drawerEntity: CrmDrawerEntity | null;
  onCommentTextChange: (value: string) => void;
  onAddComment: () => void;
  onClose: () => void;
  onOpenEntity: (entity: CrmDrawerEntity) => void;
  onCloseEntity: () => void;
  onStart: (task: Task) => void;
  onComplete: (task: Task) => void;
  onCancel: (task: Task) => void;
  onReopen: (task: Task) => void;
  onDeleteComment: (task: Task, comment: TaskComment) => void;
  onUpdateDetails: (task: Task, payload: TaskDetailsUpdatePayload) => Promise<unknown> | void;
  onAssignToMe: (task: Task) => void;
  onWatch: (task: Task) => void;
  onSnoozeTomorrow: (task: Task) => void;
  onDueToday: (task: Task) => void;
  onDueTomorrow: (task: Task) => void;
  pending: {
    start: boolean;
    complete: boolean;
    cancel: boolean;
    reopen: boolean;
    updateDetails: boolean;
    assignToMe: boolean;
    watch: boolean;
    snooze: boolean;
    dueToday: boolean;
    dueTomorrow: boolean;
    deleteComment: boolean;
  };
};

type TaskDrawerTab = "overview" | "comments" | "history";

export function TaskDrawer({
  task,
  comments,
  commentsLoading,
  activityEvents,
  activityLoading,
  commentText,
  teamMembers,
  isAddingComment,
  detailsErrorMessage,
  drawerEntity,
  onCommentTextChange,
  onAddComment,
  onClose,
  onOpenEntity,
  onCloseEntity,
  onStart,
  onComplete,
  onCancel,
  onReopen,
  onDeleteComment,
  onUpdateDetails,
  onAssignToMe,
  onWatch,
  onSnoozeTomorrow,
  onDueToday,
  onDueTomorrow,
  pending,
}: TaskDrawerProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<TaskDrawerTab>("overview");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [detailsDraft, setDetailsDraft] = useState({
    title: "",
    description: "",
    priority: "normal",
    due_at: "",
    reminder_at: "",
  });
  const titleId = "task-drawer-title";
  useBodyScrollLock(Boolean(task));

  useEffect(() => {
    if (!task) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);
    setActiveTab("overview");
    setIsEditingDetails(false);
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => {
      cancelAnimationFrame(frame);
      setIsOpen(false);
    };
  }, [task?.id]);

  useEffect(() => {
    setAssigneeDraft(task?.assignee ? String(task.assignee) : "");
  }, [task?.assignee, task?.id]);

  useEffect(() => {
    if (!task || isEditingDetails) return;
    setDetailsDraft({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "normal",
      due_at: toDateTimeLocal(task.due_at),
      reminder_at: toDateTimeLocal(task.reminder_at),
    });
  }, [isEditingDetails, task]);

  if (!task) {
    return <CrmEntityDrawer entity={drawerEntity} onClose={onCloseEntity} />;
  }

  const isClosed = ["done", "cancelled"].includes(task.status);
  const assigneeLabel = task.assignee_name || task.assignee_email || "";
  const activeTeamMembers = teamMembers.filter((member) => member.is_active);
  const selectedAssigneeId = assigneeDraft ? Number(assigneeDraft) : null;
  const assigneeChanged = selectedAssigneeId !== (task.assignee ? Number(task.assignee) : null);
  const detailsChanged =
    detailsDraft.title.trim() !== task.title ||
    detailsDraft.description !== (task.description || "") ||
    detailsDraft.priority !== task.priority ||
    detailsDraft.due_at !== toDateTimeLocal(task.due_at) ||
    detailsDraft.reminder_at !== toDateTimeLocal(task.reminder_at);
  const canSaveDetails = detailsDraft.title.trim().length > 0 && detailsChanged;
  const canStart = task.status === "open";
  const canComplete = !isClosed;
  const canCancel = !isClosed;
  const canReopen = isClosed;
  const linkedEntitiesCount = [task.client, task.lead, task.deal, task.appointment, task.conversation].filter(Boolean).length;
  const statusHint =
    task.status === "open"
      ? t("tasks.statusOpenHint")
      : task.status === "in_progress"
        ? t("tasks.statusInProgressHint")
        : task.status === "done"
          ? t("tasks.statusDoneHint")
          : t("tasks.statusCancelledHint");

  const saveDetails = async () => {
    if (!canSaveDetails) return;
    try {
      await onUpdateDetails(task, {
        title: detailsDraft.title.trim(),
        description: detailsDraft.description,
        priority: detailsDraft.priority as Task["priority"],
        due_at: detailsDraft.due_at ? new Date(detailsDraft.due_at).toISOString() : null,
        reminder_at: detailsDraft.reminder_at ? new Date(detailsDraft.reminder_at).toISOString() : null,
      });
      setIsEditingDetails(false);
    } catch {
      // The page-level mutation exposes the error message back into the drawer.
    }
  };

  const cancelDetailsEdit = () => {
    setDetailsDraft({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "normal",
      due_at: toDateTimeLocal(task.due_at),
      reminder_at: toDateTimeLocal(task.reminder_at),
    });
    setIsEditingDetails(false);
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-[rgba(23,18,15,0.35)] backdrop-blur-sm transition-opacity duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onMouseDown={onClose}
      >
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            "ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden bg-surface-muted shadow-premium transition-transform duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform sm:rounded-l-[2rem]",
            isOpen ? "translate-x-0" : "translate-x-full",
          )}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-10 border-b border-zani-border bg-surface-card/95 px-5 py-4 backdrop-blur-xl sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={task.priority} />
                  <StatusBadge status={task.status} />
                  {task.due_at ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{t("tasks.due")} {formatDateTime(task.due_at)}</span> : null}
                </div>
                <h2 id={titleId} className="truncate text-2xl font-semibold tracking-tight text-zani-ink">{task.title}</h2>
                <p className="mt-1 text-sm font-semibold text-zani-muted">
                  {assigneeLabel || t("tasks.noAssignee")}
                  {task.reminder_at ? ` В· ${t("tasks.reminderAt")}: ${formatDateTime(task.reminder_at)}` : ""}
                </p>
              </div>
              <Button type="button" variant="ghost" className="h-12 w-12 shrink-0 rounded-full px-0" onClick={onClose} aria-label={t("crmCard.close")}>
                <X size={28} strokeWidth={2.4} />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <section className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("tasks.taskSummary")}</p>
                  <p className="mt-2 text-sm leading-6 text-zani-subtle">{statusHint}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {canStart ? <Button variant="secondary" onClick={() => onStart(task)} isLoading={pending.start}><Play size={16} /> {t("tasks.start")}</Button> : null}
                  {canComplete ? <Button variant="primary" onClick={() => onComplete(task)} isLoading={pending.complete}><Check size={16} /> {t("tasks.complete")}</Button> : null}
                  {canCancel ? <Button variant="ghost" onClick={() => onCancel(task)} isLoading={pending.cancel}><X size={16} /> {t("tasks.cancel")}</Button> : null}
                  {canReopen ? <Button variant="secondary" onClick={() => onReopen(task)} isLoading={pending.reopen}><RotateCcw size={16} /> {t("tasks.reopen")}</Button> : null}
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {!isClosed ? <Button variant="secondary" onClick={() => setIsEditingDetails((value) => !value)}><Pencil size={16} /> {t("tasks.edit")}</Button> : null}
                {!isClosed ? <Button variant="secondary" onClick={() => onAssignToMe(task)} isLoading={pending.assignToMe}><UserPlus size={16} /> {t("tasks.assignToMe")}</Button> : null}
                {!isClosed ? <Button variant="secondary" onClick={() => onWatch(task)} isLoading={pending.watch}><BellPlus size={16} /> {t("tasks.watch")}</Button> : null}
                {!isClosed ? <Button variant="secondary" onClick={() => onSnoozeTomorrow(task)} isLoading={pending.snooze}><Clock size={16} /> {t("tasks.snooze")}</Button> : null}
                {!isClosed ? <Button variant="secondary" onClick={() => onDueToday(task)} isLoading={pending.dueToday}><CalendarPlus size={16} /> {t("common.today")}</Button> : null}
                {!isClosed ? <Button variant="secondary" onClick={() => onDueTomorrow(task)} isLoading={pending.dueTomorrow}><CalendarPlus size={16} /> {t("tasks.tomorrow")}</Button> : null}
              </div>
            </section>

            <div className="sticky top-0 z-10 -mx-5 mt-4 border-y border-zani-border bg-surface-muted/92 px-5 py-2 backdrop-blur sm:-mx-7 sm:px-7">
              <div className="grid grid-cols-3 gap-1 rounded-control bg-surface-muted p-1">
                <TaskDrawerTabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
                  {t("tasks.drawerOverviewTab")}
                </TaskDrawerTabButton>
                <TaskDrawerTabButton active={activeTab === "comments"} onClick={() => setActiveTab("comments")}>
                  {t("tasks.drawerCommentsTab")} В· {comments.length}
                </TaskDrawerTabButton>
                <TaskDrawerTabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>
                  {t("tasks.drawerHistoryTab")} В· {activityEvents.length}
                </TaskDrawerTabButton>
              </div>
            </div>

            {activeTab === "overview" ? (
              <div className="mt-4 space-y-4">
                {isEditingDetails ? (
                  <div className="rounded-card border border-brand-100 bg-surface-card p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("tasks.editTitle")}</p>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={cancelDetailsEdit}>
                          {t("common.cancel")}
                        </Button>
                        <Button type="button" size="sm" isLoading={pending.updateDetails} disabled={!canSaveDetails} onClick={() => void saveDetails()}>
                          {t("clients.save")}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <Input
                        label={t("tasks.formTitle")}
                        value={detailsDraft.title}
                        onChange={(event) => setDetailsDraft((current) => ({ ...current, title: event.target.value }))}
                        required
                      />
                      <Textarea
                        label={t("tasks.formDescription")}
                        className="min-h-28"
                        value={detailsDraft.description}
                        onChange={(event) => setDetailsDraft((current) => ({ ...current, description: event.target.value }))}
                      />
                      <div className="grid gap-3 md:grid-cols-3">
                        <Select
                          label={t("tasks.priority")}
                          value={detailsDraft.priority}
                          onChange={(event) => setDetailsDraft((current) => ({ ...current, priority: event.target.value }))}
                          options={[
                            { value: "normal", label: t("tasks.priorityNormal") },
                            { value: "high", label: t("tasks.priorityHigh") },
                            { value: "urgent", label: t("tasks.priorityUrgent") },
                            { value: "low", label: t("tasks.priorityLow") },
                          ]}
                        />
                        <Input
                          label={t("tasks.dueAt")}
                          type="datetime-local"
                          value={detailsDraft.due_at}
                          onChange={(event) => setDetailsDraft((current) => ({ ...current, due_at: event.target.value }))}
                        />
                        <Input
                          label={t("tasks.reminderAt")}
                          type="datetime-local"
                          value={detailsDraft.reminder_at}
                          onChange={(event) => setDetailsDraft((current) => ({ ...current, reminder_at: event.target.value }))}
                        />
                      </div>
                      {detailsErrorMessage ? <p className="rounded-card bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{detailsErrorMessage}</p> : null}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("crmCard.overview")}</p>
                  {task.description ? <p className="text-sm leading-6 text-zani-text">{task.description}</p> : <p className="text-sm leading-6 text-zani-muted">{t("crmCard.noNotesText")}</p>}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("tasks.assignee")}</p>
                    <div className="flex flex-col gap-3">
                      <Select
                        value={assigneeDraft}
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
                        isLoading={pending.updateDetails}
                        disabled={isClosed || !assigneeChanged}
                        onClick={() => {
                          onUpdateDetails(task, { assignee: selectedAssigneeId });
                        }}
                      >
                        <UserPlus size={16} /> {t("tasks.saveAssignee")}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">
                      <CalendarClock size={14} /> {t("tasks.dates")}
                    </p>
                    <div className="space-y-2 text-sm font-semibold text-zani-subtle">
                      {task.due_at ? <MetaRow label={t("tasks.dueAt")} value={formatDateTime(task.due_at)} /> : null}
                      {task.reminder_at ? <MetaRow label={t("tasks.reminderAt")} value={formatDateTime(task.reminder_at)} /> : null}
                      {task.snoozed_until ? <MetaRow label={t("tasks.snoozed")} value={formatDateTime(task.snoozed_until)} /> : null}
                      {task.completed_at ? <MetaRow label={t("tasks.completedAt")} value={formatDateTime(task.completed_at)} /> : null}
                      {task.cancelled_at ? <MetaRow label={t("tasks.cancelledAt")} value={formatDateTime(task.cancelled_at)} /> : null}
                      <MetaRow label={t("tasks.updatedAt")} value={formatDateTime(task.updated_at)} />
                    </div>
                  </div>
                </div>

                <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">
                      <Link2 size={14} /> {t("tasks.links")}
                    </p>
                    <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-zani-muted">{linkedEntitiesCount}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-zani-muted">
                    {task.client ? <EntityChip onClick={() => onOpenEntity({ type: "client", id: Number(task.client) })}>{task.client_name || t("common.client")}</EntityChip> : null}
                    {task.lead ? <EntityChip onClick={() => onOpenEntity({ type: "lead", id: Number(task.lead) })}>{task.lead_title || t("crmCard.leadNumber", { id: task.lead })}</EntityChip> : null}
                    {task.deal ? <EntityChip onClick={() => onOpenEntity({ type: "deal", id: Number(task.deal) })}>{task.deal_title || t("nav.deals")}</EntityChip> : null}
                    {task.appointment ? <EntityChip onClick={() => onOpenEntity({ type: "appointment", id: Number(task.appointment) })}>{task.appointment_service_name || t("nav.appointments")}{task.appointment_start_at ? ` В· ${formatDateTime(task.appointment_start_at)}` : ""}</EntityChip> : null}
                    {task.conversation ? <EntityLinkChip href={`/app/conversations?conversation=${task.conversation}`}>{task.conversation_label || task.conversation_external_user_id || t("nav.conversations")}</EntityLinkChip> : null}
                    {!linkedEntitiesCount ? <p className="text-sm font-semibold text-zani-muted">{t("tasks.noLinkedEntities")}</p> : null}
                  </div>
                </div>

                {task.cancel_reason ? (
                  <div className="rounded-card border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-400">{t("tasks.cancelReasonLabel")}</p>
                    {task.cancel_reason}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "comments" ? (
              <div className="mt-4 rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><MessageSquare size={14} /> {t("tasks.comments")}</p>
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-zani-muted">{comments.length}</span>
                </div>
                <div className="space-y-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-card border border-zani-border bg-surface-muted p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm leading-6 text-zani-text">{comment.text}</p>
                          <p className="mt-1 text-xs font-semibold text-zani-faint">
                            {comment.author_name || comment.author_email || t("resources.typeStaff")} В· {formatDateTime(comment.created_at)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                          aria-label={t("tasks.deleteComment")}
                          title={t("tasks.deleteComment")}
                          isLoading={pending.deleteComment}
                          onClick={() => onDeleteComment(task, comment)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {commentsLoading ? <p className="text-sm text-zani-muted">{t("common.loading")}</p> : null}
                  {!commentsLoading && !comments.length ? <p className="text-sm text-zani-muted">{t("tasks.noComments")}</p> : null}
                </div>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onAddComment();
                  }}
                >
                  <Textarea value={commentText} onChange={(event) => onCommentTextChange(event.target.value)} placeholder={t("tasks.commentPlaceholder")} />
                  <Button type="submit" isLoading={isAddingComment} disabled={!commentText.trim()}>{t("tasks.addComment")}</Button>
                </form>
              </div>
            ) : null}

            {activeTab === "history" ? (
              <div className="mt-4 rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">
                    <CalendarClock size={14} /> {t("tasks.history")}
                  </p>
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-zani-muted">{activityEvents.length}</span>
                </div>
                <div className="space-y-2">
                  {activityEvents.slice(0, 16).map((event) => (
                    <TaskActivityRow key={event.id} event={event} />
                  ))}
                  {activityLoading ? <p className="text-sm text-zani-muted">{t("common.loading")}</p> : null}
                  {!activityLoading && !activityEvents.length ? <p className="text-sm text-zani-muted">{t("tasks.noHistory")}</p> : null}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
      <CrmEntityDrawer entity={drawerEntity} onClose={onCloseEntity} />
    </>
  );
}

function TaskDrawerTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-10 rounded-lg px-3 text-sm font-semibold transition",
        active ? "bg-surface-card text-brand-700 shadow-sm" : "text-zani-muted hover:bg-surface-card hover:text-zani-ink",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-3 py-2">
      <span className="text-zani-faint">{label}</span>
      <span className="text-right text-zani-ink">{value}</span>
    </div>
  );
}

function EntityChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="rounded-full bg-surface-muted px-3 py-1.5 transition hover:bg-brand-50 hover:text-brand-700" onClick={onClick}>
      {children}
    </button>
  );
}

function EntityLinkChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="rounded-full bg-surface-muted px-3 py-1.5 transition hover:bg-brand-50 hover:text-brand-700" href={href}>
      {children}
    </a>
  );
}

function TaskActivityRow({ event }: { event: ActivityEvent }) {
  const { t } = useI18n();
  const details = activityDetails(event, t);
  return (
    <div className="flex gap-3 rounded-card bg-surface-muted p-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-control bg-surface-card text-brand-600">
        <CalendarClock size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-zani-ink">{event.text || event.event_type}</p>
        <p className="mt-1 text-xs font-semibold text-zani-faint">{formatDateTime(event.created_at)}</p>
        {details.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {details.map((detail) => (
              <span key={detail} className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-bold text-zani-muted">
                {detail}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function activityDetails(event: ActivityEvent, t: ReturnType<typeof useI18n>["t"]) {
  const metadata = event.metadata || {};
  const fields = metadata.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return [];
  return Object.keys(fields)
    .slice(0, 4)
    .map((field) => fieldLabel(field, t));
}

function fieldLabel(field: string, t: ReturnType<typeof useI18n>["t"]) {
  const labels: Record<string, string> = {
    title: t("tasks.title"),
    description: t("tasks.description"),
    priority: t("tasks.priority"),
    due_at: t("tasks.dueAt"),
    reminder_at: t("tasks.reminderAt"),
    assignee: t("tasks.assignee"),
    client: t("common.client"),
    lead: t("tasks.lead"),
    deal: t("tasks.deal"),
    appointment: t("tasks.appointment"),
    conversation: t("nav.conversations"),
  };
  return labels[field] || field;
}
