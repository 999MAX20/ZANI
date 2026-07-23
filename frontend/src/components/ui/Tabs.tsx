import { cn } from "../../lib/cn";

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-control bg-surface-muted p-1 no-scrollbar", className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "zani-focus-ring inline-flex min-h-9 flex-1 shrink-0 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition",
              active ? "bg-surface-card text-brand-700 shadow-sm" : "text-zani-subtle hover:bg-surface-warm hover:text-zani-text",
            )}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
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
