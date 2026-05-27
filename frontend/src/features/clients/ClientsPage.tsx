import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  Edit3,
  Inbox,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Tags,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { segmentFiltersApi, segmentsApi, taggedObjectsApi, tagsApi } from "../../api/activities";
import { clientsApi } from "../../api/clients";
import { getApiErrorMessage, unwrapList } from "../../api/client";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { ClientForm } from "../../components/forms/ClientForm";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { FilterChips, IconBubble } from "../../components/ui/Primitives";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment, BotConversation, Client, Deal, Id, Lead, SegmentFilter, Task } from "../../types";

type SegmentDraft = {
  name: string;
  field: SegmentFilter["field"];
  operator: SegmentFilter["operator"];
  value: string;
};

type ClientQuickFilter = "all" | "new" | "with_leads" | "with_deals" | "with_bookings" | "tagged";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "К";
}

function sourceLabel(source?: string) {
  const labels: Record<string, string> = {
    website: "Сайт",
    landing: "Лендинг",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    manual: "Вручную",
    parser: "Парсер",
    other: "Другое",
  };
  return labels[source || ""] || source || "Другое";
}

function money(value: string | number, currency = "KZT") {
  return `${Number(value || 0).toLocaleString("ru-RU")} ${currency}`;
}

function ClientListItem({
  client,
  leadCount,
  dealCount,
  bookingCount,
  tags,
  selected,
  onSelect,
}: {
  client: Client;
  leadCount: number;
  dealCount: number;
  bookingCount: number;
  tags: Array<{ id: Id; tag_name?: string; tag_color?: string }>;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = bookingCount ? "Записи" : dealCount ? "Сделки" : leadCount ? "Заявки" : "Новый";
  const statusClass = bookingCount
    ? "bg-emerald-50 text-emerald-700"
    : dealCount
      ? "bg-brand-50 text-brand-700"
      : leadCount
        ? "bg-ai-50 text-ai-700"
        : "bg-slate-100 text-slate-600";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${
        selected ? "border-brand-200 bg-white ring-4 ring-brand-100" : "border-white/75 bg-white/82"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ai-50 text-sm font-black text-ai-700 ring-1 ring-ai-100">
          {initials(client.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-black text-midnight">{client.full_name}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">{client.phone || client.email || "Контактов нет"}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass}`}>{status}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span>{sourceLabel(client.source)}</span>
            <span>·</span>
            <span>{formatDate(client.created_at)}</span>
            {tags.slice(0, 2).map((tag) => (
              <span key={tag.id} className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{tag.tag_name}</span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/65 p-8 text-center">
      <IconBubble icon={UsersRound} tone="slate" className="mx-auto" />
      <p className="mt-4 font-black text-midnight">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function TimelineRow({
  icon,
  title,
  meta,
  badge,
}: {
  icon: typeof Inbox;
  title: string;
  meta: string;
  badge?: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-slate-100">
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-midnight">{title}</p>
          {badge}
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-500">{meta}</p>
      </div>
    </div>
  );
}

export function ClientsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { clients, leads, deals, appointments, tasks, botConversations, tags, taggedObjects, segments } = useEntityData({
    clients: true,
    leads: true,
    deals: true,
    appointments: true,
    tasks: true,
    botConversations: true,
    tags: true,
    taggedObjects: true,
    segments: true,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<Id | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [quickFilter, setQuickFilter] = useState<ClientQuickFilter>("all");
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>({ name: "", field: "source", operator: "equals", value: "" });

  const filteredClients = useQuery({
    queryKey: ["clients", "filtered", search, source, selectedTag, selectedSegment],
    queryFn: () => clientsApi.listFiltered({ q: search || undefined, source: source || undefined, tag: selectedTag || undefined, segment: selectedSegment || undefined }),
  });

  const mutation = useMutation({
    mutationFn: (payload: Partial<Client>) => editing ? clientsApi.update({ id: editing.id, payload }) : clientsApi.create(payload),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setEditing(undefined);
      setSelectedClientId(client.id);
      clearCreateParam();
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: number; duplicateId: number }) => clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setOpen(false);
      setEditing(undefined);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: clientsApi.archive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const tagList = unwrapList(tags.data);
  const addTagMutation = useMutation({
    mutationFn: async ({ clientId, tagName }: { clientId: Id; tagName: string }) => {
      const existing = tagList.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
      const tag = existing || await tagsApi.create({ business: business!.id, name: tagName, color: "#2563eb", source: "manual" });
      return taggedObjectsApi.create({ business: business!.id, tag: tag.id, entity_type: "client", entity_id: String(clientId) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["tagged-objects"] });
      queryClient.invalidateQueries({ queryKey: ["crm-card"] });
    },
  });

  const createSegmentMutation = useMutation({
    mutationFn: async () => {
      const segment = await segmentsApi.create({
        business: business!.id,
        name: segmentDraft.name,
        description: "Saved client filter",
        entity_type: "client",
        is_active: true,
      });
      await segmentFiltersApi.create({
        business: business!.id,
        segment: segment.id,
        field: segmentDraft.field,
        operator: segmentDraft.operator,
        value_json: { value: segmentDraft.value },
        sort_order: 1,
      });
      await segmentsApi.refreshCount(segment.id);
      return segment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      setSegmentDraft({ name: "", field: "source", operator: "equals", value: "" });
      setSegmentOpen(false);
    },
  });

  function clearCreateParam() {
    if (!searchParams.get("create")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    const clientId = Number(searchParams.get("client") || "");
    if (clientId) setSelectedClientId(clientId);
    if (searchParams.get("create") === "1") {
      setEditing(undefined);
      setOpen(true);
    }
  }, [searchParams]);

  const clientList = unwrapList<Client>(clients.data);
  const leadList = unwrapList<Lead>(leads.data);
  const dealList = unwrapList<Deal>(deals.data);
  const appointmentList = unwrapList<Appointment>(appointments.data);
  const taskList = unwrapList<Task>(tasks.data);
  const conversationList = unwrapList<BotConversation>(botConversations.data);
  const taggedObjectList = unwrapList(taggedObjects.data);
  const segmentList = unwrapList(segments.data);
  const hasActiveFilters = Boolean(search || source || selectedTag || selectedSegment);
  const baseRows = hasActiveFilters ? unwrapList<Client>(filteredClients.data) : clientList;

  const clientTags = useMemo(() => {
    const map: Record<string, typeof taggedObjectList> = {};
    taggedObjectList.forEach((item) => {
      if (item.entity_type !== "client") return;
      map[item.entity_id] = map[item.entity_id] || [];
      map[item.entity_id]?.push(item);
    });
    return map;
  }, [taggedObjectList]);

  const leadClientIds = new Set(leadList.map((lead) => lead.client));
  const dealClientIds = new Set(dealList.map((deal) => deal.client));
  const appointmentClientIds = new Set(appointmentList.map((appointment) => appointment.client));
  const taggedClientIds = new Set(taggedObjectList.filter((item) => item.entity_type === "client").map((item) => item.entity_id));
  const rows = baseRows.filter((client) => {
    if (quickFilter === "new") return !leadClientIds.has(client.id) && !dealClientIds.has(client.id) && !appointmentClientIds.has(client.id);
    if (quickFilter === "with_leads") return leadClientIds.has(client.id);
    if (quickFilter === "with_deals") return dealClientIds.has(client.id);
    if (quickFilter === "with_bookings") return appointmentClientIds.has(client.id);
    if (quickFilter === "tagged") return taggedClientIds.has(String(client.id));
    return true;
  });

  useEffect(() => {
    if (selectedClientId && rows.some((client) => client.id === selectedClientId)) return;
    setSelectedClientId(rows[0]?.id || null);
  }, [rows, selectedClientId]);

  const selectedClient = clientList.find((client) => client.id === selectedClientId) || rows[0] || null;
  const selectedLeads = selectedClient ? leadList.filter((lead) => lead.client === selectedClient.id).sort((a, b) => b.created_at.localeCompare(a.created_at)) : [];
  const selectedDeals = selectedClient ? dealList.filter((deal) => deal.client === selectedClient.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : [];
  const selectedAppointments = selectedClient ? appointmentList.filter((appointment) => appointment.client === selectedClient.id).sort((a, b) => b.start_at.localeCompare(a.start_at)) : [];
  const selectedTasks = selectedClient ? taskList.filter((task) => task.client === selectedClient.id && !["done", "cancelled"].includes(task.status)).sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || ""))) : [];
  const selectedConversations = selectedClient ? conversationList.filter((conversation) => conversation.client === selectedClient.id).sort((a, b) => String(b.last_message_at || b.updated_at).localeCompare(String(a.last_message_at || a.updated_at))) : [];
  const openDealValue = selectedDeals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const clientsWithoutActivity = clientList.filter((client) => !leadClientIds.has(client.id) && !dealClientIds.has(client.id) && !appointmentClientIds.has(client.id)).length;

  const quickFilterOptions = [
    { value: "all" as const, label: `Все ${clientList.length}` },
    { value: "new" as const, label: `Новые ${clientsWithoutActivity}` },
    { value: "with_leads" as const, label: `С заявками ${leadClientIds.size}` },
    { value: "with_deals" as const, label: `Со сделками ${dealClientIds.size}` },
    { value: "with_bookings" as const, label: `С записями ${appointmentClientIds.size}` },
    { value: "tagged" as const, label: `С тегами ${taggedClientIds.size}` },
  ];

  const sourceOptions = [
    { value: "", label: "Все источники" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "telegram", label: "Telegram" },
    { value: "instagram", label: "Instagram" },
    { value: "website", label: "Сайт" },
    { value: "manual", label: "Вручную" },
  ];

  if (!business) return <ErrorState message={t("clients.noBusiness")} />;
  if (clients.isLoading || filteredClients.isLoading || leads.isLoading || deals.isLoading || appointments.isLoading) return <LoadingState />;

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">Клиенты</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-midnight sm:text-5xl">Профиль клиента</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Список клиентов слева, рабочий профиль справа: история заявок, сделок, записей, сообщений и быстрые действия.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSegmentOpen(true)}><Tags size={18} /> Сегмент</Button>
          <Button onClick={() => setOpen(true)}><Plus size={18} /> Создать клиента</Button>
        </div>
      </div>

      {mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error ? (
        <div className="mt-4"><ErrorState message={getApiErrorMessage(mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error)} /></div>
      ) : null}

      <section className="my-5 rounded-3xl border border-white/75 bg-white/82 p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
          <Input placeholder="Поиск по имени, телефону или email" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} options={[{ value: "", label: "Все теги" }, ...tagList.map((tag) => ({ value: tag.id, label: tag.name }))]} />
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)]">
          <Select value={selectedSegment} onChange={(event) => setSelectedSegment(event.target.value)} options={[{ value: "", label: "Все сегменты" }, ...segmentList.map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.cached_count})` }))]} />
          <div className="min-w-0 rounded-2xl border border-slate-100 bg-white/55 p-2">
            <FilterChips value={quickFilter} options={quickFilterOptions} onChange={setQuickFilter} />
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-slate-100 bg-white/55 p-2">
            <FilterChips value={source} options={sourceOptions} onChange={setSource} />
        </div>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.35fr)]">
        <div className="rounded-[2rem] border border-white/75 bg-white/72 p-3 shadow-sm xl:sticky xl:top-5">
          <div className="flex items-center justify-between px-2 py-2">
            <div>
              <h2 className="text-lg font-black text-midnight">Клиентская база</h2>
              <p className="mt-1 text-xs font-bold text-slate-400">Прокрутка списка внутри панели</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{rows.length}</span>
          </div>
          <div className="mt-2 max-h-[min(760px,calc(100vh-320px))] min-h-[420px] space-y-3 overflow-y-auto pr-1">
            {rows.map((client) => (
              <ClientListItem
                key={client.id}
                client={client}
                leadCount={leadList.filter((lead) => lead.client === client.id).length}
                dealCount={dealList.filter((deal) => deal.client === client.id).length}
                bookingCount={appointmentList.filter((appointment) => appointment.client === client.id).length}
                tags={clientTags[String(client.id)] || []}
                selected={selectedClient?.id === client.id}
                onSelect={() => setSelectedClientId(client.id)}
              />
            ))}
            {!rows.length ? <EmptyState title="Клиенты не найдены" text="Измените фильтры или создайте клиента вручную." /> : null}
          </div>
        </div>

        {selectedClient ? (
          <div className="rounded-[2rem] border border-white/75 bg-white/86 p-5 shadow-soft">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-ai-50 text-lg font-black text-ai-700 ring-1 ring-ai-100">
                  {initials(selectedClient.full_name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">{sourceLabel(selectedClient.source)}</span>
                    {selectedClient.is_archived ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Архив</span> : null}
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-midnight">{selectedClient.full_name}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">{selectedClient.phone || selectedClient.email || "Контактов нет"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedClient.phone ? (
                  <Button variant="secondary" onClick={() => window.open(`https://wa.me/${selectedClient.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}>
                    <Phone size={16} /> WhatsApp
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => { setEditing(selectedClient); setOpen(true); }}>
                  <Edit3 size={16} /> Изменить
                </Button>
                <Button variant="ghost" onClick={() => setDrawerEntity({ type: "client", id: selectedClient.id })}>
                  Полная карточка <MoreHorizontal size={16} />
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Заявки</p>
                <p className="mt-2 text-2xl font-black text-midnight">{selectedLeads.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Сделки</p>
                <p className="mt-2 text-2xl font-black text-midnight">{selectedDeals.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Открыто</p>
                <p className="mt-2 text-2xl font-black text-midnight">{money(openDealValue)}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Записи</p>
                <p className="mt-2 text-2xl font-black text-midnight">{selectedAppointments.length}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Диалоги</p>
                <p className="mt-2 text-2xl font-black text-midnight">{selectedConversations.length}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-black text-midnight">
                      <ClipboardList size={18} className="text-brand-600" /> Быстрые действия
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button variant="secondary" onClick={() => setDrawerEntity({ type: "client", id: selectedClient.id })}>
                      <UserRound size={16} /> Карточка
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const tagName = window.prompt("Название тега");
                        if (tagName) addTagMutation.mutate({ clientId: selectedClient.id, tagName });
                      }}
                    >
                      <Tags size={16} /> Добавить тег
                    </Button>
                    <Button variant="secondary" onClick={() => setOpen(true)}>
                      <Plus size={16} /> Новый клиент
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const reason = window.prompt("Причина архивации");
                        if (reason !== null) archiveMutation.mutate({ id: selectedClient.id, reason });
                      }}
                    >
                      Архивировать
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                    <Tags size={18} className="text-brand-600" /> Теги и заметки
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(clientTags[String(selectedClient.id)] || []).map((tag) => (
                      <span key={tag.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{tag.tag_name}</span>
                    ))}
                    {!clientTags[String(selectedClient.id)]?.length ? <span className="text-sm font-semibold text-slate-500">Тегов пока нет.</span> : null}
                  </div>
                  {selectedClient.notes ? <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{selectedClient.notes}</p> : null}
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                    <ClipboardList size={18} className="text-brand-600" /> Активные задачи
                  </div>
                  <div className="space-y-2">
                    {selectedTasks.slice(0, 5).map((task: Task) => (
                      <TimelineRow key={task.id} icon={ClipboardList} title={task.title} meta={`${task.priority} · ${formatDateTime(task.due_at)}`} />
                    ))}
                    {!selectedTasks.length ? <p className="text-sm font-semibold text-slate-500">Активных задач нет.</p> : null}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white p-4">
                <div className="mb-4 flex items-center gap-2 font-black text-midnight">
                  <CalendarCheck size={18} className="text-brand-600" /> История клиента
                </div>
                <div className="space-y-3">
                  {selectedLeads.slice(0, 4).map((lead: Lead) => (
                    <TimelineRow key={`lead-${lead.id}`} icon={Inbox} title={`Заявка #${lead.id}`} meta={`${sourceLabel(lead.source)} · ${formatDateTime(lead.created_at)}`} badge={<StatusBadge status={lead.status} />} />
                  ))}
                  {selectedDeals.slice(0, 4).map((deal: Deal) => (
                    <TimelineRow key={`deal-${deal.id}`} icon={CircleDollarSign} title={deal.title} meta={`${money(deal.amount, deal.currency)} · ${formatDateTime(deal.updated_at)}`} badge={<StatusBadge status={deal.status} />} />
                  ))}
                  {selectedAppointments.slice(0, 4).map((appointment: Appointment) => (
                    <TimelineRow key={`appointment-${appointment.id}`} icon={CalendarCheck} title={`Запись #${appointment.id}`} meta={`${formatDateTime(appointment.start_at)} · ${sourceLabel(appointment.source)}`} badge={<StatusBadge status={appointment.status} />} />
                  ))}
                  {selectedConversations.slice(0, 4).map((conversation: BotConversation) => (
                    <TimelineRow
                      key={`conversation-${conversation.id}`}
                      icon={MessageCircle}
                      title={`${sourceLabel(conversation.channel)} · ${conversation.status}`}
                      meta={conversation.last_message?.text || formatDateTime(conversation.last_message_at || conversation.updated_at)}
                      badge={conversation.unread_count ? <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-black text-brand-700">{conversation.unread_count}</span> : null}
                    />
                  ))}
                  {!selectedLeads.length && !selectedDeals.length && !selectedAppointments.length && !selectedConversations.length ? (
                    <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">История пока пустая. Клиента можно связать с заявкой, сделкой или записью.</p>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <EmptyState title="Выберите клиента" text="Справа появится рабочий профиль с историей и быстрыми действиями." />
        )}
      </section>

      <Modal title={editing ? "Изменить клиента" : "Создать клиента"} open={open} onClose={() => { setOpen(false); setEditing(undefined); clearCreateParam(); }}>
        <ClientForm
          businessId={business.id}
          initial={editing}
          onSubmit={(payload) => mutation.mutateAsync(payload)}
          onOpenClient={(id) => {
            setOpen(false);
            setEditing(undefined);
            setSelectedClientId(id);
          }}
          onMergeDuplicate={(duplicateId) => {
            if (!editing) return Promise.resolve();
            return mergeMutation.mutateAsync({ targetId: editing.id, duplicateId });
          }}
        />
      </Modal>

      <Modal title="Создать сегмент" open={segmentOpen} onClose={() => setSegmentOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createSegmentMutation.mutate();
          }}
        >
          <Input label="Название сегмента" value={segmentDraft.name} onChange={(event) => setSegmentDraft({ ...segmentDraft, name: event.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Поле"
              value={segmentDraft.field}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, field: event.target.value as SegmentDraft["field"] })}
              options={[
                { value: "source", label: "Источник" },
                { value: "tag", label: "Тег" },
                { value: "full_name", label: "Имя" },
                { value: "phone", label: "Телефон" },
                { value: "email", label: "Email" },
                { value: "notes", label: "Заметки" },
              ]}
            />
            <Select
              label="Условие"
              value={segmentDraft.operator}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, operator: event.target.value as SegmentDraft["operator"] })}
              options={[
                { value: "equals", label: "Равно" },
                { value: "contains", label: "Содержит" },
                { value: "in", label: "В списке" },
                { value: "is_empty", label: "Пусто" },
                { value: "not_empty", label: "Не пусто" },
              ]}
            />
          </div>
          {segmentDraft.field === "tag" ? (
            <Select
              label="Значение"
              value={segmentDraft.value}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })}
              options={[{ value: "", label: "Выберите тег" }, ...tagList.map((tag) => ({ value: String(tag.id), label: tag.name }))]}
            />
          ) : (
            <Input label="Значение" value={segmentDraft.value} onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })} />
          )}
          <Button type="submit" isLoading={createSegmentMutation.isPending} disabled={!segmentDraft.name}>
            Сохранить сегмент
          </Button>
        </form>
      </Modal>

      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
