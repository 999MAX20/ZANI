import {
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  PlugZap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatDateTime } from "../../../lib/format";
import type { ActivityEvent } from "../../../types";

export type TimelineCategoryConfig = {
  icon: LucideIcon;
  labelKey: string;
  iconClassName: string;
  badgeClassName: string;
};

export type TimelineDetail = {
  label: string;
  value: string;
};

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const categoryConfig: Record<ActivityEvent["category"], TimelineCategoryConfig> = {
  crm: {
    icon: ClipboardList,
    labelKey: "crmCard.timelineCategoryCrm",
    iconClassName: "bg-brand-50 text-brand-700",
    badgeClassName: "bg-brand-50 text-brand-700",
  },
  message: {
    icon: MessageCircle,
    labelKey: "crmCard.timelineCategoryMessage",
    iconClassName: "bg-sky-50 text-sky-700",
    badgeClassName: "bg-sky-50 text-sky-700",
  },
  appointment: {
    icon: CalendarClock,
    labelKey: "crmCard.timelineCategoryAppointment",
    iconClassName: "bg-emerald-50 text-emerald-700",
    badgeClassName: "bg-emerald-50 text-emerald-700",
  },
  task: {
    icon: CheckCircle2,
    labelKey: "crmCard.timelineCategoryTask",
    iconClassName: "bg-amber-50 text-amber-700",
    badgeClassName: "bg-amber-50 text-amber-700",
  },
  automation: {
    icon: Bot,
    labelKey: "crmCard.timelineCategoryAutomation",
    iconClassName: "bg-violet-50 text-violet-700",
    badgeClassName: "bg-violet-50 text-violet-700",
  },
  system: {
    icon: PlugZap,
    labelKey: "crmCard.timelineCategorySystem",
    iconClassName: "bg-slate-100 text-slate-700",
    badgeClassName: "bg-slate-100 text-slate-700",
  },
};

const metadataIdFields = new Set([
  "appointment_id",
  "business_event_id",
  "client_id",
  "connector_id",
  "conversation_id",
  "current_resource_id",
  "deal_id",
  "from_assignee",
  "from_stage",
  "from_stage_id",
  "lead_id",
  "message_id",
  "note_id",
  "previous_resource_id",
  "resource_id",
  "submission",
  "target_id",
  "task_id",
  "to_assignee",
  "to_stage",
  "to_stage_id",
]);

const metadataTokenFields = new Set([
  "action_type",
  "channel",
  "event_type",
  "from",
  "from_status",
  "integration_event_type",
  "kind",
  "lifecycle_action",
  "source_event_type",
  "status",
  "target_type",
  "to",
  "to_status",
  "tool_name",
]);

function localeFor(language: string) {
  if (language === "kk") return "kk-KZ";
  if (language === "en") return "en-US";
  return "ru-RU";
}

export function formatToken(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scalarValue(value: unknown): string | number | boolean | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function formatMetadataValue(key: string, value: unknown, t: Translate) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    const values = value
      .map((item) => scalarValue(item))
      .filter((item): item is string | number | boolean => item !== null)
      .slice(0, 4)
      .map((item) => String(item));
    return values.join(", ");
  }

  const scalar = scalarValue(value);
  if (scalar === null) return "";
  if (typeof scalar === "boolean") return scalar ? t("crmCard.yes") : t("crmCard.no");

  const text = String(scalar);
  if (metadataIdFields.has(key)) return `#${text}`;
  if (key.endsWith("_at") || key.includes("start_at") || key.includes("end_at")) return formatDateTime(text);
  if (metadataTokenFields.has(key)) return formatToken(text);
  return text;
}

function addDetail(details: TimelineDetail[], label: string, value: string) {
  if (!value) return;
  if (details.some((detail) => detail.label === label && detail.value === value)) return;
  details.push({ label, value });
}

function addTransition(details: TimelineDetail[], label: string, fromValue: string, toValue: string) {
  if (!fromValue && !toValue) return;
  addDetail(details, label, `${fromValue || "-"} -> ${toValue || "-"}`);
}

