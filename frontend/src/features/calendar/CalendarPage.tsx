import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { appointmentsApi } from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { workingHoursApi } from "../../api/workingHours";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { FloatingActionButton } from "../../components/ui/Primitives";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { formatDateTime, todayISO } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment, Task } from "../../types";

const dayStartHour = 8;
const dayEndHour = 21;
const hourHeight = 78;
const timelineHours = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => dayStartHour + index);
const appointmentStatusActions: Appointment["status"][] = ["confirmed", "completed", "cancelled", "no_show"];
const localeByLanguage = {
  ru: "ru-RU",
  kk: "kk-KZ",
  en: "en-US",
};

type CalendarResource = {
  id: number | null;
  name: string;
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

function shiftDateValue(value: string, days: number) {
  const nextDate = parseDate(value);
  nextDate.setDate(nextDate.getDate() + days);
  return toDateInputValue(nextDate);
}

function shiftMonthValue(value: string, months: number) {
  const nextDate = parseDate(value);
  nextDate.setMonth(nextDate.getMonth() + months);
  return toDateInputValue(nextDate);
}

function formatPickerDate(value: string, locale: string) {
  const date = parseDate(value);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(date);
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
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(selected.getFullYear(), selected.getMonth(), index + 1)),
  ];
  const tail = (7 - (cells.length % 7)) % 7;
  return [...cells, ...Array.from({ length: tail }, () => null)];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getMinutes(value: string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getAppointmentMetrics(appointment: Appointment) {
  const start = getMinutes(appointment.start_at);
  const end = Math.max(start + 30, getMinutes(appointment.end_at));
  const top = Math.max(0, ((start - dayStartHour * 60) / 60) * hourHeight);
  const height = Math.max(58, ((end - start) / 60) * hourHeight);
  return { top, height };
}

function getTone(index: number) {
  const tones = [
    "border-sky-200 bg-sky-50 text-sky-950",
    "border-emerald-200 bg-emerald-50 text-emerald-950",
    "border-violet-200 bg-violet-50 text-violet-950",
    "border-amber-200 bg-amber-50 text-amber-950",
    "border-rose-200 bg-rose-50 text-rose-950",
  ];
  return tones[index % tones.length];
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
  const cells = getMonthDates(toDateInputValue(monthDate));

  function shiftMonth(delta: number) {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="relative w-full sm:w-auto">
      <Button
        variant="secondary"
        className="h-11 w-full justify-between rounded-2xl px-4 sm:min-w-[210px]"
        onClick={() => {
          setMonthDate(parseDate(value));
          setOpen((current) => !current);
        }}
      >
        <span className="truncate">{formatPickerDate(value, locale)}</span>
        <CalendarDays size={18} />
      </Button>
      {open ? (
        <div className="fixed inset-x-3 top-24 z-30 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-premium sm:absolute sm:inset-auto sm:right-0 sm:top-14 sm:w-[340px]">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" className="h-12 w-12 rounded-full px-0" onClick={() => shiftMonth(-1)} aria-label={labels.previousMonth}>
              <ChevronLeft size={22} />
            </Button>
            <p className="font-semibold text-midnight">
              {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(monthDate)}
            </p>
            <Button variant="ghost" className="h-12 w-12 rounded-full px-0" onClick={() => shiftMonth(1)} aria-label={labels.nextMonth}>
              <ChevronRight size={22} />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400">
            {labels.weekdays.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
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
                  className={cn(
                    "h-11 rounded-2xl text-sm font-black transition disabled:pointer-events-none disabled:opacity-0",
                    isSelected
                      ? "bg-ai-gradient text-white shadow-glow"
                      : isToday
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-700 hover:bg-slate-100",
                  )}
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

function MiniMonth({
  value,
  locale,
  weekdays,
  appointmentDates,
  onChange,
}: {
  value: string;
  locale: string;
  weekdays: string[];
  appointmentDates: Map<string, number>;
  onChange: (value: string) => void;
}) {
  const cells = getMonthDates(value);

  return (
    <div className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" className="h-9 w-9 rounded-full px-0" onClick={() => onChange(shiftMonthValue(value, -1))}>
          <ChevronLeft size={18} />
        </Button>
        <p className="text-sm font-black text-midnight">
          {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(parseDate(value))}
        </p>
        <Button variant="ghost" className="h-9 w-9 rounded-full px-0" onClick={() => onChange(shiftMonthValue(value, 1))}>
          <ChevronRight size={18} />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">
        {weekdays.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          const key = cell ? toDateInputValue(cell) : `empty-${index}`;
          const isSelected = cell && key === value;
          const count = cell ? appointmentDates.get(key) || 0 : 0;
          return (
            <button
              key={key}
              type="button"
              disabled={!cell}
              onClick={() => cell && onChange(key)}
              className={cn(
                "relative grid h-9 place-items-center rounded-full text-sm font-black transition disabled:pointer-events-none disabled:opacity-20",
                isSelected ? "bg-midnight text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {cell?.getDate()}
              {count ? <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", isSelected ? "bg-white" : "bg-brand-500")} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarPage() {
  const { t, language } = useI18n();
  const { business } = useActiveBusiness();
  const { appointments, clients, services, resources, leads, workingHours, tasks } = useEntityData({
    appointments: true,
    clients: true,
    services: true,
    resources: true,
    leads: true,
    workingHours: true,
    tasks: true,
  });
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingPrefill, setBookingPrefill] = useState<{ date?: string; slot?: string; hour?: number; service?: number; resource?: number } | null>(null);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [serviceFilter, setServiceFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Partial<Appointment>) => appointmentsApi.create(payload),
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setBookingOpen(false);
      if (appointment.start_at) setDate(appointment.start_at.slice(0, 10));
      setSelectedAppointmentId(appointment.id);
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

  if (!business) return <ErrorState message={t("calendar.noBusiness")} />;

  const appointmentItems = appointments.data || [];
  const clientItems = clients.data || [];
  const serviceItems = services.data || [];
  const resourceItems = resources.data || [];
  const leadItems = leads.data || [];
  const workingHourItems = workingHours.data || [];
  const taskItems = (tasks.data || []) as Task[];
  const isCalendarDataLoading = appointments.isLoading || clients.isLoading || services.isLoading || resources.isLoading || leads.isLoading || workingHours.isLoading;
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

  const clientById = new Map(clientItems.map((client) => [client.id, client]));
  const serviceById = new Map(serviceItems.map((service) => [service.id, service]));
  const resourceById = new Map(resourceItems.map((resource) => [resource.id, resource]));
  const leadById = new Map(leadItems.map((lead) => [lead.id, lead]));

  const appointmentList = appointmentItems.filter((item) => {
    const client = clientById.get(item.client);
    const service = serviceById.get(item.service);
    const resource = item.resource ? resourceById.get(item.resource) : null;
    const query = search.trim().toLowerCase();

    if (serviceFilter && item.service !== Number(serviceFilter)) return false;
    if (resourceFilter && item.resource !== Number(resourceFilter)) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (!query) return true;
    return [client?.full_name, service?.name, resource?.name, item.source, item.notes]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const dayAppointments = appointmentList
    .filter((item) => item.start_at.slice(0, 10) === date)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const weekDates = getWeekDates(date);
  const monthDates = getMonthDates(date);
  const dayTasks = taskItems.filter((task) => task.due_at?.slice(0, 10) === date && !["done", "cancelled"].includes(task.status));
  const selectedAppointment = dayAppointments.find((appointment) => appointment.id === selectedAppointmentId) || dayAppointments[0] || null;
  const hasClients = Boolean(clientItems.length);
  const hasServices = Boolean(serviceItems.length);
  const hasResources = Boolean(resourceItems.length);
  const hasWorkingHours = Boolean(workingHourItems.length);
  const confirmedCount = dayAppointments.filter((appointment) => appointment.status === "confirmed").length;
  const completedCount = dayAppointments.filter((appointment) => appointment.status === "completed").length;
  const openSlotsHint = Math.max(0, timelineHours.length - dayAppointments.length);
  const appointmentDates = new Map<string, number>();
  appointmentList.forEach((appointment) => {
    const key = appointment.start_at.slice(0, 10);
    appointmentDates.set(key, (appointmentDates.get(key) || 0) + 1);
  });
  const visibleResources: CalendarResource[] = resourceItems.length
    ? resourceItems
      .filter((resource) => !resourceFilter || resource.id === Number(resourceFilter))
      .map((resource) => ({ id: resource.id, name: resource.name }))
    : [{ id: null, name: "Общий календарь" }];

  function shiftDate(days: number) {
    setDate(shiftDateValue(date, days));
  }

  function openBookingForDate(nextDate = date, hour?: number, resource?: number | null) {
    setBookingPrefill({
      date: nextDate,
      hour,
      service: serviceFilter ? Number(serviceFilter) : undefined,
      resource: resource ?? (resourceFilter ? Number(resourceFilter) : undefined),
    });
    setBookingOpen(true);
  }

  function getAppointmentActionLabel(status: Appointment["status"]) {
    if (status === "confirmed") return t("appointment.actionConfirm");
    if (status === "completed") return t("appointment.actionComplete");
    if (status === "cancelled") return t("appointment.actionCancel");
    if (status === "no_show") return t("appointment.actionNoShow");
    return t(`status.${status}`);
  }

  function renderAppointmentPreview(appointment: Appointment, compact = false) {
    const client = clientById.get(appointment.client);
    const service = serviceById.get(appointment.service);
    const resource = appointment.resource ? resourceById.get(appointment.resource) : null;

    return (
      <button
        key={appointment.id}
        type="button"
        className={cn(
          "w-full rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft",
          selectedAppointment?.id === appointment.id && "border-brand-200 bg-brand-50/60",
        )}
        onClick={() => setSelectedAppointmentId(appointment.id)}
        onDoubleClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-midnight">{client?.full_name || t("common.client")}</p>
            <p className="mt-1 truncate text-xs font-bold text-slate-500">{formatTime(appointment.start_at)}-{formatTime(appointment.end_at)} · {service?.name || t("common.service")}</p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>
        {!compact ? <p className="mt-2 truncate text-xs font-semibold text-slate-500">{resource?.name || "Без ресурса"} · {appointment.source}</p> : null}
      </button>
    );
  }

  return (
    <>
      <section className="mb-5 rounded-[2rem] border border-white/80 bg-white/86 p-4 shadow-soft backdrop-blur-xl lg:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-600">Календарь</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-midnight sm:text-4xl">Расписание записей</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
              Рабочий календарь для записей, мастеров, статусов визита и быстрых действий менеджера.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[44px_minmax(0,1fr)_44px_auto] xl:flex xl:items-center">
            <Button variant="secondary" className="h-11 w-11 px-0" onClick={() => shiftDate(-1)} aria-label={t("calendar.previousDay")}>
              <ChevronLeft size={18} />
            </Button>
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
            <Button variant="secondary" className="h-11 w-11 px-0" onClick={() => shiftDate(1)} aria-label={t("calendar.nextDay")}>
              <ChevronRight size={18} />
            </Button>
            <Button variant="secondary" className="h-11 px-4" onClick={() => setDate(todayISO())}>
              Сегодня
            </Button>
            <div className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-white p-1 sm:col-span-4 xl:w-[250px]">
              {[
                { value: "day", label: "День" },
                { value: "week", label: "Неделя" },
                { value: "month", label: "Месяц" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-black transition",
                    viewMode === item.value ? "bg-midnight text-white shadow-sm" : "text-slate-500 hover:text-midnight",
                  )}
                  onClick={() => setViewMode(item.value as typeof viewMode)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Button
              variant="ai"
              className="h-11 sm:col-span-4"
              disabled={clients.isLoading || services.isLoading}
              onClick={() => openBookingForDate(date)}
            >
              <Plus size={18} />
              Новая запись
            </Button>
          </div>
        </div>
      </section>

      {isCalendarDataLoading ? (
        <div className="mb-4">
          <LoadingState label={t("calendar.loadingInline")} />
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-3xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
          {notice}
        </div>
      ) : null}

      {statusMutation.error || quickHoursMutation.error ? (
        <div className="mb-4">
          <ErrorState message={getApiErrorMessage(statusMutation.error || quickHoursMutation.error)} />
        </div>
      ) : null}

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Записи сегодня", value: dayAppointments.length, icon: CalendarDays, tone: "text-brand-600 bg-brand-50" },
          { label: "Подтверждены", value: confirmedCount, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
          { label: "Свободные окна", value: openSlotsHint, icon: Clock3, tone: "text-sky-600 bg-sky-50" },
          { label: "Задачи на день", value: dayTasks.length, icon: UserRound, tone: "text-amber-600 bg-amber-50" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-sm">
              <div className={cn("grid h-12 w-12 place-items-center rounded-2xl", item.tone)}>
                <Icon size={22} />
              </div>
              <p className="mt-4 text-3xl font-black text-midnight">{item.value}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 rounded-[2rem] border border-white/80 bg-white/86 shadow-soft backdrop-blur-xl">
          <div className="border-b border-slate-100 p-4 lg:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_180px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                  placeholder="Поиск: клиент, услуга, мастер..."
                />
              </label>
              <Select
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
                disabled={services.isLoading}
                options={[{ value: "", label: "Все услуги" }, ...serviceItems.map((service) => ({ value: String(service.id), label: service.name }))]}
              />
              <Select
                value={resourceFilter}
                onChange={(event) => setResourceFilter(event.target.value)}
                disabled={resources.isLoading}
                options={[{ value: "", label: "Все мастера" }, ...resourceItems.map((resource) => ({ value: String(resource.id), label: resource.name }))]}
              />
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                options={[
                  { value: "", label: "Все статусы" },
                  { value: "created", label: t("status.created") },
                  { value: "confirmed", label: t("status.confirmed") },
                  { value: "completed", label: t("status.completed") },
                  { value: "cancelled", label: t("status.cancelled") },
                  { value: "no_show", label: t("status.no_show") },
                ]}
              />
            </div>
          </div>

          {viewMode === "day" ? (
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: `86px repeat(${visibleResources.length}, minmax(180px, 1fr))` }}>
                  <div className="bg-slate-50/60 p-4 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    GMT+6
                  </div>
                  {visibleResources.map((resource, index) => (
                    <div key={resource.id ?? "empty-resource"} className="border-l border-slate-100 p-4">
                      <div className="flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-3xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-100">
                        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-black", getTone(index))}>
                          {getInitials(resource.name)}
                        </div>
                        <div className="min-w-0 max-w-full">
                          <p className="max-w-[150px] truncate font-black text-midnight">{resource.name}</p>
                          <p className="mt-1 text-xs font-bold text-brand-600">10:00 - 21:00</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="relative grid" style={{ gridTemplateColumns: `86px repeat(${visibleResources.length}, minmax(180px, 1fr))`, height: `${(dayEndHour - dayStartHour) * hourHeight}px` }}>
                  <div className="relative border-r border-slate-100 bg-slate-50/50">
                    {timelineHours.slice(0, -1).map((hour) => (
                      <div key={hour} className="absolute left-0 right-0 border-t border-slate-100 px-4 pt-2 text-sm font-bold text-slate-400" style={{ top: `${(hour - dayStartHour) * hourHeight}px` }}>
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                  {visibleResources.map((resource) => {
                    const columnAppointments = dayAppointments.filter((appointment) => {
                      if (resource.id === null) return !appointment.resource;
                      return appointment.resource === resource.id;
                    });

                    return (
                      <div key={resource.id ?? "empty-column"} className="relative border-l border-slate-100">
                        {timelineHours.slice(0, -1).map((hour) => (
                          <button
                            key={hour}
                            type="button"
                            className="absolute left-0 right-0 border-t border-slate-100 text-left transition hover:bg-brand-50/45"
                            style={{ top: `${(hour - dayStartHour) * hourHeight}px`, height: `${hourHeight}px` }}
                            onClick={() => openBookingForDate(date, hour, resource.id)}
                            aria-label={`Создать запись на ${hour}:00`}
                          />
                        ))}
                        {columnAppointments.map((appointment, index) => {
                          const client = clientById.get(appointment.client);
                          const service = serviceById.get(appointment.service);
                          const metrics = getAppointmentMetrics(appointment);
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              className={cn(
                                "absolute left-3 right-3 overflow-hidden rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-premium",
                                getTone(index),
                                selectedAppointment?.id === appointment.id && "ring-4 ring-brand-100",
                              )}
                              style={{ top: `${metrics.top + 8}px`, height: `${metrics.height - 10}px` }}
                              onClick={() => setSelectedAppointmentId(appointment.id)}
                              onDoubleClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-black">{formatTime(appointment.start_at)} - {formatTime(appointment.end_at)}</p>
                                <MoreHorizontal size={16} />
                              </div>
                              <p className="mt-2 line-clamp-2 text-sm font-black">{client?.full_name || t("common.client")}</p>
                              <p className="mt-1 truncate text-xs font-bold opacity-75">{service?.name || t("common.service")}</p>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {viewMode === "week" ? (
            <div className="grid gap-3 p-4 lg:grid-cols-7 lg:p-5">
              {weekDates.map((day) => {
                const key = toDateInputValue(day);
                const items = appointmentList.filter((appointment) => appointment.start_at.slice(0, 10) === key);
                return (
                  <div key={key} className={cn("rounded-3xl border p-3", key === date ? "border-brand-200 bg-brand-50/60" : "border-slate-100 bg-white")}>
                    <button type="button" className="mb-3 text-left" onClick={() => { setDate(key); setViewMode("day"); }}>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{weekDays[(day.getDay() + 6) % 7]}</p>
                      <p className="text-2xl font-black text-midnight">{day.getDate()}</p>
                    </button>
                    <div className="space-y-2">
                      {items.map((appointment) => renderAppointmentPreview(appointment, true))}
                      {!items.length ? <p className="rounded-2xl border border-dashed border-slate-200 p-3 text-xs font-bold text-slate-400">Свободный день</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {viewMode === "month" ? (
            <div className="overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-100">
                {weekDays.map((day) => (
                  <div key={day} className="bg-slate-50/70 p-3 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 bg-slate-100">
                {monthDates.map((day, index) => {
                  const key = day ? toDateInputValue(day) : `empty-${index}`;
                  const items = day ? appointmentList.filter((appointment) => appointment.start_at.slice(0, 10) === key) : [];
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!day}
                      className={cn(
                        "min-h-32 bg-white p-3 text-left transition disabled:bg-slate-50",
                        day && key === date ? "ring-2 ring-inset ring-brand-400" : "hover:bg-brand-50/60",
                      )}
                      onClick={() => {
                        if (!day) return;
                        setDate(key);
                        setViewMode("day");
                      }}
                    >
                      {day ? <span className="text-sm font-black text-midnight">{day.getDate()}</span> : null}
                      <div className="mt-2 space-y-1">
                        {items.slice(0, 3).map((appointment) => {
                          const client = clientById.get(appointment.client);
                          return (
                            <p key={appointment.id} className="truncate rounded-xl bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">
                              {client?.full_name || t("common.client")}
                            </p>
                          );
                        })}
                        {items.length > 3 ? <p className="text-xs font-black text-slate-400">+{items.length - 3}</p> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <MiniMonth value={date} locale={locale} weekdays={weekDays} appointmentDates={appointmentDates} onChange={setDate} />

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Filter size={18} className="text-brand-600" />
              <p className="font-black text-midnight">Рабочие фильтры</p>
            </div>
            <div className="space-y-3">
              {[
                { label: "Клиенты", ready: hasClients },
                { label: "Услуги", ready: hasServices },
                { label: "Часы работы", ready: hasWorkingHours },
                { label: "Мастера", ready: hasResources },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold">
                  <span className="text-slate-700">{item.label}</span>
                  <span className={item.ready ? "text-emerald-600" : "text-amber-600"}>{item.ready ? "Готово" : "Настроить"}</span>
                </div>
              ))}
              {!hasWorkingHours ? (
                <Button type="button" variant="secondary" className="w-full" isLoading={quickHoursMutation.isPending} onClick={() => quickHoursMutation.mutate()}>
                  Быстро: 9:00-20:00
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Выбранная запись</p>
            {selectedAppointment ? (
              <div className="mt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-midnight">{clientById.get(selectedAppointment.client)?.full_name || t("common.client")}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{formatDateTime(selectedAppointment.start_at)}</p>
                  </div>
                  <StatusBadge status={selectedAppointment.status} />
                </div>
                <div className="mt-4 space-y-2 text-sm font-bold text-slate-600">
                  <p>Услуга: {serviceById.get(selectedAppointment.service)?.name || t("common.service")}</p>
                  <p>Мастер: {selectedAppointment.resource ? resourceById.get(selectedAppointment.resource)?.name : "Не назначен"}</p>
                  <p>Источник: {selectedAppointment.source}</p>
                  {selectedAppointment.lead ? <p>Заявка: #{leadById.get(selectedAppointment.lead)?.id || selectedAppointment.lead}</p> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {appointmentStatusActions.filter((status) => status !== selectedAppointment.status).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-brand-50 hover:text-brand-700"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status })}
                    >
                      {getAppointmentActionLabel(status)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded-full bg-midnight px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800"
                    onClick={() => setDrawerEntity({ type: "appointment", id: selectedAppointment.id })}
                  >
                    Открыть карточку
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="mt-4 w-full rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-left text-sm font-bold leading-6 text-slate-500 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                onClick={() => openBookingForDate(date)}
              >
                На выбранную дату нет записей. Нажмите, чтобы создать первую запись.
              </button>
            )}
          </div>

          {dayAppointments.length ? (
            <div className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Повестка дня</p>
              <div className="space-y-2">
                {dayAppointments.slice(0, 6).map((appointment) => renderAppointmentPreview(appointment))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      {mutation.error ? (
        <div className="mt-4">
          <ErrorState message={getApiErrorMessage(mutation.error)} />
        </div>
      ) : null}

      <Modal title={t("calendar.newBooking")} open={bookingOpen} onClose={() => { setBookingOpen(false); setBookingPrefill(null); }}>
        <AppointmentForm
          businessId={business.id}
          clients={clientItems}
          services={serviceItems}
          resources={resourceItems}
          leads={leadItems}
          prefill={bookingPrefill || { date }}
          onSubmit={(payload) => mutation.mutateAsync(payload)}
        />
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
      <FloatingActionButton label={t("calendar.newBooking")} icon={Plus} onClick={() => openBookingForDate(date)} />
    </>
  );
}
