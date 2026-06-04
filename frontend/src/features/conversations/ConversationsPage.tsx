import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCheck,
  CheckSquare,
  ExternalLink,
  Filter,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Search,
  Send,
  Sparkles,
  Square,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { botsApi } from "../../api/bots";
import { inboxApi, type InboxConversation, type InboxFilters, type InboxMessage } from "../../api/inbox";
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

type InboxTab = "all" | "errors" | "paused";

const channelLabels: Record<string, string> = {
  website: "source.website",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

type Translate = ReturnType<typeof useI18n>["t"];

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

function conversationTitle(conversation: InboxConversation | null | undefined, t: Translate) {
  if (!conversation) return t("conversations.selectDialog");
  return conversation.client_name || conversation.external_user_id || t("conversations.clientFromChannel", { channel: channelLabel(conversation.channel, t) });
}

function tabFilters(filters: InboxFilters, tab: InboxTab): InboxFilters {
  const base: InboxFilters = {
    ...filters,
    status: "",
    handoff_required: undefined,
    bot_enabled: undefined,
  };
  if (tab === "errors") return { ...base, handoff_required: "true" };
  if (tab === "paused") return { ...base, bot_enabled: "false" };
  return base;
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1", className)}>{children}</span>;
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

function InboxMetricChip({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "blue" | "amber" | "slate";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  }[tone];

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${toneClass}`}>
      <span>{label}</span>
      <span className="text-midnight">{value}</span>
    </div>
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
  const initials = conversationTitle(conversation, t)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50",
        active ? "bg-brand-50/80" : "bg-white",
      )}
    >
      <div className="flex items-center gap-3">
        {selectable ? (
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-white"
            onClick={onToggleSelected}
            aria-label={selectedForBulk ? t("conversations.removeFromSelection") : t("conversations.selectForBulk")}
          >
            {selectedForBulk ? <CheckSquare size={19} /> : <Square size={19} />}
          </button>
        ) : null}
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-sm font-black text-brand-700 shadow-sm">
          {initials || <MessageSquare size={18} />}
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white", conversation.channel === "telegram" ? "bg-blue-500" : conversation.channel === "whatsapp" ? "bg-emerald-500" : conversation.channel === "instagram" ? "bg-pink-500" : "bg-slate-400")} />
          {(conversation.unread_count || 0) > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-midnight px-1 text-[10px] font-black text-white">
              {conversation.unread_count}
            </span>
          ) : null}
        </div>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onClick}>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-black text-midnight">{conversationTitle(conversation, t)}</p>
            <span className="shrink-0 text-xs font-bold text-slate-400">{formatDateTime(conversation.last_message_at)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-500">{preview}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">{channelLabel(conversation.channel, t)}</span>
            {conversation.handoff_required ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-black text-red-600">{t("conversations.noReply")}</span> : null}
            {!conversation.handoff_required && !conversation.bot_enabled ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-600">{t("conversations.paused")}</span> : null}
          </div>
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message, t }: { message: InboxMessage; t: Translate }) {
  const inbound = message.direction === "inbound";
  const ai = message.sender_type === "bot" || message.sender_type === "ai";
  const author = ai ? t("conversations.senderAssistant") : message.sender_type === "manager" ? t("conversations.senderManager") : t("conversations.senderClient");

  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[74%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          inbound ? "border border-slate-100 bg-white text-slate-700" : ai ? "bg-ai-50 text-ai-800 ring-1 ring-ai-100" : "bg-brand-50 text-slate-800 ring-1 ring-brand-100",
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-60">
          {ai ? <Sparkles size={13} /> : null}
          {author}
        </div>
        <p className="whitespace-pre-wrap">{message.text || t("conversations.emptyMessage")}</p>
        {message.error_text ? (
          <p className={cn("mt-2 text-xs font-bold", message.status === "failed" ? "text-red-500" : "text-amber-500")}>
            {message.error_text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ConversationsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(searchParams.get("conversation")) || null);
  const [activeTab, setActiveTab] = useState<InboxTab>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(() => Boolean(searchParams.get("conversation")));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<InboxFilters>(() => ({
    status: searchParams.get("status") || "",
    bot: searchParams.get("bot") || undefined,
    channel: searchParams.get("channel") || undefined,
    assigned_to: searchParams.get("assigned_to") || undefined,
    unread: searchParams.get("unread") || undefined,
    search: searchParams.get("search") || undefined,
  }));
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { user } = useAuth();
  const { business } = useActiveBusiness();
  const canSuggestAi = hasPermission(user, business?.id, "ai_assistant", "suggest");
  const canRunAiPipeline = hasPermission(user, business?.id, "ai_pipeline", "execute");

  const summary = useQuery({
    queryKey: ["inbox-summary"],
    queryFn: inboxApi.getSummary,
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });

  const conversations = useQuery({
    queryKey: ["inbox-conversations", filters],
    queryFn: () => inboxApi.listConversations(filters),
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });

  const bots = useQuery({
    queryKey: ["bots"],
    queryFn: botsApi.list,
  });

  const items = conversations.data?.results || [];
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  useEffect(() => {
    if (selectedId || conversations.isLoading || !items.length) return;
    const unread = items.find((item) => (item.unread_count || 0) > 0);
    const priority = unread || items.find((item) => item.handoff_required) || items[0];
    if (!priority) return;
    setSelectedId(priority.id);
    const params = new URLSearchParams(searchParams);
    params.set("conversation", String(priority.id));
    setSearchParams(params, { replace: true });
  }, [conversations.isLoading, items, searchParams, selectedId, setSearchParams]);

  const messages = useQuery({
    queryKey: ["inbox-messages", selected?.id],
    queryFn: () => inboxApi.listMessages(selected!.id),
    enabled: Boolean(selected?.id),
    refetchInterval: selected?.id ? realtimeIntervals.inboxMessagesMs : false,
    ...realtimeQueryOptions,
  });

  const channelOptions = summary.data?.channels?.length
    ? summary.data.channels
    : [
        { key: "website", label: t("source.website") },
        { key: "telegram", label: "Telegram" },
        { key: "whatsapp", label: "WhatsApp" },
        { key: "instagram", label: "Instagram" },
      ];

  function updateFilters(next: InboxFilters, tab = activeTab) {
    setFilters(next);
    setActiveTab(tab);
    setSelectedIds([]);
    setBulkMode(false);
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    if (selectedId) params.set("conversation", String(selectedId));
    setSearchParams(params, { replace: true });
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
      queryClient.invalidateQueries({ queryKey: ["inbox-messages", selected?.id] }),
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  };

  function toggleBulkId(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectVisibleConversations() {
    setBulkMode(true);
    setSelectedIds(items.map((item) => item.id));
  }

  function resetBulkSelection() {
    setBulkMode(false);
    setSelectedIds([]);
  }

  const assignMutation = useMutation({
    mutationFn: inboxApi.assignToMe,
    onSuccess: async () => {
      setNotice(t("conversations.assignedToMe"));
      await invalidateInbox();
    },
  });

  const handoffMutation = useMutation({
    mutationFn: inboxApi.handoff,
    onSuccess: async () => {
      setNotice(t("conversations.handoffDone"));
      await invalidateInbox();
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
    onSuccess: async () => {
      setNotice(t("conversations.botModeUpdated"));
      await invalidateInbox();
    },
  });

  const closeMutation = useMutation({
    mutationFn: inboxApi.closeConversation,
    onSuccess: async () => {
      setNotice(t("conversations.closed"));
      await invalidateInbox();
    },
  });

  const reopenMutation = useMutation({
    mutationFn: inboxApi.reopenConversation,
    onSuccess: async () => {
      setNotice(t("conversations.reopened"));
      await invalidateInbox();
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

  const tabs = [
    { value: "all" as const, label: t("conversations.filterAll"), count: summary.data?.total ?? 0 },
    { value: "errors" as const, label: t("conversations.attention"), count: summary.data?.handoff_required ?? 0 },
    { value: "paused" as const, label: t("conversations.paused"), count: summary.data?.bot_paused ?? 0 },
  ];
  const selectedInsight = selected ? getAutoPipelineInsight(selected) : null;

  return (
    <div className="space-y-4">
      {notice ? <div className="rounded-2xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-bold text-ai-800">{notice}</div> : null}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-midnight md:text-3xl">{t("conversations.title")}</h1>
          <p className="mt-1 max-w-2xl text-base leading-6 text-slate-600">{t("conversations.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InboxMetricChip label={t("conversations.metricTotal")} value={summary.data?.total ?? 0} />
          <InboxMetricChip label={t("conversations.noReply")} value={summary.data?.handoff_required ?? 0} tone="amber" />
          <InboxMetricChip label={t("conversations.inWork")} value={summary.data?.assigned_to_me ?? 0} />
          <InboxMetricChip label={t("conversations.unreadMessages")} value={summary.data?.unread_messages ?? 0} tone="blue" />
        </div>
      </section>

      <WorkQueueLayout className="overflow-hidden border border-slate-200 shadow-[0_4px_20px_rgba(0,47,108,0.04)] lg:min-h-[calc(100vh-190px)] lg:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(560px,1fr)_300px]">
        <WorkQueueListPane mobileDetailOpen={mobileThreadOpen}>
          <div className="space-y-3 p-5">
            <h1 className="text-2xl font-black tracking-tight text-midnight">{t("conversations.dialogsTitle")}</h1>
            <Select
              className="min-h-12 rounded-xl text-midnight"
              value={filters.bot || ""}
              onChange={(event) => updateFilters({ ...filters, bot: event.target.value || undefined })}
              options={[
                { value: "", label: t("conversations.allAgents") },
                ...(bots.data || []).map((bot) => ({ value: bot.id, label: bot.name })),
              ]}
            />

            <div className="flex gap-2">
              <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-500">
                <Search size={18} />
                <input
                  className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-slate-400"
                  placeholder={t("conversations.queueSearch")}
                  value={filters.search || ""}
                  onChange={(event) => updateFilters({ ...filters, search: event.target.value })}
                />
              </label>
              <button
                className={cn("grid h-12 w-12 place-items-center rounded-xl text-slate-600", filtersOpen ? "bg-midnight text-white" : "bg-slate-100")}
                type="button"
                aria-label={t("conversations.filterButton")}
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <Filter size={19} />
              </button>
            </div>

            {filtersOpen ? (
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <Select
                  className="min-h-10 rounded-xl"
                  value={filters.channel || ""}
                  onChange={(event) => updateFilters({ ...filters, channel: event.target.value || undefined })}
                  options={[
                    { value: "", label: t("conversations.allChannels") },
                    ...channelOptions.map((channel) => ({
                      value: channel.key,
                      label: channelLabel(channel.key, t) || channel.label || channel.key,
                    })),
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    className="min-h-10 rounded-xl"
                    value={filters.unread || ""}
                    onChange={(event) => updateFilters({ ...filters, unread: event.target.value || undefined })}
                    options={[
                      { value: "", label: t("conversations.allMessages") },
                      { value: "true", label: t("conversations.unreadMessages") },
                      { value: "false", label: t("conversations.read") },
                    ]}
                  />
                  <Select
                    className="min-h-10 rounded-xl"
                    value={filters.assigned_to || ""}
                    onChange={(event) => updateFilters({ ...filters, assigned_to: event.target.value || undefined })}
                    options={[
                      { value: "", label: t("conversations.allManagers") },
                      { value: "me", label: t("conversations.assignedToMeFilter") },
                      { value: "unassigned", label: t("conversations.unassigned") },
                    ]}
                  />
                </div>
                <button
                  type="button"
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white text-xs font-black text-slate-500 ring-1 ring-slate-200"
                  onClick={() => updateFilters({ status: "", bot: filters.bot })}
                >
                  <X size={15} /> {t("conversations.resetFilters")}
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-y border-slate-100 p-5">
            <div className="grid grid-cols-3 rounded-2xl bg-slate-100 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  className={cn(
                    "rounded-xl px-2 py-2 text-sm font-black transition",
                    activeTab === tab.value ? "bg-white text-midnight shadow-sm" : "text-slate-400 hover:text-slate-600",
                  )}
                  onClick={() => updateFilters(tabFilters(filters, tab.value), tab.value)}
                >
                  {tab.label} <span className="ml-1 rounded-md bg-slate-200 px-1.5 text-xs text-slate-600">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          {items.length ? (
            <div className="border-b border-slate-100 px-5 py-3">
              {!bulkMode ? (
                <button type="button" className="text-sm font-black text-brand-600" onClick={selectVisibleConversations}>
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
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("markRead")} isLoading={bulkMutation.isPending}>
                      {t("conversations.markRead")}
                    </Button>
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("assign")} isLoading={bulkMutation.isPending}>
                      {t("conversations.take")}
                    </Button>
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("pauseBot")} isLoading={bulkMutation.isPending}>
                      {t("conversations.pause")}
                    </Button>
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("handoff")} isLoading={bulkMutation.isPending}>
                      {t("conversations.operator")}
                    </Button>
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("close")} isLoading={bulkMutation.isPending}>
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
            {items.map((conversation) => (
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
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
                  <MessageSquare aria-hidden="true" size={26} />
                </div>
                <p className="text-2xl font-black text-slate-400">{t("conversations.selectDialog")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-black text-midnight sm:text-xl">{conversationTitle(selected, t)}</h2>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill className="bg-blue-50 text-blue-700 ring-blue-200">{channelLabel(selected.channel, t)}</Pill>
                      {selected.bot_enabled ? <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">{t("conversations.botActive")}</Pill> : <Pill className="bg-slate-100 text-slate-600 ring-slate-200">{t("conversations.botPaused")}</Pill>}
                      {selected.handoff_required ? <Pill className="bg-amber-50 text-amber-700 ring-amber-200">{t("conversations.needsOperator")}</Pill> : null}
                      {selected.client ? <Pill className="bg-white text-slate-500 ring-slate-200">{t("conversations.clientId", { id: selected.client })}</Pill> : null}
                      {selected.lead ? <Pill className="bg-white text-slate-500 ring-slate-200">{t("conversations.leadId", { id: selected.lead })}</Pill> : null}
                      {selected.deal ? <Pill className="bg-white text-slate-500 ring-slate-200">{t("conversations.dealId", { id: selected.deal })}</Pill> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip label={t("conversations.assignTooltip")}>
                      <Button variant="secondary" disabled={!selected} onClick={() => assignMutation.mutate(selected.id)} isLoading={assignMutation.isPending} aria-label={t("conversations.takeDialog")}>
                        <UserCheck size={17} /> <span className="hidden sm:inline">{t("conversations.assign")}</span>
                      </Button>
                    </Tooltip>
                    <Tooltip label={selected.bot_enabled ? t("conversations.pauseBotTooltip") : t("conversations.enableBotTooltip")}>
                      <Button
                        variant="secondary"
                        disabled={!selected}
                        onClick={() => toggleBotMutation.mutate({ conversationId: selected.id, botEnabled: !selected.bot_enabled })}
                        isLoading={toggleBotMutation.isPending}
                        aria-label={selected.bot_enabled ? t("conversations.pauseBot") : t("conversations.enableBot")}
                      >
                        {selected.bot_enabled ? <PauseCircle size={17} /> : <PlayCircle size={17} />}
                      </Button>
                    </Tooltip>
                    <Tooltip label={t("conversations.handoffTooltip")}>
                      <Button
                        variant="secondary"
                        onClick={() => handoffMutation.mutate({ conversationId: selected.id, reason: "manager_requested_from_inbox" })}
                        isLoading={handoffMutation.isPending}
                        aria-label={t("conversations.handoffToOperator")}
                      >
                        <AlertTriangle size={17} />
                      </Button>
                    </Tooltip>
                    {selected.status === "closed" ? (
                      <Tooltip label={t("conversations.reopenTooltip")}>
                        <Button variant="secondary" onClick={() => reopenMutation.mutate(selected.id)} isLoading={reopenMutation.isPending} aria-label={t("conversations.openDialog")}>
                          <PlayCircle size={17} /> {t("common.open")}
                        </Button>
                      </Tooltip>
                    ) : (
                    <Tooltip label={t("conversations.closeTooltip")}>
                        <Button
                          variant="secondary"
                          onClick={() => closeMutation.mutate({ conversationId: selected.id, reason: "closed_from_inbox" })}
                          isLoading={closeMutation.isPending}
                          aria-label={t("conversations.closeDialog")}
                        >
                          <CheckCheck size={17} /> <span className="hidden sm:inline">{t("common.close")}</span>
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pb-28 lg:pb-5">
                {messages.isLoading ? <LoadingState label={t("conversations.loadingHistory")} /> : null}
                {!messages.isLoading && !(messages.data || []).length ? (
                  <EmptyState title={t("conversations.noMessagesTitle")} description={t("conversations.noMessagesText")} />
                ) : null}
                {(messages.data || []).map((message) => (
                  <MessageBubble key={message.id} message={message} t={t} />
                ))}
              </div>

              <div className="border-t border-slate-200 bg-white p-4">
                {selected.status === "closed" ? (
                  <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                    {t("conversations.closedReplyNotice")}
                  </div>
                ) : null}
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <textarea
                    rows={2}
                    className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
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
                    className="h-11 w-11 rounded-2xl px-0"
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

        <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-4 2xl:flex">
          {selected ? (
            <>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <UserRound size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-midnight">{selected.client_name || conversationTitle(selected, t)}</p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-500">{selected.client_phone || selected.external_user_id || t("conversations.noContact")}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-100">{selected.client ? t("common.client") : t("conversations.newContact")}</Pill>
                      <Pill className="bg-slate-50 text-slate-600 ring-slate-200">{channelLabel(selected.channel, t)}</Pill>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("conversations.channel")}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-midnight">{channelLabel(selected.channel, t)}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{selected.bot_enabled ? t("conversations.botActive") : t("conversations.botPaused")}</p>
                  </div>
                  {selected.bot_enabled ? <PlayCircle className="text-emerald-500" size={22} /> : <PauseCircle className="text-amber-500" size={22} />}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("conversations.nextTask")}</p>
                <div className="mt-3 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
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

              <div className="rounded-2xl border border-ai-100 bg-ai-50 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-black text-ai-900"><Sparkles size={18} /> {t("conversations.replyHint")}</p>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-ai-800">
                  {selectedInsight?.intent ? t("conversations.intentLine", { intent: selectedInsight.intent }) : t("conversations.assistantDraftHelp")}
                  {selectedInsight?.confidence !== null && selectedInsight?.confidence !== undefined ? ` ${t("conversations.confidenceLine", { confidence: selectedInsight.confidence })}` : ""}
                </p>
                <div className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold leading-6 text-slate-700">
                  {draft || selectedInsight?.nextAction || t("conversations.prepareDraftFallback")}
                </div>
                <Button className="mt-3 w-full rounded-xl" variant="ai" onClick={() => suggestMutation.mutate(selected.id)} isLoading={suggestMutation.isPending} disabled={!canSuggestAi}>
                  <Sparkles size={16} /> {t("conversations.prepareReply")}
                </Button>
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
