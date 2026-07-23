import { X } from "lucide-react";

import { Select } from "../../../components/ui/Select";
import { SearchableCalendarFilter } from "./SearchableCalendarFilter";
import type { CalendarTranslate, SearchableCalendarFilterOption } from "../calendarTypes";

export type ActiveCalendarFilterChip = {
  key: string;
  label: string;
  clear: () => void;
};

export function CalendarResourceFilters({
  serviceFilter,
  resourceFilter,
  statusFilter,
  serviceOptions,
  resourceOptions,
  isServicesLoading,
  isResourcesLoading,
  onServiceChange,
  onResourceChange,
  onStatusChange,
  t,
}: {
  serviceFilter: string;
  resourceFilter: string;
  statusFilter: string;
  serviceOptions: SearchableCalendarFilterOption[];
  resourceOptions: SearchableCalendarFilterOption[];
  isServicesLoading: boolean;
  isResourcesLoading: boolean;
  onServiceChange: (value: string) => void;
  onResourceChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  t: CalendarTranslate;
}) {
  return (
    <>
      <SearchableCalendarFilter
        value={serviceFilter}
        onChange={onServiceChange}
        disabled={isServicesLoading}
        options={serviceOptions}
        allLabel={t("calendar.allServices")}
        searchPlaceholder={t("calendar.searchServices")}
        emptyLabel={t("calendar.noFilterResults")}
      />
      <SearchableCalendarFilter
        value={resourceFilter}
        onChange={onResourceChange}
        disabled={isResourcesLoading}
        options={resourceOptions}
        allLabel={t("calendar.allResources")}
        searchPlaceholder={t("calendar.searchResources")}
        emptyLabel={t("calendar.noFilterResults")}
      />
      <Select
        value={statusFilter}
        onChange={(event) => onStatusChange(event.target.value)}
        options={[
          { value: "", label: t("calendar.allStatuses") },
          { value: "created", label: t("status.created") },
          { value: "confirmed", label: t("status.confirmed") },
          { value: "completed", label: t("status.completed") },
          { value: "cancelled", label: t("status.cancelled") },
          { value: "no_show", label: t("status.no_show") },
        ]}
      />
    </>
  );
}

export function ActiveCalendarFilters({
  chips,
  onClearAll,
  t,
}: {
  chips: ActiveCalendarFilterChip[];
  onClearAll: () => void;
  t: CalendarTranslate;
}) {
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zani-border bg-surface-muted px-4 py-2">
      <span className="text-[11px] font-bold uppercase text-zani-muted">{t("calendar.filters")}</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="inline-flex min-h-7 max-w-full items-center gap-2 rounded-control border border-brand-100 bg-zani-card px-2.5 py-1 text-xs font-bold text-brand-700 transition hover:border-brand-200 hover:bg-brand-50"
          onClick={chip.clear}
        >
          <span className="truncate">{chip.label}</span>
          <X size={13} />
        </button>
      ))}
      <button type="button" className="min-h-7 rounded-control px-2.5 py-1 text-xs font-bold text-zani-muted transition hover:bg-zani-card hover:text-zani-text" onClick={onClearAll}>
        {t("conversations.resetFilters")}
      </button>
    </div>
  );
}
