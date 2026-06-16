import { ChevronDown, MoreHorizontal, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import type { ClientKpi, ClientQuickFilter, Translate } from "../types";

type FilterChip = {
  key: "search" | "source" | "tag" | "segment";
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
  advancedFiltersOpen,
  onAdvancedFiltersOpenChange,
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
  advancedFiltersOpen: boolean;
  onAdvancedFiltersOpenChange: (value: boolean) => void;
  onOpenSegment: () => void;
  onClearSearch: () => void;
  onClearAll: () => void;
  t: Translate;
}) {
  const quickFilterOptions: Array<{ value: ClientQuickFilter; label: string }> = [
    { value: "all", label: `Все ${kpi.total}` },
    { value: "new", label: "Новые" },
    { value: "vip", label: "VIP" },
    { value: "no_reply", label: `Без ответа ${kpi.noReply}` },
    { value: "mine", label: "Мои клиенты" },
  ];
  const activeFilters: FilterChip[] = [
    search ? { key: "search", label: "Поиск", value: search } : null,
    source ? { key: "source", label: "Источник", value: sourceOptions.find((option) => String(option.value) === source)?.label || source } : null,
    selectedTag ? { key: "tag", label: "Тег", value: tagOptions.find((option) => String(option.value) === selectedTag)?.label || selectedTag } : null,
    selectedSegment ? { key: "segment", label: "Сегмент", value: segmentOptions.find((option) => String(option.value) === selectedSegment)?.label || selectedSegment } : null,
  ].filter(Boolean) as FilterChip[];
  const activeFilterCount = activeFilters.length;

  function removeFilter(key: FilterChip["key"]) {
    if (key === "search") onClearSearch();
    if (key === "source") onSourceChange("");
    if (key === "tag") onSelectedTagChange("");
    if (key === "segment") onSelectedSegmentChange("");
  }

  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-2.5">
      <div className="flex min-h-9 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1" role="tablist" aria-label="Фильтр клиентов">
          {quickFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={quickFilter === option.value}
              onClick={() => onQuickFilterChange(option.value)}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-medium transition",
                quickFilter === option.value ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 gap-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => onAdvancedFiltersOpenChange(!advancedFiltersOpen)}>
            Ещё фильтры
            {activeFilterCount ? <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">{activeFilterCount}</span> : null}
            <ChevronDown size={14} className={cn("transition", advancedFiltersOpen && "rotate-180")} />
          </Button>
          <Button variant="secondary" size="icon" className="h-9 w-9 min-h-9 min-w-9" aria-label="Еще">
            <MoreHorizontal size={17} />
          </Button>
        </div>
      </div>

      {advancedFiltersOpen ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <Select value={source} onChange={(event) => onSourceChange(event.target.value)} options={sourceOptions} className="h-9 min-h-9 w-[158px] text-xs" aria-label="Источник" />
          <Select value={selectedTag} onChange={(event) => onSelectedTagChange(event.target.value)} options={tagOptions} className="h-9 min-h-9 w-[145px] text-xs" aria-label="Тег" />
          <Button variant="secondary" size="sm" onClick={onOpenSegment}>
            {t("clients.segment")} <ChevronDown size={14} />
          </Button>
          <Select value={selectedSegment} onChange={(event) => onSelectedSegmentChange(event.target.value)} options={segmentOptions} className="h-9 min-h-9 w-[160px] text-xs" aria-label="Сегмент" />
        </div>
      ) : null}

      {activeFilters.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Активные фильтры:</span>
          {activeFilters.map((filter) => (
            <span key={filter.key} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700">
              {filter.label}: {filter.value}
              <button type="button" onClick={() => removeFilter(filter.key)} className="grid h-5 w-5 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-slate-900" aria-label={`Убрать фильтр ${filter.label}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <button type="button" onClick={onClearAll} className="h-8 rounded-full px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
            Очистить все
          </button>
        </div>
      ) : null}
    </div>
  );
}
