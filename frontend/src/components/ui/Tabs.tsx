import type { KeyboardEvent } from "react";

import { cn } from "../../lib/cn";

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  tone = "brand",
}: {
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  tone?: "brand" | "ai";
}) {
  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % options.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + options.length) % options.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
    onChange(options[nextIndex].value);
  };

  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-control bg-surface-muted p-1 no-scrollbar", className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "zani-focus-ring inline-flex min-h-9 flex-1 shrink-0 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition",
              active
                ? tone === "ai"
                  ? "bg-ai-50 text-ai-700 shadow-sm ring-1 ring-ai-100"
                  : "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100"
                : "text-zani-subtle hover:bg-surface-warm hover:text-zani-text",
            )}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => selectFromKeyboard(event, index)}
          >
            <span className="min-w-0 truncate">{option.label}</span>
            {typeof option.count === "number" ? (
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", active ? "bg-surface-muted text-zani-subtle" : "bg-surface-card text-zani-faint")}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
