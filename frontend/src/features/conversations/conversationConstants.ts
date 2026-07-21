export const CONVERSATIONS_SHELL_OFFSET = 104;
export const CONVERSATIONS_PRESET_STORAGE_KEY = "zani_conversations_filters_v1";

export const priorityOptions = [
  { value: "", labelKey: "conversations.anyPriority" },
  { value: "urgent", labelKey: "notification.priority.urgent" },
  { value: "high", labelKey: "notification.priority.high" },
  { value: "normal", labelKey: "notification.priority.normal" },
  { value: "low", labelKey: "notification.priority.low" },
];

export const channelOptions: Array<{ value: string; label: string } | { value: string; labelKey: string }> = [
  { value: "", labelKey: "conversations.allChannels" },
  { value: "website", label: "Website" },
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
];
