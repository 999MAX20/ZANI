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
    <nav className={cn("flex gap-1 rounded-lg bg-slate-100 p-1", className)} aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold transition focus-visible-ring",
              active ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-midnight",
            )}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {typeof option.count === "number" ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{option.count}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
