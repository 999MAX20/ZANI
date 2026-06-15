import type { LucideIcon } from "lucide-react";
import { CheckCircle2, MessageCircle, RefreshCw, TrendingDown, TrendingUp, UsersRound } from "lucide-react";

import { cn } from "../../../lib/cn";
import type { ClientKpi } from "../types";

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
  tone,
  trend = "up",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  delta: string;
  deltaLabel: string;
  tone: "blue" | "emerald" | "orange" | "purple";
  trend?: "up" | "down" | "neutral";
}) {
  const tones = {
    blue: "text-blue-600 bg-blue-50",
    emerald: "text-emerald-600 bg-emerald-50",
    orange: "text-orange-600 bg-orange-50",
    purple: "text-purple-600 bg-purple-50",
  };
  const TrendIcon = trend === "down" ? TrendingDown : trend === "up" ? TrendingUp : null;
  const trendClass = trend === "down" ? "text-orange-600" : trend === "up" ? "text-emerald-600" : "text-slate-600";

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tones[tone])}>
          <Icon size={18} strokeWidth={2} />
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-semibold", trendClass)}>
          {TrendIcon ? <TrendIcon size={15} /> : null}
          {delta}
        </div>
      </div>
      <p className="text-xl font-bold leading-none text-slate-950">{value.toLocaleString("ru-RU")}</p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className="truncate text-xs font-semibold text-slate-600">{label}</p>
        <p className="shrink-0 text-xs font-medium text-slate-500">{deltaLabel}</p>
      </div>
    </div>
  );
}

export function ClientsKpi({ kpi }: { kpi: ClientKpi }) {
  const activePercent = `${kpi.total ? Math.round((kpi.active / kpi.total) * 100) : 0}%`;
  const noReplyPercent = `${kpi.total ? Math.round((kpi.noReply / kpi.total) * 100) : 0}%`;
  const repeatPercent = `${kpi.total ? Math.round((kpi.repeat / kpi.total) * 100) : 0}%`;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard icon={UsersRound} label="Всего клиентов" value={kpi.total} delta="—" deltaLabel="всего" tone="blue" trend="neutral" />
      <KpiCard icon={CheckCircle2} label="Активные" value={kpi.active} delta={activePercent} deltaLabel="от всех" tone="emerald" />
      <KpiCard icon={MessageCircle} label="Без ответа" value={kpi.noReply} delta={noReplyPercent} deltaLabel="от всех" tone="orange" trend="down" />
      <KpiCard icon={RefreshCw} label="Повторные" value={kpi.repeat} delta={repeatPercent} deltaLabel="от всех" tone="purple" />
    </div>
  );
}
