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
  Send,
  Sparkles,
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
import { WorkQueueDetailPane, WorkQueueLayout, WorkQueueListPane } from "../../components/layout/WorkQueueLayout";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { MetricCard } from "../../components/ui/MetricCard";
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
    .toUpperCase() || "C";
}

type Translate = ReturnType<typeof useI18n>["t"];

function sourceLabel(source: string | undefined, t: Translate) {
  const labels: Record<string, string> = {
    website: "clients.sourceWebsite",
    landing: "clients.sourceLanding",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    manual: "clients.sourceManual",
    parser: "clients.sourceParser",
    other: "clients.sourceOther",
  };
  const label = labels[source || ""];
  return label ? t(label) : source || t("clients.sourceOther");
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
  t,
}: {
  client: Client;
  leadCount: number;
  dealCount: number;
  bookingCount: number;
  tags: Array<{ id: Id; tag_name?: string; tag_color?: string }>;
  selected: boolean;
  onSelect: () => void;
  t: Translate;
}) {
  const status = bookingCount ? t("clients.statusBookings") : dealCount ? t("clients.statusDeals") : leadCount ? t("clients.statusLeads") : t("clients.statusNew");
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
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">{client.phone || client.email || t("clients.noContacts")}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass}`}>{status}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span>{sourceLabel(client.source, t)}</span>
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

function ClientEmptyState({ title, text }: { title: string; text: string }) {
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
  const [tagOpen, setTagOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<Id | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [quickFilter, setQuickFilter] = useState<ClientQuickFilter>("all");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setArchiveOpen(false);
      setArchiveReason("");
    },
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
      setTagOpen(false);
      setTagDraft("");
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

  function openClient(clientId: Id) {
    setSelectedClientId(clientId);
    setMobileDetailOpen(true);
  }

  const selectedClient = clientList.find((client) => client.id === selectedClientId) || rows[0] || null;
  const selectedLeads = selectedClient ? leadList.filter((lead) => lead.client === selectedClient.id).sort((a, b) => b.created_at.localeCompare(a.created_at)) : [];
  const selectedDeals = selectedClient ? dealList.filter((deal) => deal.client === selectedClient.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : [];
  const selectedAppointments = selectedClient ? appointmentList.filter((appointment) => appointment.client === selectedClient.id).sort((a, b) => b.start_at.localeCompare(a.start_at)) : [];
  const selectedTasks = selectedClient ? taskList.filter((task) => task.client === selectedClient.id && !["done", "cancelled"].includes(task.status)).sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || ""))) : [];
  const selectedConversations = selectedClient ? conversationList.filter((conversation) => conversation.client === selectedClient.id).sort((a, b) => String(b.last_message_at || b.updated_at).localeCompare(String(a.last_message_at || a.updated_at))) : [];
  const openDealValue = selectedDeals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const clientsWithoutActivity = clientList.filter((client) => !leadClientIds.has(client.id) && !dealClientIds.has(client.id) && !appointmentClientIds.has(client.id)).length;

  const quickFilterOptions = [
    { value: "all" as const, label: t("clients.filterAllWithCount", { count: clientList.length }) },
    { value: "new" as const, label: t("clients.filterNewWithCount", { count: clientsWithoutActivity }) },
    { value: "with_leads" as const, label: t("clients.filterWithLeadsCount", { count: leadClientIds.size }) },
    { value: "with_deals" as const, label: t("clients.filterWithDealsCount", { count: dealClientIds.size }) },
    { value: "with_bookings" as const, label: t("clients.filterWithBookingsCount", { count: appointmentClientIds.size }) },
    { value: "tagged" as const, label: t("clients.filterTaggedCount", { count: taggedClientIds.size }) },
  ];

  const sourceOptions = [
    { value: "", label: t("clients.allSources") },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "telegram", label: "Telegram" },
    { value: "instagram", label: "Instagram" },
    { value: "website", label: t("clients.sourceWebsite") },
    { value: "manual", label: t("clients.sourceManual") },
  ];

  if (!business) return <ErrorState message={t("clients.noBusiness")} />;
  if (clients.isLoading || filteredClients.isLoading || leads.isLoading || deals.isLoading || appointments.isLoading) return <LoadingState />;

  return (
    <>
      <section className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-midnight md:text-3xl">{t("clients.profileTitle")}</h1>
          <p className="mt-1 max-w-2xl text-base leading-6 text-slate-600">{t("clients.profileDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSegmentOpen(true)}><Tags size={18} /> {t("clients.segment")}</Button>
          <Button onClick={() => setOpen(true)}><Plus size={18} /> {t("clients.create")}</Button>
        </div>
      </section>

      {mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error ? (
        <div className="mt-4"><ErrorState message={getApiErrorMessage(mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error)} /></div>
      ) : null}

      <section className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,47,108,0.04)] [background:linear-gradient(120deg,#fff_0%,#fff_56%,#eef2ff_100%)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-700 shadow-[0_0_18px_rgba(124,58,237,0.12)]">
              <Sparkles size={21} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-midnight">{t("clients.retentionTitle")}</h2>
              <p className="mt-1 max-w-3xl text-base leading-6 text-slate-600">
                {t("clients.retentionText", { count: clientsWithoutActivity })}
              </p>
            </div>
          </div>
          <Button
            className="shrink-0"
            onClick={() => setQuickFilter("new")}
            disabled={!clientsWithoutActivity}
          >
            {t("clients.retentionAction")} <Send size={16} />
          </Button>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_rgba(0,47,108,0.04)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
          <Input placeholder={t("clients.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} options={[{ value: "", label: t("clients.allTags") }, ...tagList.map((tag) => ({ value: tag.id, label: tag.name }))]} />
          <Select value={selectedSegment} onChange={(event) => setSelectedSegment(event.target.value)} options={[{ value: "", label: t("clients.allSegments") }, ...segmentList.map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.cached_count})` }))]} />
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-2">
            <FilterChips value={quickFilter} options={quickFilterOptions} onChange={setQuickFilter} />
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-2">
            <FilterChips value={source} options={sourceOptions} onChange={setSource} />
          </div>
        </div>
      </section>

      <WorkQueueLayout className="overflow-hidden border border-slate-200 shadow-[0_4px_20px_rgba(0,47,108,0.04)] lg:grid-cols-[430px_minmax(0,1fr)]">
        <WorkQueueListPane mobileDetailOpen={mobileDetailOpen}>
          <div className="flex items-center justify-between px-2 py-2">
            <div>
              <h2 className="text-lg font-black text-midnight">{t("clients.baseTitle")}</h2>
              <p className="mt-1 text-xs font-bold text-slate-400">{t("clients.baseHint")}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{rows.length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-28 lg:pb-3">
            {rows.map((client) => (
              <ClientListItem
                key={client.id}
                client={client}
                leadCount={leadList.filter((lead) => lead.client === client.id).length}
                dealCount={dealList.filter((deal) => deal.client === client.id).length}
                bookingCount={appointmentList.filter((appointment) => appointment.client === client.id).length}
                tags={clientTags[String(client.id)] || []}
                selected={selectedClient?.id === client.id}
                onSelect={() => openClient(client.id)}
                t={t}
              />
            ))}
            {!rows.length ? <ClientEmptyState title={t("clients.notFoundTitle")} text={t("clients.notFoundText")} /> : null}
          </div>
        </WorkQueueListPane>

        <WorkQueueDetailPane mobileDetailOpen={mobileDetailOpen} closeLabel={t("common.close")} onMobileClose={() => setMobileDetailOpen(false)}>
          {selectedClient ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-28 lg:pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-ai-50 text-lg font-black text-ai-700 ring-1 ring-ai-100">
                  {initials(selectedClient.full_name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">{sourceLabel(selectedClient.source, t)}</span>
                    {selectedClient.is_archived ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{t("clients.archive")}</span> : null}
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-midnight">{selectedClient.full_name}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">{selectedClient.phone || selectedClient.email || t("clients.noContacts")}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedClient.phone ? (
                  <Button variant="secondary" onClick={() => window.open(`https://wa.me/${selectedClient.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}>
                    <Phone size={16} /> WhatsApp
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => { setEditing(selectedClient); setOpen(true); }}>
                  <Edit3 size={16} /> {t("clients.edit")}
                </Button>
                <Button variant="ghost" onClick={() => setDrawerEntity({ type: "client", id: selectedClient.id })}>
                  {t("clients.fullCard")} <MoreHorizontal size={16} />
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              <MetricCard compact label={t("clients.metricLeads")} value={selectedLeads.length} />
              <MetricCard compact label={t("clients.metricDeals")} value={selectedDeals.length} />
              <MetricCard compact label={t("clients.metricOpen")} value={money(openDealValue)} />
              <MetricCard compact label={t("clients.metricBookings")} value={selectedAppointments.length} />
              <MetricCard compact label={t("clients.metricDialogs")} value={selectedConversations.length} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-black text-midnight">
                      <ClipboardList size={18} className="text-brand-600" /> {t("clients.quickActions")}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button variant="secondary" onClick={() => setDrawerEntity({ type: "client", id: selectedClient.id })}>
                      <UserRound size={16} /> {t("clients.card")}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setTagOpen(true)}
                    >
                      <Tags size={16} /> {t("clients.addTag")}
                    </Button>
                    <Button variant="secondary" onClick={() => setOpen(true)}>
                      <Plus size={16} /> {t("clients.newClient")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setArchiveOpen(true)}
                    >
                      {t("clients.archiveAction")}
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                    <Tags size={18} className="text-brand-600" /> {t("clients.tagsAndNotes")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(clientTags[String(selectedClient.id)] || []).map((tag) => (
                      <span key={tag.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{tag.tag_name}</span>
                    ))}
                    {!clientTags[String(selectedClient.id)]?.length ? <span className="text-sm font-semibold text-slate-500">{t("clients.noTagsYet")}</span> : null}
                  </div>
                  {selectedClient.notes ? <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{selectedClient.notes}</p> : null}
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                    <ClipboardList size={18} className="text-brand-600" /> {t("clients.activeTasks")}
                  </div>
                  <div className="space-y-2">
                    {selectedTasks.slice(0, 5).map((task: Task) => (
                      <TimelineRow key={task.id} icon={ClipboardList} title={task.title} meta={`${task.priority} · ${formatDateTime(task.due_at)}`} />
                    ))}
                    {!selectedTasks.length ? <p className="text-sm font-semibold text-slate-500">{t("clients.noActiveTasks")}</p> : null}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white p-4">
                <div className="mb-4 flex items-center gap-2 font-black text-midnight">
                  <CalendarCheck size={18} className="text-brand-600" /> {t("clients.history")}
                </div>
                <div className="space-y-3">
                  {selectedLeads.slice(0, 4).map((lead: Lead) => (
                    <TimelineRow key={`lead-${lead.id}`} icon={Inbox} title={t("clients.leadFallback", { id: lead.id })} meta={`${sourceLabel(lead.source, t)} · ${formatDateTime(lead.created_at)}`} badge={<StatusBadge status={lead.status} />} />
                  ))}
                  {selectedDeals.slice(0, 4).map((deal: Deal) => (
                    <TimelineRow key={`deal-${deal.id}`} icon={CircleDollarSign} title={deal.title} meta={`${money(deal.amount, deal.currency)} · ${formatDateTime(deal.updated_at)}`} badge={<StatusBadge status={deal.status} />} />
                  ))}
                  {selectedAppointments.slice(0, 4).map((appointment: Appointment) => (
                    <TimelineRow key={`appointment-${appointment.id}`} icon={CalendarCheck} title={t("clients.bookingFallback", { id: appointment.id })} meta={`${formatDateTime(appointment.start_at)} · ${sourceLabel(appointment.source, t)}`} badge={<StatusBadge status={appointment.status} />} />
                  ))}
                  {selectedConversations.slice(0, 4).map((conversation: BotConversation) => (
                    <TimelineRow
                      key={`conversation-${conversation.id}`}
                      icon={MessageCircle}
                      title={`${sourceLabel(conversation.channel, t)} · ${conversation.status}`}
                      meta={conversation.last_message?.text || formatDateTime(conversation.last_message_at || conversation.updated_at)}
                      badge={conversation.unread_count ? <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-black text-brand-700">{conversation.unread_count}</span> : null}
                    />
                  ))}
                  {!selectedLeads.length && !selectedDeals.length && !selectedAppointments.length && !selectedConversations.length ? (
                    <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">{t("clients.emptyHistory")}</p>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
          ) : (
            <div className="grid flex-1 place-items-center p-8">
              <ClientEmptyState title={t("clients.listHintTitle")} text={t("clients.listHintText")} />
            </div>
          )}
        </WorkQueueDetailPane>
      </WorkQueueLayout>

      <Modal title={editing ? t("clients.editTitle") : t("clients.create")} open={open} onClose={() => { setOpen(false); setEditing(undefined); clearCreateParam(); }}>
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

      <Modal title={t("clients.addTag")} open={tagOpen} onClose={() => { setTagOpen(false); setTagDraft(""); }}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const tagName = tagDraft.trim();
            if (!selectedClient || !tagName) return;
            addTagMutation.mutate({ clientId: selectedClient.id, tagName });
          }}
        >
          <Input label={t("clients.tagPrompt")} value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setTagOpen(false); setTagDraft(""); }}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" isLoading={addTagMutation.isPending} disabled={!tagDraft.trim()}>
              {t("clients.addTag")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title={t("clients.archiveClient")} open={archiveOpen} onClose={() => { setArchiveOpen(false); setArchiveReason(""); }}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedClient) return;
            archiveMutation.mutate({ id: selectedClient.id, reason: archiveReason.trim() });
          }}
        >
          <Input label={t("clients.archiveReason")} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder={t("clients.archiveReasonPlaceholder")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setArchiveOpen(false); setArchiveReason(""); }}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" isLoading={archiveMutation.isPending}>
              {t("clients.archiveAction")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title={t("clients.createSegment")} open={segmentOpen} onClose={() => setSegmentOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createSegmentMutation.mutate();
          }}
        >
          <Input label={t("clients.segmentName")} value={segmentDraft.name} onChange={(event) => setSegmentDraft({ ...segmentDraft, name: event.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t("clients.field")}
              value={segmentDraft.field}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, field: event.target.value as SegmentDraft["field"] })}
              options={[
                { value: "source", label: t("clients.source") },
                { value: "tag", label: t("clients.tag") },
                { value: "full_name", label: t("clients.name") },
                { value: "phone", label: t("clients.phone") },
                { value: "email", label: "Email" },
                { value: "notes", label: t("clients.notes") },
              ]}
            />
            <Select
              label={t("clients.condition")}
              value={segmentDraft.operator}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, operator: event.target.value as SegmentDraft["operator"] })}
              options={[
                { value: "equals", label: t("clients.equals") },
                { value: "contains", label: t("clients.contains") },
                { value: "in", label: t("clients.inList") },
                { value: "is_empty", label: t("clients.isEmpty") },
                { value: "not_empty", label: t("clients.notEmpty") },
              ]}
            />
          </div>
          {segmentDraft.field === "tag" ? (
            <Select
              label={t("clients.value")}
              value={segmentDraft.value}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })}
              options={[{ value: "", label: t("clients.selectTag") }, ...tagList.map((tag) => ({ value: String(tag.id), label: tag.name }))]}
            />
          ) : (
            <Input label={t("clients.value")} value={segmentDraft.value} onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })} />
          )}
          <Button type="submit" isLoading={createSegmentMutation.isPending} disabled={!segmentDraft.name}>
            {t("clients.saveSegment")}
          </Button>
        </form>
      </Modal>

      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
