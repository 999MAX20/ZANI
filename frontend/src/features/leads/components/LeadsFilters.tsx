import { cn } from "../../../lib/cn";
import type { LeadFilter, Translate } from "../types";
import { SourceFilter } from "./common/SourceFilter";

export function LeadsFilters({
  filters,
  activeFilter,
  source,
  onFilterChange,
  onSourceChange,
  t,
}: {
  filters: Array<{ value: LeadFilter; label: string; count: number }>;
  activeFilter: LeadFilter;
  source: string;
  onFilterChange: (value: LeadFilter) => void;
  onSourceChange: (value: string) => void;
  t: Translate;
}) {
  return (
    <section className="flex min-h-16 items-center gap-4 overflow-x-auto border-b border-gray-200 bg-white py-3">
      <div className="flex w-max items-center gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onFilterChange(item.value)}
            className={cn("inline-flex min-h-10 shrink-0 items-center rounded-lg px-4 py-2 text-sm font-medium transition focus-visible-ring", activeFilter === item.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}
          >
            {item.label}
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{item.count}</span>
          </button>
        ))}
      </div>
      <span className="h-8 w-px shrink-0 bg-gray-300" />
      <div className="flex shrink-0 items-center gap-2">
        {["whatsapp", "telegram", "instagram", "website"].map((item) => (
          <SourceFilter key={item} source={item} active={source === item} onClick={() => onSourceChange(source === item ? "" : item)} t={t} />
        ))}
      </div>
    </section>
  );
}
