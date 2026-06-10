import { ChevronDown, MoreHorizontal, X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import type { ClientQuickFilter, Translate } from "../types";

type FilterChip = {
  key: "search" | "source" | "tag" | "segment";
  label: string;
  value: string;
};

export function ClientsFilters({
  quickFilter,
  onQuickFilterChange,
  source,
  onSourceChange,
  selectedTag,
  onSelectedTagChange,
  selectedSegment,
  onSelectedSegmentChange,
  search,
  tagOptions,
  segmentOptions,
  sourceOptions,
  onOpenSegment,
  onClearSearch,
  onClearAll,
  t,
}: {
  quickFilter: ClientQuickFilter;
  onQuickFilterChange: (value: ClientQuickFilter) => void;
  source: string;
  onSourceChange: (value: string) => void;
  selectedTag: string;
  onSelectedTagChange: (value: string) => void;
  selectedSegment: string;
  onSelectedSegmentChange: (value: string) => void;
  search: string;
  tagOptions: Array<{ value: string | number; label: string }>;
  segmentOptions: Array<{ value: string | number; label: string }>;
  sourceOptions: Array<{ value: string | number; label: string }>;
  onOpenSegment: () => void;
  onClearSearch: () => void;
  onClearAll: () => void;
  t: Translate;
}) {
  const quickFilterOptions: Array<{ value: ClientQuickFilter; label: string }> = [
    { value: "all", label: "Все" },
    { value: "new", label: "Новые" },
    { value: "vip", label: "VIP" },
    { value: "no_reply", label: "Без ответа" },
    { value: "mine", label: "Мои клиенты" },
  ];
  const activeFilters: FilterChip[] = [
    search ? { key: "search", label: "Поиск", value: search } : null,
    source ? { key: "source", label: "Источник", value: sourceOptions.find((option) => String(option.value) === source)?.label || source } : null,
    selectedTag ? { key: "tag", label: "Тег", value: tagOptions.find((option) => String(option.value) === selectedTag)?.label || selectedTag } : null,
    selectedSegment ? { key: "segment", label: "Сегмент", value: segmentOptions.find((option) => String(option.value) === selectedSegment)?.label || selectedSegment } : null,
  ].filter(Boolean) as FilterChip[];

  function removeFilter(key: FilterChip["key"]) {
    if (key === "search") onClearSearch();
    if (key === "source") onSourceChange("");
    if (key === "tag") onSelectedTagChange("");
    if (key === "segment") onSelectedSegmentChange("");
  }

  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1" role="tablist" aria-label="Фильтр клиентов">
          {quickFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={quickFilter === option.value}
              onClick={() => onQuickFilterChange(option.value)}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-semibold transition",
                quickFilter === option.value ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={source} onChange={(event) => onSourceChange(event.target.value)} options={sourceOptions} className="h-9 min-h-9 w-[170px] text-xs" aria-label="Источник" />
          <Select value={selectedTag} onChange={(event) => onSelectedTagChange(event.target.value)} options={tagOptions} className="h-9 min-h-9 w-[160px] text-xs" aria-label="Тег" />
          <Button variant="secondary" size="sm" onClick={onOpenSegment}>
            {t("clients.segment")} <ChevronDown size={14} />
          </Button>
          <Select value={selectedSegment} onChange={(event) => onSelectedSegmentChange(event.target.value)} options={segmentOptions} className="h-9 min-h-9 w-[170px] text-xs" aria-label="Сегмент" />
          <Button variant="secondary" size="icon" className="h-9 w-9 min-h-9 min-w-9" aria-label="Еще">
            <MoreHorizontal size={17} />
          </Button>
        </div>
      </div>

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
          <button type="button" onClick={onClearAll} className="h-8 rounded-full px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50">
            Очистить все
          </button>
        </div>
      ) : null}
    </div>
  );
}
