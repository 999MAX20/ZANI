import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { clientsApi } from "../../../api/clients";
import { unwrapList } from "../../../api/client";
import {
  segmentsApi,
  taggedObjectsApi,
  tagsApi,
} from "../../../api/activities";
import type {
  CrmCardTab,
  CrmDrawerEntity,
} from "../../../components/crm/CrmEntityDrawer";
import type { Client, Id, Segment, Tag, TaggedObject } from "../../../types";
import { useClientRows } from "./useClientRows";
import { useDebouncedValue } from "./useDebouncedValue";
import type {
  ClientQuickFilter,
  ClientTableColumn,
  ClientTag,
  SegmentDraft,
  Translate,
} from "../types";
import { clientSourceOptions } from "../utils";

const DEFAULT_CLIENTS_PAGE_SIZE = 20;
const RELATED_PAGE_SIZE = 100;

export function useClientsWorkspace({
  businessId,
  currentUserId,
  t,
}: {
  businessId?: Id;
  currentUserId?: Id | null;
  t: Translate;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(
    null,
  );
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
  const [visibleClientColumns, setVisibleClientColumns] = useState<
    Set<ClientTableColumn>
  >(() => new Set(["source"]));
  const [tagDraft, setTagDraft] = useState("");
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>({
    name: "",
    field: "source",
    operator: "equals",
    value: "",
  });

  const filteredClients = useQuery({
    queryKey: [
      "clients",
      "filtered",
      businessId,
      debouncedSearch,
      source,
      selectedTag,
      selectedSegment,
      quickFilter,
      page,
      pageSize,
    ],
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
    enabled: Boolean(businessId),
  });

  const clientList = filteredClients.data?.clients || [];
  const clientIds = useMemo(
    () => clientList.map((client) => client.id),
    [clientList],
  );
  const clientIdList = clientIds.join(",");
  const totalClients = filteredClients.data?.count || 0;
  const serverSummary = filteredClients.data?.summary;
  const totalPages = Math.max(1, Math.ceil(totalClients / pageSize));

  const tagsQuery = useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: () => tagsApi.list(),
    enabled: Boolean(businessId),
  });

  const taggedObjects = useQuery<TaggedObject[]>({
    queryKey: [
      "tagged-objects",
      "clients",
      businessId,
      clientIdList,
      RELATED_PAGE_SIZE,
    ],
    queryFn: () =>
      taggedObjectsApi.list({
        entity_type: "client",
        entity_id__in: clientIdList,
        page_size: RELATED_PAGE_SIZE,
      }),
    enabled: Boolean(businessId && clientIds.length > 0),
  });

  const segments = useQuery<Segment[]>({
    queryKey: ["segments"],
    queryFn: () => segmentsApi.list(),
    enabled: Boolean(businessId),
  });

  const clearCreateParam = useCallback(() => {
    if (!searchParams.get("create")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearSearchFilter = useCallback(() => {
    setSearch("");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("search");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearAllFilters = useCallback(() => {
    clearSearchFilter();
    setSource("");
    setSelectedTag("");
    setSelectedSegment("");
  }, [clearSearchFilter]);

  const openCreateClient = useCallback(() => {
    setEditing(undefined);
    setCreateOpen(true);
  }, []);

  const openEditClient = useCallback((client: Client) => {
    setEditing(client);
    setCreateOpen(true);
  }, []);

  const openClientCard = useCallback(
    (clientId: number, initialTab: CrmCardTab = "overview") => {
      setSelectedClientId(clientId);
      if (initialTab === "overview") {
        navigate(`/app/clients/${clientId}`);
        return;
      }
      setDrawerEntity({ type: "client", id: clientId, initialTab });
    },
    [navigate],
  );

  const closeClientCard = useCallback(() => {
    setDrawerEntity(null);
    const nextParams = new URLSearchParams(searchParams);
    if (nextParams.has("client")) {
      nextParams.delete("client");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const selectClient = useCallback((clientId: number) => {
    setSelectedClientId(clientId);
    setDrawerEntity(null);
  }, []);

  const toggleClientColumn = useCallback((column: ClientTableColumn) => {
    setVisibleClientColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }, []);

  const goToPage = useCallback(
    (nextPage: number) => {
      const normalized = Math.min(Math.max(1, nextPage), totalPages);
      setPage(normalized);
    },
    [totalPages],
  );

  useEffect(() => {
    const clientId = Number(searchParams.get("client") || "");
    if (clientId) {
      setSelectedClientId(clientId);
      setDrawerEntity(null);
      navigate(`/app/clients/${clientId}`, { replace: true });
      return;
    }
    if (searchParams.get("create") === "1") {
      setEditing(undefined);
      setCreateOpen(true);
    }
    setSearch(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, source, selectedTag, selectedSegment, quickFilter]);

  useEffect(() => {
    const safePage = Math.min(page, totalPages);
    if (safePage !== page) setPage(safePage);
  }, [page, totalPages]);

  const tagList = unwrapList<Tag>(tagsQuery.data);
  const taggedObjectList = unwrapList<TaggedObject>(taggedObjects.data);
  const segmentList = unwrapList<Segment>(segments.data);

  const clientTags = useMemo(() => {
    const map: Record<string, ClientTag[]> = {};
    taggedObjectList.forEach((item) => {
      if (item.entity_type !== "client") return;
      map[item.entity_id] = map[item.entity_id] || [];
      map[item.entity_id]?.push({
        id: item.id,
        tag_name: item.tag_name,
        tag_color: item.tag_color,
      });
    });
    return map;
  }, [taggedObjectList]);

  const { rows, kpi } = useClientRows({
    clients: clientList,
    tagsByClient: clientTags,
    currentUserId,
    totalOverride: totalClients,
    serverSummary,
    t,
  });

  const selectedRow =
    rows.find((row) => row.client.id === selectedClientId) || rows[0] || null;
  const selectedClient = actionClient || selectedRow?.client || null;
  const sourceOptions = useMemo(
    () =>
      clientSourceOptions.map((option) => ({
        value: option.value,
        label: option.label.startsWith("clients.")
          ? t(option.label)
          : option.label,
      })),
    [t],
  );
  const tagOptions = [
    { value: "", label: t("clients.allTags") },
    ...tagList.map((tag) => ({ value: tag.id, label: tag.name })),
  ];
  const segmentOptions = [
    { value: "", label: t("clients.allSegments") },
    ...segmentList.map((segment) => ({
      value: segment.id,
      label: `${segment.name} (${segment.cached_count})`,
    })),
  ];

  const pageLoading =
    filteredClients.isLoading ||
    tagsQuery.isLoading ||
    segments.isLoading ||
    taggedObjects.isLoading;

  return {
    actionClient,
    clearAllFilters,
    clearCreateParam,
    clearSearchFilter,
    closeClientCard,
    createOpen,
    drawerEntity,
    editing,
    filteredClients,
    goToPage,
    kpi,
    openClientCard,
    openCreateClient,
    openEditClient,
    page,
    pageLoading,
    pageSize,
    quickFilter,
    rows,
    search,
    segmentDraft,
    segmentList,
    segmentOpen,
    segmentOptions,
    segments,
    selectClient,
    selectedClient,
    selectedClientId,
    selectedRow,
    selectedSegment,
    selectedTag,
    setActionClient,
    setCreateOpen,
    setEditing,
    setPage,
    setPageSize,
    setQuickFilter,
    setSearch,
    setSegmentDraft,
    setSegmentOpen,
    setSelectedClientId,
    setSelectedSegment,
    setSelectedTag,
    setSource,
    setTagDraft,
    setTagOpen,
    source,
    sourceOptions,
    tagDraft,
    tagList,
    tagOpen,
    tagOptions,
    taggedObjects,
    tagsQuery,
    toggleClientColumn,
    totalClients,
    visibleClientColumns,
  };
}
