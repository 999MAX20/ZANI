import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCheck,
  ClipboardList,
  Download,
  ExternalLink,
  Inbox,
  MessageSquare,
  Paperclip,
  PauseCircle,
  PlayCircle,
  Search,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { asArray, getApiErrorMessage } from "../../api/client";
import { fileAttachmentsApi } from "../../api/fileAttachments";
import { inboxApi, type InboxConversation, type InboxFilters, type InboxMessage, type InboxSummary } from "../../api/inbox";
import { quickRepliesApi } from "../../api/quickReplies";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/cn";
import { useI18n, type Language } from "../../lib/i18n";
import { realtimeIntervals, realtimeQueryOptions } from "../../lib/realtime";

const channels: Record<string, { label: string; className: string }> = {
  website: { label: "Website", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  telegram: { label: "Telegram", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  whatsapp: { label: "WhatsApp", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  instagram: { label: "Instagram", className: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" },
};

function localeFor(language: Language) {
  if (language === "kk") return "kk-KZ";
  if (language === "en") return "en-US";
  return "ru-RU";
}

function formatDateTime(value: string | null | undefined, language: Language, emptyText: string) {
  if (!value) return emptyText;
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getConversationTitle(conversation: InboxConversation | null | undefined, emptyTitle: string) {
  if (!conversation) return emptyTitle;
  return conversation.client_name || conversation.external_user_id || `${channels[conversation.channel]?.label || conversation.channel} visitor`;
}

function ChannelBadge({ channel }: { channel: string }) {
  const config = channels[channel] || { label: channel, className: "bg-slate-100 text-slate-700 ring-slate-200" };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", config.className)}>{config.label}</span>;
}

function ConversationListItem({
  conversation,
  active,
  onClick,
}: {
  conversation: InboxConversation;
  active: boolean;
  onClick: () => void;
}) {
  const { language, t } = useI18n();
  const title = getConversationTitle(conversation, t("conversations.selectDialog"));
  const lastText = conversation.last_message?.text || t("conversations.noMessagesShort");

  return (
    <button
      className={cn(
        "w-full border-b border-slate-100 px-4 py-4 text-left transition hover:bg-white",
        active ? "bg-brand-50/80" : "bg-white/40",
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ai-gradient text-sm font-bold text-white shadow-sm">
          {title.slice(0, 1).toUpperCase()}
          {(conversation.unread_count || 0) > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">
              {conversation.unread_count}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold text-midnight">{title}</p>
            <span className="shrink-0 text-xs text-slate-400">{formatDateTime(conversation.last_message_at, language, t("conversations.noMessages"))}</span>
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{lastText}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ChannelBadge channel={conversation.channel} />
            <StatusBadge status={conversation.priority || "normal"} />
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: InboxMessage }) {
  const { language, t } = useI18n();
  const isInbound = message.direction === "inbound";
  const isAi = message.sender_type === "ai" || message.sender_type === "bot";

  return (
    <div className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm",
          isInbound
            ? "border border-slate-100 bg-white text-slate-700"
            : isAi
              ? "bg-ai-50 text-ai-800 ring-1 ring-ai-100"
              : "bg-midnight text-white",
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">
          {isAi ? <Sparkles size={13} /> : null}
          {message.sender_type}
          <span>·</span>
          {formatDateTime(message.created_at, language, t("conversations.noMessages"))}
        </div>
        <p>{message.text || t("conversations.emptyMessage")}</p>
        {message.attachments?.length ? <AttachmentList attachments={message.attachments} compact /> : null}
        {message.status !== "received" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={message.status} />
            {message.error_text ? <span className="text-xs opacity-80">{message.error_text}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AttachmentList({
  attachments,
  compact = false,
}: {
  attachments: NonNullable<InboxConversation["attachments"]>;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-2", compact ? "mt-3" : "")}>
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.download_url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-3 py-2 text-sm font-semibold text-midnight transition hover:-translate-y-0.5 hover:shadow-soft",
            compact && "bg-white/15 text-inherit",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Paperclip size={15} className="shrink-0" />
            <span className="truncate">{attachment.original_name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs opacity-70">
            {Math.max(1, Math.round(attachment.size / 1024))} KB <Download size={14} />
          </span>
        </a>
      ))}
    </div>
  );
}

function groupMessagesByDate(messages: InboxMessage[], language: Language) {
  return messages.reduce<Array<{ date: string; items: InboxMessage[] }>>((groups, message) => {
    const date = new Intl.DateTimeFormat(localeFor(language), { day: "2-digit", month: "long", year: "numeric" }).format(new Date(message.created_at));
    const last = groups[groups.length - 1];
    if (last?.date === date) {
      last.items.push(message);
    } else {
      groups.push({ date, items: [message] });
    }
    return groups;
  }, []);
}

export function ConversationsPage() {
  const { language, t } = useI18n();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<InboxFilters>(() => ({
    status: searchParams.get("status") || "open",
    channel: searchParams.get("channel") || undefined,
    unread: searchParams.get("unread") || undefined,
    assigned_to: searchParams.get("assigned_to") || undefined,
    priority: searchParams.get("priority") || undefined,
    handoff_required: searchParams.get("handoff_required") || undefined,
    search: searchParams.get("search") || undefined,
  }));
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [quickReplySearch, setQuickReplySearch] = useState("");
  const [leadIdInput, setLeadIdInput] = useState("");
  const [clientIdInput, setClientIdInput] = useState("");
  const [dealIdInput, setDealIdInput] = useState("");

  const conversations = useQuery({
    queryKey: ["inbox-conversations", filters],
    queryFn: () => inboxApi.listConversations(filters),
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });

  const inboxSummary = useQuery({
    queryKey: ["inbox-summary"],
    queryFn: inboxApi.getSummary,
    refetchInterval: realtimeIntervals.inboxConversationsMs,
    ...realtimeQueryOptions,
  });

  const items = conversations.data?.results || [];
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);

  useEffect(() => {
    const conversationFromUrl = Number(searchParams.get("conversation") || "");
    if (conversationFromUrl && conversationFromUrl !== selectedId) {
      setSelectedId(conversationFromUrl);
      return;
    }
    if (!selectedId && items[0]) {
      selectConversation(items[0].id);
    }
  }, [items, searchParams, selectedId]);

  const messages = useQuery({
    queryKey: ["inbox-messages", selected?.id],
    queryFn: () => inboxApi.listMessages(selected!.id),
    enabled: Boolean(selected?.id),
    refetchInterval: selected?.id ? realtimeIntervals.inboxMessagesMs : false,
    ...realtimeQueryOptions,
  });
  const groupedMessages = useMemo(() => groupMessagesByDate(messages.data || [], language), [language, messages.data]);
  const quickReplies = useQuery({
    queryKey: ["quick-replies"],
    queryFn: quickRepliesApi.list,
  });
  const visibleQuickReplies = useMemo(() => {
    const query = quickReplySearch.toLowerCase();
    return (quickReplies.data || [])
      .filter((template) => template.is_active)
      .filter((template) => !selected || template.channel === "all" || template.channel === selected.channel)
      .filter((template) => !query || [template.title, template.text, template.category].join(" ").toLowerCase().includes(query))
      .slice(0, 5);
  }, [quickReplies.data, quickReplySearch, selected]);
  const summaryChannels = asArray<InboxSummary["channels"][number]>(inboxSummary.data?.channels);
  const summaryNextActions = asArray<InboxSummary["next_actions"][number]>(inboxSummary.data?.next_actions);

  const invalidateInbox = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-messages", selected?.id] }),
    ]);
  };

  function updateFilters(next: InboxFilters) {
    setFilters(next);
    const nextParams = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value) nextParams.set(key, String(value));
    });
    if (selectedId) nextParams.set("conversation", String(selectedId));
    setSearchParams(nextParams, { replace: true });
  }

  function patchFilters(patch: InboxFilters) {
    updateFilters({ ...filters, ...patch });
  }

  function resetFilters() {
    updateFilters({ status: "open" });
    setNotice(t("conversations.filtersReset"));
  }

  function applyInboxAction(href: string, label: string) {
    const url = new URL(href, window.location.origin);
    const next: InboxFilters = { status: "open" };
    ["channel", "status", "assigned_to", "priority", "bot_enabled", "unread", "handoff_required", "search"].forEach((key) => {
      const value = url.searchParams.get(key);
      if (value) next[key as keyof InboxFilters] = value;
    });
    updateFilters(next);
    navigate(url.pathname + url.search, { replace: true });
    setNotice(t("conversations.filterApplied", { label }));
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
      setNotice(t("conversations.markedRead"));
      await invalidateInbox();
    },
  });

  const markUnreadMutation = useMutation({
    mutationFn: inboxApi.markUnread,
    onSuccess: async () => {
      setNotice(t("conversations.markedUnread"));
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const priorityMutation = useMutation({
    mutationFn: inboxApi.setPriority,
    onSuccess: async () => {
      setNotice(t("conversations.priorityUpdated"));
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const closeConversationMutation = useMutation({
    mutationFn: inboxApi.closeConversation,
    onSuccess: async () => {
      setNotice(t("conversations.closed"));
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const reopenConversationMutation = useMutation({
    mutationFn: inboxApi.reopenConversation,
    onSuccess: async () => {
      setNotice(t("conversations.reopened"));
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const toggleBotMutation = useMutation({
    mutationFn: inboxApi.toggleBot,
    onSuccess: async () => {
      setNotice(t("conversations.botModeUpdated"));
      await invalidateInbox();
    },
  });

  const suggestMutation = useMutation({
    mutationFn: inboxApi.suggestReply,
    onSuccess: (data) => {
      setDraft(data.suggested_reply);
      setNotice(data.is_mock ? t("conversations.aiMockDraftReady") : t("conversations.aiDraftReady"));
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const sendMutation = useMutation({
    mutationFn: inboxApi.sendMessage,
    onSuccess: async () => {
      setDraft("");
      setNotice(t("conversations.replySaved"));
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });
  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => {
      if (!selected) throw new Error(t("conversations.noDialogSelected"));
      return fileAttachmentsApi.upload({
        business: selected.business,
        entityType: "bot_conversation",
        entityId: selected.id,
        file,
      });
    },
    onSuccess: async (attachment) => {
      setNotice(t("conversations.fileUploaded", { name: attachment.original_name }));
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const createTaskMutation = useMutation({
    mutationFn: inboxApi.createTask,
    onSuccess: async (task) => {
      setNotice(t("conversations.taskCreated", { title: task.title }));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const createClientMutation = useMutation({
    mutationFn: inboxApi.createClient,
    onSuccess: async (result) => {
      if (result.requires_confirmation && result.duplicates.length) {
        setNotice(t("conversations.duplicateClientFound", { list: result.duplicates.map((item) => `#${item.id} ${item.full_name}`).join(", ") }));
        return;
      }
      setNotice(result.created ? t("conversations.clientCreated", { name: result.client?.full_name || "" }) : t("conversations.clientAlreadyLinked"));
      await invalidateInbox();
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const linkClientMutation = useMutation({
    mutationFn: inboxApi.linkClient,
    onSuccess: async () => {
      setClientIdInput("");
      setNotice(t("conversations.clientLinked"));
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const createLeadMutation = useMutation({
    mutationFn: inboxApi.createLead,
    onSuccess: async (lead) => {
      setNotice(t("conversations.leadLinked", { id: lead.id }));
      await Promise.all([invalidateInbox(), queryClient.invalidateQueries({ queryKey: ["leads"] })]);
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const createDealMutation = useMutation({
    mutationFn: inboxApi.createDeal,
    onSuccess: async (deal) => {
      setNotice(t("conversations.dealCreated", { title: deal.title }));
      await Promise.all([invalidateInbox(), queryClient.invalidateQueries({ queryKey: ["deals"] })]);
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const linkDealMutation = useMutation({
    mutationFn: inboxApi.linkDeal,
    onSuccess: async () => {
      setDealIdInput("");
      setNotice(t("conversations.dealLinked"));
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const linkLeadMutation = useMutation({
    mutationFn: inboxApi.linkLead,
    onSuccess: async () => {
      setLeadIdInput("");
      setNotice(t("conversations.leadAlreadyLinked"));
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const actionError =
    assignMutation.error ||
    handoffMutation.error ||
    markReadMutation.error ||
    toggleBotMutation.error ||
    markUnreadMutation.error ||
    priorityMutation.error ||
    closeConversationMutation.error ||
    reopenConversationMutation.error ||
    sendMutation.error ||
    suggestMutation.error ||
    uploadAttachmentMutation.error ||
    createTaskMutation.error ||
    createClientMutation.error ||
    createLeadMutation.error ||
    createDealMutation.error ||
    conversations.error ||
    messages.error;

  function sendReply() {
    const text = draft.trim();
    if (!selected || !text) return;
    sendMutation.mutate({ conversationId: selected.id, text });
  }

  function selectConversation(id: number) {
    setSelectedId(id);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("conversation", String(id));
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">{t("conversations.eyebrow")}</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-midnight sm:text-5xl">{t("conversations.title")}</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">{t("conversations.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!selected}
            onClick={() => selected && markReadMutation.mutate(selected.id)}
            isLoading={markReadMutation.isPending}
          >
            <CheckCheck size={18} /> {t("conversations.markRead")}
          </Button>
          <Button
            variant="ai"
            disabled={!selected}
            onClick={() => selected && suggestMutation.mutate(selected.id)}
            isLoading={suggestMutation.isPending}
          >
            <Sparkles size={18} /> {t("conversations.suggestReply")}
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-3xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-semibold text-ai-800">{notice}</div>
      ) : null}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      {inboxSummary.data ? (
        <Card className="border-ai-100 bg-gradient-to-br from-white via-ai-50/40 to-brand-50/40">
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ai-600">{t("conversations.pulse")}</p>
                <h2 className="mt-2 text-2xl font-black text-midnight">{t("conversations.allRequests")}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{inboxSummary.data.pilot_positioning}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-100">
                  <p className="text-2xl font-black text-midnight">{inboxSummary.data.total}</p>
                  <p className="text-xs font-bold text-slate-500">{t("conversations.dialogs")}</p>
                </div>
                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-100">
                  <p className="text-2xl font-black text-red-600">{inboxSummary.data.unread}</p>
                  <p className="text-xs font-bold text-slate-500">{t("conversations.unread")}</p>
                </div>
                <div className="rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-100">
                  <p className="text-2xl font-black text-amber-600">{inboxSummary.data.handoff_required}</p>
                  <p className="text-xs font-bold text-slate-500">{t("conversations.handoff")}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {summaryChannels.map((channel) => (
                <button
                  key={channel.key}
                  className="rounded-3xl border border-slate-100 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
                  onClick={() => patchFilters({ channel: channel.key })}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <ChannelBadge channel={channel.key} />
                    <span className={cn("rounded-full px-2 py-1 text-[11px] font-black uppercase", channel.status === "available" ? "bg-emerald-50 text-emerald-700" : channel.status === "beta" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600")}>{channel.status}</span>
                  </div>
                  <p className="text-2xl font-black text-midnight">{channel.total}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{channel.pilot_note}</p>
                  {channel.unread ? <p className="mt-3 text-xs font-bold text-red-600">{t("conversations.unreadCount", { count: channel.unread })}</p> : null}
                </button>
              ))}
            </div>
            {summaryNextActions.length ? (
              <div className="flex flex-wrap gap-2">
                {summaryNextActions.map((action) => (
                  <Button key={action.label} variant={action.priority === "high" ? "ai" : "secondary"} onClick={() => applyInboxAction(action.href, action.label)}>
                    <AlertTriangle size={16} /> {action.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)_330px]">
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <div className="space-y-3 border-b border-slate-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-midnight">{t("conversations.inbox")}</h2>
                  <p className="text-sm text-slate-500">{t("conversations.dialogsCount", { count: conversations.data?.count ?? 0 })}</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                  <Inbox size={20} />
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                <Search size={17} />
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                  placeholder={t("conversations.search")}
                  value={filters.search || ""}
                  onChange={(event) => patchFilters({ search: event.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.channel || ""}
                  onChange={(event) => patchFilters({ channel: event.target.value })}
                >
                  <option value="">{t("conversations.allChannels")}</option>
                  <option value="website">Website</option>
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.unread || ""}
                  onChange={(event) => patchFilters({ unread: event.target.value })}
                >
                  <option value="">{t("tasks.all")}</option>
                  <option value="true">{t("conversations.unread")}</option>
                  <option value="false">{t("conversations.read")}</option>
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.assigned_to || ""}
                  onChange={(event) => patchFilters({ assigned_to: event.target.value })}
                >
                  <option value="">{t("conversations.allManagers")}</option>
                  <option value="me">{t("conversations.assignedToMeFilter")}</option>
                  <option value="unassigned">{t("leads.unassigned")}</option>
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.priority || ""}
                  onChange={(event) => patchFilters({ priority: event.target.value })}
                >
                  <option value="">{t("conversations.anyPriority")}</option>
                  <option value="low">{t("tasks.priorityLow")}</option>
                  <option value="normal">{t("tasks.priorityNormal")}</option>
                  <option value="high">{t("tasks.priorityHigh")}</option>
                  <option value="urgent">{t("tasks.priorityUrgent")}</option>
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.handoff_required || ""}
                  onChange={(event) => patchFilters({ handoff_required: event.target.value })}
                >
                  <option value="">{t("conversations.allHandoff")}</option>
                  <option value="true">{t("conversations.needsManager")}</option>
                  <option value="false">{t("conversations.noHandoff")}</option>
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.status || ""}
                  onChange={(event) => patchFilters({ status: event.target.value })}
                >
                  <option value="">{t("conversations.allStatuses")}</option>
                  <option value="open">{t("tasks.open")}</option>
                  <option value="closed">{t("leads.close")}</option>
                  <option value="archived">{t("leads.archive")}</option>
                </select>
                <Button variant="secondary" className="col-span-2 justify-center" onClick={resetFilters}>
                  {t("conversations.resetFilters")}
                </Button>
              </div>
            </div>

            {conversations.isLoading ? <LoadingState label={t("conversations.loadingInbox")} /> : null}
            {!conversations.isLoading && items.length === 0 ? (
              <div className="p-4">
                <EmptyState title={t("conversations.emptyTitle")} description={t("conversations.emptyText")} />
              </div>
            ) : null}
            <div className="max-h-[360px] overflow-y-auto xl:max-h-[690px]">
              {items.map((conversation) => (
                <ConversationListItem
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === selected?.id}
                  onClick={() => selectConversation(conversation.id)}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-midnight">{getConversationTitle(selected, t("conversations.selectDialog"))}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected ? <ChannelBadge channel={selected.channel} /> : null}
                {selected ? <StatusBadge status={selected.status} /> : null}
                {selected ? <StatusBadge status={selected.priority || "normal"} /> : null}
                {selected?.handoff_required ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">{t("conversations.handoff")}</span> : null}
                {(selected?.unread_count || 0) > 0 ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">{t("conversations.unreadCount", { count: selected?.unread_count || 0 })}</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!selected}
                onClick={() => selected && assignMutation.mutate(selected.id)}
                isLoading={assignMutation.isPending}
              >
                <UserCheck size={17} /> {t("tasks.assignToMe")}
              </Button>
              <Button
                variant="secondary"
                disabled={!selected}
                onClick={() => selected && toggleBotMutation.mutate({ conversationId: selected.id, botEnabled: !selected.bot_enabled })}
                isLoading={toggleBotMutation.isPending}
              >
                {selected?.bot_enabled ? <PauseCircle size={17} /> : <PlayCircle size={17} />}
                {selected?.bot_enabled ? t("conversations.pauseBot") : t("conversations.enableBot")}
              </Button>
              {selected?.status === "closed" ? (
                <Button
                  variant="ai"
                  disabled={!selected}
                  onClick={() => selected && reopenConversationMutation.mutate(selected.id)}
                  isLoading={reopenConversationMutation.isPending}
                >
                  <PlayCircle size={17} /> {t("leads.reopen")}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={!selected}
                  onClick={() =>
                    selected &&
                    closeConversationMutation.mutate({
                      conversationId: selected.id,
                      reason: t("conversations.closedFromInbox"),
                    })
                  }
                  isLoading={closeConversationMutation.isPending}
                >
                  <CheckCheck size={17} /> {t("leads.close")}
                </Button>
              )}
            </div>
          </div>

          <CardBody className="min-h-[560px] space-y-4 bg-gradient-to-b from-white to-slate-50">
            {!selected ? <EmptyState title={t("conversations.selectDialog")} description={t("conversations.selectDialogText")} /> : null}
            {selected && messages.isLoading ? <LoadingState label={t("conversations.loadingMessages")} /> : null}
            {selected && !messages.isLoading && (messages.data || []).length === 0 ? (
              <EmptyState title={t("conversations.noMessagesTitle")} description={t("conversations.noMessagesText")} />
            ) : null}
            {groupedMessages.map((group) => (
              <div key={group.date} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-400 shadow-sm">{group.date}</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                {group.items.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            ))}
          </CardBody>

          <div className="sticky bottom-[88px] z-10 border-t border-slate-100 bg-white/90 p-3 backdrop-blur-xl lg:static lg:bg-transparent lg:p-4">
            <div className="mb-3 rounded-3xl border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Search size={15} className="text-slate-400" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400"
                  placeholder={t("conversations.quickReplies")}
                  value={quickReplySearch}
                  onChange={(event) => setQuickReplySearch(event.target.value)}
                />
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {visibleQuickReplies.map((template) => (
                  <Button
                    key={template.id}
                    variant="secondary"
                    className="h-8 shrink-0 rounded-xl px-3 text-xs"
                    onClick={() => setDraft((current) => (current ? `${current}\n${template.text}` : template.text))}
                  >
                    {template.title}
                  </Button>
                ))}
                {!quickReplies.isLoading && !visibleQuickReplies.length ? (
                  <span className="text-xs font-medium text-slate-400">{t("conversations.noTemplates")}</span>
                ) : null}
              </div>
            </div>
            {selected?.status === "closed" ? (
              <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                {t("conversations.closedNotice")}
              </div>
            ) : null}
            <div className="flex items-end gap-2 rounded-3xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadAttachmentMutation.mutate(file);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-10 rounded-2xl px-0"
                disabled={!selected || uploadAttachmentMutation.isPending}
                isLoading={uploadAttachmentMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
                title={t("conversations.attachFile")}
              >
                <Paperclip size={17} />
              </Button>
              <textarea
                rows={1}
                className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
                disabled={!selected || selected.status === "closed" || sendMutation.isPending}
                placeholder={selected?.status === "closed" ? t("conversations.closedComposer") : t("conversations.replyPlaceholder")}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendReply();
                }}
              />
              <Button
                variant="ai"
                className="h-10 w-10 rounded-2xl px-0"
                disabled={!selected || selected.status === "closed" || !draft.trim()}
                isLoading={sendMutation.isPending}
                onClick={sendReply}
                title={t("conversations.saveManualReply")}
              >
                <Send size={17} />
              </Button>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-2 2xl:col-span-1">
          <CardBody>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="font-bold text-midnight">{t("conversations.context")}</h2>
                <p className="text-xs text-slate-500">{t("conversations.contextText")}</p>
              </div>
            </div>

            {selected ? (
              <div className="space-y-4">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("common.client")}</p>
                  <p className="mt-2 font-bold text-midnight">{getConversationTitle(selected, t("conversations.selectDialog"))}</p>
                  <p className="mt-1 text-sm text-slate-500">{selected.client_phone || selected.external_user_id || t("conversations.noContact")}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">{selected.client ? `${t("common.client")} #${selected.client}` : t("conversations.clientNotCreated")}</p>
                </div>

                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("conversations.crmLink")}</p>
                  <p className="mt-2 font-bold text-midnight">{selected.lead ? t("crmCard.leadNumber", { id: selected.lead }) : t("conversations.leadNotLinked")}</p>
                  <p className="mt-1 font-bold text-midnight">{selected.deal ? `${t("nav.deals")} #${selected.deal}` : t("conversations.dealNotLinked")}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {selected.lead || selected.deal ? t("conversations.crmContextLinked") : t("conversations.crmContextText")}
                  </p>
                </div>

                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("crmCard.attachments")}</p>
                  <div className="mt-3">
                    {selected.attachments?.length ? (
                      <AttachmentList attachments={selected.attachments} />
                    ) : (
                      <p className="text-sm text-slate-500">{t("conversations.noFiles")}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">{t("conversations.unread")}</p>
                    <p className="mt-1 text-2xl font-black text-midnight">{selected.unread_count || 0}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">{t("conversations.bot")}</p>
                    <p className="mt-1 text-sm font-bold text-midnight">{selected.bot_enabled ? t("conversations.active") : t("conversations.paused")}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("conversations.opsControl")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      className="justify-start"
                      disabled={!selected}
                      onClick={() => selected && markUnreadMutation.mutate(selected.id)}
                      isLoading={markUnreadMutation.isPending}
                    >
                      <MessageSquare size={16} /> {t("conversations.unread")}
                    </Button>
                    <Button
                      variant="secondary"
                      className="justify-start"
                      disabled={!selected}
                      onClick={() =>
                        selected &&
                        priorityMutation.mutate({
                          conversationId: selected.id,
                          priority: selected.priority === "urgent" ? "normal" : "urgent",
                        })
                      }
                      isLoading={priorityMutation.isPending}
                    >
                      <AlertTriangle size={16} /> {selected.priority === "urgent" ? t("tasks.priorityNormal") : t("tasks.priorityUrgent")}
                    </Button>
                  </div>
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                    value={selected.priority || "normal"}
                    onChange={(event) =>
                      selected &&
                      priorityMutation.mutate({
                        conversationId: selected.id,
                        priority: event.target.value as NonNullable<InboxConversation["priority"]>,
                      })
                    }
                  >
                    <option value="low">{t("tasks.priorityLow")}</option>
                    <option value="normal">{t("tasks.priorityNormal")}</option>
                    <option value="high">{t("tasks.priorityHigh")}</option>
                    <option value="urgent">{t("tasks.priorityUrgent")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => selected && handoffMutation.mutate({ conversationId: selected.id, reason: "Manual handoff from inbox" })}
                    isLoading={handoffMutation.isPending}
                  >
                    <AlertTriangle size={17} /> {t("conversations.handoffToManager")}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => selected && (selected.client ? navigate(`/dashboard/clients?client=${selected.client}`) : createClientMutation.mutate({ conversationId: selected.id, full_name: getConversationTitle(selected, t("conversations.selectDialog")) }))}
                    isLoading={createClientMutation.isPending}
                  >
                    <ExternalLink size={17} /> {selected.client ? t("conversations.clientLinkedButton") : t("clients.create")}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => selected && (selected.lead ? navigate(`/dashboard/leads?lead=${selected.lead}`) : createLeadMutation.mutate({ conversationId: selected.id }))}
                    isLoading={createLeadMutation.isPending}
                  >
                    <ExternalLink size={17} /> {selected.lead ? t("conversations.openLinkedLead") : t("leads.create")}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => selected && (selected.deal ? navigate(`/dashboard/deals?deal=${selected.deal}`) : createDealMutation.mutate({ conversationId: selected.id, title: `${t("nav.deals")}: ${getConversationTitle(selected, t("conversations.selectDialog"))}` }))}
                    isLoading={createDealMutation.isPending}
                  >
                    <ExternalLink size={17} /> {selected.deal ? t("conversations.openLinkedDeal") : t("deals.create")}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() =>
                      selected &&
                      createTaskMutation.mutate({
                        conversationId: selected.id,
                        title: t("conversations.followUpTaskTitle", { title: getConversationTitle(selected, t("conversations.selectDialog")) }),
                      })
                    }
                    isLoading={createTaskMutation.isPending}
                  >
                    <ClipboardList size={17} /> {t("tasks.create")}
                  </Button>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("conversations.linkClientById")}</p>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none"
                      placeholder={t("conversations.clientIdPlaceholder")}
                      value={clientIdInput}
                      onChange={(event) => setClientIdInput(event.target.value)}
                    />
                    <Button
                      variant="secondary"
                      disabled={!clientIdInput.trim()}
                      isLoading={linkClientMutation.isPending}
                      onClick={() =>
                        selected &&
                        linkClientMutation.mutate({
                          conversationId: selected.id,
                          clientId: Number(clientIdInput),
                        })
                      }
                    >
                      {t("conversations.link")}
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("conversations.linkLeadById")}</p>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none"
                      placeholder={t("conversations.leadIdPlaceholder")}
                      value={leadIdInput}
                      onChange={(event) => setLeadIdInput(event.target.value)}
                    />
                    <Button
                      variant="secondary"
                      disabled={!leadIdInput.trim()}
                      isLoading={linkLeadMutation.isPending}
                      onClick={() =>
                        selected &&
                        linkLeadMutation.mutate({
                          conversationId: selected.id,
                          leadId: Number(leadIdInput),
                        })
                      }
                    >
                      {t("conversations.link")}
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t("conversations.linkDealById")}</p>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none"
                      placeholder={t("conversations.dealIdPlaceholder")}
                      value={dealIdInput}
                      onChange={(event) => setDealIdInput(event.target.value)}
                    />
                    <Button
                      variant="secondary"
                      disabled={!dealIdInput.trim()}
                      isLoading={linkDealMutation.isPending}
                      onClick={() =>
                        selected &&
                        linkDealMutation.mutate({
                          conversationId: selected.id,
                          dealId: Number(dealIdInput),
                        })
                      }
                    >
                      {t("conversations.link")}
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-ai-100 bg-ai-50 p-4 text-sm leading-6 text-ai-800">
                  <div className="mb-2 flex items-center gap-2 font-bold">
                    <Sparkles size={16} /> {t("conversations.aiDraft")}
                  </div>
                  {t("conversations.aiDraftText")}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
                <MessageSquare className="mb-3 text-slate-400" size={20} />
                {t("conversations.selectContext")}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
