import { Columns3, Download, Filter, Flame, Share2, Upload } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import type { FilterPreset, LeadColumnKey, LeadFilter } from "../types";

type LeadFilterTab = {
  value: LeadFilter;
  label: string;
  count: number;
};

export function LeadsToolbar({
  filters,
  filter,
  source,
  sourceOptions,
  savedFiltersOpen,
  filterPresets,
  presetName,
  moreMenuOpen,
  columnOrder,
  visibleColumns,
  labels,
  onFilterChange,
  onSourceChange,
  onToggleSavedFilters,
  onApplyPreset,
  onPresetNameChange,
  onSavePreset,
  onToggleMoreMenu,
  onToggleColumn,
  onToggleSortByAi,
  onExportCsv,
  onExportExcel,
  onShareView,
  onOpenImport,
}: {
  filters: LeadFilterTab[];
  filter: LeadFilter;
  source: string;
  sourceOptions: { value: string; label: string }[];
  savedFiltersOpen: boolean;
  filterPresets: FilterPreset[];
  presetName: string;
  moreMenuOpen: boolean;
  columnOrder: LeadColumnKey[];
  visibleColumns: Record<LeadColumnKey, boolean>;
  labels: {
    source: string;
    filters: string;
    columns: string;
    exportCsv: string;
    exportExcel: string;
    import: string;
    noSavedFilters: string;
    filterPresetName: string;
    saveFilter: string;
    sortByHeat: string;
    shareView: string;
    column: (column: LeadColumnKey) => string;
  };
  onFilterChange: (filter: LeadFilter) => void;
  onSourceChange: (source: string) => void;
  onToggleSavedFilters: () => void;
  onApplyPreset: (preset: FilterPreset) => void;
  onPresetNameChange: (name: string) => void;
  onSavePreset: () => void;
  onToggleMoreMenu: () => void;
  onToggleColumn: (column: LeadColumnKey) => void;
  onToggleSortByAi: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onShareView: () => void;
  onOpenImport: () => void;
}) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-black transition duration-200 active:scale-[0.98]",
              filter === item.value
                ? "border-brand-200 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-midnight",
            )}
            onClick={() => onFilterChange(item.value)}
          >
            <span>{item.label}</span>
            <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] tabular-nums", filter === item.value ? "bg-white text-brand-700" : "bg-slate-100 text-slate-500")}>
              {item.count}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-2 border-t border-slate-100 pt-3 xl:grid-cols-[minmax(180px,240px)_auto] xl:items-center">
        <Select
          className="h-9 text-xs"
          value={source}
          onChange={(event) => onSourceChange(event.target.value)}
          aria-label={labels.source}
          options={sourceOptions}
        />
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 xl:justify-end">
          <Button variant="secondary" size="sm" className="h-9 rounded-control px-3 shadow-none active:scale-[0.98]" onClick={onToggleSavedFilters}>
            <Filter size={16} />
            {labels.filters}
          </Button>
          <Button variant="secondary" size="sm" className="h-9 rounded-control px-3 shadow-none active:scale-[0.98]" onClick={onToggleMoreMenu}>
            <Columns3 size={16} />
            {labels.columns}
          </Button>
          <Button variant="secondary" size="sm" className="h-9 rounded-control px-3 shadow-none active:scale-[0.98]" onClick={onExportCsv}>
            <Download size={16} />
            {labels.exportCsv}
          </Button>
          <Button variant="secondary" size="sm" className="h-9 rounded-control px-3 shadow-none active:scale-[0.98]" onClick={onOpenImport}>
            <Upload size={16} />
            {labels.import}
          </Button>
        </div>
      </div>
      {savedFiltersOpen ? (
        <div className="mt-3 rounded-card border border-slate-200 bg-white p-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-2">
            {filterPresets.length ? filterPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.98]"
                onClick={() => onApplyPreset(preset)}
              >
                {preset.name}
              </button>
            )) : (
              <span className="py-2 text-xs font-semibold text-slate-400">{labels.noSavedFilters}</span>
            )}
          </div>
          <div className="mt-2 flex gap-2 border-t border-slate-200 pt-3">
            <input
              className="h-9 min-w-0 flex-1 rounded-control border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-brand-300"
              placeholder={labels.filterPresetName}
              value={presetName}
              onChange={(event) => onPresetNameChange(event.target.value)}
            />
            <Button variant="secondary" size="sm" className="shrink-0 rounded-control" onClick={onSavePreset}>{labels.saveFilter}</Button>
          </div>
        </div>
      ) : null}
      {moreMenuOpen ? (
        <div className="mt-3 grid gap-3 rounded-card border border-slate-200 bg-white p-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
              <Columns3 size={16} /> {labels.columns}
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {columnOrder.map((column) => (
                <label key={column} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50">
                  <input
                    type="checkbox"
                    checked={visibleColumns[column]}
                    onChange={() => onToggleColumn(column)}
                  />
                  <span className="truncate">{labels.column(column)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <Button variant="secondary" size="sm" className="rounded-control shadow-none active:scale-[0.98]" onClick={onToggleSortByAi}><Flame size={15} /> {labels.sortByHeat}</Button>
            <Button variant="secondary" size="sm" className="rounded-control shadow-none active:scale-[0.98]" onClick={onExportCsv}><Download size={15} /> CSV</Button>
            <Button variant="secondary" size="sm" className="rounded-control shadow-none active:scale-[0.98]" onClick={onExportExcel}>{labels.exportExcel}</Button>
            <Button variant="secondary" size="sm" className="rounded-control shadow-none active:scale-[0.98]" onClick={onShareView}><Share2 size={15} /> {labels.shareView}</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