export function timelineDetails(event: ActivityEvent, t: Translate) {
  const metadata = isRecord(event.metadata) ? event.metadata : {};
  const details: TimelineDetail[] = [];

  addDetail(details, t("crmCard.timelineFieldAction"), formatMetadataValue("lifecycle_action", metadata.lifecycle_action, t));
  addTransition(
    details,
    t("crmCard.timelineFieldStatus"),
    formatMetadataValue("from_status", metadata.from_status ?? metadata.from, t),
    formatMetadataValue("to_status", metadata.to_status ?? metadata.to, t),
  );
  addTransition(
    details,
    t("crmCard.timelineFieldStage"),
    formatMetadataValue("from_stage_id", metadata.from_stage_id ?? metadata.from_stage, t),
    formatMetadataValue("to_stage_id", metadata.to_stage_id ?? metadata.to_stage, t),
  );
  addTransition(
    details,
    t("crmCard.timelineFieldTime"),
    formatMetadataValue("previous_start_at", metadata.previous_start_at, t),
    formatMetadataValue("current_start_at", metadata.current_start_at ?? metadata.start_at, t),
  );
  addTransition(
    details,
    t("crmCard.timelineFieldAmount"),
    formatMetadataValue("amount_before", metadata.amount_before, t),
    formatMetadataValue("amount_after", metadata.amount_after, t),
  );
  addTransition(
    details,
    t("crmCard.timelineFieldAssignee"),
    formatMetadataValue("from_assignee", metadata.from_assignee, t),
    formatMetadataValue("to_assignee", metadata.to_assignee, t),
  );

  addDetail(details, t("crmCard.timelineFieldReason"), formatMetadataValue("reason", metadata.reason, t));
  addDetail(details, t("crmCard.timelineFieldLostReason"), formatMetadataValue("lost_reason", metadata.lost_reason, t));
  addDetail(details, t("crmCard.timelineFieldClearedReason"), formatMetadataValue("cleared_lost_reason", metadata.cleared_lost_reason, t));
  addDetail(details, t("crmCard.timelineFieldResource"), formatMetadataValue("resource_id", metadata.resource_id, t));
  addDetail(details, t("crmCard.timelineFieldClient"), formatMetadataValue("client_id", metadata.client_id, t));
  addDetail(details, t("crmCard.timelineFieldLead"), formatMetadataValue("lead_id", metadata.lead_id, t));
  addDetail(details, t("crmCard.timelineFieldDeal"), formatMetadataValue("deal_id", metadata.deal_id, t));
  addDetail(details, t("crmCard.timelineFieldAppointment"), formatMetadataValue("appointment_id", metadata.appointment_id, t));
  addDetail(details, t("crmCard.timelineFieldTask"), formatMetadataValue("task_id", metadata.task_id, t));
  addDetail(details, t("crmCard.timelineFieldConversation"), formatMetadataValue("conversation_id", metadata.conversation_id, t));
  addDetail(details, t("crmCard.timelineFieldChannel"), formatMetadataValue("channel", metadata.channel, t));
  addDetail(details, t("crmCard.timelineFieldIntegrationEvent"), formatMetadataValue("integration_event_type", metadata.integration_event_type, t));
  addDetail(details, t("crmCard.timelineFieldConnector"), formatMetadataValue("connector_id", metadata.connector_id, t));
  addDetail(details, t("crmCard.timelineFieldExternalId"), formatMetadataValue("external_id", metadata.external_id, t));
  addDetail(details, t("crmCard.timelineFieldBusinessEvent"), formatMetadataValue("business_event_id", metadata.business_event_id, t));
  addDetail(details, t("crmCard.timelineFieldTool"), formatMetadataValue("tool_name", metadata.tool_name, t));
  addDetail(details, t("crmCard.timelineFieldSourceEvent"), formatMetadataValue("source_event_type", metadata.source_event_type, t));

  const targetType = formatMetadataValue("target_type", metadata.target_type, t);
  const targetId = formatMetadataValue("target_id", metadata.target_id, t);
  addDetail(details, t("crmCard.timelineFieldTarget"), [targetType, targetId].filter(Boolean).join(" "));

  if (event.entity_type && event.entity_id) {
    addDetail(details, t("crmCard.timelineFieldEntity"), `${formatToken(event.entity_type)} #${event.entity_id}`);
  }

  return details.slice(0, 8);
}

export function groupTimeline(events: ActivityEvent[], language: string) {
  const locale = localeFor(language);
  return events.reduce<Record<string, ActivityEvent[]>>((acc, event) => {
    const key = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(event.created_at));
    acc[key] = acc[key] || [];
    acc[key].push(event);
    return acc;
  }, {});
}
