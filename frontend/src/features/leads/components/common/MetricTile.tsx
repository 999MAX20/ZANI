import type { LucideIcon } from "lucide-react";
import type React from "react";

import { cn } from "../../../../lib/cn";

export function MetricTile({
  icon: Icon,
  label,
  value,
  delta,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  delta?: string;
  tone?: "brand" | "green" | "amber" | "blue" | "pink";
}) {
  const toneClass = {
    brand: "bg-brand-50 text-brand-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-orange-50 text-orange-700",
    blue: "bg-sky-50 text-sky-700",
    pink: "bg-rose-50 text-rose-700",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft transition duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2.5">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", toneClass)}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">{label}</p>
          <div className="mt-1 flex items-end gap-1.5">
            <p className="text-xl font-bold leading-none text-midnight">{value}</p>
            {delta ? <span className="text-xs font-bold text-emerald-600">{delta}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
