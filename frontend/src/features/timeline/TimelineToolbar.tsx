import { Search } from "lucide-react";
import { categoryConfig } from "../../components/crm/drawers/timelineHelpers";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useI18n } from "../../lib/i18n";
import type { Id } from "../../types";
import type { TimelineFilters } from "../../types/timeline";
import { TimelineActorFilter } from "./TimelineActorFilter";

export function TimelineToolbar({
  businessId,
  filters,
  onChange,
  onReset,
}: {
  businessId: Id;
  filters: TimelineFilters;
  onChange: (key: keyof TimelineFilters, value: string | number) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const active = Boolean(
    filters.search ||
      filters.category ||
      filters.actor ||
      filters.date_from ||
      filters.date_to,
  );
  return (
    <div
      className="shrink-0 space-y-3 border-b border-zani-border p-3"
      data-testid="timeline-toolbar"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(160px,220px)_minmax(160px,220px)]">
        <Input
          aria-label={t("timeline.search")}
          placeholder={t("timeline.searchPlaceholder")}
          leftIcon={<Search size={18} />}
          type="search"
          maxLength={160}
          value={filters.search}
          onChange={(e) => onChange("search", e.target.value)}
        />
        <Select
          aria-label={t("timeline.category")}
          value={filters.category}
          options={[
            { value: "", label: t("timeline.allCategories") },
            ...Object.entries(categoryConfig).map(([value, config]) => ({
              value,
              label: t(config.labelKey),
            })),
          ]}
          onChange={(e) => onChange("category", e.target.value)}
        />
        <TimelineActorFilter
          businessId={businessId}
          value={filters.actor}
          onChange={(value) => onChange("actor", value)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 sm:flex-none">
          <Input
            className="!min-w-0 sm:w-44"
            label={t("timeline.dateFrom")}
            type="date"
            value={filters.date_from}
            max={filters.date_to || undefined}
            onChange={(e) => onChange("date_from", e.target.value)}
          />
        </div>
        <div className="min-w-0 flex-1 sm:flex-none">
          <Input
            className="!min-w-0 sm:w-44"
            label={t("timeline.dateTo")}
            type="date"
            value={filters.date_to}
            min={filters.date_from || undefined}
            onChange={(e) => onChange("date_to", e.target.value)}
          />
        </div>
        {active && (
          <Button type="button" variant="ghost" onClick={onReset}>
            {t("timeline.reset")}
          </Button>
        )}
      </div>
    </div>
  );
}
