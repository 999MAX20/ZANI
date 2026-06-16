import { InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  PauseCircle,
  PlayCircle,
  Send,
  Sparkles,
  Square,
  UserCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { botsApi } from "../../api/bots";
import {
  INBOX_MESSAGES_PAGE_SIZE,
  inboxApi,
  inboxQueryKeys,
  normalizeFilters,
  type InboxConversation,
  type InboxFilters,
  type InboxMessage,
  type PaginatedInboxMessageResponse,
} from "../../api/inbox";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { WorkQueueDetailPane, WorkQueueLayout, WorkQueueListPane } from "../../components/layout/WorkQueueLayout";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useAuth } from "../auth/AuthProvider";
import { ConversationQueueFilters } from "./components/ConversationQueueFilters";

type InboxPreset = "all" | "mine" | "new" | "attention" | "custom";
type InboxSort = "latest" | "unread" | "first_response";

const CONVERSATIONS_SHELL_OFFSET = 104;

const channelLabels: Record<string, string> = {
  website: "source.website",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

type Translate = ReturnType<typeof useI18n>["t"];

const CONVERSATIONS_PRESET_STORAGE_KEY = "zani_conversations_filters_v1";

const priorityOptions = [
  { value: "", labelKey: "conversations.anyPriority" },
  { value: "urgent", labelKey: "notification.priority.urgent" },
  { value: "high", labelKey: "notification.priority.high" },
  { value: "normal", labelKey: "notification.priority.normal" },
  { value: "low", labelKey: "notification.priority.low" },
];

const channelOptions = [
  { value: "", label: "Все каналы" },
  { value: "website", label: "Website" },
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
];

function getSavedConversationsFilterState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_PRESET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      preset?: InboxPreset;
      sortBy?: InboxSort;
      filters?: InboxFilters;
    };
    return {
      preset: parsed.preset,
      sortBy: parsed.sortBy,
      filters: parsed.filters,
    };
  } catch {
    return null;
  }
}

