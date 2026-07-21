import { Plus, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/Button";
import { formatCalendarDateTime, formatPickerDate } from "../calendarUtils";
import { CalendarAppointmentPreview } from "./CalendarAppointmentCards";
import type { CalendarTranslate } from "../calendarTypes";
import type { Appointment, Client, Resource, Service, Task, WorkingHours } from "../../../types";

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
    <aside className="fixed inset-x-3 bottom-3 z-40 max-h-[82vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-premium sm:inset-x-auto sm:right-6 sm:top-24 sm:bottom-auto sm:w-[380px]">
      <div className="pr-10">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("calendar.selectedDay")}</p>
        <p className="mt-2 text-xl font-black text-midnight">{formatPickerDate(date, locale)}</p>
        <p className="mt-1 text-sm font-bold text-slate-500">
          {selectedDayHours && !selectedDayHours.is_day_off
            ? `${selectedDayHours.start_time.slice(0, 5)}-${selectedDayHours.end_time.slice(0, 5)}`
            : t("calendar.freeDay")}
        </p>
      </div>
      <button
        type="button"
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-midnight"
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
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-lg font-black text-midnight">{value}</p>
            <p className="truncate text-[11px] font-black uppercase text-slate-400">{label}</p>
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
        <Link className="col-span-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-midnight transition hover:bg-slate-50" to="/app/working-hours">
          {t("appointment.openHours")}
        </Link>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("calendar.bookings")}</p>
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
              className="w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-left text-sm font-bold leading-6 text-slate-500 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              onClick={() => onOpenBooking(date)}
            >
              {t("calendar.freeDayHint")}
            </button>
          ) : null}
        </div>
      </div>

      {dayTasks.length ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("calendar.tasksToday")}</p>
          <div className="space-y-2">
            {dayTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="truncate text-sm font-black text-midnight">{task.title}</p>
                {task.due_at ? <p className="mt-1 text-xs font-bold text-slate-500">{formatCalendarDateTime(task.due_at, locale, businessTimeZone)}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
