import type { InboxConversation, InboxFilters } from "../../api/inbox";
import { CONVERSATIONS_PRESET_STORAGE_KEY } from "./conversationConstants";
import type { InboxPreset, SavedConversationFilterState, Translate } from "./conversationTypes";

const channelLabels: Record<string, string> = {
  website: "source.website",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

export function getSavedConversationsFilterState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_PRESET_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedConversationFilterState;
  } catch {
    return null;
  }
}

export function getPresetFilters(preset: InboxPreset, existing: InboxFilters): InboxFilters {
  const presetFilters: InboxFilters = { ...existing };
  if (preset === "mine") {
    presetFilters.assigned_to = "me";
  } else if (preset === "new") {
    presetFilters.unread = "true";
  } else if (preset === "attention") {
    presetFilters.handoff_required = "true";
  } else {
    presetFilters.assigned_to = undefined;
    presetFilters.unread = undefined;
    presetFilters.handoff_required = undefined;
  }
  if (preset === "all") {
    presetFilters.status = "";
    presetFilters.bot_enabled = undefined;
  }
  return presetFilters;
}

export function isValidPreset(value: string | null): value is InboxPreset {
  return value === "all" || value === "mine" || value === "new" || value === "attention" || value === "custom";
}

export function getConversationTimestamp(value?: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

export function channelLabel(channel: string | undefined, t: Translate) {
  if (!channel) return "";
  const label = channelLabels[channel];
  return label ? t(label) : channel;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function formatMessageTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function conversationTitle(conversation: InboxConversation | null | undefined, t: Translate) {
  if (!conversation) return t("conversations.selectDialog");
  return conversation.client_name || conversation.external_user_id || t("conversations.clientFromChannel", { channel: channelLabel(conversation.channel, t) });
}

export function getAutoPipelineInsight(conversation: InboxConversation) {
  const metadata = conversation.metadata_json || {};
  const preview = metadata.conversation_qualification_preview;
  const auto = metadata.auto_crm_pipeline;
  const manual = metadata.conversation_pipeline;
  const payload = (
    preview && typeof preview === "object"
      ? preview
      : auto && typeof auto === "object"
        ? auto
        : manual && typeof manual === "object"
          ? manual
          : null
  ) as Record<string, unknown> | null;
  if (!payload) return null;
  const qualification = payload?.qualification && typeof payload.qualification === "object" ? (payload.qualification as Record<string, unknown>) : null;
  if (!qualification) return null;
  const confidence = typeof qualification?.confidence === "number" ? Math.round(qualification.confidence * 100) : null;
  return {
    status: typeof payload?.status === "string" ? payload.status : "",
    intent: typeof qualification?.intent === "string" ? qualification.intent : "",
    confidence,
    nextAction: typeof qualification?.next_action === "string" ? qualification.next_action : "",
  };
}
