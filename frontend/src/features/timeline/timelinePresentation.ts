import type { TimelineFilters } from "../../types/timeline";

export function readTimelineFilters(params: URLSearchParams): TimelineFilters {
  const page = Number(params.get("page"));
  const size = Number(params.get("page_size"));
  return {
    search: params.get("search") || "",
    category: params.get("category") || "",
    actor: params.get("actor") || "",
    date_from: params.get("date_from") || "",
    date_to: params.get("date_to") || "",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    page_size: [10, 20, 30, 50, 100].includes(size) ? size : 20,
  };
}

// Deliberately do not pass free-form reason/error/source/provider/ID fields to
// timelineDetails. Redacting suspicious strings alone is not a safe allowlist.
export function safeTimelineMetadata(metadata: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  const statuses = new Set([
    "new",
    "open",
    "in_progress",
    "done",
    "completed",
    "cancelled",
    "active",
    "inactive",
    "won",
    "lost",
    "scheduled",
    "confirmed",
    "no_show",
    "pending",
    "sent",
    "failed",
    "paused",
    "draft",
    "ready",
    "closed",
  ]);
  for (const key of ["amount_before", "amount_after"]) {
    const value = metadata[key];
    if (
      (typeof value === "number" ||
        (typeof value === "string" && /^-?\d+(\.\d{1,4})?$/.test(value))) &&
      Number.isFinite(Number(value))
    )
      safe[key] = value;
  }
  for (const key of ["previous_start_at", "current_start_at", "start_at"]) {
    const value = metadata[key];
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T[\d:.+Z-]+$/.test(value) &&
      Number.isFinite(Date.parse(value))
    )
      safe[key] = value;
  }
  for (const key of ["from_status", "to_status"]) {
    if (
      typeof metadata[key] === "string" &&
      statuses.has(metadata[key] as string)
    )
      safe[key] = metadata[key];
  }
  return safe;
}

export function timelineDate(
  value: string,
  language: string,
  timeZone: string,
  timeOnly = false,
) {
  const stamp = new Date(value);
  if (!Number.isFinite(stamp.getTime())) return "—";
  // Numeric KK month also works in Chromium builds with partial locale data.
  const options: Intl.DateTimeFormatOptions = timeOnly
    ? { hour: "2-digit", minute: "2-digit" }
    : {
        day: "numeric",
        month: language === "kk" ? "2-digit" : "long",
        year: "numeric",
      };
  try {
    return new Intl.DateTimeFormat(
      language === "kk" ? "kk-KZ" : language === "en" ? "en-GB" : "ru-RU",
      { ...options, timeZone },
    ).format(stamp);
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      ...options,
      timeZone: "UTC",
    }).format(stamp);
  }
}

export function timelineSummary(eventType: string, t: (key: string) => string) {
  const key = `crmCard.timelineEvent.${eventType}`;
  const label = t(key);
  return label !== key ? label : t("timeline.otherEvent");
}

export function timelineDetailTransitions(
  metadata: Record<string, unknown>,
  language: string,
  timeZone: string,
  t: (key: string) => string,
) {
  const safe = safeTimelineMetadata(metadata);
  const translatedStatus = (value: unknown) => {
    if (typeof value !== "string") return "";
    const key = `status.${value}`;
    return t(key) !== key ? t(key) : "";
  };
  const date = (value: unknown) =>
    typeof value === "string"
      ? `${timelineDate(value, language, timeZone)} · ${timelineDate(value, language, timeZone, true)}`
      : "";
  const amount = (value: unknown) =>
    value === undefined
      ? ""
      : new Intl.NumberFormat(
          language === "kk" ? "kk-KZ" : language === "en" ? "en-GB" : "ru-RU",
        ).format(Number(value));
  return [
    {
      label: t("crmCard.timelineFieldStatus"),
      from: translatedStatus(safe.from_status),
      to: translatedStatus(safe.to_status),
    },
    {
      label: t("crmCard.timelineFieldTime"),
      from: date(safe.previous_start_at),
      to: date(safe.current_start_at ?? safe.start_at),
    },
    {
      label: t("crmCard.timelineFieldAmount"),
      from: amount(safe.amount_before),
      to: amount(safe.amount_after),
    },
  ]
    .filter((detail) => detail.from || detail.to)
    .map(({ label, from, to }) => ({
      label,
      value: `${from || "—"} → ${to || "—"}`,
    }));
}

export const timelineEntityRoutes: Record<
  string,
  { path: string; permission: string; label: string }
> = {
  client: {
    path: "clients",
    permission: "clients",
    label: "crmCard.timelineFieldClient",
  },
  lead: {
    path: "leads",
    permission: "leads",
    label: "crmCard.timelineFieldLead",
  },
  deal: {
    path: "deals",
    permission: "deals",
    label: "crmCard.timelineFieldDeal",
  },
  task: {
    path: "tasks",
    permission: "tasks",
    label: "crmCard.timelineFieldTask",
  },
  appointment: {
    path: "calendar",
    permission: "appointments",
    label: "crmCard.timelineFieldAppointment",
  },
  conversation: {
    path: "conversations",
    permission: "conversations",
    label: "crmCard.timelineFieldConversation",
  },
};
