import { ChevronDown, Columns3, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { CrmFilterChips } from "../../../components/crm";
import { PopoverSurface } from "../../../components/ui/Overlay";
import { Select } from "../../../components/ui/Select";
import type { ClientKpi, ClientQuickFilter, ClientTableColumn, Translate } from "../types";

type FilterChip = {
  id: "search" | "source" | "tag" | "segment";
  label: string;
  value: string;
};

export function ClientsFilters({
  quickFilter,
  onQuickFilterChange,
  search,
  source,
  onSourceChange,
  selectedTag,
  onSelectedTagChange,
  selectedSegment,
  onSelectedSegmentChange,
  tagOptions,
  segmentOptions,
  sourceOptions,
  kpi,
  visibleColumns,
  onToggleColumn,
  onOpenSegment,
  onClearSearch,
  onClearAll,
  t,
}: {
  quickFilter: ClientQuickFilter;
  onQuickFilterChange: (value: ClientQuickFilter) => void;
  search: string;
  source: string;
  onSourceChange: (value: string) => void;
  selectedTag: string;
  onSelectedTagChange: (value: string) => void;
  selectedSegment: string;
  onSelectedSegmentChange: (value: string) => void;
  tagOptions: Array<{ value: string | number; label: string }>;
  segmentOptions: Array<{ value: string | number; label: string }>;
  sourceOptions: Array<{ value: string | number; label: string }>;
  kpi: ClientKpi;
  visibleColumns: Set<ClientTableColumn>;
  onToggleColumn: (column: ClientTableColumn) => void;
  onOpenSegment: () => void;
  onClearSearch: () => void;
  onClearAll: () => void;
  t: Translate;
}) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const quickFilterOptions = useMemo(
    () =>
      [
        { value: "all" as const, label: t("clients.filterAllWithCount", { count: kpi.total }) },
        { value: "new" as const, label: t("clients.filterNew") },
        { value: "vip" as const, label: "VIP" },
        { value: "no_reply" as const, label: t("clients.filterNoReplyWithCount", { count: kpi.noReply }) },
        { value: "mine" as const, label: t("clients.filterMine") },
      ],
    [kpi.noReply, kpi.total, t],
  );
  const columnOptions = useMemo(
    () => [
      { id: "source" as const, label: t("clients.source") },
      { id: "manager" as const, label: t("clients.manager") },
    ],
    [t],
  );

  const activeFilters: FilterChip[] = [
    search ? { id: "search", label: t("clients.searchFilter"), value: search } : null,
    source ? { id: "source", label: t("clients.source"), value: sourceOptions.find((option) => String(option.value) === source)?.label || source } : null,
    selectedTag ? { id: "tag", label: t("clients.tag"), value: tagOptions.find((option) => String(option.value) === selectedTag)?.label || selectedTag } : null,
    selectedSegment
      ? { id: "segment", label: t("clients.segment"), value: segmentOptions.find((option) => String(option.value) === selectedSegment)?.label || selectedSegment }
      : null,
  ].filter(Boolean) as FilterChip[];

  function removeFilter(id: string) {
    if (id === "search") onClearSearch();
    if (id === "source") onSourceChange("");
    if (id === "tag") onSelectedTagChange("");
    if (id === "segment") onSelectedSegmentChange("");
  }

  const advancedContent = (
    <div className="grid gap-2">
      <div className="grid gap-2 md:grid-cols-2">
        <Select value={source} onChange={(event) => onSourceChange(event.target.value)} options={sourceOptions} className="h-9 text-xs" aria-label={t("clients.source")} />
        <Select value={selectedTag} onChange={(event) => onSelectedTagChange(event.target.value)} options={tagOptions} className="h-9 text-xs" aria-label={t("clients.tag")} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Button type="button" variant="secondary" size="sm" onClick={onOpenSegment} className="justify-between">
          {t("clients.segment")}
          <ChevronDown size={14} />
        </Button>
        <Select
          value={selectedSegment}
          onChange={(event) => onSelectedSegmentChange(event.target.value)}
          options={segmentOptions}
          className="h-9 text-xs"
          aria-label={t("clients.segment")}
        />
      </div>
      <div className="pt-1 text-right">
        <Button type="button" size="sm" variant="secondary" className="h-8" onClick={onClearAll}>
          {search || source || selectedTag || selectedSegment ? t("common.clear") : t("common.reset")}
        </Button>
      </div>
    </div>
  );

  return (
    <CrmFilterChips
      value={quickFilter}
      options={quickFilterOptions}
      onChange={onQuickFilterChange}
      advanced={advancedContent}
      advancedLabel={t("common.advanced")}
      activeFilters={activeFilters}
      onClearFilter={removeFilter}
      onClearAll={onClearAll}
      ariaLabel={t("clients.filtersAriaLabel")}
      activeFiltersLabel={t("crm.activeFilters")}
      clearAllLabel={t("common.clearAll")}
      filtersLabel={t("clients.filters")}
    >
      <div className="relative">
        <button
          type="button"
          className="zani-focus-ring inline-grid h-9 w-9 place-items-center rounded-control border border-zani-border bg-surface-card text-zani-subtle shadow-sm transition hover:border-brand-100 hover:bg-brand-50 hover:text-zani-text"
          onClick={() => setColumnsOpen((value) => !value)}
          aria-label={t("clients.columns")}
        >
          <Columns3 size={15} />
        </button>
        {columnsOpen ? (
          <PopoverSurface className="absolute right-0 top-10 w-48 p-2">
            {columnOptions.map((column) => (
              <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-2 text-sm font-medium text-zani-subtle hover:bg-surface-muted hover:text-zani-text">
                <input
                  type="checkbox"
                  checked={visibleColumns.has(column.id)}
                  onChange={() => onToggleColumn(column.id)}
                  className="h-4 w-4 rounded border-zani-border text-brand-600 focus:ring-brand-500"
                />
                {column.label}
              </label>
            ))}
          </PopoverSurface>
        ) : null}
      </div>
      {search ? (
        <span className="inline-flex h-9 items-center gap-1 rounded-control border border-brand-100 bg-brand-50 px-2 text-sm font-semibold text-brand-700">
          <Search size={14} className="text-brand-600" />
          <span className="max-w-40 truncate">{search}</span>
          <button type="button" onClick={onClearSearch} className="zani-focus-ring ml-1 rounded-full p-1 text-brand-600 hover:bg-surface-card" aria-label={t("clients.clearSearch")}>
            <X size={12} />
          </button>
        </span>
      ) : null}
    </CrmFilterChips>
  );
}
