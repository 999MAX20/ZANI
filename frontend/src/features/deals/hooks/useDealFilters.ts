import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { DealFiltersState, DealQuickFilter, DealStatusFilter } from "../types";

const DEAL_FILTERS_KEY = "zani.deals.filters";
const quickFilters: DealQuickFilter[] = ["all", "mine", "hot", "overdue", "no_tasks"];
const statusFilters: DealStatusFilter[] = ["open", "won", "lost", "all"];

function loadFilters(): Partial<DealFiltersState> {
  try {
    return JSON.parse(localStorage.getItem(DEAL_FILTERS_KEY) || "{}") as Partial<DealFiltersState>;
  } catch {
    return {};
  }
}

export function useDealFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const saved = useMemo(loadFilters, []);
  const [filters, setFilters] = useState<DealFiltersState>(() => {
    const quick = searchParams.get("quick") as DealQuickFilter | null;
    const status = searchParams.get("status") as DealStatusFilter | null;
    return {
      pipelineId: searchParams.get("pipeline") || saved.pipelineId || "",
      stageFilter: searchParams.get("stage") || saved.stageFilter || "all",
      statusFilter: status && statusFilters.includes(status) ? status : saved.statusFilter || "open",
      ownerFilter: searchParams.get("owner") || saved.ownerFilter || "",
      search: searchParams.get("search") || saved.search || "",
      quickFilter: quick && quickFilters.includes(quick) ? quick : saved.quickFilter || "all",
      sourceFilter: searchParams.get("source") || saved.sourceFilter || "",
      minAmount: searchParams.get("min") || saved.minAmount || "",
      maxAmount: searchParams.get("max") || saved.maxAmount || "",
      dateFrom: searchParams.get("from") || saved.dateFrom || "",
      dateTo: searchParams.get("to") || saved.dateTo || "",
      expanded: Boolean(saved.expanded),
    };
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      localStorage.setItem(DEAL_FILTERS_KEY, JSON.stringify(filters));
      const next = new URLSearchParams(searchParams);
      [
        ["pipeline", filters.pipelineId],
        ["stage", filters.stageFilter === "all" ? "" : filters.stageFilter],
        ["status", filters.statusFilter === "open" ? "" : filters.statusFilter],
        ["owner", filters.ownerFilter],
        ["search", filters.search],
        ["quick", filters.quickFilter === "all" ? "" : filters.quickFilter],
        ["source", filters.sourceFilter],
        ["min", filters.minAmount],
        ["max", filters.maxAmount],
        ["from", filters.dateFrom],
        ["to", filters.dateTo],
      ].forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      setSearchParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [filters, searchParams, setSearchParams]);

  function updateFilters(patch: Partial<DealFiltersState>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setFilters((current) => ({
      ...current,
      stageFilter: "all",
      statusFilter: "open",
      ownerFilter: "",
      search: "",
      quickFilter: "all",
      sourceFilter: "",
      minAmount: "",
      maxAmount: "",
      dateFrom: "",
      dateTo: "",
    }));
  }

  const activeFilterCount = [
    filters.stageFilter !== "all",
    filters.statusFilter !== "open",
    Boolean(filters.ownerFilter),
    Boolean(filters.search),
    filters.quickFilter !== "all",
    Boolean(filters.sourceFilter),
    Boolean(filters.minAmount),
    Boolean(filters.maxAmount),
    Boolean(filters.dateFrom),
    Boolean(filters.dateTo),
  ].filter(Boolean).length;

  return { filters, updateFilters, resetFilters, activeFilterCount };
}
