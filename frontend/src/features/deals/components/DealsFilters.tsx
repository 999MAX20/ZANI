import { Search, X } from "lucide-react";

import { CrmFilterChips, type CrmActiveFilter } from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { PipelineStage, TeamMember } from "../../../types";
import type { DealFiltersState, DealQuickFilter, DealStatusFilter, Translate } from "../types";
import { sourceLabel } from "../utils/dealHelpers";

type DealsFiltersProps = {
  filters: DealFiltersState;
  stages: PipelineStage[];
  teamMembers: TeamMember[];
  quickCounts: Record<DealQuickFilter, number>;
  onChange: (patch: Partial<DealFiltersState>) => void;
  onReset: () => void;
  t: Translate;
};

const quickFilters: DealQuickFilter[] = ["all", "mine", "hot", "overdue", "no_tasks"];
const statusFilters: DealStatusFilter[] = ["open", "won", "lost", "all"];
const sourceOptions = ["", "manual", "website", "landing", "telegram", "whatsapp", "instagram", "parser", "other"];

function statusLabel(value: DealStatusFilter, t: Translate) {
  const labels: Record<DealStatusFilter, string> = {
    open: t("deals.statusOpen"),
    won: t("deals.statusWon"),
    lost: t("deals.statusLost"),
    all: t("deals.allStatuses"),
  };
  return labels[value];
}

function quickLabel(value: DealQuickFilter, t: Translate) {
  const labels: Record<DealQuickFilter, string> = {
    all: t("deals.allStatuses"),
    mine: t("deals.filterMine"),
    hot: t("deals.hot"),
    overdue: t("deals.overdue"),
    no_tasks: t("deals.noTasksFilter"),
  };
  return labels[value];
}

export function DealsFilters({ filters, stages, teamMembers, quickCounts, onChange, onReset, t }: DealsFiltersProps) {
  const activeFilters: CrmActiveFilter[] = [
    filters.search ? { id: "search", label: t("common.search"), value: filters.search } : null,
    filters.statusFilter !== "open" ? { id: "statusFilter", label: t("deals.status"), value: statusLabel(filters.statusFilter, t) } : null,
    filters.stageFilter !== "all" ? { id: "stageFilter", label: t("deals.stage"), value: stages.find((stage) => String(stage.id) === filters.stageFilter)?.name || filters.stageFilter } : null,
    filters.ownerFilter ? { id: "ownerFilter", label: t("deals.manager"), value: teamMembers.find((member) => String(member.user.id) === filters.ownerFilter)?.user.full_name || filters.ownerFilter } : null,
    filters.sourceFilter ? { id: "sourceFilter", label: t("deals.source"), value: sourceLabel(filters.sourceFilter, t) } : null,
    filters.minAmount ? { id: "minAmount", label: t("deals.amountFrom"), value: filters.minAmount } : null,
    filters.maxAmount ? { id: "maxAmount", label: t("deals.amountTo"), value: filters.maxAmount } : null,
    filters.dateFrom ? { id: "dateFrom", label: t("deals.periodFrom"), value: filters.dateFrom } : null,
    filters.dateTo ? { id: "dateTo", label: t("deals.periodTo"), value: filters.dateTo } : null,
  ].filter(Boolean) as CrmActiveFilter[];

  function clearFilter(id: string) {
    if (id === "search") onChange({ search: "" });
    if (id === "statusFilter") onChange({ statusFilter: "open" });
    if (id === "stageFilter") onChange({ stageFilter: "all" });
    if (id === "ownerFilter") onChange({ ownerFilter: "" });
    if (id === "sourceFilter") onChange({ sourceFilter: "" });
    if (id === "minAmount") onChange({ minAmount: "" });
    if (id === "maxAmount") onChange({ maxAmount: "" });
    if (id === "dateFrom") onChange({ dateFrom: "" });
    if (id === "dateTo") onChange({ dateTo: "" });
  }

  return (
    <CrmFilterChips
      value={filters.quickFilter}
      options={quickFilters.map((value) => ({ value, label: quickLabel(value, t), count: quickCounts[value] }))}
      onChange={(quickFilter) => onChange({ quickFilter })}
      advancedLabel={t("deals.filters")}
      activeFilters={activeFilters}
      onClearFilter={clearFilter}
      onClearAll={onReset}
      ariaLabel={t("deals.filters")}
      advanced={
        <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-2">
            <Select value={filters.statusFilter} onChange={(event) => onChange({ statusFilter: event.target.value as DealStatusFilter })} options={statusFilters.map((value) => ({ value, label: statusLabel(value, t) }))} className="h-9 text-xs" aria-label={t("deals.status")} />
            <Select value={filters.stageFilter} onChange={(event) => onChange({ stageFilter: event.target.value })} options={[{ value: "all", label: t("deals.allStages") }, ...stages.map((stage) => ({ value: String(stage.id), label: stage.name }))]} className="h-9 text-xs" aria-label={t("deals.stage")} />
            <Select
              value={filters.ownerFilter}
              onChange={(event) => onChange({ ownerFilter: event.target.value })}
              options={[{ value: "", label: t("deals.allManagers") }, ...teamMembers.filter((member) => member.is_active).map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email }))]}
              className="h-9 text-xs"
              aria-label={t("deals.manager")}
            />
            <Select value={filters.sourceFilter} onChange={(event) => onChange({ sourceFilter: event.target.value })} options={sourceOptions.map((value) => ({ value, label: value ? sourceLabel(value, t) : t("clients.allSources") }))} className="h-9 text-xs" aria-label={t("deals.source")} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Input type="number" value={filters.minAmount} onChange={(event) => onChange({ minAmount: event.target.value })} placeholder={t("deals.amountFrom")} className="h-9 text-xs" aria-label={t("deals.amountFrom")} />
            <Input type="number" value={filters.maxAmount} onChange={(event) => onChange({ maxAmount: event.target.value })} placeholder={t("deals.amountTo")} className="h-9 text-xs" aria-label={t("deals.amountTo")} />
            <Input type="date" value={filters.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} className="h-9 text-xs" aria-label={t("deals.periodFrom")} />
            <Input type="date" value={filters.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} className="h-9 text-xs" aria-label={t("deals.periodTo")} />
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="secondary" className="h-8" onClick={onReset}>
              {t("deals.reset")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="relative w-full min-w-[220px] md:w-[300px]">
        <Input
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder={t("deals.queueSearch")}
          leftIcon={<Search size={15} />}
          rightIcon={filters.search ? <button type="button" onClick={() => onChange({ search: "" })} className="rounded-full p-1 text-zani-faint hover:bg-surface-muted hover:text-zani-text" aria-label={t("deals.clearSearch")}><X size={13} /></button> : null}
          className="h-9 text-xs"
          aria-label={t("common.search")}
        />
      </div>
    </CrmFilterChips>
  );
}
