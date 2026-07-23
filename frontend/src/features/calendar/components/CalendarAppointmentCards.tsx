import { Clock } from "lucide-react";
import { Link } from "react-router-dom";

import { StatusBadge } from "../../../components/ui/StatusBadge";
import { cn } from "../../../lib/cn";
import type { Appointment, Client, Resource, Service, Task } from "../../../types";
import type { CalendarTranslate } from "../calendarTypes";
import { formatTime } from "../calendarUtils";

export function CalendarAppointmentPreview({
  appointment,
  compact = false,
  selectedAppointmentId,
  clientById,
  serviceById,
  resourceById,
  locale,
  businessTimeZone,
  onSelect,
  onOpenCard,
  t,
}: {
  appointment: Appointment;
  compact?: boolean;
  selectedAppointmentId: number | null;
  clientById: Map<number, Client>;
  serviceById: Map<number, Service>;
  resourceById: Map<number, Resource>;
  locale: string;
  businessTimeZone: string;
  onSelect: (appointment: Appointment) => void;
  onOpenCard: (appointment: Appointment) => void;
  t: CalendarTranslate;
}) {
  const client = clientById.get(appointment.client);
  const service = serviceById.get(appointment.service);
  const resource = appointment.resource ? resourceById.get(appointment.resource) : null;

  return (
    <button
      key={appointment.id}
      type="button"
      className={cn(
        compact
          ? "w-full bg-zani-card px-4 py-3 text-left transition hover:bg-brand-50"
          : "w-full rounded-control border border-zani-border bg-zani-card px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50",
        selectedAppointmentId === appointment.id && (compact ? "bg-brand-50" : "border-brand-400 bg-brand-50 ring-1 ring-brand-200"),
      )}
      onClick={() => onSelect(appointment)}
      onDoubleClick={() => onOpenCard(appointment)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-zani-text">{client?.full_name || t("common.client")}</p>
          <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-zani-muted">
            <Clock size={13} />
            <span className="truncate">{formatTime(appointment.start_at, locale, businessTimeZone)}-{formatTime(appointment.end_at, locale, businessTimeZone)} - {service?.name || t("common.service")}</span>
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>
      {!compact ? <p className="mt-2 truncate text-xs font-semibold text-zani-muted">{resource?.name || t("calendar.noResource")} - {appointment.source}</p> : null}
    </button>
  );
}

export function CalendarTaskPreview({
  task,
  locale,
  businessTimeZone,
  t,
}: {
  task: Task;
  locale: string;
  businessTimeZone: string;
  t: CalendarTranslate;
}) {
  return (
    <Link
      key={task.id}
      to={`/app/tasks/${task.id}`}
      className="flex min-h-[58px] items-start justify-between gap-3 bg-zani-card px-4 py-3 text-left transition hover:bg-brand-50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-zani-text">{task.title}</p>
        <p className="mt-1 truncate text-xs font-bold text-zani-muted">
          {task.due_at ? formatTime(task.due_at, locale, businessTimeZone) : t("tasks.dueNone")}
          {task.assignee_name ? ` - ${task.assignee_name}` : ""}
        </p>
      </div>
      <StatusBadge status={task.status} />
    </Link>
  );
}
