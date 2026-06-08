import { ArrowDown, ArrowUp, Columns3, KanbanSquare, MoreHorizontal, Trash2, UserPlus, ListTree, Table2 } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import type { DealSortKey, DealViewMode } from "../types";

const viewOptions: Array<{ value: DealViewMode; labelKey: string; icon: typeof ListTree }> = [
  { value: "list", labelKey: "deals.viewList", icon: ListTree },
  { value: "kanban", labelKey: "deals.viewKanban", icon: KanbanSquare },
  { value: "table", labelKey: "deals.viewTable", icon: Table2 },
];

export function DealsToolbar({
  viewMode,
  sortKey,
  sortAsc,
  selectedCount,
  onViewModeChange,
  onSortKeyChange,
  onSortDirectionToggle,
  onBulkClear,
  t,
}: {
  viewMode: DealViewMode;
  sortKey: DealSortKey;
  sortAsc: boolean;
  selectedCount: number;
  onViewModeChange: (value: DealViewMode) => void;
  onSortKeyChange: (value: DealSortKey) => void;
  onSortDirectionToggle: () => void;
  onBulkClear: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <section className="flex min-h-14 flex-col gap-3 border-y border-slate-200 bg-white px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg bg-slate-100 p-1">
          {viewOptions.map(({ value, labelKey, icon: Icon }) => {
            const label = t(labelKey);
            return (
            <button
              key={value}
              type="button"
              className={cn("inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-bold transition", viewMode === value ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-midnight")}
              onClick={() => onViewModeChange(value)}
              aria-label={label}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </button>
            );
          })}
        </div>
        {selectedCount ? <span className="rounded-lg bg-primary-50 px-3 py-2 text-sm font-black text-brand-700">{t("deals.selected", { count: selectedCount })}</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={sortKey}
          onChange={(event) => onSortKeyChange(event.target.value as DealSortKey)}
          options={[
            { value: "updated", label: t("deals.sortUpdated") },
            { value: "amount", label: t("deals.sortAmount") },
            { value: "priority", label: t("deals.sortPriority") },
          ]}
        />
        <Button variant="secondary" size="icon" className="h-10 w-10" aria-label={t("deals.toggleSort")} onClick={onSortDirectionToggle}>
          {sortAsc ? <ArrowUp size={17} /> : <ArrowDown size={17} />}
        </Button>
        {selectedCount ? (
          <>
            <Button variant="secondary" size="sm"><UserPlus size={15} /> {t("deals.assign")}</Button>
            <Button variant="secondary" size="sm"><Columns3 size={15} /> {t("deals.stage")}</Button>
            <Button variant="danger" size="sm" onClick={onBulkClear}><Trash2 size={15} /> {t("deals.delete")}</Button>
          </>
        ) : null}
        <Button variant="secondary" size="icon" className="h-10 w-10" aria-label={t("deals.more")}>
          <MoreHorizontal size={17} />
        </Button>
      </div>
    </section>
  );
}
