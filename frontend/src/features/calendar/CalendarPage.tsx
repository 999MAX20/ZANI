import { MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  appointmentsApi,
  type AppointmentCreatePayload,
} from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { workingHoursApi } from "../../api/workingHours";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { AppointmentRescheduleForm } from "../../components/forms/AppointmentRescheduleForm";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { dateInTimeZone, todayInTimeZone } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment, Task } from "../../types";
import {
  dayEndHour,
  dayStartHour,
  hourHeight,
  localeByLanguage,
  timelineHours,
} from "./calendarConstants";
import type { CalendarResource, CalendarViewMode } from "./calendarTypes";
import {
  formatCalendarDateTime,
  formatPickerDate,
  formatTime,
  formatTimeZoneLabel,
  formatWorkingHoursLabel,
  getAppointmentMetrics,
  getCalendarRange,
  getInitials,
  getMonthDates,
  getQueryDate,
  getQueryView,
  getTone,
  getWeekDates,
  getWeekday,
  getWorkingHoursFor,
  isDateValue,
  isWorkingHourSlot,
  normalizeTimeZone,
  shiftDateValue,
  toDateInputValue,
} from "./calendarUtils";
import { AppointmentDrawerPanel } from "./components/AppointmentDrawerPanel";
import {
  CalendarAppointmentPreview,
  CalendarTaskPreview,
} from "./components/CalendarAppointmentCards";
import {
  ActiveCalendarFilters,
  type ActiveCalendarFilterChip,
} from "./components/CalendarFilters";
import { CalendarToolbar } from "./components/CalendarToolbar";
import { MonthInspectorPanel } from "./components/MonthInspectorPanel";

