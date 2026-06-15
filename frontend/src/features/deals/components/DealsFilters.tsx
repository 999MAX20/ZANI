import { CalendarDays, Download, Plus, SlidersHorizontal, X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { DealFiltersState, Translate } from "../types";

export function DealsFilters({
  filters,
  pipelines,
  teamMembers,
  activePipeline,
  activeFilterCount,
  onChange,
  onReset,
  onExport,
  onCreate,
  onConfigure,
  t,
}: {
  filters: DealFiltersState;
  pipelines: Array<{ id: number; name: string }>;
  teamMembers: Array<{ user: { id: number; full_name?: string; email: string } }>;
  activePipeline: number;
  activeFilterCount: number;
  onChange: (patch: Partial<DealFiltersState>) => void;
  onReset: () => void;
  onExport: () => void;
  onCreate: () => void;
  onConfigure: () => void;
  t: Translate;
}) {
  return (
    <section className="mb-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[176px_170px_210px]">
          <Select className="min-h-10 rounded-lg border-slate-100 bg-white text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.03)]" value={String(activePipeline || "")} onChange={(event) => onChange({ pipelineId: event.target.value })} options={pipelines.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))} />
          <Input className="h-10 rounded-lg border-slate-100 text-[13px] font-bold shadow-[0_1px_2px_rgba(15,23,42,0.03)]" leftIcon={<CalendarDays size={15} />} type="date" value={filters.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} />
          <Select
            className="min-h-10 rounded-lg border-slate-100 bg-white text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            value={filters.ownerFilter}
            onChange={(event) => onChange({ ownerFilter: event.target.value })}
            options={[{ value: "", label: t("deals.allManagers") }, ...teamMembers.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email }))]}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {activeFilterCount ? (
            <Button variant="secondary" size="icon" className="h-10 w-10 min-w-10 shrink-0 rounded-lg border-slate-100 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]" aria-label={t("deals.reset")} onClick={onReset}>
              <X size={16} />
            </Button>
          ) : null}
          <Button variant="secondary" className="h-10 rounded-lg border-slate-100 px-4 text-[13px] font-black text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]" onClick={onConfigure}>
            <SlidersHorizontal size={15} /> {t("deals.configurePipeline")}
          </Button>
          <Button className="h-10 rounded-lg bg-[#5b4bff] px-4 text-[13px] font-black shadow-[0_10px_22px_rgba(91,75,255,0.22)] hover:bg-[#4d3df1]" onClick={onCreate}>
            <Plus size={16} /> {t("deals.newDeal")}
          </Button>
        </div>
      </div>

      {filters.expanded ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-slate-100 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)] md:grid-cols-2 xl:grid-cols-5">
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
          <Input label={t("deals.periodTo")} type="date" value={filters.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} />
          <Input label={t("deals.amountFrom")} type="number" value={filters.minAmount} onChange={(event) => onChange({ minAmount: event.target.value })} />
          <Input label={t("deals.amountTo")} type="number" value={filters.maxAmount} onChange={(event) => onChange({ maxAmount: event.target.value })} />
          <Input label={t("deals.source")} value={filters.sourceFilter} onChange={(event) => onChange({ sourceFilter: event.target.value })} />
          <Button variant="secondary" className="h-10 self-end rounded-lg border-slate-100 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]" onClick={onExport}>
            <Download size={16} /> Excel
          </Button>
        </div>
      ) : null}
    </section>
  );
}
