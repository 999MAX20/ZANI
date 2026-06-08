import type { LucideIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "../../../../lib/cn";

type MetricVariant = "default" | "success" | "info" | "danger" | "warning";

const variantClass: Record<MetricVariant, string> = {
  default: "bg-slate-100 text-slate-600 ring-slate-500",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-500",
  info: "bg-blue-50 text-blue-700 ring-blue-500",
  danger: "bg-red-50 text-red-700 ring-red-500",
  warning: "bg-amber-50 text-amber-700 ring-amber-500",
};

export const MetricCard = memo(function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  variant = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  delta?: string;
  variant?: MetricVariant;
}) {
  const shouldHighlight = typeof value === "number" ? value > 0 : Boolean(value);

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
        shouldHighlight && "ring-2 ring-offset-2 ring-brand-500/20",
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", variantClass[variant])}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold leading-none text-midnight">{value}</p>
          {delta ? <p className="mt-1 text-xs font-semibold text-emerald-700">{delta}</p> : null}
        </div>
      </div>
    </div>
  );
});
