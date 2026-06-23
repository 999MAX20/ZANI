import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { appointmentsApi, type AppointmentCreatePayload } from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { workingHoursApi } from "../../api/workingHours";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { AppointmentRescheduleForm } from "../../components/forms/AppointmentRescheduleForm";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { dateInTimeZone, minutesInTimeZone, todayInTimeZone } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment, Task, WorkingHours } from "../../types";

const dayStartHour = 8;
const dayEndHour = 21;
const hourHeight = 72;
const timelineHours = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => dayStartHour + index);
const viewModes = ["day", "week", "month", "list"] as const;
const localeByLanguage = {
  ru: "ru-RU",
  kk: "kk-KZ",
  en: "en-US",
};

type CalendarResource = {
  id: number | null;
  name: string;
};

type SearchableCalendarFilterOption = {
  value: string;
  label: string;
};

function SearchableCalendarFilter({
  value,
  options,
  allLabel,
  searchPlaceholder,
  emptyLabel,
  disabled,
  onChange,
}: {
  value: string;
  options: SearchableCalendarFilterOption[];
  allLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options;

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-black text-midnight shadow-sm transition hover:border-brand-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100",
          disabled && "cursor-not-allowed bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-slate-50",
        )}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={cn("truncate", !selectedOption && "text-slate-600")}>{selectedOption?.label || allLabel}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-slate-400 transition", isOpen && "rotate-180")} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-12 z-40 rounded-xl border border-slate-200 bg-white p-2 shadow-premium">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-midnight outline-none placeholder:text-slate-400"
            />
            {query ? (
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-midnight"
                onClick={() => setQuery("")}
                aria-label={emptyLabel}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto pr-1">
            <button
              type="button"
              className={cn(
                "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-black transition hover:bg-slate-50",
                !value ? "bg-brand-50 text-brand-700" : "text-slate-700",
              )}
              onClick={() => selectValue("")}
            >
              <span className="truncate">{allLabel}</span>
              {!value ? <Check size={16} className="shrink-0" /> : null}
            </button>
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-black transition hover:bg-slate-50",
                  value === option.value ? "bg-brand-50 text-brand-700" : "text-slate-700",
                )}
                onClick={() => selectValue(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {value === option.value ? <Check size={16} className="shrink-0" /> : null}
              </button>
            ))}
            {!filteredOptions.length ? <p className="px-3 py-4 text-sm font-bold text-slate-400">{emptyLabel}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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

function isDateValue(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateInputValue(parseDate(value)) === value;
}

function getQueryDate(value: string | null, fallback: string) {
  return isDateValue(value) ? value! : fallback;
}

function getQueryView(value: string | null) {
  return viewModes.includes(value as (typeof viewModes)[number]) ? value as (typeof viewModes)[number] : "day";
}

function normalizeTimeZone(value?: string | null) {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
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

function getCalendarRange(value: string, viewMode: "day" | "week" | "month" | "list") {
  if (viewMode === "week") {
    const week = getWeekDates(value);
    return { start: toDateInputValue(week[0]), end: shiftDateValue(toDateInputValue(week[6]), 1) };
  }
  if (viewMode === "month") {
    const selected = parseDate(value);
    const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
    return { start: toDateInputValue(start), end: toDateInputValue(end) };
  }
  return { start: value, end: shiftDateValue(value, 1) };
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

function getMinutes(value: string, timeZone: string) {
  return minutesInTimeZone(value, timeZone);
}

function timeStringToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getWeekday(value: string) {
  return (parseDate(value).getDay() + 6) % 7;
}

function getWorkingHoursFor(rows: WorkingHours[], weekday: number, resourceId: number | null) {
  const resourceHours = resourceId ? rows.find((row) => row.resource === resourceId && row.weekday === weekday) : null;
  return resourceHours || rows.find((row) => !row.resource && row.weekday === weekday) || null;
}

function isWorkingHourSlot(rows: WorkingHours[], dateValue: string, hour: number, resourceId: number | null) {
  const hours = getWorkingHoursFor(rows, getWeekday(dateValue), resourceId);
  if (!hours || hours.is_day_off) return false;
  const hourStart = hour * 60;
  return hourStart >= timeStringToMinutes(hours.start_time) && hourStart < timeStringToMinutes(hours.end_time);
}

function formatWorkingHoursLabel(rows: WorkingHours[], dateValue: string, resourceId: number | null, fallback: string) {
  const hours = getWorkingHoursFor(rows, getWeekday(dateValue), resourceId);
  if (!hours || hours.is_day_off) return fallback;
  return `${hours.start_time.slice(0, 5)}-${hours.end_time.slice(0, 5)}`;
}

function formatTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));
}

function formatCalendarDateTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function formatTimeZoneLabel(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value || timeZone;
  } catch {
    return timeZone;
  }
}

