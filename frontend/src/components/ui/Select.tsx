import { ChevronDown, Check } from "lucide-react";
import { SelectHTMLAttributes, forwardRef, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { PopoverSurface } from "./Overlay";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, value, defaultValue, onChange, onBlur, disabled, name, ...props }, ref) => {
    const { t } = useI18n();
    const wrapperRef = useRef<HTMLLabelElement | null>(null);
    const initialValue = value ?? defaultValue ?? options[0]?.value ?? "";
    const [internalValue, setInternalValue] = useState(String(initialValue));
    const [open, setOpen] = useState(false);
    const currentValue = value !== undefined ? String(value) : internalValue;
    const selectedOption = useMemo(
      () => options.find((option) => String(option.value) === currentValue) || options[0],
      [currentValue, options],
    );

    useEffect(() => {
      if (value !== undefined) setInternalValue(String(value));
    }, [value]);

    useEffect(() => {
      function handleClick(event: MouseEvent) {
        if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function selectValue(nextValue: string | number) {
      const normalizedValue = String(nextValue);
      setInternalValue(normalizedValue);
      setOpen(false);
      onChange?.({
        target: { name, value: normalizedValue },
        currentTarget: { name, value: normalizedValue },
      } as React.ChangeEvent<HTMLSelectElement>);
    }

    return (
      <label ref={wrapperRef} className="relative block">
        {label ? <span className="mb-2 block text-sm font-semibold text-zani-subtle">{label}</span> : null}
        <select
          ref={ref}
          className="sr-only"
          value={currentValue}
          name={name}
          disabled={disabled}
          onChange={onChange}
          onBlur={onBlur}
          tabIndex={-1}
          aria-hidden="true"
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "zani-focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2 text-left text-sm font-semibold text-zani-text shadow-sm transition hover:border-brand-100 hover:bg-surface-warm disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-zani-faint",
            error && "border-zani-danger focus-visible:border-zani-danger focus-visible:ring-[rgba(194,65,12,0.18)]",
            className,
          )}
          onClick={() => setOpen((state) => !state)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span className="min-w-0 truncate">{selectedOption?.label || t("common.select")}</span>
          <ChevronDown size={17} className={cn("shrink-0 text-zani-faint transition", open && "rotate-180 text-brand-600")} />
        </button>
        {open ? (
          <PopoverSurface className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto p-1">
            {options.map((option) => {
              const isSelected = String(option.value) === currentValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-control px-3 py-2.5 text-left text-sm font-semibold transition",
                    isSelected ? "bg-brand-50 text-brand-700" : "text-zani-subtle hover:bg-surface-muted hover:text-zani-text",
                  )}
                  onClick={() => selectValue(option.value)}
                >
                  <span className="min-w-0 overflow-hidden break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{option.label}</span>
                  {isSelected ? <Check size={16} className="shrink-0" /> : null}
                </button>
              );
            })}
          </PopoverSurface>
        ) : null}
        {error ? <span className="mt-1.5 block text-xs font-semibold text-zani-danger">{error}</span> : null}
      </label>
    );
  },
);

Select.displayName = "Select";
