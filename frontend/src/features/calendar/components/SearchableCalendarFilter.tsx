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
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-black text-midnight shadow-sm transition hover:border-brand-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100",
          disabled && "cursor-not-allowed bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-slate-50",
        )}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={cn("truncate", !selectedOption && "text-slate-600")}>{selectedOption?.label || allLabel}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-slate-400 transition", isOpen && "rotate-180")} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-12 z-40 rounded-xl border border-slate-200 bg-white p-2 shadow-premium">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-midnight outline-none placeholder:text-slate-400"
            />
            {query ? (
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-white hover:text-midnight"
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
                "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-black transition hover:bg-slate-50",
                !value ? "bg-brand-50 text-brand-700" : "text-slate-700",
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
                  "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-black transition hover:bg-slate-50",
                  value === option.value ? "bg-brand-50 text-brand-700" : "text-slate-700",
                )}
                onClick={() => selectValue(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {value === option.value ? <Check size={16} className="shrink-0" /> : null}
              </button>
            ))}
            {!filteredOptions.length ? <p className="px-3 py-4 text-sm font-bold text-slate-400">{emptyLabel}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
