import type { Task } from "../../types";
import type { ClientTableRow, Translate } from "./types";

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

export function money(value: string | number, currency = "KZT") {
  return `${Number(value || 0).toLocaleString("ru-RU")} ${currency}`;
}

export function latestDate(values: Array<string | null | undefined>) {
  const timestamps = values.filter(Boolean).map((value) => String(value));
  if (!timestamps.length) return null;
  return timestamps.sort((a, b) => b.localeCompare(a))[0] || null;
}

export function statusMeta(status: ClientTableRow["status"]) {
  const map = {
    active: { label: "Активный", className: "bg-emerald-50 text-emerald-700 before:bg-emerald-500" },
    new: { label: "Новый", className: "bg-blue-50 text-blue-700 before:bg-blue-500" },
    vip: { label: "VIP", className: "bg-violet-50 text-violet-700 before:bg-violet-500" },
    no_reply: { label: "Без ответа", className: "bg-amber-50 text-amber-700 before:bg-amber-500" },
    archived: { label: "Архив", className: "bg-slate-100 text-slate-600 before:bg-slate-400" },
  } satisfies Record<ClientTableRow["status"], { label: string; className: string }>;
  return map[status];
}

export function priorityLabel(priority?: Task["priority"]) {
  const labels: Record<Task["priority"], string> = {
    low: "Низкий",
    normal: "Обычный",
    high: "Высокий",
    urgent: "Срочный",
  };
  return priority ? labels[priority] : null;
}
