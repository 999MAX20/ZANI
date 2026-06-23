import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { clientsApi, type ClientMergeDryRun } from "../../api/clients";
import { getApiErrorMessage, unwrapList } from "../../api/client";
import { segmentFiltersApi, segmentsApi, taggedObjectsApi, tagsApi } from "../../api/activities";
import { CrmEntityDrawer, type CrmCardTab, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { CrmTableSurface, CrmWorkspaceGrid, CrmWorkspacePage } from "../../components/crm";
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
import type { Client, Id, Segment, Tag, TaggedObject } from "../../types";
import { ClientsFilters } from "./components/ClientsFilters";
import { ClientsTable } from "./components/ClientsTable";
import { MobileClientCards } from "./components/MobileClientCards";
import { useClientRows } from "./hooks/useClientRows";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import type { ClientQuickFilter, ClientTableColumn, ClientTag, SegmentDraft } from "./types";
import { clientSourceOptions } from "./utils";

const DEFAULT_CLIENTS_PAGE_SIZE = 20;
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
  const [mergePreview, setMergePreview] = useState<ClientMergeDryRun | null>(null);
  const [editing, setEditing] = useState<Client | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<Id | null>(null);
  const [actionClient, setActionClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [source, setSource] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_CLIENTS_PAGE_SIZE);
  const [quickFilter, setQuickFilter] = useState<ClientQuickFilter>("all");
  const [visibleClientColumns, setVisibleClientColumns] = useState<Set<ClientTableColumn>>(() => new Set(["source"]));
  const [tagDraft, setTagDraft] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>({ name: "", field: "source", operator: "equals", value: "" });

  const filteredClients = useQuery({
    queryKey: ["clients", "filtered", business?.id, debouncedSearch, source, selectedTag, selectedSegment, quickFilter, page, pageSize],
    queryFn: () =>
      clientsApi.listFiltered({
        q: debouncedSearch || undefined,
        source: source || undefined,
        tag: selectedTag || undefined,
        segment: selectedSegment || undefined,
        quick_filter: quickFilter === "all" ? undefined : quickFilter,
        page,
        page_size: pageSize,
      }),
    enabled: Boolean(business),
  });

  const clientList = filteredClients.data?.clients || [];
  const clientIds = useMemo(() => clientList.map((client) => client.id), [clientList]);
  const clientIdList = clientIds.join(",");
  const totalClients = filteredClients.data?.count || 0;
  const serverSummary = filteredClients.data?.summary;
  const totalPages = Math.max(1, Math.ceil(totalClients / pageSize));

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
      queryClient.invalidateQueries({ queryKey: ["crm-card", "client", client.id] });
      setCreateOpen(false);
      setEditing(undefined);
      openClientCard(client.id);
      clearCreateParam();
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: number; duplicateId: number }) => clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: (mergedClient) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["crm-card", "client", mergedClient.target_client_id] });
      setCreateOpen(false);
      setEditing(undefined);
      setMergePreview(null);
    },
  });
  const mergeDryRunMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: number; duplicateId: number }) => clientsApi.mergeDryRun({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: (preview) => setMergePreview(preview),
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
      setActionClient(null);
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
      setActionClient(null);
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

  function openEditClient(client: Client) {
    setEditing(client);
    setCreateOpen(true);
  }

  function openClientCard(clientId: number, initialTab: CrmCardTab = "overview") {
    setSelectedClientId(clientId);
    setDrawerEntity({ type: "client", id: clientId, initialTab });
  }

  const closeClientCard = useCallback(() => {
    setDrawerEntity(null);
    const nextParams = new URLSearchParams(searchParams);
    if (nextParams.has("client")) {
      nextParams.delete("client");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function selectClient(clientId: number) {
    openClientCard(clientId);
  }

  function toggleClientColumn(column: ClientTableColumn) {
    setVisibleClientColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }

  function goToPage(nextPage: number) {
    const normalized = Math.min(Math.max(1, nextPage), totalPages);
    setPage(normalized);
  }

  useEffect(() => {
    const clientId = Number(searchParams.get("client") || "");
    if (clientId) {
      setSelectedClientId(clientId);
      setDrawerEntity({ type: "client", id: clientId, initialTab: "overview" });
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
      if (event.key === "Escape") closeClientCard();
    }

    window.addEventListener("keydown", handleHotkeys);
    return () => window.removeEventListener("keydown", handleHotkeys);
  }, [closeClientCard]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, source, selectedTag, selectedSegment, quickFilter]);

  useEffect(() => {
    const safePage = Math.min(page, totalPages);
    if (safePage !== page) setPage(safePage);
  }, [page, totalPages]);

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
    tagsByClient: clientTags,
    currentUserId: user?.id || null,
    totalOverride: totalClients,
    serverSummary,
  });

  const selectedRow = rows.find((row) => row.client.id === selectedClientId) || null;
  const selectedClient = actionClient || selectedRow?.client || null;
  const sourceOptions = useMemo(
    () => clientSourceOptions.map((option) => ({ value: option.value, label: option.label.startsWith("clients.") ? t(option.label) : option.label })),
    [t],
  );
  const tagOptions = [{ value: "", label: t("clients.allTags") }, ...tagList.map((tag) => ({ value: tag.id, label: tag.name }))];
  const segmentOptions = [{ value: "", label: t("clients.allSegments") }, ...segmentList.map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.cached_count})` }))];

  const pageError = filteredClients.error || tagsQuery.error || segments.error || taggedObjects.error || saveClientMutation.error || mergeDryRunMutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error;
  const pageLoading = filteredClients.isLoading || tagsQuery.isLoading || segments.isLoading || taggedObjects.isLoading;

  if (!business) return <ErrorState message={t("clients.noBusiness")} />;
  if (pageLoading) return <LoadingState />;

  return (
    <>
      <CrmWorkspacePage>
        {pageError ? (
          <div className="mb-3">
            <ErrorState message={getApiErrorMessage(pageError)} />
          </div>
        ) : null}

        <CrmWorkspaceGrid>
          <main className="min-w-0">
            <CrmTableSurface
              className="h-full"
              filters={
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
                  visibleColumns={visibleClientColumns}
                  onToggleColumn={toggleClientColumn}
                  onOpenSegment={() => setSegmentOpen(true)}
                  onClearSearch={clearSearchFilter}
                  onClearAll={clearAllFilters}
                  t={t}
                />
              }
            >
              <MobileClientCards rows={rows} selectedClientId={selectedClientId} onSelectClient={selectClient} t={t} />
              <ClientsTable
                rows={rows}
                selectedClientId={selectedClientId}
                onSelectClient={selectClient}
                totalClients={totalClients}
                page={page}
                pageSize={pageSize}
                onPageChange={goToPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
                visibleColumns={visibleClientColumns}
                t={t}
              />
            </CrmTableSurface>
          </main>
        </CrmWorkspaceGrid>
      </CrmWorkspacePage>

      <Modal title={editing ? t("clients.editTitle") : t("clients.create")} open={createOpen} onClose={() => { setCreateOpen(false); setEditing(undefined); clearCreateParam(); }}>
        <ClientForm
          businessId={business.id}
          initial={editing}
          onSubmit={(payload) => saveClientMutation.mutateAsync(payload)}
          onOpenClient={(id) => {
            setCreateOpen(false);
            setEditing(undefined);
            openClientCard(id);
          }}
          onMergeDuplicate={(duplicateId) => {
            if (!editing) return Promise.resolve();
            return mergeDryRunMutation.mutateAsync({ targetId: editing.id, duplicateId });
          }}
        />
      </Modal>

      <Modal title={t("clients.mergePreviewTitle")} open={Boolean(mergePreview)} onClose={() => setMergePreview(null)}>
        {mergePreview ? (
          <div className="space-y-4">
            <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-black">{t("clients.mergePreviewWarning")}</p>
              <p className="mt-1">{t("clients.mergePreviewPolicy")}: {mergePreview.policy}</p>
            </div>
            <div className="rounded-card border border-slate-200 bg-white p-4">
              <p className="font-black text-midnight">{mergePreview.duplicate.full_name || t("common.client")}</p>
              <p className="mt-1 text-sm text-slate-500">{mergePreview.duplicate.phone || mergePreview.duplicate.email || t("clients.noContact")}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(mergePreview.transferred).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-control bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-600">{key.replace(/_/g, " ")}</span>
                  <span className="font-black text-midnight">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMergePreview(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={mergeMutation.isPending}
                onClick={() => mergeMutation.mutate({ targetId: mergePreview.target_client_id, duplicateId: mergePreview.duplicate.id })}
              >
                {t("clients.mergeConfirm")}
              </Button>
            </div>
          </div>
        ) : null}
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

      <CrmEntityDrawer
        entity={drawerEntity}
        onClose={closeClientCard}
        clientActions={{
          onEdit: openEditClient,
          onAddTag: (client) => {
            setActionClient(client);
            setSelectedClientId(client.id);
            setTagOpen(true);
          },
          onArchive: (client) => {
            setActionClient(client);
            setSelectedClientId(client.id);
            setArchiveOpen(true);
          },
        }}
      />
    </>
  );
}
