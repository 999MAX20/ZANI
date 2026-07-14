export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function dateInTimeZone(value: Date | string, timeZone = "UTC") {
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

export function todayInTimeZone(timeZone = "UTC") {
  return dateInTimeZone(new Date(), timeZone);
}

export function hourInTimeZone(value: Date | string, timeZone = "UTC") {
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

export function minutesInTimeZone(value: Date | string, timeZone = "UTC") {
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
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
