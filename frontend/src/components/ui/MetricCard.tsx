import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "../../lib/cn";

type MetricCardTone = "brand" | "slate" | "emerald" | "amber" | "red";

type MetricCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: MetricCardTone;
  href?: string;
  compact?: boolean;
  className?: string;
};

const toneClasses: Record<MetricCardTone, string> = {
  brand: "bg-brand-50 text-brand-600",
  slate: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
};

export function MetricCard({ label, value, hint, icon: Icon, tone = "brand", href, compact = false, className }: MetricCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">{label}</p>
          <p className={cn("mt-2 font-bold text-midnight", compact ? "text-2xl" : "text-3xl")}>{value}</p>
        </div>
        {Icon ? (
          <div className={cn("grid shrink-0 place-items-center rounded-xl", compact ? "h-10 w-10" : "h-12 w-12", toneClasses[tone])}>
            <Icon size={compact ? 20 : 22} />
          </div>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-sm font-medium leading-5 text-slate-500">{hint}</p> : null}
    </>
  );
  const classNames = cn(
    "rounded-xl border border-slate-200 bg-white shadow-soft transition duration-150 hover:-translate-y-0.5 hover:shadow-md",
    compact ? "p-4" : "p-5",
    href && "transition-colors hover:border-brand-200",
    className,
  );

  if (href) {
    return (
      <Link to={href} className={classNames}>
        {content}
      </Link>
    );
  }

  return <div className={classNames}>{content}</div>;
}
