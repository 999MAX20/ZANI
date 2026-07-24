import { ChevronDown, Check } from "lucide-react";
import { SelectHTMLAttributes, forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { PopoverSurface } from "./Overlay";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, value, defaultValue, onChange, onBlur, disabled, required, name, "aria-label": ariaLabel, "aria-describedby": describedBy, ...props }, ref) => {
    const { t } = useI18n();
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const labelId = useId();
    const valueId = useId();
    const listboxId = useId();
    const errorId = useId();
    const initialValue = value ?? defaultValue ?? options[0]?.value ?? "";
    const [internalValue, setInternalValue] = useState(String(initialValue));
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const currentValue = value !== undefined ? String(value) : internalValue;
    const selectedIndex = options.findIndex(
      (option) => String(option.value) === currentValue,
    );
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
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }

    function openListbox() {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      setOpen(true);
    }

    function moveActiveOption(direction: 1 | -1) {
      if (!options.length) return;
      if (!open) {
        const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;
        setActiveIndex(
          (initialIndex + direction + options.length) % options.length,
        );
        setOpen(true);
        return;
      }
      setActiveIndex(
        (current) => (current + direction + options.length) % options.length,
      );
    }

    return (
      <div ref={wrapperRef} className="relative block">
        {label ? <span id={labelId} className="mb-2 block text-sm font-semibold text-zani-subtle">{label}</span> : null}
        <select
          ref={ref}
          className="sr-only"
          value={currentValue}
          name={name}
          disabled={disabled}
          required={required}
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
          ref={triggerRef}
          type="button"
          role="combobox"
          disabled={disabled}
          className={cn(
            "zani-focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2 text-left text-sm font-semibold text-zani-text shadow-sm transition hover:border-brand-100 hover:bg-surface-warm disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-zani-faint",
            error && "border-zani-danger focus-visible:border-zani-danger focus-visible:ring-[rgba(194,65,12,0.18)]",
            className,
          )}
          aria-label={
            ariaLabel ||
            (!label
              ? selectedOption?.label || t("common.select")
              : undefined)
          }
          aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
          aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined}
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-activedescendant={
            open && options[activeIndex]
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          aria-invalid={error ? "true" : undefined}
          aria-required={required || undefined}
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            openListbox();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveOption(1);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveOption(-1);
              return;
            }
            if (event.key === "Home" && open) {
              event.preventDefault();
              setActiveIndex(0);
              return;
            }
            if (event.key === "End" && open) {
              event.preventDefault();
              setActiveIndex(Math.max(0, options.length - 1));
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (open && options[activeIndex]) {
                selectValue(options[activeIndex].value);
              } else {
                openListbox();
              }
            }
            if (event.key === "Tab") {
              setOpen(false);
            }
          }}
        >
          <span id={valueId} className="min-w-0 truncate">{selectedOption?.label || t("common.select")}</span>
          <ChevronDown aria-hidden="true" size={17} className={cn("shrink-0 text-zani-faint transition", open && "rotate-180 text-brand-600")} />
        </button>
        {open ? (
          <PopoverSurface id={listboxId} role="listbox" className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto p-1">
            {options.map((option, optionIndex) => {
              const isSelected = String(option.value) === currentValue;
              return (
                <button
                  key={option.value}
                  id={`${listboxId}-option-${optionIndex}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={cn(
                    "zani-focus-ring flex w-full items-center justify-between gap-3 rounded-control px-3 py-2.5 text-left text-sm font-semibold transition",
                    isSelected
                      ? "bg-brand-50 text-brand-700"
                      : activeIndex === optionIndex
                        ? "bg-surface-muted text-zani-text"
                        : "text-zani-subtle hover:bg-surface-muted hover:text-zani-text",
                  )}
                  onClick={() => selectValue(option.value)}
                  onMouseEnter={() => setActiveIndex(optionIndex)}
                >
                  <span className="min-w-0 overflow-hidden break-words leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{option.label}</span>
                  {isSelected ? <Check aria-hidden="true" size={16} className="shrink-0" /> : null}
                </button>
              );
            })}
          </PopoverSurface>
        ) : null}
        {error ? <span id={errorId} role="alert" className="mt-1.5 block text-xs font-semibold text-zani-danger">{error}</span> : null}
      </div>
    );
  },
);

Select.displayName = "Select";
