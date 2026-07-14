import { useCallback, useEffect, useState } from "react";

import {
  defaultVisibleColumns,
  LEAD_COLUMNS_KEY,
  LEAD_COLUMN_ORDER_KEY,
  leadColumnOrder,
  leadFilters,
  LEAD_PRESETS_KEY,
  LEADS_PAGE_SIZE,
  type FilterPreset,
  type LeadColumnKey,
  type LeadFilter,
  type Translate,
} from "../types";
import { loadJson, saveJson } from "../utils/leadStorage";

export function useLeadsTableState({
  searchParams,
  t,
  onNotice,
}: {
  searchParams: URLSearchParams;
  t: Translate;
  onNotice: (message: string | null, tone?: "success" | "info" | "warning" | "danger") => void;
}) {
  const [filter, setFilter] = useState<LeadFilter>(() => {
    const param = searchParams.get("filter") as LeadFilter | null;
    return param && leadFilters.includes(param) ? param : "all";
  });
  const [source, setSource] = useState(searchParams.get("source") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortByAi, setSortByAi] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LEADS_PAGE_SIZE);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => loadJson<FilterPreset[]>(LEAD_PRESETS_KEY, []));
  const [presetName, setPresetName] = useState("");
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<LeadColumnKey, boolean>>(() => {
    const saved = loadJson<Partial<Record<LeadColumnKey, boolean>>>(LEAD_COLUMNS_KEY, {});
    const next = { ...defaultVisibleColumns, ...saved };
    const visibleCount = leadColumnOrder.filter((column) => next[column]).length;
    return visibleCount > 5 ? defaultVisibleColumns : next;
  });
  const [columnOrder, setColumnOrder] = useState<LeadColumnKey[]>(() => {
    const saved = loadJson<LeadColumnKey[]>(LEAD_COLUMN_ORDER_KEY, leadColumnOrder);
    return [...saved.filter((column): column is LeadColumnKey => leadColumnOrder.includes(column)), ...leadColumnOrder.filter((column) => !saved.includes(column))];
  });

  useEffect(() => {
    setPage(1);
  }, [filter, search, source]);

  useEffect(() => {
    saveJson(LEAD_PRESETS_KEY, filterPresets);
  }, [filterPresets]);

  useEffect(() => {
    saveJson(LEAD_COLUMNS_KEY, visibleColumns);
  }, [visibleColumns]);

  useEffect(() => {
    saveJson(LEAD_COLUMN_ORDER_KEY, columnOrder);
  }, [columnOrder]);

  const savePreset = useCallback(() => {
    const name = presetName.trim() || t("leads.defaultPresetName");
    setFilterPresets((value) => [{ id: String(Date.now()), name, filter, source, search }, ...value].slice(0, 8));
    setPresetName("");
    onNotice(t("leads.filterSaved"));
  }, [filter, onNotice, presetName, search, source, t]);

  const applyPreset = useCallback((preset: FilterPreset) => {
    setFilter(preset.filter);
    setSource(preset.source);
    setSearch(preset.search);
  }, []);

  const shareView = useCallback(async () => {
    const params = new URLSearchParams(searchParams);
    params.set("filter", filter);
    if (source) params.set("source", source);
    else params.delete("source");
    if (search) params.set("search", search);
    else params.delete("search");
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    await navigator.clipboard?.writeText(url);
    onNotice(t("leads.viewCopied"));
  }, [filter, onNotice, search, searchParams, source, t]);

  return {
    filter,
    setFilter,
    source,
    setSource,
    search,
    setSearch,
    sortByAi,
    setSortByAi,
    page,
    setPage,
    pageSize,
    setPageSize,
    filterPresets,
    presetName,
    setPresetName,
    savedFiltersOpen,
    setSavedFiltersOpen,
    moreMenuOpen,
    setMoreMenuOpen,
    visibleColumns,
    setVisibleColumns,
    columnOrder,
    savePreset,
    applyPreset,
    shareView,
  };
}
