import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { appointmentsApi } from "../../../api/appointments";
import { getApiErrorMessage } from "../../../api/client";
import { scheduleExceptionsApi } from "../../../api/workingHours";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { ErrorState, LoadingState } from "../../../components/ui/StateViews";
import { todayInTimeZone } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { Resource, ScheduleException } from "../../../types";
import { AbsenceAppointmentsModal } from "./AbsenceAppointmentsModal";

export function ScheduleExceptionsPanel({ resource, timeZone, canManage }: {
  resource: Resource; timeZone: string; canManage: boolean;
}) {
  const { t, language } = useI18n();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(params.get("date") || todayInTimeZone(timeZone));
  const [dayOff, setDayOff] = useState(true);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [reviewOpen, setReviewOpen] = useState(false);
  const exceptions = useQuery({
    queryKey: ["schedule-exceptions", resource.business, resource.id],
    queryFn: () => scheduleExceptionsApi.list({ business: resource.business, resource: resource.id }),
  });
  const appointments = useQuery({
    queryKey: ["appointments", "schedule-date", resource.id, date],
    queryFn: () => appointmentsApi.listAll({ business: resource.business, resource: resource.id, start_from: date,
      start_to: new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10) }),
    enabled: Boolean(date),
  });
  const existing = exceptions.data?.find((item) => item.date === date);
  useEffect(() => {
    if (!existing) return;
    setDayOff(existing.is_day_off);
    setStart(existing.start_time.slice(0, 5));
    setEnd(existing.end_time.slice(0, 5));
  }, [existing?.id]);
  const mutation = useMutation({
    mutationFn: async (remove: boolean) => {
      if (remove && existing) { await scheduleExceptionsApi.remove(existing.id); return; }
      const payload = { business: resource.business, resource: resource.id, date, start_time: start, end_time: end, is_day_off: dayOff };
      if (existing) await scheduleExceptionsApi.update({ id: existing.id, payload });
      else await scheduleExceptionsApi.create(payload);
    },
    onSuccess: async (_result, remove) => {
      await Promise.all(["schedule-exceptions", "available-slots", "appointments"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      if (!remove) setReviewOpen(true);
    },
  });
  function selectDate(nextDate: string, record?: ScheduleException) {
    setDate(nextDate);
    const row = record || exceptions.data?.find((item) => item.date === nextDate);
    setDayOff(row?.is_day_off ?? true);
    setStart(row?.start_time.slice(0, 5) || "09:00");
    setEnd(row?.end_time.slice(0, 5) || "18:00");
    mutation.reset();
  }
  const activeAppointments = (appointments.data || [])
    .filter((item) => item.status === "created" || item.status === "confirmed")
    .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at) || left.id - right.id);
  const error = exceptions.error || mutation.error || appointments.error;
  return (
    <section className="space-y-3 border-t border-zani-border pt-4" data-testid="schedule-exceptions">
      <h3 className="font-semibold text-zani-ink">{t("workingHours.dateExceptions")}</h3>
      {exceptions.isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
      <div className="flex flex-wrap gap-2">
        {(exceptions.data || []).map((row) => (
          <Button key={row.id} variant="secondary" type="button" onClick={() => selectDate(row.date, row)}>
            {row.date} · {row.is_day_off ? t("workingHours.dayOff") : `${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}`}
          </Button>
        ))}
      </div>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); mutation.mutate(false); }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input type="date" required label={t("appointment.date")} value={date} onChange={(event) => selectDate(event.target.value)} />
          <Input type="time" required disabled={!canManage || dayOff} label={t("workingHours.start")} value={start} onChange={(event) => setStart(event.target.value)} />
          <Input type="time" required disabled={!canManage || dayOff} label={t("workingHours.end")} value={end} onChange={(event) => setEnd(event.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={!canManage} checked={dayOff} onChange={(event) => setDayOff(event.target.checked)} />
          {t("workingHours.dayOff")}
        </label>
        {canManage ? <div className="flex gap-2">
          <Button type="submit" disabled={!date || exceptions.isLoading || Boolean(exceptions.error)} isLoading={mutation.isPending}>{t("workingHours.saveDate")}</Button>
          {existing ? <Button variant="secondary" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>{t("workingHours.restoreWeek")}</Button> : null}
        </div> : null}
      </form>
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">{t("workingHours.appointmentsToReview")}</h4>
        <Button variant="secondary" type="button" disabled={!date} onClick={() => setReviewOpen(true)}>{t("workingHours.reviewAppointments")}</Button>
        {appointments.isLoading ? <LoadingState /> : null}
        {!appointments.isLoading && !appointments.error && !activeAppointments.length ? <p className="text-sm text-zani-subtle">{t("workingHours.noAppointmentsOnDate")}</p> : null}
        {activeAppointments.map((item) => <Link key={item.id} className="zani-focus-ring block rounded-control text-sm text-brand-700 underline"
          to={`/app/calendar?date=${date}&resource=${resource.id}&appointment=${item.id}`}>
          {new Date(item.start_at).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", timeZone })} · {item.client_name} · {item.service_name}
        </Link>)}
      </div>
      {reviewOpen ? <AbsenceAppointmentsModal resource={resource} date={date} appointments={activeAppointments}
        loading={appointments.isFetching} error={appointments.error} timeZone={timeZone} onClose={() => setReviewOpen(false)} /> : null}
    </section>
  );
}
