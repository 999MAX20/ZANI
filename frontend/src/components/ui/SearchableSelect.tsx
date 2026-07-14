import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

type SearchableSelectProps = {
  label?: string;
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
};

export function SearchableSelect({
  label,
  value,
  options,
  placeholder,
  emptyLabel,
  disabled,
  className,
  onChange,
}: SearchableSelectProps) {
  const { t } = useI18n();
  const wrapperRef = useRef<HTMLLabelElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const displayPlaceholder = placeholder || t("common.select");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options.slice(0, 80);
    return options
      .filter((option) => `${option.label} ${option.description || ""} ${option.searchText || ""}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 80);
  }, [normalizedQuery, options]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <label ref={wrapperRef} className={cn("relative block", className)}>
      {label ? <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span> : null}
      <button
        type="button"
        disabled={disabled}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-800 shadow-sm outline-none transition hover:border-brand-200 hover:bg-slate-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        onClick={() => setOpen((state) => !state)}
      >
        <span className={cn("min-w-0 truncate", !selectedOption && "text-slate-400")}>
          {selectedOption?.label || displayPlaceholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value ? (
            <span
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={(event) => {
                event.stopPropagation();
                selectValue("");
              }}
            >
              <X size={14} />
            </span>
          ) : null}
          <ChevronDown size={17} className={cn("text-slate-400 transition", open && "rotate-180 text-brand-600")} />
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-premium">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                  }
                  if (event.key === "Enter" && filteredOptions[0]) {
                    event.preventDefault();
                    selectValue(filteredOptions[0].value);
                  }
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-midnight outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                placeholder={t("common.search")}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            <button
              type="button"
              className={cn("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition", !value ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50")}
              onClick={() => selectValue("")}
            >
              <span className="min-w-0 truncate">{emptyLabel || displayPlaceholder}</span>
              {!value ? <Check size={16} className="shrink-0" /> : null}
            </button>
            {filteredOptions.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition",
                    isSelected ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => selectValue(option.value)}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.description ? <span className="mt-0.5 block truncate text-xs font-semibold text-slate-400">{option.description}</span> : null}
                  </span>
                  {isSelected ? <Check size={16} className="mt-0.5 shrink-0" /> : null}
                </button>
              );
            })}
            {!filteredOptions.length ? <p className="px-3 py-4 text-sm font-semibold text-slate-500">{t("common.noResults")}</p> : null}
          </div>
        </div>
      ) : null}
    </label>
  );
}