export function CalendarPage() {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const showNotification = useNotification();
  const { setPageHeader } = usePageHeader();
  const { business } = useActiveBusiness();
  const { clients, services, resources, leads, workingHours, tasks } =
    useEntityData({
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
  const [date, setDate] = useState(() =>
    getQueryDate(searchParams.get("date"), fallbackToday),
  );
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() =>
    getQueryView(searchParams.get("view")),
  );
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
  const [serviceFilter, setServiceFilter] = useState(
    searchParams.get("service") || "",
  );
  const [resourceFilter, setResourceFilter] = useState(
    searchParams.get("resource") || "",
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "",
  );
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    number | null
  >(null);
  const [monthInspectorOpen, setMonthInspectorOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(
    null,
  );
  const [statusReasonTarget, setStatusReasonTarget] = useState<{
    appointment: Appointment;
    status: Appointment["status"];
  } | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Appointment | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const appointmentIdFromUrl = Number(searchParams.get("appointment")) || null;
  const searchParamsKey = searchParams.toString();
  const calendarRange = useMemo(
    () => getCalendarRange(date, viewMode),
    [date, viewMode],
  );

  const appointments = useQuery({
    queryKey: [
      "appointments",
      "calendar",
      business?.id,
      calendarRange.start,
      calendarRange.end,
      serviceFilter,
      resourceFilter,
      statusFilter,
    ],
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
    queryKey: [
      "available-slots",
      "calendar-day",
      business?.id,
      serviceFilter,
      resourceFilter,
      date,
    ],
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
    setSearchParams(
      (current) => {
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
      },
      { replace: true },
    );
  }, [
    date,
    resourceFilter,
    search,
    serviceFilter,
    setSearchParams,
    statusFilter,
    viewMode,
  ]);

  useEffect(() => {
    const appointment = deepLinkedAppointment.data;
    if (!appointment) return;
    setDate(
      dateInTimeZone(appointment.start_at, business?.timezone || "Asia/Almaty"),
    );
    setSelectedAppointmentId(appointment.id);
    setViewMode("day");
  }, [business?.timezone, deepLinkedAppointment.data]);

  function refreshAppointmentData(appointment?: Appointment) {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["available-slots"] });
    queryClient.invalidateQueries({ queryKey: ["activity-events"] });
    queryClient.invalidateQueries({ queryKey: ["crm-card"] });
    if (appointment)
      queryClient.invalidateQueries({
        queryKey: ["crm-card", "appointment", appointment.id],
      });
  }

  function setNotice(
    message: string | null,
    tone: "success" | "info" | "warning" | "danger" = "success",
  ) {
    if (!message) return;
    showNotification({ message, tone });
  }

  const mutation = useMutation({
    mutationFn: (payload: AppointmentCreatePayload) =>
      appointmentsApi.create(payload),
    onSuccess: (appointment) => {
      refreshAppointmentData(appointment);
      setBookingOpen(false);
      if (appointment.start_at)
        setDate(
          dateInTimeZone(
            appointment.start_at,
            business?.timezone || "Asia/Almaty",
          ),
        );
      setSelectedAppointmentId(appointment.id);
      setNotice(t("calendar.createdNotice"));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: number;
      status: Appointment["status"];
      reason?: string;
    }) => {
      if (status === "confirmed") return appointmentsApi.confirm(id);
      if (status === "cancelled")
        return appointmentsApi.cancel(id, { reason: reason || "" });
      if (status === "completed") return appointmentsApi.complete(id);
      if (status === "no_show")
        return appointmentsApi.noShow(id, { reason: reason || "" });
      return appointmentsApi.get(id);
    },
    onSuccess: (appointment) => {
      refreshAppointmentData(appointment);
      setStatusReasonTarget(null);
      setStatusReason("");
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: appointmentsApi.reschedule,
    onSuccess: (appointment) => {
      refreshAppointmentData(appointment);
      setDate(
        dateInTimeZone(
          appointment.start_at,
          business?.timezone || "Asia/Almaty",
        ),
      );
      setSelectedAppointmentId(appointment.id);
      setRescheduleTarget(null);
      setNotice(t("appointments.rescheduledNotice"));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      appointmentsApi.archive({ id, reason }),
    onSuccess: (appointment) => {
      refreshAppointmentData(appointment);
      setArchiveTarget(null);
      setArchiveReason("");
      setSelectedAppointmentId(null);
      setNotice(t("appointments.archive"));
    },
  });

  const quickHoursMutation = useMutation({
    mutationFn: () =>
      workingHoursApi.applyPreset({
        business: business!.id,
        preset: "daily_9_20",
      }),
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

  const actionError =
    statusMutation.error ||
    quickHoursMutation.error ||
    rescheduleMutation.error ||
    archiveMutation.error;
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
  const isCalendarDataLoading =
    appointments.isLoading ||
    clients.isLoading ||
    services.isLoading ||
    resources.isLoading ||
    leads.isLoading ||
    workingHours.isLoading;
  const locale = localeByLanguage[language];
  const businessTimeZone = normalizeTimeZone(
    business.timezone || "Asia/Almaty",
  );
  const todayValue = todayInTimeZone(businessTimeZone);
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
  const serviceById = new Map(
    serviceItems.map((service) => [service.id, service]),
  );
  const resourceById = new Map(
    resourceItems.map((resource) => [resource.id, resource]),
  );
  const leadById = new Map(leadItems.map((lead) => [lead.id, lead]));

  const appointmentList = appointmentItems.filter((item) => {
    const client = clientById.get(item.client);
    const service = serviceById.get(item.service);
    const resource = item.resource ? resourceById.get(item.resource) : null;
    const query = search.trim().toLowerCase();
    if (item.is_archived) return false;
    if (serviceFilter && item.service !== Number(serviceFilter)) return false;
    if (resourceFilter && item.resource !== Number(resourceFilter))
      return false;
    if (statusFilter && item.status !== statusFilter) return false;
    if (!query) return true;
    return [
      client?.full_name,
      service?.name,
      resource?.name,
      item.source,
      item.notes,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const weekDates = getWeekDates(date);
  const monthDates = getMonthDates(date);
  const dayAppointments = appointmentList
    .filter((item) => dateInTimeZone(item.start_at, businessTimeZone) === date)
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
  const weekKeys = new Set(weekDates.map(toDateInputValue));
  const weekAppointments = appointmentList
    .filter((item) =>
      weekKeys.has(dateInTimeZone(item.start_at, businessTimeZone)),
    )
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
  const dayTasks = taskItems.filter(
    (task) =>
      task.due_at &&
      dateInTimeZone(task.due_at, businessTimeZone) === date &&
      !["done", "cancelled"].includes(task.status),
  );
  const selectedAppointment =
    appointmentItems.find(
      (appointment) =>
        appointment.id === selectedAppointmentId && !appointment.is_archived,
    ) || null;
  const hasWorkingHours = Boolean(workingHourItems.length);
  const selectedResourceId = resourceFilter ? Number(resourceFilter) : null;
  const selectedDayHours = getWorkingHoursFor(
    workingHourItems,
    getWeekday(date),
    selectedResourceId,
  );
  const confirmedCount = dayAppointments.filter(
    (appointment) => appointment.status === "confirmed",
  ).length;
  const openSlotsFallback = Math.max(
    0,
    timelineHours.length - dayAppointments.length,
  );
  const openSlotsCount =
    serviceFilter && dayAvailableSlots.data
      ? dayAvailableSlots.data.length
      : openSlotsFallback;
  const openSlotsLabel = serviceFilter
    ? t("calendar.openSlots")
    : t("calendar.openSlotsEstimate");
  const timeZoneLabel = formatTimeZoneLabel(businessTimeZone);
  const selectedResource = resourceFilter
    ? resourceById.get(Number(resourceFilter))
    : null;
  const dayScheduleResource: CalendarResource = selectedResource
    ? { id: selectedResource.id, name: selectedResource.name }
    : {
        id: null,
        name: resourceItems.length
          ? t("calendar.allResources")
          : t("calendar.businessSchedule"),
      };

  function shiftDate(days: number) {
    setDate(shiftDateValue(date, days));
  }

  function selectAppointment(appointment: Appointment) {
    setSelectedAppointmentId(appointment.id);
    setMonthInspectorOpen(false);
    setDate(dateInTimeZone(appointment.start_at, businessTimeZone));
  }

  function openAppointmentWorkspace(appointment: Appointment) {
    navigate(`/app/calendar/${appointment.id}`);
  }

  function selectMonthDay(nextDate: string) {
    setDate(nextDate);
    setSelectedAppointmentId(null);
    setMonthInspectorOpen(true);
  }

  function openBookingForDate(
    nextDate = date,
    hour?: number,
    resource?: number | null,
  ) {
    setBookingPrefill({
      date: nextDate,
      hour,
      service: serviceFilter ? Number(serviceFilter) : undefined,
      resource:
        resource ?? (resourceFilter ? Number(resourceFilter) : undefined),
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
    if (
      appointment.status === "created" ||
      appointment.status === "rescheduled"
    )
      return ["confirmed", "cancelled"] as Appointment["status"][];
    if (appointment.status === "confirmed")
      return ["completed", "cancelled", "no_show"] as Appointment["status"][];
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

  const serviceFilterOptions = serviceItems.map((service) => ({
    value: String(service.id),
    label: service.name,
  }));
  const resourceFilterOptions = resourceItems.map((resource) => ({
    value: String(resource.id),
    label: resource.name,
  }));
  const activeFilterChips = [
    serviceFilter
      ? {
          key: "service",
          label:
            serviceById.get(Number(serviceFilter))?.name ||
            t("calendar.allServices"),
          clear: () => setServiceFilter(""),
        }
      : null,
    resourceFilter
      ? {
          key: "resource",
          label:
            resourceById.get(Number(resourceFilter))?.name ||
            t("calendar.allResources"),
          clear: () => setResourceFilter(""),
        }
      : null,
    statusFilter
      ? {
          key: "status",
          label: t(`status.${statusFilter}`),
          clear: () => setStatusFilter(""),
        }
      : null,
    search.trim()
      ? { key: "search", label: search.trim(), clear: () => setSearch("") }
      : null,
  ].filter(Boolean) as ActiveCalendarFilterChip[];

  function clearAllFilters() {
    setServiceFilter("");
    setResourceFilter("");
    setStatusFilter("");
    setSearch("");
  }

  return (
    <>
      <CalendarToolbar
        date={date}
        viewMode={viewMode}
        locale={locale}
        todayValue={todayValue}
        weekDays={weekDays}
        serviceFilter={serviceFilter}
        resourceFilter={resourceFilter}
        statusFilter={statusFilter}
        serviceOptions={serviceFilterOptions}
        resourceOptions={resourceFilterOptions}
        isServicesLoading={services.isLoading}
        isResourcesLoading={resources.isLoading}
        onDateChange={setDate}
        onViewModeChange={setViewMode}
        onShiftDate={shiftDate}
        onServiceChange={setServiceFilter}
        onResourceChange={setResourceFilter}
        onStatusChange={setStatusFilter}
        t={t}
      />

      {isCalendarDataLoading ? (
        <div className="mb-4">
          <LoadingState label={t("calendar.loadingInline")} />
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="overflow-hidden rounded-card border border-zani-border bg-zani-card shadow-sm lg:hidden">
          <div className="p-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-zani-muted">
                {t("calendar.mobileAgenda")}
              </p>
              <p className="mt-1 truncate text-lg font-bold text-zani-text">
                {formatPickerDate(date, locale)}
              </p>
              <p className="mt-1 text-sm font-bold text-zani-muted">
                {selectedDayHours && !selectedDayHours.is_day_off
                  ? `${selectedDayHours.start_time.slice(0, 5)}-${selectedDayHours.end_time.slice(0, 5)}`
                  : t("calendar.freeDay")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-zani-border border-y border-zani-border bg-surface-muted">
            {[
              [t("calendar.bookings"), dayAppointments.length],
              [openSlotsLabel, openSlotsCount],
              [t("calendar.tasksToday"), dayTasks.length],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 px-3 py-2">
                <p className="text-lg font-bold text-zani-text">{value}</p>
                <p className="truncate text-[11px] font-bold uppercase text-zani-muted">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-zani-border p-3">
            <Button
              type="button"
              className="w-full"
              onClick={() => openBookingForDate(date)}
            >
              <Plus size={16} />
              {t("calendar.newBooking")}
            </Button>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-control border border-zani-border bg-zani-card px-3 py-2 text-xs font-bold text-zani-text hover:bg-surface-hover"
              to="/app/working-hours"
            >
              {t("appointment.openHours")}
            </Link>
          </div>

          <div className="divide-y divide-zani-border">
            {dayAppointments.map((appointment) => (
              <CalendarAppointmentPreview
                key={appointment.id}
                appointment={appointment}
                compact
                selectedAppointmentId={selectedAppointmentId}
                clientById={clientById}
                serviceById={serviceById}
                resourceById={resourceById}
                locale={locale}
                businessTimeZone={businessTimeZone}
                onSelect={selectAppointment}
                onOpenCard={openAppointmentWorkspace}
                t={t}
              />
            ))}
            {dayTasks.map((task) => (
              <CalendarTaskPreview
                key={task.id}
                task={task}
                locale={locale}
                businessTimeZone={businessTimeZone}
                t={t}
              />
            ))}
            {!dayAppointments.length && !dayTasks.length ? (
              <button
                type="button"
                className="w-full px-4 py-5 text-left text-sm font-bold leading-6 text-zani-muted transition hover:bg-brand-50 hover:text-brand-700"
                onClick={() => openBookingForDate(date)}
              >
                {t("calendar.freeDayHint")}
              </button>
            ) : null}
          </div>
        </div>

        <div className="hidden min-w-0 overflow-visible rounded-card border border-zani-border bg-zani-card shadow-sm lg:block">
          <ActiveCalendarFilters
            chips={activeFilterChips}
            onClearAll={clearAllFilters}
            t={t}
          />
          {viewMode === "day" ? (
            <div className="overflow-y-visible">
              <div className="min-w-0">
                <div
                  className="sticky top-0 z-10 grid border-b border-zani-border bg-zani-card"
                  style={{ gridTemplateColumns: "72px minmax(0, 1fr)" }}
                >
                  <div className="bg-surface-muted p-3 text-xs font-bold uppercase text-zani-muted">
                    {timeZoneLabel}
                  </div>
                  <div className="border-l border-zani-border bg-zani-card p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-control text-xs font-bold",
                          getTone(0),
                        )}
                      >
                        {getInitials(dayScheduleResource.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-zani-text">
                          {t("calendar.daySchedule")}
                        </p>
                        <p className="text-xs font-bold text-zani-muted">
                          {formatWorkingHoursLabel(
                            workingHourItems,
                            date,
                            dayScheduleResource.id,
                            t("calendar.freeDay"),
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="relative grid"
                  style={{
                    gridTemplateColumns: "72px minmax(0, 1fr)",
                    height: `${(dayEndHour - dayStartHour) * hourHeight}px`,
                  }}
                >
                  <div className="relative border-r border-zani-border bg-surface-muted">
                    {timelineHours.slice(0, -1).map((hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-zani-border px-3 pt-2 text-xs font-bold text-zani-muted"
                        style={{
                          top: `${(hour - dayStartHour) * hourHeight}px`,
                        }}
                      >
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                  <div className="relative border-l border-zani-border">
                    {timelineHours.slice(0, -1).map((hour) => {
                      const isWorking = isWorkingHourSlot(
                        workingHourItems,
                        date,
                        hour,
                        dayScheduleResource.id,
                      );
                      return (
                        <button
                          key={hour}
                          type="button"
                          disabled={!isWorking}
                          className={cn(
                            "absolute left-0 right-0 border-t border-zani-border text-left transition",
                            isWorking
                              ? "hover:bg-brand-50"
                              : "cursor-not-allowed bg-surface-muted opacity-70",
                          )}
                          style={{
                            top: `${(hour - dayStartHour) * hourHeight}px`,
                            height: `${hourHeight}px`,
                          }}
                          onClick={() =>
                            isWorking &&
                            openBookingForDate(
                              date,
                              hour,
                              dayScheduleResource.id,
                            )
                          }
                          aria-label={t("calendar.createAtHour", {
                            hour: String(hour).padStart(2, "0"),
                          })}
                        />
                      );
                    })}
                    {dayAppointments.map((appointment, index) => {
                      const client = clientById.get(appointment.client);
                      const service = serviceById.get(appointment.service);
                      const resource = appointment.resource
                        ? resourceById.get(appointment.resource)
                        : null;
                      const metrics = getAppointmentMetrics(
                        appointment,
                        businessTimeZone,
                      );
                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          className={cn(
                            "group absolute left-2 right-2 overflow-visible rounded-control border-l-4 border-t border-r border-b px-3 py-2 text-left shadow-sm transition hover:z-30 hover:shadow-md",
                            getTone(index),
                            selectedAppointment?.id === appointment.id &&
                              "border-brand-500 bg-brand-50 shadow-md",
                          )}
                          style={{
                            top: `${metrics.top + 6}px`,
                            height: `${metrics.height - 8}px`,
                          }}
                          onClick={() => selectAppointment(appointment)}
                          onDoubleClick={() =>
                            openAppointmentWorkspace(appointment)
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold leading-4">
                              {formatTime(
                                appointment.start_at,
                                locale,
                                businessTimeZone,
                              )}
                              -
                              {formatTime(
                                appointment.end_at,
                                locale,
                                businessTimeZone,
                              )}
                            </p>
                            <MoreHorizontal size={14} className="shrink-0" />
                          </div>
                          <p className="mt-1 truncate text-sm font-bold leading-4">
                            {client?.full_name || t("common.client")}
                          </p>
                          {metrics.height > 62 ? (
                            <p className="mt-1 truncate text-xs font-bold opacity-75">
                              {service?.name || t("common.service")}
                              {resource ? ` · ${resource.name}` : ""}
                            </p>
                          ) : null}
                          <div className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-50 hidden w-72 rounded-card border border-zani-border bg-zani-card p-3 text-zani-text shadow-premium group-hover:block">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-zani-text">
                                  {client?.full_name || t("common.client")}
                                </p>
                                <p className="mt-1 text-xs font-bold text-zani-muted">
                                  {formatTime(
                                    appointment.start_at,
                                    locale,
                                    businessTimeZone,
                                  )}
                                  -
                                  {formatTime(
                                    appointment.end_at,
                                    locale,
                                    businessTimeZone,
                                  )}
                                </p>
                              </div>
                              <StatusBadge status={appointment.status} />
                            </div>
                            <div className="mt-3 space-y-1 text-xs font-bold text-zani-muted">
                              <p className="truncate">
                                {service?.name || t("common.service")}
                              </p>
                              <p className="truncate">
                                {resource?.name || t("appointment.noResource")}
                              </p>
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
                <div
                  className="sticky top-0 z-10 grid border-b border-zani-border bg-zani-card"
                  style={{
                    gridTemplateColumns: "72px repeat(7, minmax(128px, 1fr))",
                  }}
                >
                  <div className="bg-surface-muted p-3 text-xs font-bold uppercase text-zani-muted">
                    {timeZoneLabel}
                  </div>
                  {weekDates.map((day) => {
                    const key = toDateInputValue(day);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={cn(
                          "border-l border-zani-border p-3 text-left",
                          key === date ? "bg-brand-50" : "bg-zani-card",
                        )}
                        onClick={() => setDate(key)}
                      >
                        <p className="text-xs font-bold uppercase text-zani-muted">
                          {weekDays[(day.getDay() + 6) % 7]}
                        </p>
                        <p className="mt-1 text-lg font-bold text-zani-text">
                          {day.getDate()}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div
                  className="relative grid"
                  style={{
                    gridTemplateColumns: "72px repeat(7, minmax(128px, 1fr))",
                    height: `${(dayEndHour - dayStartHour) * hourHeight}px`,
                  }}
                >
                  <div className="relative border-r border-zani-border bg-surface-muted">
                    {timelineHours.slice(0, -1).map((hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-zani-border px-3 pt-2 text-xs font-bold text-zani-muted"
                        style={{
                          top: `${(hour - dayStartHour) * hourHeight}px`,
                        }}
                      >
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                  {weekDates.map((day) => {
                    const key = toDateInputValue(day);
                    const items = weekAppointments.filter(
                      (appointment) =>
                        dateInTimeZone(
                          appointment.start_at,
                          businessTimeZone,
                        ) === key,
                    );
                    return (
                      <div
                        key={key}
                        className={cn(
                          "relative border-l border-zani-border",
                          key === date && "bg-brand-50",
                        )}
                      >
                        {timelineHours.slice(0, -1).map((hour) => {
                          const isWorking = isWorkingHourSlot(
                            workingHourItems,
                            key,
                            hour,
                            null,
                          );
                          return (
                            <button
                              key={hour}
                              type="button"
                              disabled={!isWorking}
                              className={cn(
                                "absolute left-0 right-0 border-t border-zani-border transition",
                                isWorking
                                  ? "hover:bg-brand-50"
                                  : "cursor-not-allowed bg-surface-muted opacity-70",
                              )}
                              style={{
                                top: `${(hour - dayStartHour) * hourHeight}px`,
                                height: `${hourHeight}px`,
                              }}
                              onClick={() =>
                                isWorking && openBookingForDate(key, hour)
                              }
                              aria-label={t("calendar.createAtHour", {
                                hour: String(hour).padStart(2, "0"),
                              })}
                            />
                          );
                        })}
                        {items.map((appointment, index) => {
                          const client = clientById.get(appointment.client);
                          const service = serviceById.get(appointment.service);
                          const metrics = getAppointmentMetrics(
                            appointment,
                            businessTimeZone,
                          );
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              className={cn(
                                "group absolute left-1 right-1 overflow-visible rounded-control border-l-4 border-t border-r border-b px-2 py-1 text-left text-xs shadow-sm hover:z-30 hover:shadow-md",
                                getTone(index),
                                selectedAppointment?.id === appointment.id &&
                                  "border-brand-500 bg-brand-50 shadow-md",
                              )}
                              style={{
                                top: `${metrics.top + 4}px`,
                                height: `${Math.max(34, metrics.height - 8)}px`,
                              }}
                              onClick={() => selectAppointment(appointment)}
                            >
                              <p className="font-bold">
                                {formatTime(
                                  appointment.start_at,
                                  locale,
                                  businessTimeZone,
                                )}
                              </p>
                              <p className="truncate font-bold">
                                {client?.full_name || t("common.client")}
                              </p>
                              <div className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-50 hidden w-64 rounded-card border border-zani-border bg-zani-card p-3 text-zani-text shadow-premium group-hover:block">
                                <p className="truncate text-sm font-bold text-zani-text">
                                  {client?.full_name || t("common.client")}
                                </p>
                                <p className="mt-1 text-xs font-bold text-zani-muted">
                                  {formatTime(
                                    appointment.start_at,
                                    locale,
                                    businessTimeZone,
                                  )}
                                  -
                                  {formatTime(
                                    appointment.end_at,
                                    locale,
                                    businessTimeZone,
                                  )}
                                </p>
                                <p className="mt-2 truncate text-xs font-bold text-zani-muted">
                                  {service?.name || t("common.service")}
                                </p>
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
              <div className="grid grid-cols-7 border-b border-zani-border">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="bg-surface-muted p-3 text-center text-xs font-bold uppercase text-zani-muted"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 bg-zani-border">
                {monthDates.map((day, index) => {
                  const key = day ? toDateInputValue(day) : `empty-${index}`;
                  const items = day
                    ? appointmentList.filter(
                        (appointment) =>
                          dateInTimeZone(
                            appointment.start_at,
                            businessTimeZone,
                          ) === key,
                      )
                    : [];
                  const isSelectedDay = day && key === date;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "relative min-h-28 bg-zani-card p-3 text-left transition",
                        !day && "bg-surface-muted",
                        isSelectedDay
                          ? "bg-brand-50 ring-2 ring-inset ring-brand-500"
                          : day && "hover:bg-brand-50",
                      )}
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
                          <span className="text-sm font-bold text-zani-text">
                            {day.getDate()}
                          </span>
                          {isSelectedDay ? (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">
                              {t("calendar.selectedDay")}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="relative z-20 mt-2 space-y-1">
                        {items.slice(0, 3).map((appointment) => {
                          const client = clientById.get(appointment.client);
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              className="w-full truncate rounded-control border border-brand-100 bg-zani-card px-2 py-1 text-left text-xs font-bold text-brand-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectAppointment(appointment);
                              }}
                            >
                              {formatTime(
                                appointment.start_at,
                                locale,
                                businessTimeZone,
                              )}{" "}
                              {client?.full_name || t("common.client")}
                            </button>
                          );
                        })}
                        {items.length > 3 ? (
                          <p className="text-xs font-bold text-zani-muted">
                            +{items.length - 3}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {viewMode === "list" ? (
            <div className="divide-y divide-zani-border">
              {dayAppointments.map((appointment) => {
                const client = clientById.get(appointment.client);
                const service = serviceById.get(appointment.service);
                const resource = appointment.resource
                  ? resourceById.get(appointment.resource)
                  : null;
                return (
                  <div
                    key={appointment.id}
                    className={cn(
                      "grid gap-3 p-4 transition hover:bg-surface-hover lg:grid-cols-[170px_minmax(0,1.2fr)_minmax(0,1fr)_180px]",
                      selectedAppointment?.id === appointment.id &&
                        "bg-brand-50",
                    )}
                  >
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => selectAppointment(appointment)}
                    >
                      <p className="text-sm font-bold text-zani-text">
                        {formatCalendarDateTime(
                          appointment.start_at,
                          locale,
                          businessTimeZone,
                        )}
                      </p>
                      <p className="mt-1 text-xs font-bold text-zani-muted">
                        {formatTime(
                          appointment.start_at,
                          locale,
                          businessTimeZone,
                        )}
                        -
                        {formatTime(
                          appointment.end_at,
                          locale,
                          businessTimeZone,
                        )}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => selectAppointment(appointment)}
                    >
                      <p className="truncate text-sm font-bold text-zani-text">
                        {client?.full_name || t("common.client")}
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-zani-muted">
                        {service?.name || t("common.service")}
                      </p>
                    </button>
                    <div className="min-w-0 text-sm font-bold text-zani-muted">
                      <p className="truncate">
                        {resource?.name || t("calendar.noResource")}
                      </p>
                      <p className="mt-1 truncate text-xs text-zani-muted">
                        {appointment.source}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={appointment.status} />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openAppointmentWorkspace(appointment)}
                      >
                        {t("appointments.card")}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!dayAppointments.length ? (
                <button
                  type="button"
                  className="w-full p-8 text-left text-sm font-bold text-zani-muted transition hover:bg-brand-50 hover:text-brand-700"
                  onClick={() => openBookingForDate(date)}
                >
                  {t("calendar.freeDayHint")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {viewMode === "month" && monthInspectorOpen && !selectedAppointment ? (
          <MonthInspectorPanel
            date={date}
            locale={locale}
            businessTimeZone={businessTimeZone}
            selectedDayHours={selectedDayHours}
            dayAppointments={dayAppointments}
            dayTasks={dayTasks}
            openSlotsLabel={openSlotsLabel}
            openSlotsCount={openSlotsCount}
            selectedAppointmentId={selectedAppointmentId}
            clientById={clientById}
            serviceById={serviceById}
            resourceById={resourceById}
            onClose={() => setMonthInspectorOpen(false)}
            onOpenBooking={openBookingForDate}
            onOpenDay={() => {
              setMonthInspectorOpen(false);
              setViewMode("day");
            }}
            onSelectAppointment={selectAppointment}
            onOpenAppointmentCard={openAppointmentWorkspace}
            t={t}
          />
        ) : null}

        {selectedAppointment ? (
          <AppointmentDrawerPanel
            appointment={selectedAppointment}
            clientById={clientById}
            serviceById={serviceById}
            resourceById={resourceById}
            leadById={leadById}
            locale={locale}
            businessTimeZone={businessTimeZone}
            statusMutationPending={statusMutation.isPending}
            getAppointmentActionLabel={getAppointmentActionLabel}
            getAllowedStatusActions={getAllowedStatusActions}
            canRescheduleAppointment={canRescheduleAppointment}
            shouldShowRepeatBooking={shouldShowRepeatBooking}
            onClose={() => setSelectedAppointmentId(null)}
            onRepeatBooking={openRepeatBooking}
            onStatusAction={(appointment, status) => {
              if (status === "cancelled" || status === "no_show") {
                setStatusReasonTarget({ appointment, status });
                setStatusReason("");
                return;
              }
              statusMutation.mutate({ id: appointment.id, status });
            }}
            onReschedule={setRescheduleTarget}
            onOpenCard={openAppointmentWorkspace}
            onArchive={setArchiveTarget}
            t={t}
          />
        ) : null}
      </section>

      {mutation.error ? (
        <div className="mt-4">
          <ErrorState message={getApiErrorMessage(mutation.error)} />
        </div>
      ) : null}

      <Modal
        title={t("calendar.newBooking")}
        open={bookingOpen}
        onClose={() => {
          setBookingOpen(false);
          setBookingPrefill(null);
        }}
      >
        <AppointmentForm
          businessId={business.id}
          clients={clientItems}
          services={serviceItems}
          resources={resourceItems}
          leads={leadItems}
          prefill={bookingPrefill || { date }}
          onSubmit={(payload) => mutation.mutateAsync(payload)}
          timeZone={businessTimeZone}
        />
      </Modal>
      <Modal
        title={t("appointments.rescheduleTitle")}
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
      >
        {rescheduleTarget ? (
          <AppointmentRescheduleForm
            appointment={rescheduleTarget}
            businessId={business.id}
            resources={resourceItems}
            onCancel={() => setRescheduleTarget(null)}
            onSubmit={(payload) =>
              rescheduleMutation.mutateAsync({
                id: rescheduleTarget.id,
                payload,
              })
            }
            isSubmitting={rescheduleMutation.isPending}
            timeZone={businessTimeZone}
          />
        ) : null}
      </Modal>
      <Modal
        title={t("appointments.statusReasonTitle")}
        open={Boolean(statusReasonTarget)}
        onClose={() => {
          setStatusReasonTarget(null);
          setStatusReason("");
        }}
      >
        <div className="space-y-4">
          <Input
            label={t("appointments.statusReason")}
            value={statusReason}
            onChange={(event) => setStatusReason(event.target.value)}
            placeholder={t("appointments.statusReasonPlaceholder")}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStatusReasonTarget(null);
                setStatusReason("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant={
                statusReasonTarget?.status === "cancelled"
                  ? "danger"
                  : "primary"
              }
              isLoading={statusMutation.isPending}
              disabled={!statusReason.trim()}
              onClick={() => {
                if (!statusReasonTarget) return;
                statusMutation.mutate({
                  id: statusReasonTarget.appointment.id,
                  status: statusReasonTarget.status,
                  reason: statusReason.trim(),
                });
              }}
            >
              {statusReasonTarget
                ? getAppointmentActionLabel(statusReasonTarget.status)
                : t("appointments.actions")}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        title={t("appointments.archive")}
        open={Boolean(archiveTarget)}
        onClose={() => {
          setArchiveTarget(null);
          setArchiveReason("");
        }}
      >
        <div className="space-y-4">
          <Input
            label={t("appointments.archiveReason")}
            value={archiveReason}
            onChange={(event) => setArchiveReason(event.target.value)}
            placeholder={t("appointments.archiveReasonPlaceholder")}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setArchiveTarget(null);
                setArchiveReason("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={archiveMutation.isPending}
              onClick={() => {
                if (!archiveTarget) return;
                archiveMutation.mutate({
                  id: archiveTarget.id,
                  reason:
                    archiveReason.trim() ||
                    t("appointments.archiveReasonDefault"),
                });
              }}
            >
              {t("appointments.archive")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
