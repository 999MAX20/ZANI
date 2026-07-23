import {
  CalendarClock,
  CalendarPlus,
  Check,
  ClipboardList,
  Link2,
  MessageSquare,
  Play,
  RotateCcw,
  SquareArrowOutUpRight,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";

import type { CrmDrawerEntity } from "../../../components/crm/CrmEntityDrawer";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDateTime } from "../../../lib/format";
import type { Task } from "../../../types";

type Translate = (key: string, params?: Record<string, string | number>) => string;

type TaskQuickInspectorProps = {
  task: Task | null;
  t: Translate;
  onOpen: (task: Task) => void;
  onOpenRelated: (path: string) => void;
  onStart: (task: Task) => void;
  onComplete: (task: Task) => void;
  onCancel: (task: Task) => void;
  onReopen: (task: Task) => void;
  onAssignToMe: (task: Task) => void;
  onDueToday: (task: Task) => void;
  onDueTomorrow: (task: Task) => void;
  pending: {
    start: boolean;
    complete: boolean;
    cancel: boolean;
    reopen: boolean;
    assignToMe: boolean;
    dueToday: boolean;
    dueTomorrow: boolean;
  };
};

export function TaskQuickInspector({
  task,
  t,
  onOpen,
  onOpenRelated,
  onStart,
  onComplete,
  onCancel,
  onReopen,
  onAssignToMe,
  onDueToday,
  onDueTomorrow,
  pending,
}: TaskQuickInspectorProps) {
  if (!task) {
    return (
      <div className="grid min-h-[260px] place-items-center p-4 text-center">
        <div>
          <p className="text-sm font-bold text-zani-text">{t("tasks.emptyTitle")}</p>
          <p className="mt-1 text-sm font-semibold text-zani-muted">{t("tasks.emptyText")}</p>
        </div>
      </div>
    );
  }

  const isClosed = task.status === "done" || task.status === "cancelled";
  const relatedEntities = getRelatedEntities(task, t);
  const statusHint =
    task.status === "open"
      ? t("tasks.statusOpenHint")
      : task.status === "in_progress"
        ? t("tasks.statusInProgressHint")
        : task.status === "done"
          ? t("tasks.statusDoneHint")
          : t("tasks.statusCancelledHint");

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-zani-border bg-zani-card shadow-zani-card">
      <div className="border-b border-zani-border p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zani-muted">{t("tasks.task")}</p>
            <h2 className="mt-1 truncate text-base font-bold text-zani-text">{task.title}</h2>
          </div>
          <StatusBadge status={task.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status={task.priority} />
          <span className="inline-flex items-center rounded-control bg-surface-muted px-2 py-1 text-xs font-bold text-zani-muted ring-1 ring-zani-border">
            {task.assignee_name || task.assignee_email || t("tasks.noAssignee")}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <section className="rounded-card border border-zani-border bg-surface-muted p-3">
          <p className="text-xs font-semibold text-zani-muted">{t("tasks.taskSummary")}</p>
          <p className="mt-1 text-sm font-bold leading-5 text-zani-text">{statusHint}</p>
          {task.description ? (
            <p className="mt-2 line-clamp-3 text-sm font-medium leading-5 text-zani-muted">{task.description}</p>
          ) : null}
        </section>

        <div className="grid gap-2">
          <MetaRow
            icon={CalendarClock}
            label={t("tasks.dueAt")}
            value={task.due_at ? formatDateTime(task.due_at) : t("tasks.groupNoDue")}
          />
          <MetaRow
            icon={ClipboardList}
            label={t("tasks.priority")}
            value={priorityLabel(task.priority, t)}
          />
          <MetaRow
            icon={UsersRound}
            label={t("tasks.assignee")}
            value={task.assignee_name || task.assignee_email || t("tasks.noAssignee")}
          />
        </div>

        <section className="rounded-card border border-zani-border bg-surface-card p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-zani-muted">
            <Link2 size={14} />
            {t("tasks.links")}
          </p>
          <div className="flex flex-wrap gap-2">
            {relatedEntities.map((entity) => (
              <button
                key={`${entity.type}-${entity.id}`}
                type="button"
                className="max-w-full truncate rounded-full bg-surface-muted px-3 py-1.5 text-xs font-bold text-zani-muted transition hover:bg-brand-50 hover:text-brand-700"
                onClick={() => onOpenRelated(entity.path)}
              >
                {entity.label}
              </button>
            ))}
            {!relatedEntities.length ? (
              <p className="text-sm font-semibold text-zani-muted">{t("tasks.noLinkedEntities")}</p>
            ) : null}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <RelatedStat icon={MessageSquare} value={task.comments_count || 0} label={t("tasks.comments")} />
          <RelatedStat icon={UsersRound} value={task.watchers_count || 0} label={t("tasks.watch")} />
        </div>

        {task.cancel_reason ? (
          <section className="rounded-card border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
            <p className="mb-1 text-xs font-bold text-red-500">{t("tasks.cancelReasonLabel")}</p>
            {task.cancel_reason}
          </section>
        ) : null}
      </div>

      <div className="grid gap-2 border-t border-zani-border p-4">
        <Button type="button" onClick={() => onOpen(task)}>
          <SquareArrowOutUpRight size={16} />
          {t("tasks.details")}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {task.status === "open" ? (
            <Button type="button" variant="secondary" isLoading={pending.start} onClick={() => onStart(task)}>
              <Play size={16} />
              {t("tasks.start")}
            </Button>
          ) : null}
          {!isClosed ? (
            <Button type="button" variant="secondary" isLoading={pending.complete} onClick={() => onComplete(task)}>
              <Check size={16} />
              {t("tasks.complete")}
            </Button>
          ) : null}
          {!isClosed ? (
            <Button type="button" variant="secondary" isLoading={pending.assignToMe} onClick={() => onAssignToMe(task)}>
              <UserPlus size={16} />
              {t("tasks.assignToMe")}
            </Button>
          ) : null}
          {!isClosed ? (
            <Button type="button" variant="secondary" isLoading={pending.dueToday} onClick={() => onDueToday(task)}>
              <CalendarPlus size={16} />
              {t("common.today")}
            </Button>
          ) : null}
          {!isClosed ? (
            <Button type="button" variant="secondary" isLoading={pending.dueTomorrow} onClick={() => onDueTomorrow(task)}>
              <CalendarPlus size={16} />
              {t("tasks.tomorrow")}
            </Button>
          ) : null}
          {!isClosed ? (
            <Button type="button" variant="ghost" isLoading={pending.cancel} onClick={() => onCancel(task)}>
              <X size={16} />
              {t("tasks.cancel")}
            </Button>
          ) : null}
          {isClosed ? (
            <Button type="button" variant="secondary" isLoading={pending.reopen} onClick={() => onReopen(task)}>
              <RotateCcw size={16} />
              {t("tasks.reopen")}
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2">
      <Icon size={16} className="shrink-0 text-zani-muted" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zani-muted">{label}</p>
        <p className="truncate text-sm font-bold text-zani-text">{value}</p>
      </div>
    </div>
  );
}

function RelatedStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof MessageSquare;
  value: number;
  label: string;
}) {
  return (
    <div className="min-w-0 rounded-control bg-surface-muted p-2">
      <Icon size={15} className="text-zani-muted" />
      <p className="mt-2 text-base font-bold text-zani-text">{value}</p>
      <p className="truncate text-[11px] font-semibold text-zani-muted">{label}</p>
    </div>
  );
}

