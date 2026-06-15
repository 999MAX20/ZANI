import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { appointmentsApi } from "../../api/appointments";
import { clientsApi } from "../../api/clients";
import { getApiErrorMessage, unwrapList } from "../../api/client";
import { dealsApi } from "../../api/deals";
import { leadsApi } from "../../api/leads";
import { tasksApi } from "../../api/tasks";
import { segmentFiltersApi, segmentsApi, taggedObjectsApi, tagsApi } from "../../api/activities";
import { botConversationsApi } from "../../api/bots";
import { CrmEntityDrawer, type CrmCardTab, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { ClientForm } from "../../components/forms/ClientForm";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useAuth } from "../auth/AuthProvider";
import type { Appointment, BotConversation, Client, Deal, Id, Lead, Segment, Tag, TaggedObject, Task } from "../../types";
import { ClientInspector } from "./components/ClientInspector";
import { ClientsFilters } from "./components/ClientsFilters";
import { ClientsKpi } from "./components/ClientsKpi";
import { ClientsTable } from "./components/ClientsTable";
import { MobileClientCards } from "./components/MobileClientCards";
import { useClientRows } from "./hooks/useClientRows";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import type { ClientQuickFilter, ClientTag, SegmentDraft } from "./types";
import { clientSourceOptions } from "./utils";

const CLIENTS_PAGE_SIZE = 20;
const RELATED_PAGE_SIZE = 100;

