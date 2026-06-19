import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { ReactNode, useMemo } from "react";

import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

type FilterOption<TValue extends string> = { value: TValue; label: string; count?: number };

type CrmFilterChip = {
  id: string;
  label: string;
  value: string;
};

export function CrmFilterChips<TValue extends string>({
  value,
  options,
  onChange,
  advanced,
  advancedLabel,
  activeFilters,
  onClearFilter,
  children,
  onClearAll,
  className,
  ariaLabel,
}: {
  value: TValue;
  options: Array<FilterOption<TValue>>;
  onChange: (value: TValue) => void;
  advanced?: ReactNode;
  advancedLabel?: string;
  activeFilters?: CrmFilterChip[];
  onClearFilter?: (id: string) => void;
  onClearAll?: () => void;
  children?: ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  const hasFilters = Boolean(activeFilters?.length);

  const advancedCounter = useMemo(() => (activeFilters?.length ? activeFilters.length : 0), [activeFilters]);

  return (
    <div className={cn("rounded-card border border-slate-200 bg-white", className)}>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1">
          {options.map((option) => {
            const active = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(option.value)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition",
                  active ? "bg-brand-50 text-brand-700" : "bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <span>{option.label}</span>
                {typeof option.count === "number" ? <span className="rounded-full bg-white px-1.5 py-0.5 text-xs text-slate-500">{option.count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {advanced ? (
            <details className="group relative" onToggle={() => {}}>
              <summary className="list-none">
                <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-lg" type="button">
                  <SlidersHorizontal size={14} />
                  {advancedLabel || "Фильтры"}
                  <ChevronDown size={14} className={cn("transition", "group-open:rotate-180")} />
                  {advancedCounter ? <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] text-slate-600">{advancedCounter}</span> : null}
                </Button>
              </summary>
              <div className="absolute right-0 top-12 z-20 w-[min(620px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                {advanced}
              </div>
            </details>
          ) : null}
          {children}
        </div>
      </div>

      {activeFilters?.length ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          <span className="text-xs font-semibold text-slate-500">Активные:</span>
          {activeFilters.map((filter) => (
            <span key={filter.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              {filter.label}: {filter.value}
              {onClearFilter ? (
                <button
                  type="button"
                  onClick={() => onClearFilter(filter.id)}
                  className="grid h-5 w-5 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-slate-900"
                  aria-label={`Убрать фильтр ${filter.label}`}
                >
                  <X size={12} />
                </button>
              ) : null}
            </span>
          ))}
          {onClearAll ? (
            <button type="button" onClick={onClearAll} className="h-8 rounded-full px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50">
              Очистить все
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
