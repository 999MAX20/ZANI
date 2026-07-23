import { cn } from "../../lib/cn";

export type FilterBarOption<TValue extends string> = {
  value: TValue;
  label: string;
  count?: number;
};

type FilterBarProps<TValue extends string> = {
  options: Array<FilterBarOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  ariaLabel: string;
  className?: string;
};

export function FilterBar<TValue extends string>({ options, value, onChange, ariaLabel, className }: FilterBarProps<TValue>) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-control bg-surface-muted p-1 no-scrollbar", className)} role="tablist" aria-label={ariaLabel}>
      {options.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "zani-focus-ring inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition",
              active ? "bg-surface-card text-brand-700 shadow-sm" : "text-zani-subtle hover:bg-surface-warm hover:text-zani-text",
            )}
            onClick={() => onChange(item.value)}
          >
            <span className="min-w-0 truncate">{item.label}</span>
            {typeof item.count === "number" ? (
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", active ? "bg-surface-muted text-zani-subtle" : "bg-surface-card text-zani-faint")}>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
