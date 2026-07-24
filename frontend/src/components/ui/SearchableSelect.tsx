import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { PopoverSurface } from "./Overlay";

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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const labelId = useId();
  const valueId = useId();
  const listboxId = useId();
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
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div ref={wrapperRef} className={cn("relative block", className)}>
      {label ? <span id={labelId} className="mb-2 block text-sm font-semibold text-zani-subtle">{label}</span> : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cn(
          "zani-focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2 text-left text-sm font-semibold text-zani-text shadow-sm transition hover:border-brand-100 hover:bg-surface-warm disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-zani-faint",
          value && "pr-16",
        )}
        aria-labelledby={label ? `${labelId} ${valueId}` : valueId}
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((state) => !state)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span id={valueId} className={cn("min-w-0 truncate", !selectedOption && "text-zani-faint")}>
          {selectedOption?.label || displayPlaceholder}
        </span>
        <ChevronDown aria-hidden="true" size={17} className={cn("shrink-0 text-zani-faint transition", open && "rotate-180 text-brand-600")} />
      </button>
      {value ? (
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "zani-focus-ring absolute right-9 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-control text-zani-faint transition hover:bg-surface-muted hover:text-zani-text disabled:cursor-not-allowed",
            label ? "top-[calc(50%+0.75rem)]" : "top-1/2",
          )}
          aria-label={`${t("common.clearSelection")}: ${label || displayPlaceholder}`}
          onClick={() => selectValue("")}
        >
          <X aria-hidden="true" size={14} />
        </button>
      ) : null}

      {open ? (
        <PopoverSurface id={listboxId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden">
          <div className="border-b border-zani-border p-2">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zani-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                    requestAnimationFrame(() => triggerRef.current?.focus());
                  }
                  if (event.key === "Enter" && filteredOptions[0]) {
                    event.preventDefault();
                    selectValue(filteredOptions[0].value);
                  }
                }}
                className="zani-focus-ring h-10 w-full rounded-control border border-zani-border bg-surface-card pl-9 pr-3 text-sm font-semibold text-zani-text placeholder:text-zani-faint"
                placeholder={t("common.search")}
                aria-label={t("common.search")}
                aria-controls={listboxId}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={cn(
                "zani-focus-ring flex w-full items-center justify-between gap-3 rounded-control px-3 py-2.5 text-left text-sm font-semibold transition",
                !value ? "bg-brand-50 text-brand-700" : "text-zani-subtle hover:bg-surface-muted hover:text-zani-text",
              )}
              onClick={() => selectValue("")}
            >
              <span className="min-w-0 overflow-hidden break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{emptyLabel || displayPlaceholder}</span>
              {!value ? <Check aria-hidden="true" size={16} className="shrink-0" /> : null}
            </button>
            {filteredOptions.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "zani-focus-ring flex w-full items-start justify-between gap-3 rounded-control px-3 py-2.5 text-left text-sm font-semibold transition",
                    isSelected ? "bg-brand-50 text-brand-700" : "text-zani-subtle hover:bg-surface-muted hover:text-zani-text",
                  )}
                  onClick={() => selectValue(option.value)}
                >
                  <span className="min-w-0">
                    <span className="block overflow-hidden break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{option.label}</span>
                    {option.description ? <span className="mt-0.5 block overflow-hidden break-words text-xs font-semibold leading-4 text-zani-faint [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{option.description}</span> : null}
                  </span>
                  {isSelected ? <Check aria-hidden="true" size={16} className="mt-0.5 shrink-0" /> : null}
                </button>
              );
            })}
            {!filteredOptions.length ? <p className="px-3 py-4 text-sm font-semibold text-zani-faint">{t("common.noResults")}</p> : null}
          </div>
        </PopoverSurface>
      ) : null}
    </div>
  );
}
