import { Download, Filter, Save, Search, X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import type { DealFiltersState, DealMetricsModel, DealQuickFilter, Translate } from "../types";

export function DealsFilters({
  filters,
  metrics,
  pipelines,
  teamMembers,
  activePipeline,
  activeFilterCount,
  onChange,
  onReset,
  onSave,
  onExport,
  t,
}: {
  filters: DealFiltersState;
  metrics: DealMetricsModel;
  pipelines: Array<{ id: number; name: string }>;
  teamMembers: Array<{ user: { id: number; full_name?: string; email: string } }>;
  activePipeline: number;
  activeFilterCount: number;
  onChange: (patch: Partial<DealFiltersState>) => void;
  onReset: () => void;
  onSave: () => void;
  onExport: () => void;
  t: Translate;
}) {
  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(220px,1fr)_auto_auto_auto]">
        <Select value={String(activePipeline || "")} onChange={(event) => onChange({ pipelineId: event.target.value })} options={pipelines.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))} />
        <Input leftIcon={<Search size={17} />} placeholder={t("deals.queueSearch")} value={filters.search} onChange={(event) => onChange({ search: event.target.value })} />
        <Button variant="secondary" onClick={() => onChange({ expanded: !filters.expanded })}>
          <Filter size={17} /> {t("deals.filters")} {activeFilterCount ? <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">{activeFilterCount}</span> : null}
        </Button>
        <Button variant="secondary" onClick={onSave}>
          <Save size={17} /> {t("deals.saveFilter")}
        </Button>
        <Button variant="secondary" onClick={onExport}>
          <Download size={17} /> Excel
        </Button>
      </div>

      {filters.expanded ? (
        <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-2 xl:grid-cols-6">
          <Select
            label={t("deals.status")}
            value={filters.statusFilter}
            onChange={(event) => onChange({ statusFilter: event.target.value as DealFiltersState["statusFilter"] })}
            options={[
              { value: "open", label: t("deals.statusOpen") },
              { value: "won", label: t("deals.statusWon") },
              { value: "lost", label: t("deals.statusLost") },
              { value: "all", label: t("deals.allStatuses") },
            ]}
          />
          <Select
            label={t("deals.manager")}
            value={filters.ownerFilter}
            onChange={(event) => onChange({ ownerFilter: event.target.value })}
            options={[{ value: "", label: t("deals.allManagers") }, ...teamMembers.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email }))]}
          />
          <Input label={t("deals.periodFrom")} type="date" value={filters.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} />
          <Input label={t("deals.periodTo")} type="date" value={filters.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} />
          <Input label={t("deals.amountFrom")} type="number" value={filters.minAmount} onChange={(event) => onChange({ minAmount: event.target.value })} />
          <Input label={t("deals.amountTo")} type="number" value={filters.maxAmount} onChange={(event) => onChange({ maxAmount: event.target.value })} />
        </div>
      ) : null}

      <div className="mt-3 flex gap-2 overflow-x-auto">
        {metrics.quickFilters.map((item) => (
          <button
            key={item.value}
            type="button"
            className={cn("inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-sm font-bold transition focus-visible-ring", filters.quickFilter === item.value ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}
            onClick={() => onChange({ quickFilter: item.value as DealQuickFilter })}
          >
            {item.label}
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{item.count}</span>
          </button>
        ))}
        {activeFilterCount ? (
          <button type="button" className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-600 hover:bg-slate-100" onClick={onReset}>
            <X size={15} /> {t("deals.reset")}
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto">
        {metrics.stageOptions.map((item) => (
          <button
            key={item.value}
            type="button"
            className={cn("inline-flex min-h-9 shrink-0 items-center rounded-lg border px-3 text-sm font-bold transition", filters.stageFilter === item.value ? "border-brand-600 bg-primary-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
            onClick={() => onChange({ stageFilter: item.value })}
          >
            {item.label}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{item.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
