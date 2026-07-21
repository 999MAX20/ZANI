import { dayStartHour, hourHeight, viewModes } from "./calendarConstants";
import { minutesInTimeZone } from "../../lib/format";
import type { CalendarViewMode } from "./calendarTypes";
import type { Appointment, WorkingHours } from "../../types";

export function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDateValue(value: string, days: number) {
  const nextDate = parseDate(value);
  nextDate.setDate(nextDate.getDate() + days);
  return toDateInputValue(nextDate);
}

export function isDateValue(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateInputValue(parseDate(value)) === value;
}

export function getQueryDate(value: string | null, fallback: string) {
  return isDateValue(value) ? value! : fallback;
}

export function getQueryView(value: string | null): CalendarViewMode {
  return viewModes.includes(value as CalendarViewMode) ? value as CalendarViewMode : "day";
}

export function normalizeTimeZone(value?: string | null) {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

export function formatPickerDate(value: string, locale: string) {
  const date = parseDate(value);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export function getWeekDates(value: string) {
  const selected = parseDate(value);
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

export function getMonthDates(value: string) {
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

export function getCalendarRange(value: string, viewMode: CalendarViewMode) {
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

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function getMinutes(value: string, timeZone: string) {
  return minutesInTimeZone(value, timeZone);
}

export function timeStringToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getWeekday(value: string) {
  return (parseDate(value).getDay() + 6) % 7;
}

export function getWorkingHoursFor(rows: WorkingHours[], weekday: number, resourceId: number | null) {
  const resourceHours = resourceId ? rows.find((row) => row.resource === resourceId && row.weekday === weekday) : null;
  return resourceHours || rows.find((row) => !row.resource && row.weekday === weekday) || null;
}

export function isWorkingHourSlot(rows: WorkingHours[], dateValue: string, hour: number, resourceId: number | null) {
  const hours = getWorkingHoursFor(rows, getWeekday(dateValue), resourceId);
  if (!hours || hours.is_day_off) return false;
  const hourStart = hour * 60;
  return hourStart >= timeStringToMinutes(hours.start_time) && hourStart < timeStringToMinutes(hours.end_time);
}

export function formatWorkingHoursLabel(rows: WorkingHours[], dateValue: string, resourceId: number | null, fallback: string) {
  const hours = getWorkingHoursFor(rows, getWeekday(dateValue), resourceId);
  if (!hours || hours.is_day_off) return fallback;
  return `${hours.start_time.slice(0, 5)}-${hours.end_time.slice(0, 5)}`;
}

export function formatTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));
}

export function formatCalendarDateTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export function formatTimeZoneLabel(timeZone: string) {
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

export function getAppointmentMetrics(appointment: Appointment, timeZone: string) {
  const start = getMinutes(appointment.start_at, timeZone);
  const end = Math.max(start + 30, getMinutes(appointment.end_at, timeZone));
  const top = Math.max(0, ((start - dayStartHour * 60) / 60) * hourHeight);
  const height = Math.max(58, ((end - start) / 60) * hourHeight);
  return { top, height };
}

export function getTone(index: number) {
  const tones = [
    "border-sky-200 bg-sky-50 text-sky-950",
    "border-emerald-200 bg-emerald-50 text-emerald-950",
    "border-violet-200 bg-violet-50 text-violet-950",
    "border-amber-200 bg-amber-50 text-amber-950",
    "border-rose-200 bg-rose-50 text-rose-950",
  ];
  return tones[index % tones.length];
}
