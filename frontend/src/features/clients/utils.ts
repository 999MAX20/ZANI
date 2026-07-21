import type { Task } from "../../types";
import type { ClientTableRow, Translate } from "./types";

export const CLIENT_SOURCE_VALUES = ["website", "landing", "telegram", "whatsapp", "instagram", "manual", "parser", "other"] as const;
export type ClientSourceValue = (typeof CLIENT_SOURCE_VALUES)[number];

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "C"
  );
}

export function sourceLabel(source: string | undefined, t: Translate) {
  const labels: Record<string, string> = {
    website: "clients.sourceWebsite",
    landing: "clients.sourceLanding",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    manual: "clients.sourceManual",
    parser: "clients.sourceParser",
    other: "clients.sourceOther",
  };
  const label = labels[source || ""];
  return label ? t(label) : source || t("clients.sourceOther");
}

export const clientSourceOptions = [
  { value: "", label: "clients.allSources" },
  { value: "website", label: "clients.sourceWebsite" },
  { value: "landing", label: "clients.sourceLanding" },
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "manual", label: "clients.sourceManual" },
  { value: "parser", label: "clients.sourceParser" },
  { value: "other", label: "clients.sourceOther" },
] as const;

export function money(value: string | number, currency = "KZT") {
  return `${Number(value || 0).toLocaleString("ru-RU")} ${currency}`;
}

export function parseClientDate(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function latestDate(values: Array<string | null | undefined>) {
  const parsed = values
    .map((value) => {
      const timestamp = parseClientDate(value);
      return timestamp === null ? null : { value, timestamp };
    })
    .filter((item): item is { value: string; timestamp: number } => item !== null);

  if (!parsed.length) return null;
  parsed.sort((a, b) => b.timestamp - a.timestamp);
  return parsed[0]?.value || null;
}

export function compareDescDate(a: string | null | undefined, b: string | null | undefined) {
  const aTs = parseClientDate(a);
  const bTs = parseClientDate(b);
  if (aTs === null && bTs === null) return 0;
  if (aTs === null) return 1;
  if (bTs === null) return -1;
  return bTs - aTs;
}

export function statusMeta(status: ClientTableRow["status"], t: Translate) {
  const map = {
    active: { label: t("clients.statusActive"), className: "bg-emerald-50 text-emerald-700 before:bg-emerald-500" },
    new: { label: t("clients.statusNew"), className: "bg-indigo-50 text-indigo-700 before:bg-indigo-500" },
    vip: { label: "VIP", className: "bg-purple-50 text-purple-700 before:bg-purple-500" },
    no_reply: { label: t("clients.statusNoReply"), className: "bg-orange-50 text-orange-700 before:bg-orange-500" },
    archived: { label: t("clients.archive"), className: "bg-slate-100 text-slate-600 before:bg-slate-400" },
  } satisfies Record<ClientTableRow["status"], { label: string; className: string }>;
  return map[status];
}

export function priorityLabel(priority: Task["priority"] | undefined, t: Translate) {
  const labels: Record<Task["priority"], string> = {
    low: t("notification.priority.low"),
    normal: t("notification.priority.normal"),
    high: t("notification.priority.high"),
    urgent: t("notification.priority.urgent"),
  };
  return priority ? labels[priority] : null;
}
