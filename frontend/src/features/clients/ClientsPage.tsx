import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Filter, Plus, Search } from "lucide-react";
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
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment, BotConversation, Client, Deal, Id, Lead, Task } from "../../types";
import { ClientInspector } from "./components/ClientInspector";
import { ClientsFilters } from "./components/ClientsFilters";
import { ClientsKpi } from "./components/ClientsKpi";
import { ClientsTable } from "./components/ClientsTable";
import { MobileClientCards } from "./components/MobileClientCards";
import { useClientRows } from "./hooks/useClientRows";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import type { ClientQuickFilter, ClientTag, SegmentDraft } from "./types";
import { useI18n } from "../../lib/i18n";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<Id | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [source, setSource] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [quickFilter, setQuickFilter] = useState<ClientQuickFilter>("all");
  const [tagDraft, setTagDraft] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>({ name: "", field: "source", operator: "equals", value: "" });

  const hasServerFilters = Boolean(debouncedSearch || source || selectedTag || selectedSegment);
  const filteredClients = useQuery({
    queryKey: ["clients", "filtered", debouncedSearch, source, selectedTag, selectedSegment],
    queryFn: () => clientsApi.listFiltered({ q: debouncedSearch || undefined, source: source || undefined, tag: selectedTag || undefined, segment: selectedSegment || undefined }),
    enabled: hasServerFilters,
  });

  const saveClientMutation = useMutation({
    mutationFn: (payload: Partial<Client>) => (editing ? clientsApi.update({ id: editing.id, payload }) : clientsApi.create(payload)),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setCreateOpen(false);
      setEditing(undefined);
      setSelectedClientId(client.id);
      clearCreateParam();
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: number; duplicateId: number }) => clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCreateOpen(false);
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
      const tag = existing || (await tagsApi.create({ business: business!.id, name: tagName, color: "#2563eb", source: "manual" }));
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

  function clearAllFilters() {
    setSearch("");
    setSource("");
    setSelectedTag("");
    setSelectedSegment("");
  }

  useEffect(() => {
    const clientId = Number(searchParams.get("client") || "");
    if (clientId) setSelectedClientId(clientId);
    if (searchParams.get("create") === "1") {
      setEditing(undefined);
      setCreateOpen(true);
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
  const baseRows = hasServerFilters ? unwrapList<Client>(filteredClients.data) : clientList;

  const clientTags = useMemo(() => {
    const map: Record<string, ClientTag[]> = {};
    taggedObjectList.forEach((item) => {
      if (item.entity_type !== "client") return;
      map[item.entity_id] = map[item.entity_id] || [];
      map[item.entity_id]?.push({ id: item.id, tag_name: item.tag_name, tag_color: item.tag_color });
    });
    return map;
  }, [taggedObjectList]);

  const { rows, kpi } = useClientRows({
    clients: baseRows,
    leads: leadList,
    deals: dealList,
    appointments: appointmentList,
    tasks: taskList,
    conversations: conversationList,
    tagsByClient: clientTags,
    quickFilter,
  });

  useEffect(() => {
    if (selectedClientId && rows.some((row) => row.client.id === selectedClientId)) return;
    setSelectedClientId(rows[0]?.client.id || null);
  }, [rows, selectedClientId]);

  const selectedRow = rows.find((row) => row.client.id === selectedClientId) || rows[0] || null;
  const sourceOptions = [
    { value: "", label: t("clients.allSources") },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "telegram", label: "Telegram" },
    { value: "instagram", label: "Instagram" },
    { value: "website", label: t("clients.sourceWebsite") },
    { value: "manual", label: t("clients.sourceManual") },
  ];
  const tagOptions = [{ value: "", label: t("clients.allTags") }, ...tagList.map((tag) => ({ value: tag.id, label: tag.name }))];
  const segmentOptions = [{ value: "", label: t("clients.allSegments") }, ...segmentList.map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.cached_count})` }))];
  const pageError = saveClientMutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error;
  const pageLoading = clients.isLoading || leads.isLoading || deals.isLoading || appointments.isLoading || (hasServerFilters && filteredClients.isLoading);

  if (!business) return <ErrorState message={t("clients.noBusiness")} />;
  if (pageLoading) return <LoadingState />;

  return (
    <>
      <section className="min-h-[calc(100vh-96px)] bg-[#f8fafc]">
        <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">{t("clients.title")}</h1>
              <button type="button" className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 xl:hidden" aria-label="Уведомления">
                <Bell size={18} />
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row xl:max-w-[720px]">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value.slice(0, 120))}
                  placeholder="Поиск клиентов, телефона, тегов..."
                  aria-label="Поиск клиентов"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-14 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">⌘ K</span>
              </div>
              <Button variant="secondary" size="icon" className="hidden h-11 w-11 shrink-0 sm:inline-flex" aria-label="Фильтры">
                <Filter size={18} />
              </Button>
              <Button className="h-11 shrink-0 bg-blue-600 px-5 hover:bg-blue-700" onClick={() => setCreateOpen(true)}>
                {t("clients.create")} <Plus size={17} />
              </Button>
            </div>
          </div>
        </div>

        {pageError ? (
          <div className="px-4 pt-4 sm:px-6">
            <ErrorState message={getApiErrorMessage(pageError)} />
          </div>
        ) : null}

        <div className="grid min-h-0 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <main className="min-w-0 px-4 py-5 sm:px-6">
            <ClientsKpi kpi={kpi} />

            <div className="mt-6 rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <ClientsFilters
                quickFilter={quickFilter}
                onQuickFilterChange={setQuickFilter}
                source={source}
                onSourceChange={setSource}
                selectedTag={selectedTag}
                onSelectedTagChange={setSelectedTag}
                selectedSegment={selectedSegment}
                onSelectedSegmentChange={setSelectedSegment}
                search={search}
                tagOptions={tagOptions}
                segmentOptions={segmentOptions}
                sourceOptions={sourceOptions}
                onOpenSegment={() => setSegmentOpen(true)}
                onClearSearch={() => setSearch("")}
                onClearAll={clearAllFilters}
                t={t}
              />
              <MobileClientCards rows={rows} selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} t={t} />
              <ClientsTable rows={rows} selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} totalClients={clientList.length} t={t} />
            </div>
          </main>

          <ClientInspector
            row={selectedRow}
            onClose={() => setSelectedClientId(null)}
            onEdit={() => {
              if (!selectedRow) return;
              setEditing(selectedRow.client);
              setCreateOpen(true);
            }}
            onFullCard={() => {
              if (!selectedRow) return;
              setDrawerEntity({ type: "client", id: selectedRow.client.id });
            }}
            onAddTag={() => setTagOpen(true)}
            onArchive={() => setArchiveOpen(true)}
            t={t}
          />
        </div>
      </section>

      <Modal title={editing ? t("clients.editTitle") : t("clients.create")} open={createOpen} onClose={() => { setCreateOpen(false); setEditing(undefined); clearCreateParam(); }}>
        <ClientForm
          businessId={business.id}
          initial={editing}
          onSubmit={(payload) => saveClientMutation.mutateAsync(payload)}
          onOpenClient={(id) => {
            setCreateOpen(false);
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
            if (!selectedRow || !tagName) return;
            addTagMutation.mutate({ clientId: selectedRow.client.id, tagName });
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
            if (!selectedRow) return;
            archiveMutation.mutate({ id: selectedRow.client.id, reason: archiveReason.trim() });
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