function priorityLabel(priority: Task["priority"], t: Translate) {
  if (priority === "urgent") return t("tasks.priorityUrgent");
  if (priority === "high") return t("tasks.priorityHigh");
  if (priority === "low") return t("tasks.priorityLow");
  return t("tasks.priorityNormal");
}

function getRelatedEntities(task: Task, t: Translate) {
  const entities: Array<{
    type: CrmDrawerEntity["type"] | "conversation";
    id: number;
    label: string;
    path: string;
  }> = [];
  if (task.client) {
    entities.push({
      type: "client",
      id: Number(task.client),
      label: task.client_name || t("common.client"),
      path: `/app/clients/${task.client}`,
    });
  }
  if (task.lead) {
    entities.push({
      type: "lead",
      id: Number(task.lead),
      label: task.lead_title || t("tasks.lead"),
      path: `/app/leads/${task.lead}`,
    });
  }
  if (task.deal) {
    entities.push({
      type: "deal",
      id: Number(task.deal),
      label: task.deal_title || t("tasks.deal"),
      path: `/app/deals/${task.deal}`,
    });
  }
  if (task.appointment) {
    entities.push({
      type: "appointment",
      id: Number(task.appointment),
      label: task.appointment_service_name || t("tasks.appointment"),
      path: `/app/calendar/${task.appointment}`,
    });
  }
  if (task.conversation) {
    entities.push({
      type: "conversation",
      id: Number(task.conversation),
      label: task.conversation_label || task.conversation_external_user_id || t("nav.conversations"),
      path: `/app/conversations/${task.conversation}`,
    });
  }
  return entities;
}
