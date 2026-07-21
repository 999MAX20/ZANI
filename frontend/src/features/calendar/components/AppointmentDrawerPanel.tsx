import { CalendarDays, Plus, UserRound, X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { dateInTimeZone } from "../../../lib/format";
import { formatPickerDate, formatTime } from "../calendarUtils";
import type { CalendarTranslate } from "../calendarTypes";
import type { Appointment, Client, Lead, Resource, Service } from "../../../types";

export function AppointmentDrawerPanel({
  appointment,
  clientById,
  serviceById,
  resourceById,
  leadById,
  locale,
  businessTimeZone,
  statusMutationPending,
  getAppointmentActionLabel,
  getAllowedStatusActions,
  canRescheduleAppointment,
  shouldShowRepeatBooking,
  onClose,
  onRepeatBooking,
  onStatusAction,
  onReschedule,
  onOpenCard,
  onArchive,
  t,
}: {
  appointment: Appointment;
  clientById: Map<number, Client>;
  serviceById: Map<number, Service>;
  resourceById: Map<number, Resource>;
  leadById: Map<number, Lead>;
  locale: string;
  businessTimeZone: string;
  statusMutationPending: boolean;
  getAppointmentActionLabel: (status: Appointment["status"]) => string;
  getAllowedStatusActions: (appointment: Appointment) => Appointment["status"][];
  canRescheduleAppointment: (appointment: Appointment) => boolean;
  shouldShowRepeatBooking: (appointment: Appointment) => boolean;
  onClose: () => void;
  onRepeatBooking: (appointment: Appointment) => void;
  onStatusAction: (appointment: Appointment, status: Appointment["status"]) => void;
  onReschedule: (appointment: Appointment) => void;
  onOpenCard: (appointment: Appointment) => void;
  onArchive: (appointment: Appointment) => void;
  t: CalendarTranslate;
}) {
  const canReschedule = canRescheduleAppointment(appointment);
  const statusActions = getAllowedStatusActions(appointment);

  return (
    <aside className="fixed inset-x-3 bottom-3 z-40 max-h-[82vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-premium sm:inset-x-auto sm:right-6 sm:top-24 sm:bottom-auto sm:w-[420px]">
      <div className="pr-10">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("calendar.selectedAppointment")}</p>
        <button
          type="button"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-midnight"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X size={18} />
        </button>

        <div className="mt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-2xl font-black leading-7 text-midnight">{clientById.get(appointment.client)?.full_name || t("common.client")}</p>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {formatTime(appointment.start_at, locale, businessTimeZone)}-{formatTime(appointment.end_at, locale, businessTimeZone)} В· {formatPickerDate(dateInTimeZone(appointment.start_at, businessTimeZone), locale)}
              </p>
            </div>
            <StatusBadge status={appointment.status} />
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("calendar.visit")}</p>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 border-t border-slate-200/70 py-2 first:border-t-0 first:pt-0">
              <p className="text-xs font-black uppercase text-slate-400">{t("common.service")}</p>
              <p className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-700">
                <CalendarDays size={15} className="shrink-0 text-slate-400" />
                <span className="truncate">{serviceById.get(appointment.service)?.name || t("common.service")}</span>
              </p>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 border-t border-slate-200/70 py-2">
              <p className="text-xs font-black uppercase text-slate-400">{t("appointment.resource")}</p>
              <p className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-700">
                <UserRound size={15} className="shrink-0 text-slate-400" />
                <span className="truncate">{appointment.resource ? resourceById.get(appointment.resource)?.name || t("appointment.noResource") : t("appointment.noResource")}</span>
              </p>
            </div>
            <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 border-t border-slate-200/70 py-2">
              <p className="text-xs font-black uppercase text-slate-400">{t("appointment.source")}</p>
              <p className="truncate text-sm font-black text-slate-700">{t(`appointment.source.${appointment.source}`)}</p>
            </div>
            {appointment.lead ? (
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 border-t border-slate-200/70 py-2 pb-0">
                <p className="text-xs font-black uppercase text-slate-400">{t("calendar.lead")}</p>
                <p className="text-sm font-black text-slate-700">#{leadById.get(appointment.lead)?.id || appointment.lead}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-2">
            {shouldShowRepeatBooking(appointment) ? (
              <Button type="button" className="w-full" onClick={() => onRepeatBooking(appointment)}>
                <Plus size={16} />
                {t("appointments.repeatBooking")}
              </Button>
            ) : null}
            {statusActions.length ? (
              <div className="grid grid-cols-2 gap-2">
                {statusActions.map((status, index) => (
                  <Button
                    key={status}
                    type="button"
                    variant={index === 0 ? "primary" : "secondary"}
                    size="sm"
                    disabled={statusMutationPending}
                    onClick={() => onStatusAction(appointment, status)}
                  >
                    {getAppointmentActionLabel(status)}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              {canReschedule ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => onReschedule(appointment)}>
                  {t("appointments.reschedule")}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" size="sm" className={!canReschedule ? "col-span-2" : undefined} onClick={() => onOpenCard(appointment)}>
                {t("calendar.openCard")}
              </Button>
            </div>
            <button
              type="button"
              className="mt-2 min-h-9 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:border-red-200 hover:bg-red-50"
              onClick={() => onArchive(appointment)}
            >
              {t("appointments.archiveAction")}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
