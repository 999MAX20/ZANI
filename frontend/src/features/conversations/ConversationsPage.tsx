import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCheck,
  ClipboardList,
  ExternalLink,
  Inbox,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Search,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { botAiApi } from "../../api/bots";
import { getApiErrorMessage } from "../../api/client";
import { inboxApi, type InboxConversation, type InboxFilters, type InboxMessage } from "../../api/inbox";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/cn";

const channels: Record<string, { label: string; className: string }> = {
  website: { label: "Website", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  telegram: { label: "Telegram", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  whatsapp: { label: "WhatsApp", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  instagram: { label: "Instagram", className: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" },
};

function formatDateTime(value?: string | null) {
  if (!value) return "Нет сообщений";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getConversationTitle(conversation?: InboxConversation | null) {
  if (!conversation) return "Выберите диалог";
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
  const title = getConversationTitle(conversation);
  const lastText = conversation.last_message?.text || "Пока нет сообщений";

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
            <span className="shrink-0 text-xs text-slate-400">{formatDateTime(conversation.last_message_at)}</span>
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
          {formatDateTime(message.created_at)}
        </div>
        <p>{message.text || "Пустое сообщение"}</p>
      </div>
    </div>
  );
}

export function ConversationsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<InboxFilters>({ status: "open" });
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [leadIdInput, setLeadIdInput] = useState("");

  const conversations = useQuery({
    queryKey: ["inbox-conversations", filters],
    queryFn: () => inboxApi.listConversations(filters),
  });

  const items = conversations.data?.results || [];
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);

  useEffect(() => {
    if (!selectedId && items[0]) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const messages = useQuery({
    queryKey: ["inbox-messages", selected?.id],
    queryFn: () => inboxApi.listMessages(selected!.id),
    enabled: Boolean(selected?.id),
  });

  const invalidateInbox = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] }),
      queryClient.invalidateQueries({ queryKey: ["inbox-messages", selected?.id] }),
    ]);
  };

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
      setNotice("Бот остановлен, диалог передан менеджеру.");
      await invalidateInbox();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: inboxApi.markRead,
    onSuccess: async () => {
      setNotice("Диалог отмечен прочитанным.");
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

  const suggestMutation = useMutation({
    mutationFn: botAiApi.suggestReply,
    onSuccess: (data) => setNotice(`AI draft: ${data.suggested_reply}`),
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const sendMutation = useMutation({
    mutationFn: inboxApi.sendMessage,
    onSuccess: async () => {
      setDraft("");
      setNotice("Ответ менеджера сохранен в диалоге. Реальная отправка в канал будет подключена отдельно.");
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const createTaskMutation = useMutation({
    mutationFn: inboxApi.createTask,
    onSuccess: async (task) => {
      setNotice(`Задача создана: ${task.title}`);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const createLeadMutation = useMutation({
    mutationFn: inboxApi.createLead,
    onSuccess: async (lead) => {
      setNotice(`Заявка #${lead.id} связана с диалогом.`);
      await Promise.all([invalidateInbox(), queryClient.invalidateQueries({ queryKey: ["leads"] })]);
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const linkLeadMutation = useMutation({
    mutationFn: inboxApi.linkLead,
    onSuccess: async () => {
      setLeadIdInput("");
      setNotice("Существующая заявка связана с диалогом.");
      await invalidateInbox();
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const actionError =
    assignMutation.error ||
    handoffMutation.error ||
    markReadMutation.error ||
    toggleBotMutation.error ||
    conversations.error ||
    messages.error;

  function sendReply() {
    const text = draft.trim();
    if (!selected || !text) return;
    sendMutation.mutate({ conversationId: selected.id, text });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">Unified inbox</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-midnight sm:text-5xl">Conversations</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">Реальный inbox для сайта, Telegram и будущих каналов без демо-данных.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!selected}
            onClick={() => selected && markReadMutation.mutate(selected.id)}
            isLoading={markReadMutation.isPending}
          >
            <CheckCheck size={18} /> Mark read
          </Button>
          <Button
            variant="ai"
            disabled={!selected}
            onClick={() => selected && suggestMutation.mutate(selected.id)}
            isLoading={suggestMutation.isPending}
          >
            <Sparkles size={18} /> Suggest reply
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-3xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-semibold text-ai-800">{notice}</div>
      ) : null}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)_330px]">
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <div className="space-y-3 border-b border-slate-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-midnight">Inbox</h2>
                  <p className="text-sm text-slate-500">{conversations.data?.count ?? 0} диалогов</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                  <Inbox size={20} />
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                <Search size={17} />
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                  placeholder="Поиск по клиенту, телефону, тексту..."
                  value={filters.search || ""}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.channel || ""}
                  onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}
                >
                  <option value="">Все каналы</option>
                  <option value="website">Website</option>
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.unread || ""}
                  onChange={(event) => setFilters((current) => ({ ...current, unread: event.target.value }))}
                >
                  <option value="">Все</option>
                  <option value="true">Непрочитанные</option>
                  <option value="false">Прочитанные</option>
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.assigned_to || ""}
                  onChange={(event) => setFilters((current) => ({ ...current, assigned_to: event.target.value }))}
                >
                  <option value="">Все менеджеры</option>
                  <option value="me">Назначены на меня</option>
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  value={filters.priority || ""}
                  onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
                >
                  <option value="">Любой приоритет</option>
                  <option value="low">Низкий</option>
                  <option value="normal">Обычный</option>
                  <option value="high">Высокий</option>
                  <option value="urgent">Срочный</option>
                </select>
              </div>
            </div>

            {conversations.isLoading ? <LoadingState label="Загружаем inbox..." /> : null}
            {!conversations.isLoading && items.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Диалогов пока нет" description="Новые обращения с сайта и Telegram появятся здесь автоматически." />
              </div>
            ) : null}
            <div className="max-h-[690px] overflow-y-auto">
              {items.map((conversation) => (
                <ConversationListItem
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === selected?.id}
                  onClick={() => setSelectedId(conversation.id)}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-midnight">{getConversationTitle(selected)}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected ? <ChannelBadge channel={selected.channel} /> : null}
                {selected ? <StatusBadge status={selected.status} /> : null}
                {selected ? <StatusBadge status={selected.priority || "normal"} /> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!selected}
                onClick={() => selected && assignMutation.mutate(selected.id)}
                isLoading={assignMutation.isPending}
              >
                <UserCheck size={17} /> Assign to me
              </Button>
              <Button
                variant="secondary"
                disabled={!selected}
                onClick={() => selected && toggleBotMutation.mutate({ conversationId: selected.id, botEnabled: !selected.bot_enabled })}
                isLoading={toggleBotMutation.isPending}
              >
                {selected?.bot_enabled ? <PauseCircle size={17} /> : <PlayCircle size={17} />}
                {selected?.bot_enabled ? "Pause bot" : "Enable bot"}
              </Button>
            </div>
          </div>

          <CardBody className="min-h-[560px] space-y-4 bg-gradient-to-b from-white to-slate-50">
            {!selected ? <EmptyState title="Выберите диалог" description="Сообщения выбранного клиента появятся в этой ленте." /> : null}
            {selected && messages.isLoading ? <LoadingState label="Загружаем сообщения..." /> : null}
            {selected && !messages.isLoading && (messages.data || []).length === 0 ? (
              <EmptyState title="Сообщений пока нет" description="Когда клиент напишет в подключенный канал, история будет здесь." />
            ) : null}
            {(messages.data || []).map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </CardBody>

          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white px-3 py-2">
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                disabled={!selected || sendMutation.isPending}
                placeholder="Напишите ответ клиенту..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendReply();
                }}
              />
              <Button
                variant="ai"
                className="h-10 w-10 rounded-2xl px-0"
                disabled={!selected || !draft.trim()}
                isLoading={sendMutation.isPending}
                onClick={sendReply}
                title="Сохранить ручной ответ"
              >
                <Send size={17} />
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="font-bold text-midnight">Context</h2>
                <p className="text-xs text-slate-500">CRM actions and conversation state</p>
              </div>
            </div>

            {selected ? (
              <div className="space-y-4">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Клиент</p>
                  <p className="mt-2 font-bold text-midnight">{getConversationTitle(selected)}</p>
                  <p className="mt-1 text-sm text-slate-500">{selected.client_phone || selected.external_user_id || "Контакт не указан"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Unread</p>
                    <p className="mt-1 text-2xl font-black text-midnight">{selected.unread_count || 0}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Bot</p>
                    <p className="mt-1 text-sm font-bold text-midnight">{selected.bot_enabled ? "Active" : "Paused"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => selected && handoffMutation.mutate({ conversationId: selected.id, reason: "Manual handoff from inbox" })}
                    isLoading={handoffMutation.isPending}
                  >
                    <AlertTriangle size={17} /> Handoff to manager
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => selected && createLeadMutation.mutate({ conversationId: selected.id })}
                    isLoading={createLeadMutation.isPending}
                  >
                    <ExternalLink size={17} /> {selected.lead ? "Open linked lead" : "Create lead"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() =>
                      selected &&
                      createTaskMutation.mutate({
                        conversationId: selected.id,
                        title: `Follow up: ${getConversationTitle(selected)}`,
                      })
                    }
                    isLoading={createTaskMutation.isPending}
                  >
                    <ClipboardList size={17} /> Create task
                  </Button>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Link lead by ID</p>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none"
                      placeholder="Lead ID"
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
                      Link
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-ai-100 bg-ai-50 p-4 text-sm leading-6 text-ai-800">
                  <div className="mb-2 flex items-center gap-2 font-bold">
                    <Sparkles size={16} /> AI draft
                  </div>
                  Нажмите “Suggest reply”, чтобы получить черновик ответа. Автоотправки здесь нет.
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
                <MessageSquare className="mb-3 text-slate-400" size={20} />
                Выберите диалог, чтобы увидеть CRM-контекст.
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
