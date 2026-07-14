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
    <div className={cn("flex gap-2 overflow-x-auto rounded-xl bg-slate-100 p-1 no-scrollbar", className)} role="tablist" aria-label={ariaLabel}>
      {options.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors",
              active ? "bg-white text-midnight shadow-sm" : "text-slate-600 hover:bg-white/70 hover:text-midnight",
            )}
            onClick={() => onChange(item.value)}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className={cn("rounded-full px-2 py-0.5 text-xs", active ? "bg-slate-100 text-slate-700" : "bg-white text-slate-500")}>{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