function getAppointmentMetrics(appointment: Appointment, timeZone: string) {
  const start = getMinutes(appointment.start_at, timeZone);
  const end = Math.max(start + 30, getMinutes(appointment.end_at, timeZone));
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
  todayValue,
}: {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  todayValue: string;
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
        <div className="fixed inset-x-3 top-24 z-30 rounded-card border border-slate-200 bg-white p-4 shadow-premium sm:absolute sm:inset-auto sm:left-0 sm:top-14 sm:w-[340px]">
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
              const isToday = cell && toDateInputValue(cell) === todayValue;
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
                      ? "bg-brand-600 text-white shadow-card"
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
          <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => { onChange(todayValue); setOpen(false); }}>
            {labels.today}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CalendarPage() {
  const { t, language } = useI18n();
  const showNotification = useNotification();
  const { setPageHeader } = usePageHeader();
  const { business } = useActiveBusiness();
  const { clients, services, resources, leads, workingHours, tasks } = useEntityData({
    clients: true,
    services: true,
    resources: true,
    leads: true,
    workingHours: true,
    tasks: true,
  });
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const fallbackToday = todayInTimeZone("Asia/Almaty");
  const [date, setDate] = useState(() => getQueryDate(searchParams.get("date"), fallbackToday));
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "list">(() => getQueryView(searchParams.get("view")));
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingPrefill, setBookingPrefill] = useState<{
    client?: number | null;
    service?: number | null;
    resource?: number | null;
    lead?: number | null;
    date?: string;
    slot?: string;
    hour?: number;
    source?: Appointment["source"];
  } | null>(null);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [serviceFilter, setServiceFilter] = useState(searchParams.get("service") || "");
  const [resourceFilter, setResourceFilter] = useState(searchParams.get("resource") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [monthInspectorOpen, setMonthInspectorOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Appointment | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const appointmentIdFromUrl = Number(searchParams.get("appointment")) || null;
  const searchParamsKey = searchParams.toString();
  const calendarRange = useMemo(() => getCalendarRange(date, viewMode), [date, viewMode]);

  const appointments = useQuery({
    queryKey: ["appointments", "calendar", business?.id, calendarRange.start, calendarRange.end, serviceFilter, resourceFilter, statusFilter],
    queryFn: () =>
      appointmentsApi.list({
        business: business!.id,
        start_from: calendarRange.start,
        start_to: calendarRange.end,
        service: serviceFilter ? Number(serviceFilter) : "",
        resource: resourceFilter ? Number(resourceFilter) : "",
        status: statusFilter as Appointment["status"] | "",
      }),
    enabled: Boolean(business?.id),
  });

  const deepLinkedAppointment = useQuery({
    queryKey: ["appointments", appointmentIdFromUrl],
    queryFn: () => appointmentsApi.get(appointmentIdFromUrl!),
    enabled: Boolean(appointmentIdFromUrl),
  });

  const dayAvailableSlots = useQuery({
    queryKey: ["available-slots", "calendar-day", business?.id, serviceFilter, resourceFilter, date],
    queryFn: () =>
      appointmentsApi.availableSlots({
        business_id: business!.id,
        service_id: Number(serviceFilter),
        resource_id: resourceFilter ? Number(resourceFilter) : "",
        date,
      }),
    enabled: Boolean(business?.id && serviceFilter && date),
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const nextDate = params.get("date");
    const nextView = params.get("view");
    const nextService = params.get("service") || "";
    const nextResource = params.get("resource") || "";
    const nextStatus = params.get("status") || "";
    const nextSearch = params.get("search") || "";

    if (isDateValue(nextDate)) setDate(nextDate!);
    if (nextView) setViewMode(getQueryView(nextView));
    setServiceFilter(nextService);
    setResourceFilter(nextResource);
    setStatusFilter(nextStatus);
    setSearch(nextSearch);
  }, [searchParamsKey]);

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("date", date);
      next.set("view", viewMode);
      if (serviceFilter) next.set("service", serviceFilter);
      else next.delete("service");
      if (resourceFilter) next.set("resource", resourceFilter);
      else next.delete("resource");
      if (statusFilter) next.set("status", statusFilter);
      else next.delete("status");
      if (search.trim()) next.set("search", search.trim());
      else next.delete("search");
      if (next.toString() === current.toString()) return current;
      return next;
    }, { replace: true });
  }, [date, resourceFilter, search, serviceFilter, setSearchParams, statusFilter, viewMode]);

  useEffect(() => {
    const appointment = deepLinkedAppointment.data;
    if (!appointment) return;
    setDate(dateInTimeZone(appointment.start_at, business?.timezone || "Asia/Almaty"));
    setSelectedAppointmentId(appointment.id);
    setViewMode("day");
  }, [business?.timezone, deepLinkedAppointment.data]);

  function refreshAppointmentData(appointment?: Appointment) {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["available-slots"] });
    queryClient.invalidateQueries({ queryKey: ["activity-events"] });
    queryClient.invalidateQueries({ queryKey: ["crm-card"] });
    if (appointment) queryClient.invalidateQueries({ queryKey: ["crm-card", "appointment", appointment.id] });
  }

  function setNotice(message: string | null, tone: "success" | "info" | "warning" | "danger" = "success") {
    if (!message) return;
    showNotification({ message, tone });
  }

  const mutation = useMutation({
    mutationFn: (payload: AppointmentCreatePayload) => appointmentsApi.create(payload),
    onSuccess: (appointment) => {
      refreshAppointmentData(appointment);
      setBookingOpen(false);
      if (appointment.start_at) setDate(dateInTimeZone(appointment.start_at, business?.timezone || "Asia/Almaty"));
      setSelectedAppointmentId(appointment.id);
      setNotice(t("calendar.createdNotice"));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Appointment["status"] }) => {
      if (status === "confirmed") return appointmentsApi.confirm(id);
      if (status === "cancelled") return appointmentsApi.cancel(id);
      if (status === "completed") return appointmentsApi.complete(id);
      if (status === "no_show") return appointmentsApi.noShow(id);
      return appointmentsApi.get(id);
    },
    onSuccess: (appointment) => refreshAppointmentData(appointment),
  });

  const rescheduleMutation = useMutation({
    mutationFn: appointmentsApi.reschedule,
    onSuccess: (appointment) => {
      refreshAppointmentData(appointment);
      setDate(dateInTimeZone(appointment.start_at, business?.timezone || "Asia/Almaty"));
      setSelectedAppointmentId(appointment.id);
      setRescheduleTarget(null);
      setNotice(t("appointments.rescheduledNotice"));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => appointmentsApi.archive({ id, reason }),
    onSuccess: (appointment) => {
      refreshAppointmentData(appointment);
      setArchiveTarget(null);
      setArchiveReason("");
      setSelectedAppointmentId(null);
      setNotice(t("appointments.archive"));
    },
  });

  const quickHoursMutation = useMutation({
    mutationFn: () => workingHoursApi.applyPreset({ business: business!.id, preset: "daily_9_20" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["working-hours"] });
      queryClient.invalidateQueries({ queryKey: ["available-slots"] });
      setNotice(t("calendar.quickHoursApplied"));
    },
  });

  useEffect(() => {
    setPageHeader({
      title: t("nav.calendar"),
      primaryAction: {
        label: t("calendar.newBooking"),
        icon: Plus,
        onClick: () => openBookingForDate(date),
      },
    });
    return () => setPageHeader(null);
  }, [date, setPageHeader, t]);

  const actionError = statusMutation.error || quickHoursMutation.error || rescheduleMutation.error || archiveMutation.error;
  const actionErrorMessage = actionError ? getApiErrorMessage(actionError) : "";

  useEffect(() => {
    if (!actionErrorMessage) return;
    showNotification({ message: actionErrorMessage, tone: "danger" });
  }, [actionErrorMessage, showNotification]);

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
  const businessTimeZone = normalizeTimeZone(business.timezone || "Asia/Almaty");
  const todayValue = todayInTimeZone(businessTimeZone);
  const weekDays = [t("weekday.monShort"), t("weekday.tueShort"), t("weekday.wedShort"), t("weekday.thuShort"), t("weekday.friShort"), t("weekday.satShort"), t("weekday.sunShort")];
  const clientById = new Map(clientItems.map((client) => [client.id, client]));
  const serviceById = new Map(serviceItems.map((service) => [service.id, service]));
  const resourceById = new Map(resourceItems.map((resource) => [resource.id, resource]));
  const leadById = new Map(leadItems.map((lead) => [lead.id, lead]));

  const appointmentList = appointmentItems.filter((item) => {
    const client = clientById.get(item.client);
    const service = serviceById.get(item.service);
    const resource = item.resource ? resourceById.get(item.resource) : null;
    const query = search.trim().toLowerCase();
    if (item.is_archived) return false;
    if (serviceFilter && item.service !== Number(serviceFilter)) return false;
    if (resourceFilter && item.resource !== Number(resourceFilter)) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (!query) return true;
    return [client?.full_name, service?.name, resource?.name, item.source, item.notes]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const weekDates = getWeekDates(date);
  const monthDates = getMonthDates(date);
  const dayAppointments = appointmentList
    .filter((item) => dateInTimeZone(item.start_at, businessTimeZone) === date)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const weekKeys = new Set(weekDates.map(toDateInputValue));
  const weekAppointments = appointmentList
    .filter((item) => weekKeys.has(dateInTimeZone(item.start_at, businessTimeZone)))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const dayTasks = taskItems.filter((task) => task.due_at && dateInTimeZone(task.due_at, businessTimeZone) === date && !["done", "cancelled"].includes(task.status));
  const selectedAppointment = appointmentItems.find((appointment) => appointment.id === selectedAppointmentId && !appointment.is_archived) || null;
  const hasWorkingHours = Boolean(workingHourItems.length);
  const selectedResourceId = resourceFilter ? Number(resourceFilter) : null;
  const selectedDayHours = getWorkingHoursFor(workingHourItems, getWeekday(date), selectedResourceId);
  const confirmedCount = dayAppointments.filter((appointment) => appointment.status === "confirmed").length;
  const openSlotsFallback = Math.max(0, timelineHours.length - dayAppointments.length);
  const openSlotsCount = serviceFilter && dayAvailableSlots.data ? dayAvailableSlots.data.length : openSlotsFallback;
  const openSlotsLabel = serviceFilter ? t("calendar.openSlots") : t("calendar.openSlotsEstimate");
  const timeZoneLabel = formatTimeZoneLabel(businessTimeZone);
  const selectedResource = resourceFilter ? resourceById.get(Number(resourceFilter)) : null;
  const dayScheduleResource: CalendarResource = selectedResource
    ? { id: selectedResource.id, name: selectedResource.name }
    : { id: null, name: resourceItems.length ? t("calendar.allResources") : t("calendar.businessSchedule") };

  function shiftDate(days: number) {
    setDate(shiftDateValue(date, days));
  }

  function selectAppointment(appointment: Appointment) {
    setSelectedAppointmentId(appointment.id);
    setMonthInspectorOpen(false);
    setDate(dateInTimeZone(appointment.start_at, businessTimeZone));
  }

  function selectMonthDay(nextDate: string) {
    setDate(nextDate);
    setSelectedAppointmentId(null);
    setMonthInspectorOpen(true);
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

  function getAllowedStatusActions(appointment: Appointment) {
    if (appointment.status === "created" || appointment.status === "rescheduled") return ["confirmed", "cancelled"] as Appointment["status"][];
    if (appointment.status === "confirmed") return ["completed", "cancelled", "no_show"] as Appointment["status"][];
    return [] as Appointment["status"][];
  }

  function canRescheduleAppointment(appointment: Appointment) {
    return !["completed", "cancelled", "no_show"].includes(appointment.status);
  }

  function openRepeatBooking(appointment: Appointment) {
    setBookingPrefill({
      date: dateInTimeZone(appointment.start_at, businessTimeZone),
      client: appointment.client,
      service: appointment.service,
      resource: appointment.resource || undefined,
      lead: appointment.lead || undefined,
      source: "manual",
    });
    setBookingOpen(true);
  }

  function shouldShowRepeatBooking(appointment: Appointment) {
    return ["completed", "cancelled", "no_show"].includes(appointment.status);
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
          "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50",
          selectedAppointment?.id === appointment.id && "border-brand-400 bg-brand-50 ring-1 ring-brand-200",
        )}
        onClick={() => selectAppointment(appointment)}
        onDoubleClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-midnight">{client?.full_name || t("common.client")}</p>
            <p className="mt-1 flex items-center gap-1 truncate text-xs font-bold text-slate-500">
              <Clock size={13} />
              <span className="truncate">{formatTime(appointment.start_at, locale, businessTimeZone)}-{formatTime(appointment.end_at, locale, businessTimeZone)} · {service?.name || t("common.service")}</span>
            </p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>
        {!compact ? <p className="mt-2 truncate text-xs font-semibold text-slate-500">{resource?.name || t("calendar.noResource")} · {appointment.source}</p> : null}
      </button>
    );
  }

  const serviceFilterOptions = serviceItems.map((service) => ({ value: String(service.id), label: service.name }));
  const resourceFilterOptions = resourceItems.map((resource) => ({ value: String(resource.id), label: resource.name }));
  const filterControls = (
    <>
      <SearchableCalendarFilter
        value={serviceFilter}
        onChange={setServiceFilter}
        disabled={services.isLoading}
        options={serviceFilterOptions}
        allLabel={t("calendar.allServices")}
        searchPlaceholder={t("calendar.searchServices")}
        emptyLabel={t("calendar.noFilterResults")}
      />
      <SearchableCalendarFilter
        value={resourceFilter}
        onChange={setResourceFilter}
        disabled={resources.isLoading}
        options={resourceFilterOptions}
        allLabel={t("calendar.allResources")}
        searchPlaceholder={t("calendar.searchResources")}
        emptyLabel={t("calendar.noFilterResults")}
      />
      <Select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        options={[
          { value: "", label: t("calendar.allStatuses") },
          { value: "created", label: t("status.created") },
          { value: "confirmed", label: t("status.confirmed") },
          { value: "completed", label: t("status.completed") },
          { value: "cancelled", label: t("status.cancelled") },
          { value: "no_show", label: t("status.no_show") },
        ]}
      />
    </>
  );
  const activeFilterChips = [
    serviceFilter ? { key: "service", label: serviceById.get(Number(serviceFilter))?.name || t("calendar.allServices"), clear: () => setServiceFilter("") } : null,
    resourceFilter ? { key: "resource", label: resourceById.get(Number(resourceFilter))?.name || t("calendar.allResources"), clear: () => setResourceFilter("") } : null,
    statusFilter ? { key: "status", label: t(`status.${statusFilter}`), clear: () => setStatusFilter("") } : null,
    search.trim() ? { key: "search", label: search.trim(), clear: () => setSearch("") } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  function clearAllFilters() {
    setServiceFilter("");
    setResourceFilter("");
    setStatusFilter("");
    setSearch("");
  }

  const activeFilterMonitor = activeFilterChips.length ? (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
      <span className="text-[11px] font-black uppercase text-slate-400">{t("calendar.filters")}</span>
      {activeFilterChips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="inline-flex min-h-7 max-w-full items-center gap-2 rounded-lg border border-brand-100 bg-white px-2.5 py-1 text-xs font-black text-brand-700 transition hover:border-brand-200 hover:bg-brand-50"
          onClick={chip.clear}
        >
          <span className="truncate">{chip.label}</span>
          <X size={13} />
        </button>
      ))}
      <button type="button" className="min-h-7 rounded-lg px-2.5 py-1 text-xs font-black text-slate-500 transition hover:bg-white hover:text-midnight" onClick={clearAllFilters}>
        {t("conversations.resetFilters")}
      </button>
    </div>
  ) : null;

  return (
    <>
      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="icon" className="h-10 w-10" onClick={() => shiftDate(-1)} aria-label={t("calendar.previousDay")}>
              <ChevronLeft size={18} />
            </Button>
            <CalendarPicker
              value={date}
              onChange={setDate}
              locale={locale}
              todayValue={todayValue}
              labels={{
                previousMonth: t("calendar.previousMonth"),
                nextMonth: t("calendar.nextMonth"),
                today: t("calendar.today"),
                weekdays: weekDays,
              }}
            />
            <Button variant="secondary" size="icon" className="h-10 w-10" onClick={() => shiftDate(1)} aria-label={t("calendar.nextDay")}>
              <ChevronRight size={18} />
            </Button>
            <Button variant="secondary" className="h-10 px-3" onClick={() => setDate(todayValue)}>
              {t("calendar.today")}
            </Button>
            <div className="grid grid-cols-4 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {[
                { value: "day", label: t("calendar.day") },
                { value: "week", label: t("calendar.week") },
                { value: "month", label: t("calendar.month") },
                { value: "list", label: t("appointments.title") },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-black transition sm:text-sm",
                    viewMode === item.value ? "bg-midnight text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-midnight",
                  )}
                  onClick={() => setViewMode(item.value as typeof viewMode)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <details className="mt-3 lg:hidden">
          <summary className="cursor-pointer list-none text-sm font-black text-midnight">
            <span className="inline-flex items-center gap-2"><Filter size={18} />{t("calendar.filters")}</span>
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">{filterControls}</div>
        </details>
        <div className="mt-3 hidden items-center gap-2 border-t border-slate-200 pt-3 lg:grid lg:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1fr)_170px]">{filterControls}</div>
      </section>

      {isCalendarDataLoading ? <div className="mb-4"><LoadingState label={t("calendar.loadingInline")} /></div> : null}

      <section className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{formatPickerDate(date, locale)}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {selectedDayHours && !selectedDayHours.is_day_off
                  ? `${selectedDayHours.start_time.slice(0, 5)}-${selectedDayHours.end_time.slice(0, 5)}`
                  : t("calendar.freeDay")}
              </p>
              <p className="mt-1 text-xs font-black text-slate-400">{t("calendar.bookings")} {dayAppointments.length} · {t("calendar.tasksToday")} {dayTasks.length}</p>
            </div>
            <Button size="sm" onClick={() => openBookingForDate(date)}>
              <Plus size={16} />
              {t("calendar.newBooking")}
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {dayAppointments.map((appointment) => renderAppointmentPreview(appointment))}
            {!dayAppointments.length ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                <p>{t("calendar.freeDayHint")}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" className="w-full" onClick={() => openBookingForDate(date)}>
                    <Plus size={16} />
                    {t("calendar.newBooking")}
                  </Button>
                  <a className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-midnight hover:bg-slate-50" href="/app/working-hours">
                    {t("appointment.openHours")}
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden min-w-0 overflow-visible rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
          {activeFilterMonitor}
          {viewMode === "day" ? (
            <div className="overflow-y-visible">
              <div className="min-w-0">
                <div className="sticky top-0 z-10 grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: "72px minmax(0, 1fr)" }}>
                  <div className="bg-slate-50 p-3 text-xs font-black uppercase text-slate-400">{timeZoneLabel}</div>
                    <div className="border-l border-slate-200 bg-white p-3 ">
                      <div className="flex items-center gap-3">
                        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-black", getTone(0))}>{getInitials(dayScheduleResource.name)}</div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-midnight">{t("calendar.daySchedule")}</p>
                          <p className="text-xs font-bold text-slate-500">{formatWorkingHoursLabel(workingHourItems, date, dayScheduleResource.id, t("calendar.freeDay"))}</p>
                        </div>
                      </div>
                    </div>
                </div>
                <div className="relative grid" style={{ gridTemplateColumns: "72px minmax(0, 1fr)", height: `${(dayEndHour - dayStartHour) * hourHeight}px` }}>
                  <div className="relative border-r border-slate-200 bg-slate-50">
                    {timelineHours.slice(0, -1).map((hour) => (
                      <div key={hour} className="absolute left-0 right-0 border-t border-slate-200 px-3 pt-2 text-xs font-bold text-slate-400" style={{ top: `${(hour - dayStartHour) * hourHeight}px` }}>
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                      <div className="relative border-l border-slate-200">
                        {timelineHours.slice(0, -1).map((hour) => {
                          const isWorking = isWorkingHourSlot(workingHourItems, date, hour, dayScheduleResource.id);
                          return (
                            <button
                              key={hour}
                              type="button"
                              disabled={!isWorking}
                              className={cn(
                                "absolute left-0 right-0 border-t border-slate-200 text-left transition",
                                isWorking ? "hover:bg-brand-50" : "cursor-not-allowed bg-slate-50 opacity-70",
                              )}
                              style={{ top: `${(hour - dayStartHour) * hourHeight}px`, height: `${hourHeight}px` }}
                              onClick={() => isWorking && openBookingForDate(date, hour, dayScheduleResource.id)}
                              aria-label={t("calendar.createAtHour", { hour: String(hour).padStart(2, "0") })}
                            />
                          );
                        })}
                        {dayAppointments.map((appointment, index) => {
                          const client = clientById.get(appointment.client);
                          const service = serviceById.get(appointment.service);
                          const resource = appointment.resource ? resourceById.get(appointment.resource) : null;
                          const metrics = getAppointmentMetrics(appointment, businessTimeZone);
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              className={cn(
                                "group absolute left-2 right-2 overflow-visible rounded-lg border-l-4 border-t border-r border-b px-3 py-2 text-left shadow-sm transition hover:z-30 hover:shadow-md",
                                getTone(index),
                                selectedAppointment?.id === appointment.id && "border-brand-500 bg-brand-50 shadow-md",
                              )}
                              style={{ top: `${metrics.top + 6}px`, height: `${metrics.height - 8}px` }}
                              onClick={() => selectAppointment(appointment)}
                              onDoubleClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-black leading-4">{formatTime(appointment.start_at, locale, businessTimeZone)}-{formatTime(appointment.end_at, locale, businessTimeZone)}</p>
                                <MoreHorizontal size={14} className="shrink-0" />
                              </div>
                              <p className="mt-1 truncate text-sm font-black leading-4">{client?.full_name || t("common.client")}</p>
                              {metrics.height > 62 ? <p className="mt-1 truncate text-xs font-bold opacity-75">{service?.name || t("common.service")}{resource ? ` · ${resource.name}` : ""}</p> : null}
                              <div className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-50 hidden w-72 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-premium group-hover:block">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-midnight">{client?.full_name || t("common.client")}</p>
                                    <p className="mt-1 text-xs font-bold text-slate-500">{formatTime(appointment.start_at, locale, businessTimeZone)}-{formatTime(appointment.end_at, locale, businessTimeZone)}</p>
                                  </div>
                                  <StatusBadge status={appointment.status} />
                                </div>
                                <div className="mt-3 space-y-1 text-xs font-bold text-slate-500">
                                  <p className="truncate">{service?.name || t("common.service")}</p>
                                  <p className="truncate">{resource?.name || t("appointment.noResource")}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                </div>
              </div>
            </div>
          ) : null}

          {viewMode === "week" ? (
            <div className="overflow-x-auto overflow-y-visible">
              <div className="min-w-[980px]">
                <div className="sticky top-0 z-10 grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: "72px repeat(7, minmax(128px, 1fr))" }}>
                  <div className="bg-slate-50 p-3 text-xs font-black uppercase text-slate-400">{timeZoneLabel}</div>
                  {weekDates.map((day) => {
                    const key = toDateInputValue(day);
                    return (
                      <button key={key} type="button" className={cn("border-l border-slate-200 p-3 text-left", key === date ? "bg-brand-50" : "bg-white")} onClick={() => setDate(key)}>
                        <p className="text-xs font-black uppercase text-slate-400">{weekDays[(day.getDay() + 6) % 7]}</p>
                        <p className="mt-1 text-lg font-black text-midnight">{day.getDate()}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="relative grid" style={{ gridTemplateColumns: "72px repeat(7, minmax(128px, 1fr))", height: `${(dayEndHour - dayStartHour) * hourHeight}px` }}>
                  <div className="relative border-r border-slate-200 bg-slate-50">
                    {timelineHours.slice(0, -1).map((hour) => (
                      <div key={hour} className="absolute left-0 right-0 border-t border-slate-200 px-3 pt-2 text-xs font-bold text-slate-400" style={{ top: `${(hour - dayStartHour) * hourHeight}px` }}>
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                  {weekDates.map((day) => {
                    const key = toDateInputValue(day);
                    const items = weekAppointments.filter((appointment) => dateInTimeZone(appointment.start_at, businessTimeZone) === key);
                    return (
                      <div key={key} className={cn("relative border-l border-slate-200", key === date && "bg-brand-50")}>
                        {timelineHours.slice(0, -1).map((hour) => {
                          const isWorking = isWorkingHourSlot(workingHourItems, key, hour, null);
                          return (
                            <button
                              key={hour}
                              type="button"
                              disabled={!isWorking}
                              className={cn(
                                "absolute left-0 right-0 border-t border-slate-200 transition",
                                isWorking ? "hover:bg-brand-50" : "cursor-not-allowed bg-slate-50 opacity-70",
                              )}
                              style={{ top: `${(hour - dayStartHour) * hourHeight}px`, height: `${hourHeight}px` }}
                              onClick={() => isWorking && openBookingForDate(key, hour)}
                              aria-label={t("calendar.createAtHour", { hour: String(hour).padStart(2, "0") })}
                            />
                          );
                        })}
                        {items.map((appointment, index) => {
                          const client = clientById.get(appointment.client);
                          const service = serviceById.get(appointment.service);
                          const metrics = getAppointmentMetrics(appointment, businessTimeZone);
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              className={cn("group absolute left-1 right-1 overflow-visible rounded-lg border-l-4 border-t border-r border-b px-2 py-1 text-left text-xs shadow-sm hover:z-30 hover:shadow-md", getTone(index), selectedAppointment?.id === appointment.id && "border-brand-500 bg-brand-50 shadow-md")}
                              style={{ top: `${metrics.top + 4}px`, height: `${Math.max(34, metrics.height - 8)}px` }}
                              onClick={() => selectAppointment(appointment)}
                            >
                              <p className="font-black">{formatTime(appointment.start_at, locale, businessTimeZone)}</p>
                              <p className="truncate font-bold">{client?.full_name || t("common.client")}</p>
                              <div className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-50 hidden w-64 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-premium group-hover:block">
                                <p className="truncate text-sm font-black text-midnight">{client?.full_name || t("common.client")}</p>
                                <p className="mt-1 text-xs font-bold text-slate-500">{formatTime(appointment.start_at, locale, businessTimeZone)}-{formatTime(appointment.end_at, locale, businessTimeZone)}</p>
                                <p className="mt-2 truncate text-xs font-bold text-slate-500">{service?.name || t("common.service")}</p>
                              </div>
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

          {viewMode === "month" ? (
            <div className="overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-200">
                {weekDays.map((day) => <div key={day} className="bg-slate-50 p-3 text-center text-xs font-black uppercase text-slate-400">{day}</div>)}
              </div>
              <div className="grid grid-cols-7 bg-slate-200">
                {monthDates.map((day, index) => {
                  const key = day ? toDateInputValue(day) : `empty-${index}`;
                  const items = day ? appointmentList.filter((appointment) => dateInTimeZone(appointment.start_at, businessTimeZone) === key) : [];
                  const isSelectedDay = day && key === date;
                  return (
                    <div
                      key={key}
                      className={cn("relative min-h-28 bg-white p-3 text-left transition", !day && "bg-slate-50", isSelectedDay ? "bg-brand-50 ring-2 ring-inset ring-brand-500" : day && "hover:bg-brand-50")}
                    >
                      {day ? (
                        <button
                          type="button"
                          className="absolute inset-0 z-0 text-left"
                          onClick={() => selectMonthDay(key)}
                          onDoubleClick={() => {
                            setDate(key);
                            setMonthInspectorOpen(false);
                            setViewMode("day");
                          }}
                          aria-label={formatPickerDate(key, locale)}
                        />
                      ) : null}
                      {day ? (
                        <div className="pointer-events-none relative z-10 flex items-center justify-between gap-2">
                          <span className="text-sm font-black text-midnight">{day.getDate()}</span>
                          {isSelectedDay ? <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-black uppercase text-brand-700">{t("calendar.selectedDay")}</span> : null}
                        </div>
                      ) : null}
                      <div className="relative z-20 mt-2 space-y-1">
                        {items.slice(0, 3).map((appointment) => {
                          const client = clientById.get(appointment.client);
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              className="w-full truncate rounded-md border border-brand-100 bg-white px-2 py-1 text-left text-xs font-bold text-brand-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectAppointment(appointment);
                              }}
                            >
                              {formatTime(appointment.start_at, locale, businessTimeZone)} {client?.full_name || t("common.client")}
                            </button>
                          );
                        })}
                        {items.length > 3 ? <p className="text-xs font-black text-slate-400">+{items.length - 3}</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {viewMode === "list" ? (
            <div className="divide-y divide-slate-100">
              {dayAppointments.map((appointment) => {
                const client = clientById.get(appointment.client);
                const service = serviceById.get(appointment.service);
                const resource = appointment.resource ? resourceById.get(appointment.resource) : null;
                return (
                  <div key={appointment.id} className={cn("grid gap-3 p-4 transition hover:bg-slate-50 lg:grid-cols-[170px_minmax(0,1.2fr)_minmax(0,1fr)_180px]", selectedAppointment?.id === appointment.id && "bg-brand-50")}>
                    <button type="button" className="text-left" onClick={() => selectAppointment(appointment)}>
                      <p className="text-sm font-black text-midnight">{formatCalendarDateTime(appointment.start_at, locale, businessTimeZone)}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{formatTime(appointment.start_at, locale, businessTimeZone)}-{formatTime(appointment.end_at, locale, businessTimeZone)}</p>
                    </button>
                    <button type="button" className="min-w-0 text-left" onClick={() => selectAppointment(appointment)}>
                      <p className="truncate text-sm font-black text-midnight">{client?.full_name || t("common.client")}</p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-500">{service?.name || t("common.service")}</p>
                    </button>
                    <div className="min-w-0 text-sm font-bold text-slate-600">
                      <p className="truncate">{resource?.name || t("calendar.noResource")}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">{appointment.source}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={appointment.status} />
                      <Button variant="secondary" size="sm" onClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}>{t("appointments.card")}</Button>
                    </div>
                  </div>
                );
              })}
              {!dayAppointments.length ? (
                <button type="button" className="w-full p-8 text-left text-sm font-bold text-slate-500 transition hover:bg-brand-50 hover:text-brand-700" onClick={() => openBookingForDate(date)}>
                  {t("calendar.freeDayHint")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {viewMode === "month" && monthInspectorOpen && !selectedAppointment ? (
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
              onClick={() => setMonthInspectorOpen(false)}
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
              <Button type="button" size="sm" onClick={() => openBookingForDate(date)}>
                <Plus size={16} />
                {t("calendar.newBooking")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setMonthInspectorOpen(false);
                  setViewMode("day");
                }}
              >
                {t("calendar.openDay")}
              </Button>
              <Link className="col-span-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-midnight transition hover:bg-slate-50" to="/app/working-hours">
                {t("appointment.openHours")}
              </Link>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("calendar.bookings")}</p>
              <div className="space-y-2">
                {dayAppointments.map((appointment) => renderAppointmentPreview(appointment))}
                {!dayAppointments.length ? (
                  <button
                    type="button"
                    className="w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-left text-sm font-bold leading-6 text-slate-500 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                    onClick={() => openBookingForDate(date)}
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
        ) : null}

        {selectedAppointment ? (
        <aside className="fixed inset-x-3 bottom-3 z-40 max-h-[82vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-premium sm:inset-x-auto sm:right-6 sm:top-24 sm:bottom-auto sm:w-[420px]">
          <div className="pr-10">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("calendar.selectedAppointment")}</p>
            <button
              type="button"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-midnight"
              onClick={() => setSelectedAppointmentId(null)}
              aria-label={t("common.close")}
            >
              <X size={18} />
            </button>

            <div className="mt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-2xl font-black leading-7 text-midnight">{clientById.get(selectedAppointment.client)?.full_name || t("common.client")}</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    {formatTime(selectedAppointment.start_at, locale, businessTimeZone)}-{formatTime(selectedAppointment.end_at, locale, businessTimeZone)} · {formatPickerDate(dateInTimeZone(selectedAppointment.start_at, businessTimeZone), locale)}
                  </p>
                </div>
                <StatusBadge status={selectedAppointment.status} />
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("calendar.visit")}</p>
                <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 border-t border-slate-200/70 py-2 first:border-t-0 first:pt-0">
                  <p className="text-xs font-black uppercase text-slate-400">{t("common.service")}</p>
                  <p className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-700">
                    <CalendarDays size={15} className="shrink-0 text-slate-400" />
                    <span className="truncate">{serviceById.get(selectedAppointment.service)?.name || t("common.service")}</span>
                  </p>
                </div>
                <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 border-t border-slate-200/70 py-2">
                  <p className="text-xs font-black uppercase text-slate-400">{t("appointment.resource")}</p>
                  <p className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-700">
                    <UserRound size={15} className="shrink-0 text-slate-400" />
                    <span className="truncate">{selectedAppointment.resource ? resourceById.get(selectedAppointment.resource)?.name || t("appointment.noResource") : t("appointment.noResource")}</span>
                  </p>
                </div>
                <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 border-t border-slate-200/70 py-2">
                  <p className="text-xs font-black uppercase text-slate-400">{t("appointment.source")}</p>
                  <p className="truncate text-sm font-black text-slate-700">{t(`appointment.source.${selectedAppointment.source}`)}</p>
                </div>
                {selectedAppointment.lead ? (
                  <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 border-t border-slate-200/70 py-2 pb-0">
                    <p className="text-xs font-black uppercase text-slate-400">{t("calendar.lead")}</p>
                    <p className="text-sm font-black text-slate-700">#{leadById.get(selectedAppointment.lead)?.id || selectedAppointment.lead}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 space-y-2">
                {shouldShowRepeatBooking(selectedAppointment) ? (
                  <Button type="button" className="w-full" onClick={() => openRepeatBooking(selectedAppointment)}>
                    <Plus size={16} />
                    {t("appointments.repeatBooking")}
                  </Button>
                ) : null}
                {getAllowedStatusActions(selectedAppointment).length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {getAllowedStatusActions(selectedAppointment).map((status, index) => (
                      <Button
                        key={status}
                        type="button"
                        variant={index === 0 ? "primary" : "secondary"}
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status })}
                      >
                        {getAppointmentActionLabel(status)}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  {canRescheduleAppointment(selectedAppointment) ? (
                    <Button type="button" variant="secondary" size="sm" onClick={() => setRescheduleTarget(selectedAppointment)}>
                      {t("appointments.reschedule")}
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" size="sm" className={!canRescheduleAppointment(selectedAppointment) ? "col-span-2" : undefined} onClick={() => setDrawerEntity({ type: "appointment", id: selectedAppointment.id })}>
                    {t("calendar.openCard")}
                  </Button>
                </div>
                <button
                  type="button"
                  className="mt-2 min-h-9 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:border-red-200 hover:bg-red-50"
                  onClick={() => setArchiveTarget(selectedAppointment)}
                >
                  {t("appointments.archiveAction")}
                </button>
              </div>
            </div>
          </div>
        </aside>
        ) : null}
      </section>

      {mutation.error ? <div className="mt-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}

      <Modal title={t("calendar.newBooking")} open={bookingOpen} onClose={() => { setBookingOpen(false); setBookingPrefill(null); }}>
        <AppointmentForm businessId={business.id} clients={clientItems} services={serviceItems} resources={resourceItems} leads={leadItems} prefill={bookingPrefill || { date }} onSubmit={(payload) => mutation.mutateAsync(payload)} timeZone={businessTimeZone} />
      </Modal>
      <Modal title={t("appointments.rescheduleTitle")} open={Boolean(rescheduleTarget)} onClose={() => setRescheduleTarget(null)}>
        {rescheduleTarget ? (
          <AppointmentRescheduleForm
            appointment={rescheduleTarget}
            businessId={business.id}
            resources={resourceItems}
            onCancel={() => setRescheduleTarget(null)}
            onSubmit={(payload) => rescheduleMutation.mutateAsync({ id: rescheduleTarget.id, payload })}
            isSubmitting={rescheduleMutation.isPending}
            timeZone={businessTimeZone}
          />
        ) : null}
      </Modal>
      <Modal title={t("appointments.archive")} open={Boolean(archiveTarget)} onClose={() => { setArchiveTarget(null); setArchiveReason(""); }}>
        <div className="space-y-4">
          <Input label={t("appointments.archiveReason")} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder={t("appointments.archiveReasonPlaceholder")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setArchiveTarget(null); setArchiveReason(""); }}>{t("common.cancel")}</Button>
            <Button
              type="button"
              variant="danger"
              isLoading={archiveMutation.isPending}
              onClick={() => {
                if (!archiveTarget) return;
                archiveMutation.mutate({ id: archiveTarget.id, reason: archiveReason.trim() || t("appointments.archiveReasonDefault") });
              }}
            >
              {t("appointments.archive")}
            </Button>
          </div>
        </div>
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
