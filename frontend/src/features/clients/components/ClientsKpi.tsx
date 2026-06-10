import type { LucideIcon } from "lucide-react";
import { CheckCircle2, MessageCircle, RefreshCw, UsersRound } from "lucide-react";

import { cn } from "../../../lib/cn";
import type { ClientKpi } from "../types";

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  delta: string;
  tone: "blue" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    blue: "text-blue-600 bg-blue-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    violet: "text-violet-600 bg-violet-50",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-4">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", tones[tone])}>
          <Icon size={22} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="text-2xl font-bold leading-none text-slate-950">{value}</p>
            <span className="text-xs font-semibold text-emerald-600">{delta}</span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-500">за месяц</p>
        </div>
      </div>
    </div>
  );
}

export function ClientsKpi({ kpi }: { kpi: ClientKpi }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      <KpiCard icon={UsersRound} label="Всего клиентов" value={kpi.total} delta="+24" tone="blue" />
      <KpiCard icon={CheckCircle2} label="Активные" value={kpi.active} delta={`${kpi.total ? Math.round((kpi.active / kpi.total) * 100) : 0}%`} tone="emerald" />
      <KpiCard icon={MessageCircle} label="Без ответа" value={kpi.noReply} delta="8%" tone="amber" />
      <KpiCard icon={RefreshCw} label="Повторные" value={kpi.repeat} delta={`${kpi.total ? Math.round((kpi.repeat / kpi.total) * 100) : 0}%`} tone="violet" />
    </div>
  );
}