export function ClientsPage() {
  const { t } = useI18n();
  const { setPageHeader } = usePageHeader();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<Id | null>(null);
  const [inspectorDismissed, setInspectorDismissed] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [source, setSource] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [page, setPage] = useState(1);
  const [inspectorTab, setInspectorTab] = useState<"overview" | "deals" | "tasks" | "files">("overview");
  const [quickFilter, setQuickFilter] = useState<ClientQuickFilter>("all");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>({ name: "", field: "source", operator: "equals", value: "" });

  const filteredClients = useQuery({
    queryKey: ["clients", "filtered", business?.id, debouncedSearch, source, selectedTag, selectedSegment, page, CLIENTS_PAGE_SIZE],
    queryFn: () =>
      clientsApi.listFiltered({
        q: debouncedSearch || undefined,
        source: source || undefined,
        tag: selectedTag || undefined,
        segment: selectedSegment || undefined,
        page,
        page_size: CLIENTS_PAGE_SIZE,
      }),
    enabled: Boolean(business),
  });

  const clientList = filteredClients.data?.clients || [];
  const clientIds = useMemo(() => clientList.map((client) => client.id), [clientList]);
  const clientIdList = clientIds.join(",");
  const totalClients = filteredClients.data?.count || 0;
  const serverSummary = filteredClients.data?.summary;
  const totalPages = Math.max(1, Math.ceil(totalClients / CLIENTS_PAGE_SIZE));

  const leads = useQuery({
    queryKey: ["leads", "for-clients", business?.id, clientIdList, RELATED_PAGE_SIZE],
    queryFn: () => leadsApi.list({ client_ids: clientIdList, page_size: RELATED_PAGE_SIZE }),
    enabled: Boolean(business && clientIds.length > 0),
  });

  const deals = useQuery({
    queryKey: ["deals", "for-clients", business?.id, clientIdList, RELATED_PAGE_SIZE],
    queryFn: () => dealsApi.list({ client_ids: clientIdList, page_size: RELATED_PAGE_SIZE }),
    enabled: Boolean(business && clientIds.length > 0),
  });

  const appointments = useQuery({
    queryKey: ["appointments", "for-clients", business?.id, clientIdList, RELATED_PAGE_SIZE],
    queryFn: () => appointmentsApi.list({ client_ids: clientIdList, page_size: RELATED_PAGE_SIZE }),
    enabled: Boolean(business && clientIds.length > 0),
  });

  const tasks = useQuery({
    queryKey: ["tasks", "for-clients", business?.id, clientIdList, RELATED_PAGE_SIZE],
    queryFn: () => tasksApi.list({ client_ids: clientIdList, page_size: RELATED_PAGE_SIZE }),
    enabled: Boolean(business && clientIds.length > 0),
  });

  const botConversations = useQuery({
    queryKey: ["bot-conversations", "for-clients", business?.id, clientIdList, RELATED_PAGE_SIZE],
    queryFn: () => botConversationsApi.list({ client_ids: clientIdList, page_size: RELATED_PAGE_SIZE }),
    enabled: Boolean(business && clientIds.length > 0),
  });

  const tagsQuery = useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: () => tagsApi.list(),
    enabled: Boolean(business),
  });

  const taggedObjects = useQuery<TaggedObject[]>({
    queryKey: ["tagged-objects", "clients", business?.id, clientIdList, RELATED_PAGE_SIZE],
    queryFn: () => taggedObjectsApi.list({ entity_type: "client", entity_id__in: clientIdList, page_size: RELATED_PAGE_SIZE }),
    enabled: Boolean(business && clientIds.length > 0),
  });

  const segments = useQuery<Segment[]>({
    queryKey: ["segments"],
    queryFn: () => segmentsApi.list(),
    enabled: Boolean(business),
  });

  const saveClientMutation = useMutation({
    mutationFn: (payload: Partial<Client>) => (editing ? clientsApi.update({ id: editing.id, payload }) : clientsApi.create(payload)),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["bot-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["crm-card", "client", client.id] });
      setCreateOpen(false);
      setEditing(undefined);
      setInspectorDismissed(false);
      setSelectedClientId(client.id);
      clearCreateParam();
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: number; duplicateId: number }) => clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: (mergedClient) => {
      queryClient.invalidateQueries();
      const mergedClientId = (mergedClient as { id?: number } | null)?.id;
      if (mergedClientId) {
        queryClient.invalidateQueries({ queryKey: ["crm-card", "client", mergedClientId] });
      }
      setCreateOpen(false);
      setEditing(undefined);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: clientsApi.archive,
    onSuccess: (archivedClient) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      const archivedClientId = (archivedClient as { id?: number } | null)?.id;
      if (archivedClientId) {
        queryClient.invalidateQueries({ queryKey: ["crm-card", "client", archivedClientId] });
      }
      setArchiveOpen(false);
      setArchiveReason("");
    },
  });

  const tagList = unwrapList<Tag>(tagsQuery.data);
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
    clearSearchFilter();
    setSource("");
    setSelectedTag("");
    setSelectedSegment("");
  }

  function clearSearchFilter() {
    setSearch("");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("search");
    setSearchParams(nextParams, { replace: true });
  }

  function openCreateClient() {
    setEditing(undefined);
    setCreateOpen(true);
  }

  function openClientCard(clientId: number, initialTab: CrmCardTab = "overview") {
    setInspectorDismissed(false);
    setSelectedClientId(clientId);
    setDrawerEntity({ type: "client", id: clientId, initialTab });
  }

  function selectClient(clientId: number) {
    setInspectorDismissed(false);
    setSelectedClientId(clientId);
  }

  function closeInspector() {
    setInspectorDismissed(true);
    setInspectorTab("overview");
    setSelectedClientId(null);
  }

  function goToPage(nextPage: number) {
    const normalized = Math.min(Math.max(1, nextPage), totalPages);
    setPage(normalized);
  }

  useEffect(() => {
    const clientId = Number(searchParams.get("client") || "");
    if (clientId) {
      setInspectorDismissed(false);
      setSelectedClientId(clientId);
    }
    if (searchParams.get("create") === "1") {
      setEditing(undefined);
      setCreateOpen(true);
    }
    setSearch(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    setPageHeader({
      title: t("clients.title"),
      secondaryActions: [
        {
          label: t("clients.filters"),
          icon: Filter,
          onClick: () => setAdvancedFiltersOpen((value) => !value),
        },
      ],
      primaryAction: {
        label: t("clients.create"),
        icon: Plus,
        onClick: openCreateClient,
      },
    });
  }, [setPageHeader, t]);

  useEffect(() => {
    return () => setPageHeader(null);
  }, [setPageHeader]);

  useEffect(() => {
    function handleHotkeys(event: KeyboardEvent) {
      const isCommand = event.metaKey || event.ctrlKey;
      if (isCommand && event.key.toLowerCase() === "n") {
        event.preventDefault();
        openCreateClient();
      }
      if (event.key === "Escape") closeInspector();
    }

    window.addEventListener("keydown", handleHotkeys);
    return () => window.removeEventListener("keydown", handleHotkeys);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, source, selectedTag, selectedSegment]);

  useEffect(() => {
    const safePage = Math.min(page, totalPages);
    if (safePage !== page) setPage(safePage);
  }, [page, totalPages]);

  const leadList = unwrapList<Lead>(leads.data);
  const dealList = unwrapList<Deal>(deals.data);
  const appointmentList = unwrapList<Appointment>(appointments.data);
  const taskList = unwrapList<Task>(tasks.data);
  const conversationList = unwrapList<BotConversation>(botConversations.data);
  const taggedObjectList = unwrapList<TaggedObject>(taggedObjects.data);
  const segmentList = unwrapList<Segment>(segments.data);

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
    clients: clientList,
    leads: leadList,
    deals: dealList,
    appointments: appointmentList,
    tasks: taskList,
    conversations: conversationList,
    tagsByClient: clientTags,
    quickFilter,
    currentUserId: user?.id || null,
    totalOverride: totalClients,
    serverSummary,
  });

  useEffect(() => {
    if (inspectorDismissed) return;
    if (selectedClientId && rows.some((row) => row.client.id === selectedClientId)) return;
    setSelectedClientId(rows[0]?.client.id || null);
  }, [inspectorDismissed, rows, selectedClientId]);

  useEffect(() => {
    setInspectorTab("overview");
  }, [selectedClientId]);

  const selectedRow = inspectorDismissed ? null : rows.find((row) => row.client.id === selectedClientId) || rows[0] || null;
  const sourceOptions = useMemo(
    () => clientSourceOptions.map((option) => ({ value: option.value, label: option.label.startsWith("clients.") ? t(option.label) : option.label })),
    [t],
  );
  const tagOptions = [{ value: "", label: t("clients.allTags") }, ...tagList.map((tag) => ({ value: tag.id, label: tag.name }))];
  const segmentOptions = [{ value: "", label: t("clients.allSegments") }, ...segmentList.map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.cached_count})` }))];

  const pageError = filteredClients.error || leads.error || deals.error || appointments.error || tasks.error || botConversations.error || tagsQuery.error || segments.error || taggedObjects.error || saveClientMutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error;
  const relatedLoading =
    (clientIds.length > 0 && (leads.isLoading || deals.isLoading || appointments.isLoading || tasks.isLoading || botConversations.isLoading || taggedObjects.isLoading)) ||
    leads.isFetching ||
    deals.isFetching ||
    appointments.isFetching ||
    tasks.isFetching ||
    botConversations.isFetching ||
    taggedObjects.isFetching;
  const pageLoading = filteredClients.isLoading || relatedLoading || tagsQuery.isLoading || segments.isLoading;

  if (!business) return <ErrorState message={t("clients.noBusiness")} />;
  if (pageLoading) return <LoadingState />;

  return (
    <>
      <section className="ml-auto min-h-[calc(100vh-80px)] w-full max-w-[1420px] overflow-hidden bg-[#f8fafc]">
        {pageError ? (
          <div className="px-4 pt-4 sm:px-6">
            <ErrorState message={getApiErrorMessage(pageError)} />
          </div>
        ) : null}

        <div className={selectedRow ? "grid min-h-0 xl:grid-cols-[minmax(0,996px)_330px]" : "grid min-h-0 xl:grid-cols-1"}>
          <main className="min-w-0 px-4 py-4 sm:px-6">
            <ClientsKpi kpi={kpi} />

            <div className="mt-4 rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <ClientsFilters
                quickFilter={quickFilter}
                onQuickFilterChange={setQuickFilter}
                search={search}
                source={source}
                onSourceChange={setSource}
                selectedTag={selectedTag}
                onSelectedTagChange={setSelectedTag}
                selectedSegment={selectedSegment}
                onSelectedSegmentChange={setSelectedSegment}
                tagOptions={tagOptions}
                segmentOptions={segmentOptions}
                sourceOptions={sourceOptions}
                kpi={kpi}
                advancedFiltersOpen={advancedFiltersOpen}
                onAdvancedFiltersOpenChange={setAdvancedFiltersOpen}
                onOpenSegment={() => setSegmentOpen(true)}
                onClearSearch={clearSearchFilter}
                onClearAll={clearAllFilters}
                t={t}
              />
              <MobileClientCards rows={rows} selectedClientId={selectedClientId} onSelectClient={selectClient} t={t} />
              <ClientsTable
                rows={rows}
                selectedClientId={selectedClientId}
                onSelectClient={selectClient}
                totalClients={totalClients}
                page={page}
                pageSize={CLIENTS_PAGE_SIZE}
                onPageChange={goToPage}
                t={t}
              />
            </div>
          </main>

          {selectedRow ? (
            <div>
              <ClientInspector
                row={selectedRow}
                onClose={closeInspector}
                onEdit={() => {
                  setEditing(selectedRow.client);
                  setCreateOpen(true);
                }}
                activeTab={inspectorTab}
                onOpenOverview={() => setInspectorTab("overview")}
                onOpenDeals={() => setInspectorTab("deals")}
                onOpenTasks={() => setInspectorTab("tasks")}
                onOpenFiles={() => setInspectorTab("files")}
                onFullCard={() => {
                  setInspectorTab("overview");
                  openClientCard(selectedRow.client.id, "overview");
                }}
                onAddTag={() => setTagOpen(true)}
                onArchive={() => setArchiveOpen(true)}
                t={t}
              />
            </div>
          ) : null}
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
            setInspectorDismissed(false);
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