function getPresetFilters(preset: InboxPreset, existing: InboxFilters): InboxFilters {
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

function isValidPreset(value: string | null): value is InboxPreset {
  return value === "all" || value === "mine" || value === "new" || value === "attention" || value === "custom";
}

function getConversationTimestamp(value?: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function channelLabel(channel: string | undefined, t: Translate) {
  if (!channel) return "";
  const label = channelLabels[channel];
  return label ? t(label) : channel;
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatMessageTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function conversationTitle(conversation: InboxConversation | null | undefined, t: Translate) {
  if (!conversation) return t("conversations.selectDialog");
  return conversation.client_name || conversation.external_user_id || t("conversations.clientFromChannel", { channel: channelLabel(conversation.channel, t) });
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1", className)}>{children}</span>;
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 w-max max-w-72 -translate-x-1/2 rounded-xl bg-midnight px-3 py-2 text-xs font-bold leading-5 text-white opacity-0 shadow-xl transition group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100">
        {label}
      </span>
    </span>
  );
}

function getAutoPipelineInsight(conversation: InboxConversation) {
  const metadata = conversation.metadata_json || {};
  const auto = metadata.auto_crm_pipeline;
  const manual = metadata.conversation_pipeline;
  const payload = (auto && typeof auto === "object" ? auto : manual && typeof manual === "object" ? manual : null) as Record<string, unknown> | null;
  const qualification = payload?.qualification && typeof payload.qualification === "object" ? (payload.qualification as Record<string, unknown>) : null;
  const confidence = typeof qualification?.confidence === "number" ? Math.round(qualification.confidence * 100) : null;
  return {
    status: typeof payload?.status === "string" ? payload.status : "",
    intent: typeof qualification?.intent === "string" ? qualification.intent : "",
    confidence,
    nextAction: typeof qualification?.next_action === "string" ? qualification.next_action : "",
  };
}

function ConversationItem({
  conversation,
  active,
  selectable,
  selectedForBulk,
  onToggleSelected,
  onClick,
  t,
}: {
  conversation: InboxConversation;
  active: boolean;
  selectable: boolean;
  selectedForBulk: boolean;
  onToggleSelected: () => void;
  onClick: () => void;
  t: Translate;
}) {
  const preview = conversation.last_message?.text || t("conversations.emptyHistoryPreview");
  const unread = conversation.unread_count || 0;
  const initials = conversationTitle(conversation, t)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      className={cn(
        "group relative w-full border-b border-slate-100 px-3 py-2.5 text-left transition hover:bg-slate-50",
        active ? "bg-brand-50/80 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-brand-600" : "bg-white",
      )}
    >
      <div className="flex items-center gap-2.5">
        {selectable ? (
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-white"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelected();
            }}
            aria-label={selectedForBulk ? t("conversations.removeFromSelection") : t("conversations.selectForBulk")}
          >
            {selectedForBulk ? <CheckSquare size={19} /> : <Square size={19} />}
          </button>
        ) : null}
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-xs font-black text-brand-700 shadow-sm">
          {initials || <MessageSquare size={16} />}
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white", conversation.channel === "telegram" ? "bg-blue-500" : conversation.channel === "whatsapp" ? "bg-emerald-500" : conversation.channel === "instagram" ? "bg-pink-500" : "bg-slate-400")} />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-midnight px-1 text-[10px] font-black text-white">
              {unread}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-black text-midnight">{conversationTitle(conversation, t)}</p>
            <span className="shrink-0 text-[11px] font-bold text-slate-400">{formatDateTime(conversation.last_message_at)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold leading-5 text-slate-500">{preview}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">{channelLabel(conversation.channel, t)}</span>
            {conversation.handoff_required ? <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-600">{t("conversations.noReply")}</span> : null}
            {!conversation.handoff_required && !conversation.bot_enabled ? <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-600">{t("conversations.paused")}</span> : null}
            {conversation.status === "closed" ? <span className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] font-black text-slate-500">{t("status.closed")}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, t }: { message: InboxMessage; t: Translate }) {
  const system = message.sender_type === "system";
  const inbound = message.direction === "inbound";
  const ai = message.sender_type === "bot" || message.sender_type === "ai";
  const author = ai ? t("conversations.senderAssistant") : message.sender_type === "manager" ? t("conversations.senderManager") : t("conversations.senderClient");
  const time = formatMessageTime(message.created_at || message.sent_at);

  if (system) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] rounded-full bg-slate-100 px-3 py-1.5 text-center text-xs font-bold text-slate-500">
          {message.text || t("conversations.emptyMessage")}
          {time ? <span className="ml-2 text-slate-400">{time}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          inbound ? "rounded-tl-md border border-slate-100 bg-white text-slate-700" : ai ? "rounded-tr-md bg-ai-50 text-ai-800 ring-1 ring-ai-100" : "rounded-tr-md bg-brand-600 text-white",
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-60">
          {ai ? <Sparkles size={13} /> : null}
          {author}
        </div>
        <p className="whitespace-pre-wrap">{message.text || t("conversations.emptyMessage")}</p>
        {message.attachments?.length ? (
          <div className={cn("mt-3 space-y-2", inbound ? "text-slate-700" : "text-white")}>
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.download_url}
                target="_blank"
                rel="noreferrer"
                className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ring-1", inbound ? "bg-slate-50 ring-slate-200" : "bg-white/15 ring-white/20")}
              >
                <Paperclip size={14} />
                <span className="min-w-0 flex-1 truncate">{attachment.original_name}</span>
              </a>
            ))}
          </div>
        ) : null}
        {message.error_text ? (
          <p className={cn("mt-2 text-xs font-bold", message.status === "failed" ? "text-red-500" : "text-amber-500")}>
            {message.error_text}
          </p>
        ) : null}
        <div className={cn("mt-2 flex items-center justify-end gap-1 text-[11px] font-bold", inbound ? "text-slate-400" : "text-white/70")}>
          {time ? <span>{time}</span> : null}
          {!inbound ? <span>{message.read_at ? "✓✓" : message.delivered_at || message.status === "sent" ? "✓✓" : "✓"}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function ConversationsPage() {
  const { t } = useI18n();
  const { setPageHeader } = usePageHeader();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(searchParams.get("conversation")) || null);
  const savedState = getSavedConversationsFilterState();
  const isFilterUrlPresent = !![
    "status",
    "bot",
    "channel",
    "assigned_to",
    "priority",
    "unread",
    "handoff_required",
    "bot_enabled",
    "search",
    "preset",
    "sort",
  ].find((key) => searchParams.get(key));
  const [activePreset, setActivePreset] = useState<InboxPreset>(() => {
    const presetFromUrl = searchParams.get("preset");
    if (isValidPreset(presetFromUrl)) return presetFromUrl;
    if (!isFilterUrlPresent && savedState?.preset) return savedState.preset;
    return "all";
  });
  const [sortBy, setSortBy] = useState<InboxSort>(() => {
    const sortFromUrl = searchParams.get("sort");
    if (sortFromUrl === "latest" || sortFromUrl === "unread" || sortFromUrl === "first_response") return sortFromUrl;
    if (savedState?.sortBy) return savedState.sortBy;
    return "latest";
  });
  const [bulkMode, setBulkMode] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(() => Boolean(searchParams.get("conversation")));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<InboxFilters>(() => {
    const base: InboxFilters = {
      status: searchParams.get("status") || "",
      bot: searchParams.get("bot") || savedState?.filters?.bot || undefined,
      channel: searchParams.get("channel") || savedState?.filters?.channel || undefined,
      assigned_to: searchParams.get("assigned_to") || savedState?.filters?.assigned_to || undefined,
      priority: searchParams.get("priority") || savedState?.filters?.priority || undefined,
      unread: searchParams.get("unread") || undefined,
      handoff_required: searchParams.get("handoff_required") || undefined,
      bot_enabled: searchParams.get("bot_enabled") || undefined,
      search: searchParams.get("search") || undefined,
    };
    const presetFromUrl = searchParams.get("preset");
    if (!isFilterUrlPresent && isValidPreset(presetFromUrl) && presetFromUrl !== "custom") {
      return getPresetFilters(presetFromUrl, base);
    }
    if (!isFilterUrlPresent && savedState?.preset) {
      return getPresetFilters(savedState.preset, base);
    }
    return base;
  });
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const businessId = business?.id;
  const canSuggestAi = hasPermission(user, business?.id, "ai_assistant", "suggest");
  const canRunAiPipeline = hasPermission(user, business?.id, "ai_pipeline", "execute");

  function persistFilterState(nextFilters: InboxFilters, preset: InboxPreset, nextSort?: InboxSort) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      CONVERSATIONS_PRESET_STORAGE_KEY,
      JSON.stringify({
        preset,
        sortBy: nextSort || sortBy,
        filters: nextFilters,
      }),
    );
  }

  function applyFilters(nextFilters: InboxFilters, preset: InboxPreset = activePreset, nextSortBy?: InboxSort, replaceHistory = true) {
    setFilters(nextFilters);
    setActivePreset(preset);
    if (nextSortBy) {
      setSortBy(nextSortBy);
    }
    persistFilterState(nextFilters, preset, nextSortBy);

    const params = new URLSearchParams();
    if (selectedId) params.set("conversation", String(selectedId));
    if (searchParams.get("page") && searchParams.get("page") !== "1") {
      params.set("page", searchParams.get("page") || "");
    }

    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    params.set("sort", nextSortBy || sortBy);
    if (preset !== "custom") params.set("preset", preset);

    setSearchParams(params, { replace: replaceHistory });
  }

  useEffect(() => {
    const hasFilterQuery = !![
      "status",
      "bot",
      "channel",
      "assigned_to",
      "priority",
      "unread",
      "handoff_required",
      "bot_enabled",
      "search",
      "sort",
      "preset",
    ].find((key) => searchParams.get(key));
    if (!hasFilterQuery) return;

    const nextFilters: InboxFilters = {
      status: searchParams.get("status") || "",
      bot: searchParams.get("bot") || undefined,
      channel: searchParams.get("channel") || undefined,
      assigned_to: searchParams.get("assigned_to") || undefined,
      priority: searchParams.get("priority") || undefined,
      unread: searchParams.get("unread") || undefined,
      handoff_required: searchParams.get("handoff_required") || undefined,
      bot_enabled: searchParams.get("bot_enabled") || undefined,
      search: searchParams.get("search") || undefined,
    };

    const nextSort: InboxSort = (searchParams.get("sort") as InboxSort) || "latest";
    const presetFromUrl = searchParams.get("preset");

    if (presetFromUrl && isValidPreset(presetFromUrl)) {
      setActivePreset(presetFromUrl);
    }
    setSortBy((prev) => (nextSort === "latest" || nextSort === "unread" || nextSort === "first_response" ? nextSort : prev));
    setFilters(nextFilters);
  }, [searchParams]);

  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);

  const summary = useQuery({
    queryKey: ["inbox-summary", businessId],
    queryFn: inboxApi.getSummary,
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });

  const conversations = useQuery({
    queryKey: inboxQueryKeys.conversations(normalizedFilters),
    queryFn: () => inboxApi.listConversations(normalizedFilters),
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });

  const bots = useQuery({
    queryKey: ["bots"],
    queryFn: botsApi.list,
  });

  const items = conversations.data?.results || [];

  const sortedItems = useMemo(() => {
    const source = [...items];
    if (sortBy === "unread") {
      source.sort((left, right) => {
        const unreadDiff = (right.unread_count || 0) - (left.unread_count || 0);
        if (unreadDiff !== 0) return unreadDiff;
        const leftDate = getConversationTimestamp(left.last_message_at);
        const rightDate = getConversationTimestamp(right.last_message_at);
        return rightDate - leftDate;
      });
      return source;
    }

    if (sortBy === "first_response") {
      source.sort((left, right) => {
        const leftDate = getConversationTimestamp(left.last_inbound_at);
        const rightDate = getConversationTimestamp(right.last_inbound_at);
        return leftDate - rightDate;
      });
      return source;
    }

    source.sort((left, right) => getConversationTimestamp(right.last_message_at) - getConversationTimestamp(left.last_message_at));
    return source;
  }, [items, sortBy]);

  const selected = useMemo(() => sortedItems.find((item) => item.id === selectedId) || null, [sortedItems, selectedId]);

  useEffect(() => {
    const openNextUnreadConversation = () => {
      const target = sortedItems.find((item) => (item.unread_count || 0) > 0) || sortedItems[0];
      if (!target) return;
      selectConversation(target.id);
    };

    setPageHeader({
      title: t("nav.conversations"),
      primaryAction: {
        label: selected ? t("conversations.replyToClient") : "Перейти к следующему непрочитанному",
        icon: Send,
        onClick: () => {
          if (selected) {
            composerRef.current?.focus();
            return;
          }
          openNextUnreadConversation();
        },
      },
    });
    return () => setPageHeader(null);
  }, [setPageHeader, t, selected, sortedItems, composerRef]);

  useEffect(() => {
    if (selectedId || conversations.isLoading || !items.length) return;
    const unread = sortedItems.find((item) => (item.unread_count || 0) > 0);
    const priority = unread || sortedItems.find((item) => item.handoff_required) || sortedItems[0];
    if (!priority) return;
    setSelectedId(priority.id);
    const params = new URLSearchParams(searchParams);
    params.set("conversation", String(priority.id));
    setSearchParams(params, { replace: true });
  }, [conversations.isLoading, sortedItems, searchParams, selectedId, setSearchParams]);

  const messages = useInfiniteQuery<PaginatedInboxMessageResponse, Error, InfiniteData<PaginatedInboxMessageResponse>, ReturnType<typeof inboxQueryKeys.messages>, number | null>({
    queryKey: inboxQueryKeys.messages(selected?.id),
    queryFn: ({ pageParam }) => inboxApi.listMessages(selected!.id, {
      limit: INBOX_MESSAGES_PAGE_SIZE,
      beforeId: pageParam ?? undefined,
    }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_before_id || undefined,
    enabled: Boolean(selected?.id),
    refetchInterval: selected?.id ? realtimeIntervals.inboxMessagesMs : false,
    ...realtimeQueryOptions,
  });

  const conversationCounts = useMemo(() => {
    const myTurn = items.filter((item) => item.assigned_to !== null).length;
    return {
      all: conversations.data?.count ?? summary.data?.total ?? items.length,
      unread: items.filter((item) => (item.unread_count || 0) > 0).length,
      attention: items.filter((item) => item.handoff_required).length,
      botDisabled: items.filter((item) => !item.bot_enabled).length,
      myTurn,
      unassigned: items.filter((item) => !item.assigned_to).length,
      closed: items.filter((item) => item.status === "closed").length,
      active: items.filter((item) => item.status !== "closed").length,
    };
  }, [items, conversations.data?.count, summary.data?.total]);

  const hasActiveFilters = useMemo(() => Boolean(
    filters.bot ||
    filters.channel ||
    filters.priority ||
    filters.assigned_to ||
    filters.status ||
    filters.unread ||
    filters.handoff_required ||
    filters.bot_enabled,
  ), [filters]);

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.bot) parts.push(t("conversations.agent"));
    if (filters.channel) parts.push(channelLabel(filters.channel, t));
    if (filters.priority) parts.push(`${t("conversations.priority")}: ${filters.priority}`);
    if (filters.unread === "true") parts.push(t("conversations.unreadMessages"));
    if (filters.handoff_required === "true") parts.push(t("conversations.needsOperator"));
    if (filters.bot_enabled === "false") parts.push(t("conversations.botPaused"));
    if (filters.bot_enabled === "true") parts.push(t("conversations.botActive"));
    if (filters.assigned_to === "me") parts.push(t("conversations.assignedToMeFilter"));
    if (filters.assigned_to === "unassigned") parts.push(t("conversations.unassigned"));
    if (filters.status === "open") parts.push(t("conversations.active"));
    if (filters.status === "closed") parts.push(t("status.closed"));
    return parts;
  }, [filters, t]);

  const queueFilterOptions = useMemo(() => [
    { value: "all", label: `${t("conversations.queueAll")} (${conversationCounts.all})` },
    { value: "new", label: `${t("conversations.unreadMessages")} (${summary.data?.unread ?? conversationCounts.unread})` },
    { value: "attention", label: `${t("conversations.attention")} (${summary.data?.handoff_required ?? conversationCounts.attention})` },
    { value: "paused", label: `${t("conversations.botPaused")} (${summary.data?.bot_paused ?? conversationCounts.botDisabled})` },
    { value: "closed", label: `${t("status.closed")} (${conversationCounts.closed})` },
  ], [conversationCounts.all, conversationCounts.attention, conversationCounts.botDisabled, conversationCounts.closed, conversationCounts.unread, summary.data?.bot_paused, summary.data?.handoff_required, summary.data?.unread, t]);

  const ownerFilterOptions = useMemo(() => [
    { value: "all", label: `${t("conversations.allManagers")} (${conversationCounts.all})` },
    { value: "me", label: `${t("conversations.assignedToMeFilter")} (${summary.data?.assigned_to_me ?? 0})` },
    { value: "unassigned", label: `${t("conversations.unassigned")} (${summary.data?.unassigned ?? conversationCounts.unassigned})` },
  ], [conversationCounts.all, conversationCounts.unassigned, summary.data?.assigned_to_me, summary.data?.unassigned, t]);

  const agentFilterOptions = useMemo(() => [
    { value: "", label: t("conversations.allAgents") },
    ...(bots.data || []).map((bot) => ({ value: bot.id, label: bot.name })),
  ], [bots.data, t]);

  const localizedChannelOptions = useMemo(() => channelOptions.map((option) => ({
    ...option,
    label: option.value ? option.label : t("conversations.allChannels"),
  })), [t]);

  const localizedPriorityOptions = useMemo(() => priorityOptions.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  })), [t]);

  const localizedSortOptions = useMemo(() => [
    { value: "latest", label: t("conversations.sortLatest") },
    { value: "unread", label: t("conversations.sortUnread") },
    { value: "first_response", label: t("conversations.sortFirstResponse") },
  ], [t]);

  const localizedStatusOptions = useMemo(() => [
    { value: "all", label: `${t("conversations.noFilter")} (${conversationCounts.all})` },
    { value: "open", label: `${t("conversations.active")} (${conversationCounts.active})` },
    { value: "closed", label: `${t("status.closed")} (${conversationCounts.closed})` },
  ], [conversationCounts.active, conversationCounts.all, conversationCounts.closed, t]);

  function handleSortChange(sort: string) {
    const nextSort = sort === "latest" ? "latest" : sort === "unread" ? "unread" : "first_response";
    applyFilters(filters, activePreset, nextSort);
  }

  function handleQueueChange(value: string) {
    const next: InboxFilters = {
      ...filters,
      unread: undefined,
      handoff_required: undefined,
      bot_enabled: undefined,
      status: "",
    };
    if (value === "new") next.unread = "true";
    if (value === "attention") next.handoff_required = "true";
    if (value === "paused") next.bot_enabled = "false";
    if (value === "closed") next.status = "closed";
    applyFilters(next, value === "all" && !next.assigned_to && !next.bot && !next.channel && !next.priority ? "all" : "custom");
    setSelectedIds([]);
    setBulkMode(false);
  }

  function handleOwnerChange(value: string) {
    const next: InboxFilters = {
      ...filters,
      assigned_to: value === "all" ? undefined : value,
    };
    applyFilters(next, value === "all" && !next.unread && !next.handoff_required && !next.bot_enabled && !next.status && !next.bot && !next.channel && !next.priority ? "all" : "custom");
    setSelectedIds([]);
    setBulkMode(false);
  }

  function updateFilters(next: InboxFilters) {
    applyFilters(next, "custom");
    setSelectedIds([]);
    setBulkMode(false);
  }

  function resetConversationFilters() {
    const next: InboxFilters = { search: filters.search };
    applyFilters(next, "all", "latest");
    setSelectedIds([]);
    setBulkMode(false);
  }

  function selectConversation(id: number) {
    setSelectedId(id);
    setMobileThreadOpen(true);
    const params = new URLSearchParams(searchParams);
    params.set("conversation", String(id));
    setSearchParams(params, { replace: true });
    const conversation = items.find((item) => item.id === id);
    if ((conversation?.unread_count || 0) > 0) {
      markReadMutation.mutate(id);
    }
  }

  const invalidateInbox = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inbox-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-summary"], exact: false }),
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] }),
      queryClient.invalidateQueries({ queryKey: inboxQueryKeys.messages(selected?.id) }),
      queryClient.invalidateQueries({ queryKey: ["inbox-summary", businessId] }),
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  };

  function toggleBulkId(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectVisibleConversations() {
    setBulkMode(true);
    setSelectedIds(sortedItems.map((item) => item.id));
  }

  function resetBulkSelection() {
    setBulkMode(false);
    setSelectedIds([]);
  }

  function appendSystemEvent(conversationId: number, text: string) {
    const now = new Date().toISOString();
    const eventMessage: InboxMessage = {
      id: -Date.now(),
      conversation: conversationId,
      direction: "outbound",
      sender_type: "system",
      text,
      payload_json: { source: "local_status_event" },
      status: "sent",
      sent_at: now,
      delivered_at: null,
      read_at: null,
      created_at: now,
      attachments: [],
    };

    queryClient.setQueryData<InfiniteData<PaginatedInboxMessageResponse>>(inboxQueryKeys.messages(conversationId), (current) => {
      if (!current || !current.pages.length) {
        return current;
      }

      const eventTime = new Date(now).getTime();
      const hasRecentDuplicate = current.pages.some((page) => page.results.some((message) => {
        if (message.sender_type !== "system" || message.text !== text) return false;
        const messageTime = new Date(message.created_at || message.sent_at || 0).getTime();
        return Number.isFinite(messageTime) && Math.abs(eventTime - messageTime) < 10_000;
      }));

      if (hasRecentDuplicate) {
        return current;
      }

      const nextPages = [...current.pages];
      const latestPage = nextPages[0];
      nextPages[0] = {
        ...latestPage,
        results: [...latestPage.results, eventMessage],
      };

      return {
        ...current,
        pages: nextPages,
      };
    });
  }

  const assignMutation = useMutation({
    mutationFn: inboxApi.assignToMe,
    onSuccess: async (_data, conversationId) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(Number(conversationId), t("conversations.systemAssignedToMe"));
    },
  });

  const handoffMutation = useMutation({
    mutationFn: inboxApi.handoff,
    onSuccess: async (_data, variables) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(Number(variables.conversationId), t("conversations.systemHandoff"));
    },
  });

  const markReadMutation = useMutation({
    mutationFn: inboxApi.markRead,
    onSuccess: async () => {
      await invalidateInbox();
    },
  });

  const toggleBotMutation = useMutation({
    mutationFn: inboxApi.toggleBot,
    onSuccess: async (_data, variables) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(Number(variables.conversationId), variables.botEnabled ? t("conversations.systemBotEnabled") : t("conversations.systemBotPaused"));
    },
  });

  const closeMutation = useMutation({
    mutationFn: inboxApi.closeConversation,
    onSuccess: async (_data, variables) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(Number(variables.conversationId), t("conversations.systemClosed"));
    },
  });

  const reopenMutation = useMutation({
    mutationFn: inboxApi.reopenConversation,
    onSuccess: async (_data, conversationId) => {
      setNotice(null);
      await invalidateInbox();
      appendSystemEvent(Number(conversationId), t("conversations.systemReopened"));
    },
  });

  const suggestMutation = useMutation({
    mutationFn: (conversationId: number) => {
      if (!canSuggestAi) throw new Error("Your role cannot generate AI replies.");
      return inboxApi.suggestReply(conversationId);
    },
    onSuccess: (data) => {
      setDraft(data.suggested_reply);
      setNotice(t("conversations.aiDraftReady"));
    },
  });

  const sendMutation = useMutation({
    mutationFn: inboxApi.sendMessage,
    onSuccess: async () => {
      setDraft("");
      setNotice(t("conversations.replySent"));
      await invalidateInbox();
    },
  });

  const retryMessageMutation = useMutation({
    mutationFn: inboxApi.retryMessage,
    onSuccess: async () => {
      setNotice(t("conversations.messageRetried"));
      await invalidateInbox();
    },
  });

  const createClientMutation = useMutation({
    mutationFn: inboxApi.createClient,
    onSuccess: async (result) => {
      if (result.requires_confirmation && result.duplicates.length) {
        setNotice(t("conversations.duplicateClientShort", { list: result.duplicates.map((item) => `#${item.id} ${item.full_name}`).join(", ") }));
        return;
      }
      setNotice(result.created ? t("conversations.clientCreatedShort") : t("conversations.clientAlreadyLinked"));
      await Promise.all([invalidateInbox(), queryClient.invalidateQueries({ queryKey: ["clients"] })]);
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: inboxApi.createLead,
    onSuccess: async () => {
      setNotice(t("conversations.leadCreatedShort"));
      await Promise.all([invalidateInbox(), queryClient.invalidateQueries({ queryKey: ["leads"] })]);
    },
  });

  const createDealMutation = useMutation({
    mutationFn: inboxApi.createDeal,
    onSuccess: async () => {
      setNotice(t("conversations.dealCreatedShort"));
      await Promise.all([invalidateInbox(), queryClient.invalidateQueries({ queryKey: ["deals"] })]);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: inboxApi.createTask,
    onSuccess: async () => {
      setNotice(t("conversations.taskCreatedShort"));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const runPipelineMutation = useMutation({
    mutationFn: (payload: { conversationId: number; dealTitle?: string }) => {
      if (!canRunAiPipeline) throw new Error("Your role cannot execute CRM pipeline actions.");
      return inboxApi.runPipeline(payload);
    },
    onSuccess: async (result) => {
      const created = Object.entries(result.created)
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(", ");
      const aiSuffix = result.qualification ? t("conversations.pipelineAiSuffix", { intent: result.qualification.intent, confidence: Math.round(result.qualification.confidence * 100) }) : "";
      setNotice(created ? t("conversations.pipelineUpdated", { created, ai: aiSuffix }) : t("conversations.pipelineAlreadyLinked", { ai: aiSuffix }));
      await Promise.all([
        invalidateInbox(),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (action: "markRead" | "assign" | "handoff" | "pauseBot" | "close") => {
      const ids = [...selectedIds];
      if (action === "markRead") {
        await Promise.all(ids.map((id) => inboxApi.markRead(id)));
      }
      if (action === "assign") {
        await Promise.all(ids.map((id) => inboxApi.assignToMe(id)));
      }
      if (action === "handoff") {
        await Promise.all(ids.map((id) => inboxApi.handoff({ conversationId: id, reason: "bulk_handoff_from_inbox" })));
      }
      if (action === "pauseBot") {
        await Promise.all(ids.map((id) => inboxApi.toggleBot({ conversationId: id, botEnabled: false })));
      }
      if (action === "close") {
        await Promise.all(ids.map((id) => inboxApi.closeConversation({ conversationId: id, reason: "bulk_closed_from_inbox" })));
      }
      return { action, count: ids.length };
    },
    onSuccess: async ({ count }) => {
      setNotice(t("conversations.bulkDone", { count }));
      resetBulkSelection();
      await invalidateInbox();
    },
  });

  const actionError =
    summary.error ||
    conversations.error ||
    messages.error ||
    assignMutation.error ||
    handoffMutation.error ||
    markReadMutation.error ||
    toggleBotMutation.error ||
    closeMutation.error ||
    reopenMutation.error ||
    suggestMutation.error ||
    sendMutation.error ||
    retryMessageMutation.error ||
    createClientMutation.error ||
    createLeadMutation.error ||
    createDealMutation.error ||
    createTaskMutation.error ||
    runPipelineMutation.error ||
    bulkMutation.error;

  function sendReply() {
    const text = draft.trim();
    if (!selected || !text) return;
    sendMutation.mutate({ conversationId: selected.id, text });
  }

  function runSelectedPipeline() {
    if (!selected) return;
    runPipelineMutation.mutate({ conversationId: selected.id, dealTitle: t("conversations.pipelineDealTitle", { title: conversationTitle(selected, t) }) });
  }

  const selectedInsight = selected ? getAutoPipelineInsight(selected) : null;
  const messageList = useMemo(() => {
    if (!messages.data) return [];
    return [...messages.data.pages].reverse().flatMap((page) => page.results);
  }, [messages.data]);
  const canLoadMoreMessages = Boolean(messages.hasNextPage);
  const lastMessage = messageList[messageList.length - 1];
  const lastMessageSignature = lastMessage ? `${lastMessage.id}:${lastMessage.created_at || lastMessage.sent_at || ""}:${lastMessage.text || ""}` : "";

  useEffect(() => {
    if (!selected?.id) return;
    const frame = window.requestAnimationFrame(() => {
      if (messageEndRef.current) {
        messageEndRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
        return;
      }
      messageScrollRef.current?.scrollTo({ top: messageScrollRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lastMessageSignature, messageList.length, selected?.id]);

  return (
    <div className="-mx-2 overflow-hidden sm:-mx-3 lg:-mx-4" style={{ height: `calc(100dvh - ${CONVERSATIONS_SHELL_OFFSET}px)` }}>
      {notice ? <div className="rounded-xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-bold text-ai-800">{notice}</div> : null}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      <WorkQueueLayout
        style={{ height: "100%", minHeight: 0 }}
        className="overflow-hidden border border-slate-200 shadow-soft lg:grid-cols-[310px_minmax(0,1fr)] 2xl:grid-cols-[310px_minmax(720px,1fr)_280px]"
      >
        <WorkQueueListPane mobileDetailOpen={mobileThreadOpen}>
          <ConversationQueueFilters
            filters={filters}
            sortBy={sortBy}
            hasActiveFilters={hasActiveFilters}
            activeFilterSummary={activeFilterSummary}
            queueOptions={queueFilterOptions}
            ownerOptions={ownerFilterOptions}
            agentOptions={agentFilterOptions}
            channelOptions={localizedChannelOptions}
            priorityOptions={localizedPriorityOptions}
            statusOptions={localizedStatusOptions}
            sortOptions={localizedSortOptions}
            labels={{
              filters: t("conversations.filters"),
              advancedFilters: t("conversations.advancedFilters"),
              resetFilters: t("conversations.resetFilters"),
              agent: t("conversations.agent"),
              channel: t("conversations.channel"),
              priority: t("conversations.priority"),
              status: t("conversations.status"),
              bot: t("conversations.bot"),
              sort: t("conversations.sort"),
              noFilter: t("conversations.noFilter"),
              botEnabled: t("conversations.botActive"),
              botPaused: t("conversations.botPaused"),
            }}
            onQueueChange={handleQueueChange}
            onOwnerChange={handleOwnerChange}
            onFilterChange={updateFilters}
            onSortChange={handleSortChange}
            onReset={resetConversationFilters}
          />

          {items.length ? (
            <div className="border-b border-slate-100 px-3 py-2">
              {!bulkMode ? (
                <button type="button" className="text-xs font-black text-brand-600" onClick={selectVisibleConversations}>
                  {t("conversations.selectMultiple")}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-midnight">{t("conversations.selectedCount", { count: selectedIds.length })}</p>
                    <button type="button" className="text-sm font-black text-slate-400" onClick={resetBulkSelection}>
                      {t("common.cancel")}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("markRead")} isLoading={bulkMutation.isPending}>
                      {t("conversations.markRead")}
                    </Button>
                    <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("assign")} isLoading={bulkMutation.isPending}>
                      {t("conversations.take")}
                    </Button>
                    <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("pauseBot")} isLoading={bulkMutation.isPending}>
                      {t("conversations.pause")}
                    </Button>
                    <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("handoff")} isLoading={bulkMutation.isPending}>
                      {t("conversations.operator")}
                    </Button>
                    <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("close")} isLoading={bulkMutation.isPending}>
                      {t("common.close")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pb-28 lg:pb-0">
            {conversations.isLoading ? <div className="p-5"><LoadingState label={t("conversations.loadingDialogs")} /></div> : null}
            {!conversations.isLoading && !items.length ? (
              <div className="p-5">
                <EmptyState title={t("conversations.emptyTitle")} description={t("conversations.emptyText")} />
              </div>
            ) : null}
            {sortedItems.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === selected?.id}
                selectable={bulkMode}
                selectedForBulk={selectedIds.includes(conversation.id)}
                onToggleSelected={() => toggleBulkId(conversation.id)}
                onClick={() => selectConversation(conversation.id)}
                t={t}
              />
            ))}
          </div>
        </WorkQueueListPane>

        <WorkQueueDetailPane mobileDetailOpen={mobileThreadOpen} closeLabel={t("common.close")} onMobileClose={() => setMobileThreadOpen(false)}>
          {!selected ? (
            <div className="grid flex-1 place-items-center p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">
                  <MessageSquare aria-hidden="true" size={26} />
                </div>
                <p className="text-2xl font-black text-slate-400">{t("conversations.selectDialog")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-black text-midnight">{conversationTitle(selected, t)}</h2>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill className="bg-blue-50 text-blue-700 ring-blue-200">{channelLabel(selected.channel, t)}</Pill>
                      {selected.bot_enabled ? <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">{t("conversations.botActive")}</Pill> : <Pill className="bg-slate-100 text-slate-600 ring-slate-200">{t("conversations.botPaused")}</Pill>}
                      {selected.handoff_required ? <Pill className="bg-amber-50 text-amber-700 ring-amber-200">{t("conversations.needsOperator")}</Pill> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip label={t("conversations.assignTooltip")}>
                      <Button className="h-9 rounded-lg px-3 text-xs" variant="secondary" disabled={!selected} onClick={() => assignMutation.mutate(selected.id)} isLoading={assignMutation.isPending} aria-label={t("conversations.takeDialog")}>
                        <UserCheck size={16} /> {t("conversations.takeDialog")}
                      </Button>
                    </Tooltip>
                    <Tooltip label={selected.bot_enabled ? t("conversations.pauseBotTooltip") : t("conversations.enableBotTooltip")}>
                      <Button
                        className="h-9 rounded-lg px-3 text-xs"
                        variant="secondary"
                        disabled={!selected}
                        onClick={() => toggleBotMutation.mutate({ conversationId: selected.id, botEnabled: !selected.bot_enabled })}
                        isLoading={toggleBotMutation.isPending}
                        aria-label={selected.bot_enabled ? t("conversations.pauseBot") : t("conversations.enableBot")}
                      >
                        {selected.bot_enabled ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                        {selected.bot_enabled ? t("conversations.pauseBot") : t("conversations.enableBot")}
                      </Button>
                    </Tooltip>
                    {selected.status === "closed" ? (
                      <Tooltip label={t("conversations.reopenTooltip")}>
                        <Button className="h-9 rounded-lg px-3 text-xs" variant="secondary" onClick={() => reopenMutation.mutate(selected.id)} isLoading={reopenMutation.isPending} aria-label={t("conversations.openDialog")}>
                          <PlayCircle size={16} /> {t("common.open")}
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip label={t("conversations.closeTooltip")}>
                        <Button
                          className="h-9 rounded-lg px-3 text-xs"
                          variant="secondary"
                          onClick={() => closeMutation.mutate({ conversationId: selected.id, reason: "closed_from_inbox" })}
                          isLoading={closeMutation.isPending}
                          aria-label={t("conversations.closeDialog")}
                        >
                          <CheckCheck size={16} /> {t("common.close")}
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              <div ref={messageScrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#fbfcff_0%,#fff7f2_100%)] p-5 pb-28 lg:pb-5">
                {messages.isLoading ? <LoadingState label={t("conversations.loadingHistory")} /> : null}
                {canLoadMoreMessages ? (
                  <Button
                    type="button"
                    className="h-8 min-h-8 rounded-lg px-3 text-xs"
                    variant="secondary"
                    onClick={() => messages.fetchNextPage()}
                    isLoading={messages.isFetchingNextPage}
                  >
                    Загрузить ранее
                  </Button>
                ) : null}
                {!messages.isLoading && !messageList.length ? (
                  <EmptyState title={t("conversations.noMessagesTitle")} description={t("conversations.noMessagesText")} />
                ) : null}
                {messageList.length ? (
                  <div className="sticky top-0 z-10 flex justify-center">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-500 shadow-sm ring-1 ring-slate-200">{t("common.today")}</span>
                  </div>
                ) : null}
                {messageList.map((message) => <MessageBubble key={message.id} message={message} t={t} />)}
                <div ref={messageEndRef} aria-hidden="true" />
              </div>

              <div className="border-t border-slate-200 bg-white p-3">
                {selected.status === "closed" ? (
                  <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                    {t("conversations.closedReplyNotice")}
                  </div>
                ) : null}
                <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <button type="button" className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-midnight" title={t("conversations.attachFile")}>
                    <Paperclip size={16} />
                  </button>
                  <textarea
                    ref={composerRef}
                    rows={1}
                    className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
                    disabled={selected.status === "closed" || sendMutation.isPending}
                    placeholder={t("conversations.replyPlaceholder")}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendReply();
                    }}
                  />
                  <Button
                    variant="ai"
                    className="h-10 w-10 shrink-0 rounded-lg px-0"
                    disabled={selected.status === "closed" || !draft.trim()}
                    isLoading={sendMutation.isPending}
                    onClick={sendReply}
                    title={t("conversations.send")}
                  >
                    <Send size={18} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </WorkQueueDetailPane>

        <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 2xl:flex">
          {selected ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <UserRound size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-black text-midnight">{selected.client_name || conversationTitle(selected, t)}</p>
                      <button type="button" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-midnight" aria-label={t("common.open")}>
                        <ExternalLink size={14} />
                      </button>
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-slate-500">{selected.client_phone || selected.external_user_id || t("conversations.noContact")}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-400">{selected.assigned_to_email || t("conversations.unassigned")}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-100">{selected.client ? t("common.client") : t("conversations.newContact")}</Pill>
                      <Pill className="bg-slate-50 text-slate-600 ring-slate-200">{channelLabel(selected.channel, t)}</Pill>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("conversations.channel")}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-midnight">{channelLabel(selected.channel, t)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{selected.bot_enabled ? t("conversations.channelConnected") : t("conversations.botPaused")}</p>
                  </div>
                  {selected.bot_enabled ? <PlayCircle className="text-emerald-500" size={22} /> : <PauseCircle className="text-amber-500" size={22} />}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("conversations.responsible")}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-black text-midnight">
                      {(selected.assigned_to_email || "ZA").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-midnight">{selected.assigned_to_email || t("conversations.unassigned")}</p>
                      <p className="text-xs font-bold text-slate-400">{t("conversations.owner")}</p>
                    </div>
                  </div>
                  <ChevronDown size={16} className="text-slate-400" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("conversations.nextTask")}</p>
                <div className="mt-3 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                    <CalendarCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-midnight">{selectedInsight?.nextAction || (selected.handoff_required ? t("conversations.replyToClient") : t("conversations.checkLinkedLeads"))}</p>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-black text-brand-600 disabled:cursor-not-allowed disabled:text-slate-400"
                      onClick={runSelectedPipeline}
                      disabled={!canRunAiPipeline}
                      title={!canRunAiPipeline ? t("permissions.hiddenTitle") : undefined}
                    >
                      {t("conversations.updateLinks")} <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-ai-100 bg-ai-50 p-3 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-black text-ai-900"><Sparkles size={18} /> {t("conversations.replyHint")}</p>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black text-ai-700 ring-1 ring-ai-100">BETA</span>
                </div>
                <p className="mt-3 text-xs font-bold leading-5 text-ai-800">
                  {selectedInsight?.intent ? t("conversations.intentLine", { intent: selectedInsight.intent }) : t("conversations.assistantDraftHelp")}
                  {selectedInsight?.confidence !== null && selectedInsight?.confidence !== undefined ? ` ${t("conversations.confidenceLine", { confidence: selectedInsight.confidence })}` : ""}
                </p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-ai-700">{t("conversations.recommendedReply")}</p>
                <div className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold leading-5 text-slate-700">
                  {draft || selectedInsight?.nextAction || t("conversations.prepareDraftFallback")}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <Button className="h-10 rounded-xl px-3 text-xs" variant="ai" onClick={() => suggestMutation.mutate(selected.id)} isLoading={suggestMutation.isPending} disabled={!canSuggestAi}>
                    <Sparkles size={16} /> {t("conversations.prepareReply")}
                  </Button>
                  <Button className="h-10 w-10 rounded-xl px-0" variant="secondary" type="button" aria-label={t("common.copy")}>
                    <MoreHorizontal size={16} />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-center text-sm font-bold text-slate-400">{t("conversations.selectContext")}</div>
          )}
        </aside>
      </WorkQueueLayout>
    </div>
  );
}
