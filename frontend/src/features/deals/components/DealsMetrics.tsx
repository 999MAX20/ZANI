import { AlertTriangle, CircleDollarSign, ClipboardList, Trophy, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../../lib/cn";
import type { DealMetricsModel } from "../types";
import { money } from "../utils/dealHelpers";

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint: string;
  tone: "blue" | "green" | "red" | "amber" | "orange";
  active?: boolean;
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50/55 text-blue-700",
    green: "border-emerald-200 bg-emerald-50/55 text-emerald-700",
    red: "border-red-200 bg-red-50/55 text-red-700",
    amber: "border-amber-200 bg-amber-50/70 text-amber-700",
    orange: "border-orange-200 bg-orange-50/70 text-orange-700",
  }[tone];
  return (
    <article className={cn("rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md", active ? toneClass : "border-slate-200")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", toneClass)}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-black leading-6 text-midnight">{value}</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{hint}</p>
        </div>
      </div>
    </article>
  );
}

export function DealsMetrics({ metrics }: { metrics: DealMetricsModel }) {
  const wonConversion = metrics.openDeals.length + metrics.wonDeals.length ? Math.round((metrics.wonDeals.length / (metrics.openDeals.length + metrics.wonDeals.length)) * 100) : 0;
  const lostRate = metrics.openDeals.length + metrics.lostDeals.length ? Math.round((metrics.lostDeals.length / (metrics.openDeals.length + metrics.lostDeals.length)) * 100) : 0;
  return (
    <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard icon={CircleDollarSign} label="Открытая воронка" value={metrics.openDeals.length} hint={`${money(metrics.pipelineValue)} · +8%`} tone="blue" />
      <MetricCard icon={Trophy} label="Выиграно" value={metrics.wonDeals.length} hint={`${wonConversion}% конверсия`} tone="green" />
      <MetricCard icon={XCircle} label="Потеряно" value={metrics.lostDeals.length} hint={`${lostRate}% потерь`} tone="red" />
      <MetricCard icon={AlertTriangle} label="Требуют контроля" value={metrics.overdueDeals.length} hint="Просроченные сделки" tone="amber" active={metrics.overdueDeals.length > 0} />
      <MetricCard icon={ClipboardList} label="Без задач" value={metrics.noTaskDeals.length} hint="Нет активного шага" tone="orange" active={metrics.noTaskDeals.length > 0} />
    </section>
  );
}
