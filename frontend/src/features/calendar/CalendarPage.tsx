import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { appointmentsApi } from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { workingHoursApi } from "../../api/workingHours";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { formatDateTime, todayISO } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment } from "../../types";

const hours = Array.from({ length: 11 }, (_, index) => index + 8);
const appointmentStatusActions: Appointment["status"][] = ["confirmed", "completed", "cancelled", "no_show"];
const localeByLanguage = {
  ru: "ru-RU",
  kk: "kk-KZ",
  en: "en-US",
};

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPickerDate(value: string, locale: string) {
  const date = parseDate(value);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function getWeekDates(value: string) {
  const selected = parseDate(value);
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

function getMonthDates(value: string) {
  const selected = parseDate(value);
  const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(selected.getFullYear(), selected.getMonth(), index + 1)),
  ];
}

function CalendarPicker({
  value,
  onChange,
  labels,
  locale,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  labels: {
    previousMonth: string;
    nextMonth: string;
    today: string;
    weekdays: string[];
  };
}) {
  const [open, setOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(() => parseDate(value));
  const selected = parseDate(value);
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1)),
  ];

  function shiftMonth(delta: number) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="relative w-full sm:w-auto">
      <Button
        variant="secondary"
        className="h-11 w-full justify-between rounded-2xl px-4 sm:min-w-[170px]"
        onClick={() => {
          setMonthDate(parseDate(value));
          setOpen((current) => !current);
        }}
      >
        <span>{formatPickerDate(value, locale)}</span>
        <CalendarDays size={18} />
      </Button>
      {open ? (
        <div className="fixed inset-x-3 top-24 z-30 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-premium sm:absolute sm:inset-auto sm:right-0 sm:top-14 sm:w-[340px]">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" className="h-12 w-12 rounded-full px-0" onClick={() => shiftMonth(-1)} aria-label={labels.previousMonth}><ChevronLeft size={22} /></Button>
            <p className="font-semibold text-midnight">
              {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(monthDate)}
            </p>
            <Button variant="ghost" className="h-12 w-12 rounded-full px-0" onClick={() => shiftMonth(1)} aria-label={labels.nextMonth}><ChevronRight size={22} /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400">
            {labels.weekdays.map((day) => <div key={day} className="py-2">{day}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              const isSelected = cell && toDateInputValue(cell) === toDateInputValue(selected);
              const isToday = cell && toDateInputValue(cell) === todayISO();
              return (
                <button
                  key={cell ? toDateInputValue(cell) : `empty-${index}`}
                  type="button"
                  disabled={!cell}
                  onClick={() => {
                    if (!cell) return;
                    onChange(toDateInputValue(cell));
                    setOpen(false);
                  }}
                  className={`h-12 rounded-2xl text-base font-black transition disabled:pointer-events-none disabled:opacity-0 ${
                    isSelected
                      ? "bg-ai-gradient text-white shadow-glow"
                      : isToday
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {cell?.getDate()}
                </button>
              );
            })}
          </div>
          <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => { onChange(todayISO()); setOpen(false); }}>
            {labels.today}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CalendarPage() {
  const { t, language } = useI18n();
  const { business } = useActiveBusiness();
  const { appointments, clients, services, resources, leads, workingHours } = useEntityData();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingPrefill, setBookingPrefill] = useState<{ date?: string; slot?: string } | null>(null);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [serviceFilter, setServiceFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Partial<Appointment>) => appointmentsApi.create(payload),
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setBookingOpen(false);
      if (appointment.start_at) setDate(appointment.start_at.slice(0, 10));
      setNotice(t("calendar.createdNotice"));
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Appointment["status"] }) => appointmentsApi.update({ id, payload: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });
  const quickHoursMutation = useMutation({
    mutationFn: () => workingHoursApi.applyPreset({ business: business!.id, preset: "daily_9_20" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["working-hours"] });
      queryClient.invalidateQueries({ queryKey: ["available-slots"] });
      setNotice(t("calendar.quickHoursApplied"));
    },
  });

  function shiftDate(days: number) {
    const nextDate = parseDate(date);
    nextDate.setDate(nextDate.getDate() + days);
    setDate(toDateInputValue(nextDate));
  }

  function openBookingForDate(nextDate = date) {
    setBookingPrefill({ date: nextDate });
    setBookingOpen(true);
  }

  if (!business) return <ErrorState message={t("calendar.noBusiness")} />;
  if (appointments.isLoading || clients.isLoading || services.isLoading || resources.isLoading || leads.isLoading || workingHours.isLoading) return <LoadingState />;

  const appointmentList = (appointments.data || []).filter((item) => {
    if (serviceFilter && item.service !== Number(serviceFilter)) return false;
    if (resourceFilter && item.resource !== Number(resourceFilter)) return false;
    return true;
  });
  const dayAppointments = appointmentList.filter((item) => item.start_at.slice(0, 10) === date);
  const weekDates = getWeekDates(date);
  const monthDates = getMonthDates(date);
  const hasClients = Boolean(clients.data?.length);
  const hasServices = Boolean(services.data?.length);
  const hasResources = Boolean(resources.data?.length);
  const hasWorkingHours = Boolean(workingHours.data?.length);
  const confirmedCount = dayAppointments.filter((appointment) => appointment.status === "confirmed").length;
  const completedCount = dayAppointments.filter((appointment) => appointment.status === "completed").length;
  const openSlotsHint = Math.max(0, hours.length - dayAppointments.length);
  const locale = localeByLanguage[language];
  const weekDays = [
    t("weekday.monShort"),
    t("weekday.tueShort"),
    t("weekday.wedShort"),
    t("weekday.thuShort"),
    t("weekday.friShort"),
    t("weekday.satShort"),
    t("weekday.sunShort"),
  ];

  function getAppointmentActionLabel(status: Appointment["status"]) {
    if (status === "confirmed") return t("appointment.actionConfirm");
    if (status === "completed") return t("appointment.actionComplete");
    if (status === "cancelled") return t("appointment.actionCancel");
    if (status === "no_show") return t("appointment.actionNoShow");
    return t(`status.${status}`);
  }

  const renderAppointmentCard = (appointment: Appointment, compact = false) => {
    const client = clients.data?.find((item) => item.id === appointment.client);
    const service = services.data?.find((item) => item.id === appointment.service);
    const resource = resources.data?.find((item) => item.id === appointment.resource);
    const lead = leads.data?.find((item) => item.id === appointment.lead);

    return (
      <div
        key={appointment.id}
        className="rounded-3xl border border-brand-100 bg-gradient-to-r from-brand-50 to-ai-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-premium"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button type="button" className="min-w-0 text-left" onClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}>
            <p className="font-semibold text-midnight">{client?.full_name || t("common.client")} · {service?.name || t("common.service")}</p>
            <p className="mt-1 text-sm text-slate-500">{formatDateTime(appointment.start_at)} · {resource?.name || t("calendar.noResource")}</p>
          </button>
          <StatusBadge status={appointment.status} />
        </div>
        {!compact ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {client ? <Link className="rounded-full bg-white/80 px-3 py-1 text-slate-600 hover:text-brand-700" to="/dashboard/clients">{t("common.client")}</Link> : null}
            {lead ? <Link className="rounded-full bg-white/80 px-3 py-1 text-slate-600 hover:text-brand-700" to="/dashboard/leads">{t("calendar.lead")} #{lead.id}</Link> : null}
            {appointmentStatusActions.filter((status) => status !== appointment.status).slice(0, 3).map((status) => (
              <button
                key={status}
                type="button"
                className="rounded-full bg-white/80 px-3 py-1 text-slate-600 transition hover:bg-white hover:text-brand-700"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: appointment.id, status })}
              >
                {getAppointmentActionLabel(status)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t("calendar.title")}
        description={t("calendar.description")}
        actions={
          <div className="grid w-full grid-cols-[44px_minmax(0,1fr)_44px] gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button variant="secondary" className="h-11 w-11 px-0" onClick={() => shiftDate(-1)} aria-label={t("calendar.previousDay")}><ChevronLeft size={18} /></Button>
            <CalendarPicker
              value={date}
              onChange={setDate}
              locale={locale}
              labels={{
                previousMonth: t("calendar.previousMonth"),
                nextMonth: t("calendar.nextMonth"),
                today: t("calendar.today"),
                weekdays: weekDays,
              }}
            />
            <Button variant="secondary" className="h-11 w-11 px-0" onClick={() => shiftDate(1)} aria-label={t("calendar.nextDay")}><ChevronRight size={18} /></Button>
            <Button variant="secondary" className="col-span-3 h-11 sm:col-span-1" onClick={() => setDate(todayISO())}>{t("calendar.today")}</Button>
            <div className="col-span-3 grid grid-cols-3 rounded-2xl border border-slate-200 bg-white/80 p-1 sm:col-span-1 sm:w-[230px]">
              {[
                { value: "day", label: t("calendar.day") },
                { value: "week", label: t("calendar.week") },
                { value: "month", label: t("calendar.month") },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${viewMode === item.value ? "bg-midnight text-white shadow-sm" : "text-slate-500 hover:text-midnight"}`}
                  onClick={() => setViewMode(item.value as typeof viewMode)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Button variant="ai" className="col-span-3 sm:col-span-1" onClick={() => openBookingForDate(date)}><Plus size={18} />{t("calendar.newBooking")}</Button>
          </div>
        }
      />
      <section className="mb-5 overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-soft backdrop-blur-xl">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative overflow-hidden rounded-[1.6rem] bg-midnight p-5 text-white">
            <div className="absolute -right-16 -top-20 h-44 w-44 rounded-[3rem] bg-brand-400/30 blur-2xl" />
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/55">{t("calendar.businessSchedule")}</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">{formatPickerDate(date, locale)}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">{t("calendar.heroText")}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/10">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">{t("calendar.bookings")}</p>
                  <p className="mt-2 text-3xl font-black">{dayAppointments.length}</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/10">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">{t("calendar.confirmed")}</p>
                  <p className="mt-2 text-3xl font-black">{confirmedCount}</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/10">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">{t("calendar.openSlots")}</p>
                  <p className="mt-2 text-3xl font-black">{openSlotsHint}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50/70 p-5">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">{t("calendar.readiness")}</p>
            <div className="mt-4 space-y-3">
              {[
                { ready: hasClients, label: t("calendar.readyClients") },
                { ready: hasServices, label: t("calendar.readyServices") },
                { ready: hasWorkingHours, label: t("calendar.readyHours") },
                { ready: hasResources, label: t("calendar.readyResources") },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold shadow-sm">
                  <span className="text-slate-700">{item.label}</span>
                  <span className={item.ready ? "text-green-600" : "text-amber-600"}>{item.ready ? t("calendar.ready") : t("calendar.needsSetup")}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">{completedCount ? t("calendar.completedToday").replace("{count}", String(completedCount)) : t("calendar.noCompletedYet")}</p>
          </div>
        </div>
      </section>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_220px]">
        <div className="rounded-3xl border border-white/80 bg-white/75 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
          {dayAppointments.length ? t("calendar.dayCount").replace("{count}", String(dayAppointments.length)) : t("calendar.dayEmpty")}
        </div>
        <Select
          value={serviceFilter}
          onChange={(event) => setServiceFilter(event.target.value)}
          options={[{ value: "", label: t("calendar.allServices") }, ...(services.data || []).map((service) => ({ value: String(service.id), label: service.name }))]}
        />
        <Select
          value={resourceFilter}
          onChange={(event) => setResourceFilter(event.target.value)}
          options={[{ value: "", label: t("calendar.allResources") }, ...(resources.data || []).map((resource) => ({ value: String(resource.id), label: resource.name }))]}
        />
      </div>
      {notice ? (
        <div className="mb-4 rounded-3xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
          {notice}
        </div>
      ) : null}
      <div className="mb-5 grid gap-3 lg:grid-cols-4">
        {!hasClients ? (
          <Link className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-900 transition hover:-translate-y-0.5 hover:shadow-soft" to="/dashboard/clients">
            {t("calendar.setupClient")}
          </Link>
        ) : null}
        {!hasServices ? (
          <Link className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-900 transition hover:-translate-y-0.5 hover:shadow-soft" to="/dashboard/services">
            {t("calendar.setupService")}
          </Link>
        ) : null}
        {!hasWorkingHours ? (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">{t("calendar.setupHoursTitle")}</p>
            <p className="mt-1 leading-6">{t("calendar.setupHoursText")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="min-h-9 rounded-full px-3 py-1 text-xs" isLoading={quickHoursMutation.isPending} onClick={() => quickHoursMutation.mutate()}>
                {t("calendar.applyQuickHours")}
              </Button>
              <Link className="inline-flex min-h-9 items-center rounded-full px-3 py-1 text-xs font-bold text-amber-950 underline-offset-4 hover:underline" to="/dashboard/working-hours">
                {t("calendar.configure")}
              </Link>
            </div>
          </div>
        ) : null}
        {!hasResources ? (
          <Link className="rounded-3xl border border-slate-100 bg-white/70 p-4 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:shadow-soft" to="/dashboard/resources">
            {t("calendar.setupResources")}
          </Link>
        ) : null}
      </div>
      {statusMutation.error || quickHoursMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(statusMutation.error || quickHoursMutation.error)} /></div> : null}
      <div className="grid gap-6">
        {viewMode === "day" ? <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-semibold text-midnight">{t("calendar.daySchedule")}</h2>
              <p className="text-sm text-slate-500">{t("calendar.plannedCount").replace("{count}", String(dayAppointments.length))}</p>
            </div>
          </div>
          {!dayAppointments.length ? (
            <div className="border-b border-slate-100 bg-brand-50/50 px-5 py-4 text-sm font-medium text-brand-800">
              {t("calendar.freeDayHint")}
            </div>
          ) : null}
          <div className="divide-y divide-slate-100">
            {hours.map((hour) => {
              const items = dayAppointments.filter((appointment) => new Date(appointment.start_at).getHours() === hour);
              return (
                <div key={hour} className="grid min-h-24 grid-cols-[76px_1fr] sm:grid-cols-[110px_1fr]">
                  <div className="bg-slate-50/70 px-4 py-4 text-sm font-semibold text-slate-500">{String(hour).padStart(2, "0")}:00</div>
                  <div className="space-y-3 p-3">
                    {items.map((appointment) => {
                      return renderAppointmentCard(appointment);
                    })}
                    {!items.length ? (
                      <button
                        type="button"
                        className="h-full w-full rounded-3xl border border-dashed border-slate-200 bg-white/50 p-4 text-left text-sm font-semibold text-slate-400 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                        onClick={() => openBookingForDate(date)}
                      >
                        {t("calendar.availableSlot")}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card> : null}

        {viewMode === "week" ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-semibold text-midnight">{t("calendar.weekSchedule")}</h2>
              <p className="text-sm text-slate-500">{t("calendar.weekHint")}</p>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-7">
              {weekDates.map((day) => {
                const key = toDateInputValue(day);
                const items = appointmentList.filter((appointment) => appointment.start_at.slice(0, 10) === key);
                return (
                  <div key={key} className={`rounded-3xl border p-3 ${key === date ? "border-brand-200 bg-brand-50/60" : "border-slate-100 bg-white/70"}`}>
                    <button type="button" className="mb-3 text-left" onClick={() => { setDate(key); setViewMode("day"); }}>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{weekDays[(day.getDay() + 6) % 7]}</p>
                      <p className="text-lg font-bold text-midnight">{day.getDate()}</p>
                    </button>
                    <div className="space-y-2">
                      {items.map((appointment) => renderAppointmentCard(appointment, true))}
                      {!items.length ? <p className="rounded-2xl border border-dashed border-slate-200 p-3 text-xs font-semibold text-slate-400">{t("calendar.free")}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}

        {viewMode === "month" ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-lg font-semibold text-midnight">{t("calendar.monthOverview")}</h2>
              <p className="text-sm text-slate-500">{t("calendar.monthHint")}</p>
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-100">
              {weekDays.map((day) => <div key={day} className="bg-white p-3 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{day}</div>)}
              {monthDates.map((day, index) => {
                const key = day ? toDateInputValue(day) : `empty-${index}`;
                const items = day ? appointmentList.filter((appointment) => appointment.start_at.slice(0, 10) === key) : [];
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!day}
                    className={`min-h-28 bg-white p-3 text-left transition disabled:bg-slate-50 ${day && key === date ? "ring-2 ring-inset ring-brand-400" : "hover:bg-brand-50/60"}`}
                    onClick={() => {
                      if (!day) return;
                      setDate(key);
                      setViewMode("day");
                    }}
                  >
                    {day ? <span className="text-sm font-bold text-midnight">{day.getDate()}</span> : null}
                    {items.length ? <p className="mt-2 rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">{t("calendar.shortCount").replace("{count}", String(items.length))}</p> : null}
                    <div className="mt-2 space-y-1">
                      {items.slice(0, 2).map((appointment) => {
                        const client = clients.data?.find((item) => item.id === appointment.client);
                        return <p key={appointment.id} className="truncate rounded-xl bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{client?.full_name || t("common.client")}</p>;
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        ) : null}
      </div>
      {mutation.error ? <div className="mt-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}

      <Modal title={t("calendar.newBooking")} open={bookingOpen} onClose={() => { setBookingOpen(false); setBookingPrefill(null); }}>
        <AppointmentForm
          businessId={business.id}
          clients={clients.data || []}
          services={services.data || []}
          resources={resources.data || []}
          leads={leads.data || []}
          prefill={bookingPrefill || { date }}
          onSubmit={(payload) => mutation.mutateAsync(payload)}
        />
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
