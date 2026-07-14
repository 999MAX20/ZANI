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
        { value: "all" as const, label: `Все ${kpi.total}` },
        { value: "new" as const, label: "Новые" },
        { value: "vip" as const, label: "VIP" },
        { value: "no_reply" as const, label: `Без ответа ${kpi.noReply}` },
        { value: "mine" as const, label: "Мои клиенты" },
      ],
    [kpi.noReply, kpi.total],
  );
  const columnOptions = useMemo(
    () => [
      { id: "source" as const, label: t("clients.source") },
      { id: "manager" as const, label: t("clients.manager") },
    ],
    [t],
  );

  const activeFilters: FilterChip[] = [
    search ? { id: "search", label: "Поиск", value: search } : null,
    source ? { id: "source", label: "Источник", value: sourceOptions.find((option) => String(option.value) === source)?.label || source } : null,
    selectedTag ? { id: "tag", label: "Тег", value: tagOptions.find((option) => String(option.value) === selectedTag)?.label || selectedTag } : null,
    selectedSegment
      ? { id: "segment", label: "Сегмент", value: segmentOptions.find((option) => String(option.value) === selectedSegment)?.label || selectedSegment }
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
        <Select value={source} onChange={(event) => onSourceChange(event.target.value)} options={sourceOptions} className="h-9 text-xs" aria-label="Источник" />
        <Select value={selectedTag} onChange={(event) => onSelectedTagChange(event.target.value)} options={tagOptions} className="h-9 text-xs" aria-label="Тег" />
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
          aria-label="Сегмент"
        />
      </div>
      <div className="pt-1 text-right">
        <Button type="button" size="sm" variant="secondary" className="h-8" onClick={onClearAll}>
          {search || source || selectedTag || selectedSegment ? "Очистить" : "Сбросить"}
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
      advancedLabel="Расширенные"
      activeFilters={activeFilters}
      onClearFilter={removeFilter}
      onClearAll={onClearAll}
      ariaLabel="Фильтры клиентов"
    >
      <div className="relative">
        <button
          type="button"
          className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          onClick={() => setColumnsOpen((value) => !value)}
          aria-label={t("clients.columns")}
        >
          <Columns3 size={15} />
        </button>
        {columnsOpen ? (
          <PopoverSurface className="absolute right-0 top-10 w-48 p-2">
            {columnOptions.map((column) => (
              <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={visibleColumns.has(column.id)}
                  onChange={() => onToggleColumn(column.id)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {column.label}
              </label>
            ))}
          </PopoverSurface>
        ) : null}
      </div>
      {search ? (
        <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-500">
          <Search size={14} className="text-slate-400" />
          <span className="max-w-40 truncate">{search}</span>
          <button type="button" onClick={onClearSearch} className="ml-1 rounded-full p-1 text-slate-600 hover:bg-white" aria-label="Очистить поиск">
            <X size={12} />
          </button>
        </span>
      ) : null}
    </CrmFilterChips>
  );
}
