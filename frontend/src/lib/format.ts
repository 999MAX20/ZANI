let activeBusinessTimeZone = "UTC";

export function setActiveBusinessTimeZone(timeZone?: string | null) {
  activeBusinessTimeZone = timeZone || "UTC";
}

export function formatDateTime(value?: string | null, timeZone = activeBusinessTimeZone) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export function formatDate(value?: string | null, timeZone = activeBusinessTimeZone) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

export function formatMoney(value?: string | number | null, currency = "KZT") {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function todayISO() {
  return dateInTimeZone(new Date(), activeBusinessTimeZone);
}

export function dateInTimeZone(value: Date | string, timeZone = activeBusinessTimeZone) {
  const date = typeof value === "string" ? new Date(value) : value;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
  }
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function todayInTimeZone(timeZone = activeBusinessTimeZone) {
  return dateInTimeZone(new Date(), timeZone);
}

export function hourInTimeZone(value: Date | string, timeZone = activeBusinessTimeZone) {
  const date = typeof value === "string" ? new Date(value) : value;
  let hour: string;
  try {
    hour = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    hour = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      hour12: false,
    }).format(date);
  }
  return Number(hour === "24" ? "0" : hour);
}

export function minutesInTimeZone(value: Date | string, timeZone = activeBusinessTimeZone) {
  const date = typeof value === "string" ? new Date(value) : value;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  }
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "0";
  const hour = Number(part("hour") === "24" ? "0" : part("hour"));
  return hour * 60 + Number(part("minute"));
}

export function tomorrowISO() {
  const today = todayInTimeZone(activeBusinessTimeZone);
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}
