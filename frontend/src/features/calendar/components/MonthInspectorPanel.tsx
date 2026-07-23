import { Plus, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/Button";
import type { Appointment, Client, Resource, Service, Task, WorkingHours } from "../../../types";
import type { CalendarTranslate } from "../calendarTypes";
import { formatCalendarDateTime, formatPickerDate } from "../calendarUtils";
import { CalendarAppointmentPreview } from "./CalendarAppointmentCards";

export function MonthInspectorPanel({
  date,
  locale,
  businessTimeZone,
  selectedDayHours,
  dayAppointments,
  dayTasks,
  openSlotsLabel,
  openSlotsCount,
  selectedAppointmentId,
  clientById,
  serviceById,
  resourceById,
  onClose,
  onOpenBooking,
  onOpenDay,
  onSelectAppointment,
  onOpenAppointmentCard,
  t,
}: {
  date: string;
  locale: string;
  businessTimeZone: string;
  selectedDayHours: WorkingHours | null;
  dayAppointments: Appointment[];
  dayTasks: Task[];
  openSlotsLabel: string;
  openSlotsCount: number;
  selectedAppointmentId: number | null;
  clientById: Map<number, Client>;
  serviceById: Map<number, Service>;
  resourceById: Map<number, Resource>;
  onClose: () => void;
  onOpenBooking: (date: string) => void;
  onOpenDay: () => void;
  onSelectAppointment: (appointment: Appointment) => void;
  onOpenAppointmentCard: (appointment: Appointment) => void;
  t: CalendarTranslate;
}) {
  return (
    <aside className="fixed inset-x-3 bottom-3 z-40 max-h-[82vh] overflow-y-auto rounded-card border border-zani-border bg-zani-card p-4 shadow-premium sm:inset-x-auto sm:right-6 sm:top-24 sm:bottom-auto sm:w-[380px]">
      <div className="pr-10">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-zani-muted">{t("calendar.selectedDay")}</p>
        <p className="mt-2 text-xl font-bold text-zani-text">{formatPickerDate(date, locale)}</p>
        <p className="mt-1 text-sm font-bold text-zani-muted">
          {selectedDayHours && !selectedDayHours.is_day_off
            ? `${selectedDayHours.start_time.slice(0, 5)}-${selectedDayHours.end_time.slice(0, 5)}`
            : t("calendar.freeDay")}
        </p>
      </div>
      <button
        type="button"
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-control text-zani-muted transition hover:bg-surface-hover hover:text-zani-text"
        onClick={onClose}
        aria-label={t("common.close")}
      >
        <X size={18} />
      </button>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          [t("calendar.bookings"), dayAppointments.length],
          [openSlotsLabel, openSlotsCount],
          [t("calendar.tasksToday"), dayTasks.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-control border border-zani-border bg-surface-muted px-3 py-2">
            <p className="text-lg font-bold text-zani-text">{value}</p>
            <p className="truncate text-[11px] font-bold uppercase text-zani-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" size="sm" onClick={() => onOpenBooking(date)}>
          <Plus size={16} />
          {t("calendar.newBooking")}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onOpenDay}>
          {t("calendar.openDay")}
        </Button>
        <Link className="col-span-2 inline-flex min-h-9 items-center justify-center rounded-control border border-zani-border bg-zani-card px-3 py-2 text-xs font-bold text-zani-text transition hover:bg-surface-hover" to="/app/working-hours">
          {t("appointment.openHours")}
        </Link>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-zani-muted">{t("calendar.bookings")}</p>
        <div className="space-y-2">
          {dayAppointments.map((appointment) => (
            <CalendarAppointmentPreview
              key={appointment.id}
              appointment={appointment}
              selectedAppointmentId={selectedAppointmentId}
              clientById={clientById}
              serviceById={serviceById}
              resourceById={resourceById}
              locale={locale}
              businessTimeZone={businessTimeZone}
              onSelect={onSelectAppointment}
              onOpenCard={onOpenAppointmentCard}
              t={t}
            />
          ))}
          {!dayAppointments.length ? (
            <button
              type="button"
              className="w-full rounded-control border border-dashed border-zani-border bg-surface-muted p-4 text-left text-sm font-bold leading-6 text-zani-muted transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              onClick={() => onOpenBooking(date)}
            >
              {t("calendar.freeDayHint")}
            </button>
          ) : null}
        </div>
      </div>

      {dayTasks.length ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-zani-muted">{t("calendar.tasksToday")}</p>
          <div className="space-y-2">
            {dayTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="rounded-control border border-zani-border bg-surface-muted p-3">
                <p className="truncate text-sm font-bold text-zani-text">{task.title}</p>
                {task.due_at ? <p className="mt-1 text-xs font-bold text-zani-muted">{formatCalendarDateTime(task.due_at, locale, businessTimeZone)}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
