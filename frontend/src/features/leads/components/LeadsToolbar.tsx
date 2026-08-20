import {
  Columns3,
  Download,
  Filter,
  Flame,
  Search,
  Share2,
  Upload,
} from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import type { FilterPreset, LeadColumnKey, LeadFilter } from "../types";

type LeadFilterTab = {
  value: LeadFilter;
  label: string;
  count: number;
};

export function LeadsToolbar({
  filters,
  filter,
  search,
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
  onSearchChange,
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
  search: string;
  source: string;
  sourceOptions: { value: string; label: string }[];
  savedFiltersOpen: boolean;
  filterPresets: FilterPreset[];
  presetName: string;
  moreMenuOpen: boolean;
  columnOrder: LeadColumnKey[];
  visibleColumns: Record<LeadColumnKey, boolean>;
  labels: {
    search: string;
    status: string;
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
  onSearchChange: (search: string) => void;
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
      <div
        className="grid gap-2 xl:grid-cols-[minmax(220px,0.75fr)_minmax(170px,220px)_minmax(160px,210px)_auto] xl:items-center"
        data-testid="leads-filter-toolbar"
      >
        <label className="relative block min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zani-muted"
            size={18}
          />
          <input
            data-testid="leads-search-input"
            className="h-9 w-full rounded-control border border-zani-border bg-surface-card px-9 text-sm font-semibold text-zani-text outline-none transition placeholder:text-zani-muted focus:border-brand-300 focus:ring-4 focus:ring-[var(--zani-focus-ring)]"
            placeholder={labels.search}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <Select
          data-testid="leads-status-filter"
          className="h-9 text-xs"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as LeadFilter)}
          aria-label={labels.status}
          options={filters.map((item) => ({
            value: item.value,
            label: `${item.label} · ${item.count}`,
          }))}
        />
        <Select
          data-testid="leads-source-filter"
          className="h-9 text-xs"
          value={source}
          onChange={(event) => onSourceChange(event.target.value)}
          aria-label={labels.source}
          options={sourceOptions}
        />
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 xl:justify-end">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 rounded-control px-3"
            onClick={onToggleSavedFilters}
          >
            <Filter size={16} />
            {labels.filters}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 rounded-control px-3"
            onClick={onToggleMoreMenu}
          >
            <Columns3 size={16} />
            {labels.columns}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 rounded-control px-3"
            onClick={onExportCsv}
          >
            <Download size={16} />
            {labels.exportCsv}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 rounded-control px-3"
            onClick={onOpenImport}
          >
            <Upload size={16} />
            {labels.import}
          </Button>
        </div>
      </div>
      {savedFiltersOpen ? (
        <div data-testid="lead-saved-filters-panel">
        <div className="mt-3 rounded-card border border-zani-border bg-surface-muted p-3">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-2">
            {filterPresets.length ? (
              filterPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="shrink-0 rounded-control border border-zani-border bg-surface-card px-3 py-2 text-xs font-bold text-zani-text hover:border-brand-100 hover:bg-brand-50 hover:text-brand-700"
                  onClick={() => onApplyPreset(preset)}
                >
                  {preset.name}
                </button>
              ))
            ) : (
              <span className="py-2 text-xs font-semibold text-zani-muted">
                {labels.noSavedFilters}
              </span>
            )}
          </div>
          <div className="mt-2 flex gap-2 border-t border-zani-border pt-3">
            <input
              className="h-9 min-w-0 flex-1 rounded-control border border-zani-border bg-surface-card px-3 text-sm font-semibold text-zani-text outline-none focus:border-brand-300 focus:ring-4 focus:ring-[var(--zani-focus-ring)]"
              placeholder={labels.filterPresetName}
              value={presetName}
              onChange={(event) => onPresetNameChange(event.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 rounded-control"
              onClick={onSavePreset}
            >
              {labels.saveFilter}
            </Button>
          </div>
        </div>
        </div>
      ) : null}
      {moreMenuOpen ? (
        <div className="mt-3 grid gap-3 rounded-card border border-zani-border bg-surface-muted p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-zani-text">
              <Columns3 size={16} /> {labels.columns}
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {columnOrder.map((column) => (
                <label
                  key={column}
                  className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-control border border-zani-border bg-surface-card px-3 text-xs font-bold text-zani-text hover:border-brand-100 hover:bg-surface-warm"
                >
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
            <Button
              variant="secondary"
              size="sm"
              className="rounded-control"
              onClick={onToggleSortByAi}
            >
              <Flame size={15} /> {labels.sortByHeat}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-control"
              onClick={onExportCsv}
            >
              <Download size={15} /> CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-control"
              onClick={onExportExcel}
            >
              {labels.exportExcel}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-control"
              onClick={onShareView}
            >
              <Share2 size={15} /> {labels.shareView}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
