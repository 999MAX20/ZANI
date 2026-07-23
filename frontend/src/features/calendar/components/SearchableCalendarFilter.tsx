import { Check, ChevronDown, Search, X } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/cn";
import type { SearchableCalendarFilterOption } from "../calendarTypes";

export function SearchableCalendarFilter({
  value,
  options,
  allLabel,
  searchPlaceholder,
  emptyLabel,
  disabled,
  onChange,
}: {
  value: string;
  options: SearchableCalendarFilterOption[];
  allLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options;

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-control border border-zani-border bg-zani-card px-3 text-left text-sm font-bold text-zani-text shadow-sm transition hover:border-brand-200 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-brand-100",
          disabled && "cursor-not-allowed bg-surface-muted text-zani-muted hover:border-zani-border hover:bg-surface-muted",
        )}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={cn("truncate", !selectedOption && "text-zani-muted")}>{selectedOption?.label || allLabel}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-zani-muted transition", isOpen && "rotate-180")} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-12 z-40 rounded-card border border-zani-border bg-zani-card p-2 shadow-premium">
          <div className="flex h-10 items-center gap-2 rounded-control border border-zani-border bg-surface-muted px-3">
            <Search size={16} className="shrink-0 text-zani-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-zani-text outline-none placeholder:text-zani-muted"
            />
            {query ? (
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-control text-zani-muted transition hover:bg-zani-card hover:text-zani-text"
                onClick={() => setQuery("")}
                aria-label={emptyLabel}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto pr-1">
            <button
              type="button"
              className={cn(
                "flex min-h-10 w-full items-center justify-between gap-2 rounded-control px-3 text-left text-sm font-bold transition hover:bg-surface-hover",
                !value ? "bg-brand-50 text-brand-700" : "text-zani-text",
              )}
              onClick={() => selectValue("")}
            >
              <span className="truncate">{allLabel}</span>
              {!value ? <Check size={16} className="shrink-0" /> : null}
            </button>
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-2 rounded-control px-3 text-left text-sm font-bold transition hover:bg-surface-hover",
                  value === option.value ? "bg-brand-50 text-brand-700" : "text-zani-text",
                )}
                onClick={() => selectValue(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {value === option.value ? <Check size={16} className="shrink-0" /> : null}
              </button>
            ))}
            {!filteredOptions.length ? <p className="px-3 py-4 text-sm font-bold text-zani-muted">{emptyLabel}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
