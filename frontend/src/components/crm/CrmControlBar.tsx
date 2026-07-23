import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../ui/Button";
import { PopoverSurface } from "../ui/Overlay";
import { cn } from "../../lib/cn";

export type CrmControlTab<TValue extends string> = {
  value: TValue;
  label: string;
  count?: number;
};

export type CrmActiveFilter = {
  id: string;
  label: string;
  value: string;
};

export function CrmControlBar<TValue extends string>({
  value,
  tabs,
  onChange,
  advanced,
  advancedLabel,
  activeFilters,
  onClearFilter,
  onClearAll,
  actions,
  secondary,
  className,
  ariaLabel,
  activeFiltersLabel = "Active:",
  clearAllLabel = "Clear all",
  filtersLabel = "Filters",
}: {
  value: TValue;
  tabs: Array<CrmControlTab<TValue>>;
  onChange: (value: TValue) => void;
  advanced?: ReactNode;
  advancedLabel?: string;
  activeFilters?: CrmActiveFilter[];
  onClearFilter?: (id: string) => void;
  onClearAll?: () => void;
  actions?: ReactNode;
  secondary?: ReactNode;
  className?: string;
  ariaLabel: string;
  activeFiltersLabel?: string;
  clearAllLabel?: string;
  filtersLabel?: string;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedRef = useRef<HTMLDivElement | null>(null);
  const advancedCounter = useMemo(() => activeFilters?.length || 0, [activeFilters]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!advancedRef.current?.contains(event.target as Node)) setAdvancedOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <section className={cn("border-b border-zani-border bg-surface-card", className)}>
      <div className="flex flex-col gap-3 px-3 py-2.5 md:flex-row md:items-center md:justify-between md:px-4">
        <div role="tablist" aria-label={ariaLabel} className="flex min-w-0 flex-wrap items-center gap-1 rounded-control bg-surface-muted p-1">
          {tabs.map((tab) => {
            const active = value === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(tab.value)}
                className={cn(
                  "zani-focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold transition",
                  active ? "bg-surface-card text-brand-700 shadow-sm" : "text-zani-subtle hover:bg-surface-warm hover:text-zani-text",
                )}
              >
                <span className="min-w-0 truncate">{tab.label}</span>
                {typeof tab.count === "number" ? (
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold", active ? "bg-surface-muted text-zani-subtle" : "bg-surface-card text-zani-faint")}>
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {advanced ? (
            <div ref={advancedRef} className="relative">
              <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-control" type="button" onClick={() => setAdvancedOpen((open) => !open)}>
                <SlidersHorizontal size={14} />
                {advancedLabel || filtersLabel}
                <ChevronDown size={14} className={cn("transition", advancedOpen && "rotate-180")} />
                {advancedCounter ? <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[11px] text-zani-subtle">{advancedCounter}</span> : null}
              </Button>
              {advancedOpen ? (
                <PopoverSurface className="absolute right-0 top-11 w-[min(620px,calc(100vw-2rem))] p-3">
                  {advanced}
                </PopoverSurface>
              ) : null}
            </div>
          ) : null}
          {actions}
        </div>
      </div>

      {secondary ? <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-zani-border px-3 py-2 md:px-4">{secondary}</div> : null}

      {activeFilters?.length ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-zani-border px-3 py-2 md:px-4">
          <span className="text-xs font-semibold text-zani-faint">{activeFiltersLabel}</span>
          {activeFilters.map((filter) => (
            <span key={filter.id} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
              {filter.label}: {filter.value}
              {onClearFilter ? (
                <button
                  type="button"
                  onClick={() => onClearFilter(filter.id)}
                  className="zani-focus-ring grid h-5 w-5 place-items-center rounded-full text-brand-600 hover:bg-surface-card hover:text-brand-700"
                  aria-label={`${filter.label}: ${filter.value}`}
                >
                  <X size={12} />
                </button>
              ) : null}
            </span>
          ))}
          {onClearAll ? (
            <button type="button" onClick={onClearAll} className="zani-focus-ring h-8 rounded-full px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50">
              {clearAllLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
