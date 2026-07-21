import type { InboxFilters } from "../../api/inbox";
import type { useI18n } from "../../lib/i18n";

export type InboxPreset = "all" | "mine" | "new" | "attention" | "custom";
export type InboxSort = "latest" | "unread" | "first_response";
export type Translate = ReturnType<typeof useI18n>["t"];

export type SavedConversationFilterState = {
  preset?: InboxPreset;
  sortBy?: InboxSort;
  filters?: InboxFilters;
};
