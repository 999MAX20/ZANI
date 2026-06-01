import { ChevronDown, Check } from "lucide-react";
import { SelectHTMLAttributes, forwardRef, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";

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
        {label ? <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span> : null}
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
            "flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-bold text-slate-800 shadow-sm outline-none transition hover:border-brand-200 hover:bg-slate-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            error && "border-red-300 focus:border-red-400 focus:ring-red-100",
            className,
          )}
          onClick={() => setOpen((state) => !state)}
        >
          <span className="min-w-0 truncate">{selectedOption?.label || t("common.select")}</span>
          <ChevronDown size={17} className={cn("shrink-0 text-slate-400 transition", open && "rotate-180 text-brand-600")} />
        </button>
        {open ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-premium">
            {options.map((option) => {
              const isSelected = String(option.value) === currentValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition",
                    isSelected ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => selectValue(option.value)}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {isSelected ? <Check size={16} className="shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        {error ? <span className="mt-1 block text-sm text-red-600">{error}</span> : null}
      </label>
    );
  },
);

Select.displayName = "Select";
