import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
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
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";

type InboxTab = "all" | "errors" | "paused";

const channelLabels: Record<string, string> = {
  website: "Сайт",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

function formatDateTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function conversationTitle(conversation?: InboxConversation | null) {
  if (!conversation) return "Выберите диалог";
  return conversation.client_name || conversation.external_user_id || `Клиент из ${channelLabels[conversation.channel] || conversation.channel}`;
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

function StatCard({ icon, label, value, delta, tone = "brand" }: { icon: React.ReactNode; label: string; value: number | string; delta?: string; tone?: "brand" | "amber" | "blue" | "violet" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-slate-500">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-black text-midnight">{value}</p>
          {delta ? <span className="text-xs font-black text-emerald-600">{delta}</span> : null}
        </div>
      </div>
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
}: {
  conversation: InboxConversation;
  active: boolean;
  selectable: boolean;
  selectedForBulk: boolean;
  onToggleSelected: () => void;
  onClick: () => void;
}) {
  const preview = conversation.last_message?.text || "История пока пустая";
  const initials = conversationTitle(conversation)
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
            aria-label={selectedForBulk ? "Убрать из выбора" : "Выбрать диалог"}
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
            <p className="min-w-0 flex-1 truncate font-black text-midnight">{conversationTitle(conversation)}</p>
            <span className="shrink-0 text-xs font-bold text-slate-400">{formatDateTime(conversation.last_message_at)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-500">{preview}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">{channelLabels[conversation.channel] || conversation.channel}</span>
            {conversation.handoff_required ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-black text-red-600">Без ответа</span> : null}
            {!conversation.handoff_required && !conversation.bot_enabled ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-600">Пауза</span> : null}
          </div>
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: InboxMessage }) {
  const inbound = message.direction === "inbound";
  const ai = message.sender_type === "bot" || message.sender_type === "ai";
  const author = ai ? "AI" : message.sender_type === "manager" ? "Менеджер" : "Клиент";

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
        <p className="whitespace-pre-wrap">{message.text || "Пустое сообщение"}</p>
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
        { key: "website", label: "Сайт" },
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
      setNotice("Диалог назначен на вас.");
      await invalidateInbox();
    },
  });

  const handoffMutation = useMutation({
    mutationFn: inboxApi.handoff,
    onSuccess: async () => {
      setNotice("Диалог передан оператору.");
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
      setNotice("Режим бота обновлен.");
      await invalidateInbox();
    },
  });

  const closeMutation = useMutation({
    mutationFn: inboxApi.closeConversation,
    onSuccess: async () => {
      setNotice("Диалог закрыт.");
      await invalidateInbox();
    },
  });

  const reopenMutation = useMutation({
    mutationFn: inboxApi.reopenConversation,
    onSuccess: async () => {
      setNotice("Диалог открыт.");
      await invalidateInbox();
    },
  });

  const suggestMutation = useMutation({
    mutationFn: inboxApi.suggestReply,
    onSuccess: (data) => {
      setDraft(data.suggested_reply);
      setNotice("AI подготовил черновик ответа.");
    },
  });

  const sendMutation = useMutation({
    mutationFn: inboxApi.sendMessage,
    onSuccess: async () => {
      setDraft("");
      setNotice("Ответ отправлен.");
      await invalidateInbox();
    },
  });

  const retryMessageMutation = useMutation({
    mutationFn: inboxApi.retryMessage,
    onSuccess: async () => {
      setNotice("Сообщение отправлено повторно.");
      await invalidateInbox();
    },
  });

  const createClientMutation = useMutation({
    mutationFn: inboxApi.createClient,
    onSuccess: async (result) => {
      if (result.requires_confirmation && result.duplicates.length) {
        setNotice(`Найден похожий клиент: ${result.duplicates.map((item) => `#${item.id} ${item.full_name}`).join(", ")}`);
        return;
      }
      setNotice(result.created ? "Клиент создан." : "Клиент уже связан.");
      await Promise.all([invalidateInbox(), queryClient.invalidateQueries({ queryKey: ["clients"] })]);
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: inboxApi.createLead,
    onSuccess: async () => {
      setNotice("Лид создан.");
      await Promise.all([invalidateInbox(), queryClient.invalidateQueries({ queryKey: ["leads"] })]);
    },
  });

  const createDealMutation = useMutation({
    mutationFn: inboxApi.createDeal,
    onSuccess: async () => {
      setNotice("Сделка создана.");
      await Promise.all([invalidateInbox(), queryClient.invalidateQueries({ queryKey: ["deals"] })]);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: inboxApi.createTask,
    onSuccess: async () => {
      setNotice("Задача создана.");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const runPipelineMutation = useMutation({
    mutationFn: inboxApi.runPipeline,
    onSuccess: async (result) => {
      const created = Object.entries(result.created)
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(", ");
      const aiSuffix = result.qualification ? ` AI: ${result.qualification.intent}, ${Math.round(result.qualification.confidence * 100)}%.` : "";
      setNotice(created ? `CRM pipeline создан: ${created}.${aiSuffix}` : `CRM pipeline уже связан с диалогом.${aiSuffix}`);
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
      setNotice(`Готово: обработано ${count} диалогов.`);
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
    runPipelineMutation.mutate({ conversationId: selected.id, dealTitle: `Сделка: ${conversationTitle(selected)}` });
  }

  const tabs = [
    { value: "all" as const, label: "Все", count: summary.data?.total ?? 0 },
    { value: "errors" as const, label: "Ошибки", count: summary.data?.handoff_required ?? 0 },
    { value: "paused" as const, label: "Пауза", count: summary.data?.bot_paused ?? 0 },
  ];
  const selectedInsight = selected ? getAutoPipelineInsight(selected) : null;

  return (
    <div className="space-y-4">
      {notice ? <div className="rounded-2xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-bold text-ai-800">{notice}</div> : null}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<MessageSquare size={20} />} label="Всего диалогов" value={summary.data?.total ?? 0} delta="+ за сегодня" tone="brand" />
        <StatCard icon={<AlertTriangle size={20} />} label="Без ответа" value={summary.data?.handoff_required ?? 0} tone="amber" />
        <StatCard icon={<MessageSquare size={20} />} label="В работе" value={summary.data?.assigned_to_me ?? 0} tone="blue" />
        <StatCard icon={<CheckCheck size={20} />} label="Непрочитанные" value={summary.data?.unread_messages ?? 0} tone="violet" />
      </div>

      <section className="grid min-h-[calc(100vh-176px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-soft lg:h-[calc(100vh-176px)] lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(560px,1fr)_300px]">
        <aside className={cn("min-h-0 flex-col border-b border-slate-200 bg-white lg:flex lg:border-b-0 lg:border-r", mobileThreadOpen ? "hidden" : "flex")}>
          <div className="space-y-3 p-5">
            <h1 className="text-2xl font-black tracking-tight text-midnight">Диалоги</h1>
            <Select
              className="min-h-12 rounded-xl text-midnight"
              value={filters.bot || ""}
              onChange={(event) => updateFilters({ ...filters, bot: event.target.value || undefined })}
              options={[
                { value: "", label: "Все AI-агенты" },
                ...(bots.data || []).map((bot) => ({ value: bot.id, label: bot.name })),
              ]}
            />

            <div className="flex gap-2">
              <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-500">
                <Search size={18} />
                <input
                  className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-slate-400"
                  placeholder="Поиск по имени или номеру"
                  value={filters.search || ""}
                  onChange={(event) => updateFilters({ ...filters, search: event.target.value })}
                />
              </label>
              <button
                className={cn("grid h-12 w-12 place-items-center rounded-xl text-slate-600", filtersOpen ? "bg-midnight text-white" : "bg-slate-100")}
                type="button"
                aria-label="Фильтр"
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
                    { value: "", label: "Все каналы" },
                    ...channelOptions.map((channel) => ({
                      value: channel.key,
                      label: channelLabels[channel.key] || channel.label || channel.key,
                    })),
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    className="min-h-10 rounded-xl"
                    value={filters.unread || ""}
                    onChange={(event) => updateFilters({ ...filters, unread: event.target.value || undefined })}
                    options={[
                      { value: "", label: "Все сообщения" },
                      { value: "true", label: "Непрочитанные" },
                      { value: "false", label: "Прочитанные" },
                    ]}
                  />
                  <Select
                    className="min-h-10 rounded-xl"
                    value={filters.assigned_to || ""}
                    onChange={(event) => updateFilters({ ...filters, assigned_to: event.target.value || undefined })}
                    options={[
                      { value: "", label: "Все менеджеры" },
                      { value: "me", label: "Назначены мне" },
                      { value: "unassigned", label: "Без менеджера" },
                    ]}
                  />
                </div>
                <button
                  type="button"
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white text-xs font-black text-slate-500 ring-1 ring-slate-200"
                  onClick={() => updateFilters({ status: "", bot: filters.bot })}
                >
                  <X size={15} /> Сбросить фильтры
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
                  Массовый выбор
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-midnight">Выбрано: {selectedIds.length}</p>
                    <button type="button" className="text-sm font-black text-slate-400" onClick={resetBulkSelection}>
                      Отмена
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("markRead")} isLoading={bulkMutation.isPending}>
                      Прочитано
                    </Button>
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("assign")} isLoading={bulkMutation.isPending}>
                      Взять
                    </Button>
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("pauseBot")} isLoading={bulkMutation.isPending}>
                      Пауза
                    </Button>
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("handoff")} isLoading={bulkMutation.isPending}>
                      Оператору
                    </Button>
                    <Button className="h-8 rounded-xl px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => bulkMutation.mutate("close")} isLoading={bulkMutation.isPending}>
                      Закрыть
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.isLoading ? <div className="p-5"><LoadingState label="Загружаю диалоги" /></div> : null}
            {!conversations.isLoading && !items.length ? (
              <div className="p-5">
                <EmptyState title="Диалогов нет" description="Входящие из подключенных каналов появятся здесь." />
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
              />
            ))}
          </div>
        </aside>

        <main className={cn("min-h-0 flex-col bg-slate-50/40 lg:flex", mobileThreadOpen ? "flex" : "hidden")}>
          {!selected ? (
            <div className="grid flex-1 place-items-center p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
                  <MessageSquare size={26} />
                </div>
                <p className="text-2xl font-black text-slate-400">Выберите диалог</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 lg:hidden"
                        onClick={() => setMobileThreadOpen(false)}
                        aria-label="Вернуться к списку диалогов"
                      >
                        <ArrowLeft size={19} />
                      </button>
                      <h2 className="truncate text-lg font-black text-midnight sm:text-xl">{conversationTitle(selected)}</h2>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill className="bg-blue-50 text-blue-700 ring-blue-200">{channelLabels[selected.channel] || selected.channel}</Pill>
                      {selected.bot_enabled ? <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">бот активен</Pill> : <Pill className="bg-slate-100 text-slate-600 ring-slate-200">бот на паузе</Pill>}
                      {selected.handoff_required ? <Pill className="bg-amber-50 text-amber-700 ring-amber-200">нужен оператор</Pill> : null}
                      {selected.client ? <Pill className="bg-white text-slate-500 ring-slate-200">client #{selected.client}</Pill> : null}
                      {selected.lead ? <Pill className="bg-white text-slate-500 ring-slate-200">lead #{selected.lead}</Pill> : null}
                      {selected.deal ? <Pill className="bg-white text-slate-500 ring-slate-200">deal #{selected.deal}</Pill> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip label="Назначить этот диалог на себя, чтобы было понятно, кто отвечает клиенту.">
                      <Button variant="secondary" disabled={!selected} onClick={() => assignMutation.mutate(selected.id)} isLoading={assignMutation.isPending} aria-label="Взять диалог">
                        <UserCheck size={17} /> <span className="hidden sm:inline">Назначить</span>
                      </Button>
                    </Tooltip>
                    <Tooltip label={selected.bot_enabled ? "Поставить бота на паузу в этом диалоге." : "Включить бота обратно для этого диалога."}>
                      <Button
                        variant="secondary"
                        disabled={!selected}
                        onClick={() => toggleBotMutation.mutate({ conversationId: selected.id, botEnabled: !selected.bot_enabled })}
                        isLoading={toggleBotMutation.isPending}
                        aria-label={selected.bot_enabled ? "Поставить бота на паузу" : "Запустить бота"}
                      >
                        {selected.bot_enabled ? <PauseCircle size={17} /> : <PlayCircle size={17} />}
                      </Button>
                    </Tooltip>
                    <Tooltip label="Передать диалог человеку и выключить автоматическую обработку ботом.">
                      <Button
                        variant="secondary"
                        onClick={() => handoffMutation.mutate({ conversationId: selected.id, reason: "manager_requested_from_inbox" })}
                        isLoading={handoffMutation.isPending}
                        aria-label="Передать оператору"
                      >
                        <AlertTriangle size={17} />
                      </Button>
                    </Tooltip>
                    {selected.status === "closed" ? (
                      <Tooltip label="Вернуть закрытый диалог в работу и снова разрешить ответ менеджера.">
                        <Button variant="secondary" onClick={() => reopenMutation.mutate(selected.id)} isLoading={reopenMutation.isPending} aria-label="Открыть диалог">
                          <PlayCircle size={17} /> Открыть
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip label="Закрыть диалог после обработки. История останется доступной в карточке клиента и inbox.">
                        <Button
                          variant="secondary"
                          onClick={() => closeMutation.mutate({ conversationId: selected.id, reason: "closed_from_inbox" })}
                          isLoading={closeMutation.isPending}
                          aria-label="Закрыть диалог"
                        >
                          <CheckCheck size={17} /> <span className="hidden sm:inline">Закрыть</span>
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {messages.isLoading ? <LoadingState label="Загружаю историю" /> : null}
                {!messages.isLoading && !(messages.data || []).length ? (
                  <EmptyState title="Сообщений пока нет" description="История появится после первого входящего сообщения." />
                ) : null}
                {(messages.data || []).map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>

              <div className="border-t border-slate-200 bg-white p-4">
                {selected.status === "closed" ? (
                  <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                    Диалог закрыт. Откройте его, чтобы ответить.
                  </div>
                ) : null}
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <textarea
                    rows={2}
                    className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
                    disabled={selected.status === "closed" || sendMutation.isPending}
                    placeholder="Напишите ответ клиенту"
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
                    title="Отправить"
                  >
                    <Send size={18} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>

        <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-4 2xl:flex">
          {selected ? (
            <>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <UserRound size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-midnight">{selected.client_name || conversationTitle(selected)}</p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-500">{selected.client_phone || selected.external_user_id || "Контакт не указан"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-100">{selected.client ? "Клиент" : "Новый"}</Pill>
                      <Pill className="bg-slate-50 text-slate-600 ring-slate-200">{channelLabels[selected.channel] || selected.channel}</Pill>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Канал</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-midnight">{channelLabels[selected.channel] || selected.channel}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{selected.bot_enabled ? "Бот активен" : "Бот на паузе"}</p>
                  </div>
                  {selected.bot_enabled ? <PlayCircle className="text-emerald-500" size={22} /> : <PauseCircle className="text-amber-500" size={22} />}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Следующая задача</p>
                <div className="mt-3 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                    <CalendarCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-midnight">{selectedInsight?.nextAction || (selected.handoff_required ? "Ответить клиенту" : "Проверить CRM-цепочку")}</p>
                    <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-black text-brand-600" onClick={runSelectedPipeline}>
                      Открыть в CRM <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-ai-100 bg-ai-50 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-black text-ai-900"><Sparkles size={18} /> AI-подсказка</p>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-ai-700">BETA</span>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-ai-800">
                  {selectedInsight?.intent ? `Намерение: ${selectedInsight.intent}.` : "AI может подготовить черновик ответа и собрать CRM-цепочку."}
                  {selectedInsight?.confidence !== null && selectedInsight?.confidence !== undefined ? ` Уверенность ${selectedInsight.confidence}%.` : ""}
                </p>
                <div className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold leading-6 text-slate-700">
                  {draft || selectedInsight?.nextAction || "Нажмите AI-ответ, чтобы подготовить текст для клиента."}
                </div>
                <Button className="mt-3 w-full rounded-xl" variant="ai" onClick={() => suggestMutation.mutate(selected.id)} isLoading={suggestMutation.isPending}>
                  <Sparkles size={16} /> AI-ответ
                </Button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-center text-sm font-bold text-slate-400">Выберите диалог, чтобы увидеть клиента и подсказки.</div>
          )}
        </aside>
      </section>
    </div>
  );
}
