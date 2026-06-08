import { cn } from "../../../lib/cn";
import type { LeadFilter, Translate } from "../types";
import { SourceFilter } from "./common/SourceFilter";

/**
 * Chips-фильтры для страницы заявок
 * Соответствует дизайн-референсам:
 * - Компактные chips (min-h-8 вместо min-h-10)
 * - Scrollable горизонтальный список
 * - Уменьшенные padding и шрифты
 */
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
    <section className="flex min-h-[40px] items-center gap-3 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 scrollbar-hide">
      {/* Статусные фильтры - chips с counts */}
      <div className="flex w-max items-center gap-1.5">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onFilterChange(item.value)}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition focus-visible-ring",
              activeFilter === item.value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                activeFilter === item.value ? "bg-white/20" : "bg-gray-200 text-gray-600",
              )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Разделитель */}
      <span className="hidden h-6 w-px shrink-0 bg-gray-300 lg:block" />

      {/* Фильтры по источникам - только на desktop */}
      <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
        {["whatsapp", "telegram", "instagram", "website"].map((item) => (
          <SourceFilter
            key={item}
            source={item}
            active={source === item}
            onClick={() => onSourceChange(source === item ? "" : item)}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}
