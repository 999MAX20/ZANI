import { ArrowRight, CalendarClock, MessageSquareText, Sparkles, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../../../components/ui/Button";
import { formatDateTime } from "../../../lib/format";
import type { ActivityEvent } from "../../../types";
import type { DealMetricsModel, DealRow, Translate } from "../types";
import { money } from "../utils/dealHelpers";

function WidgetShell({ title, children, action, className = "" }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`min-h-[190px] overflow-hidden rounded-lg border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-[13px] font-black text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DealsBusinessWidgets({
  metrics,
  timeline,
  onOpenDeal,
  t,
}: {
  metrics: DealMetricsModel;
  timeline: ActivityEvent[];
  onOpenDeal: (deal: DealRow) => void;
  t: Translate;
}) {
  const expectedRevenue = metrics.openDeals.reduce((sum, deal) => {
    const probability = deal.probability || deal.stageEntity?.probability || 0;
    return sum + Number(deal.amount || 0) * (probability / 100);
  }, 0);
  const forecastBase = metrics.pipelineValue || expectedRevenue || 1;
  const forecastPercent = Math.min(100, Math.max(0, Math.round((expectedRevenue / forecastBase) * 100)));
  const aiText = metrics.overdueDeals.length
    ? t("deals.aiSuggestionOverdue")
    : metrics.noTaskDeals.length
      ? t("deals.aiSuggestionNoTasks")
      : t("deals.aiSuggestionStable");

  return (
    <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.72fr)_minmax(280px,0.78fr)]">
      <WidgetShell
        title={t("deals.aiSuggestion")}
        className="relative bg-[linear-gradient(135deg,#ffffff_0%,#ffffff_58%,#f5f3ff_100%)]"
        action={<Sparkles size={17} className="text-[#6d5dfc]" />}
      >
        <div className="relative z-10 grid gap-3">
          <div className="space-y-3 text-[13px] font-semibold leading-6 text-slate-700">
            <p className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6d5dfc]" />
              {aiText}
            </p>
            <p className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6d5dfc]" />
              {t("deals.aiHighChance", { count: metrics.staleDeals.length, amount: money(metrics.staleDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0)) })}
            </p>
          </div>
          {metrics.priorityDeal ? (
            <Button variant="ghost" size="sm" className="w-fit text-blue-700" onClick={() => onOpenDeal(metrics.priorityDeal!)}>
              {t("deals.allHints")} <ArrowRight size={15} />
            </Button>
          ) : null}
        </div>
        <Sparkles size={36} className="pointer-events-none absolute bottom-6 right-7 text-[#8b5cf6]/35" />
      </WidgetShell>

      <WidgetShell
        title={t("deals.forecast")}
        action={<span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{t("deals.forecastPeriod")}</span>}
      >
        <div className="flex items-center gap-5">
          <div className="relative grid h-20 w-20 place-items-center rounded-full bg-white text-[#4f46e5] ring-[10px] ring-indigo-100">
            <TrendingUp size={20} />
            <span className="absolute inset-0 rounded-full border-[7px] border-[#6d5dfc] border-l-transparent border-t-transparent" />
            <span className="absolute text-sm font-black text-slate-950">{forecastPercent}%</span>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-950">{money(expectedRevenue)}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{t("deals.expectedRevenue")}</p>
            <p className="mt-3 text-xs font-black text-emerald-600">{t("deals.previousMonthDelta")}</p>
          </div>
        </div>
      </WidgetShell>

      <WidgetShell title={t("deals.activity")} action={<MessageSquareText size={17} className="text-slate-400" />}>
        <div className="space-y-3">
          {timeline.slice(0, 4).map((event) => (
            <div key={event.id} className="grid grid-cols-[1fr_auto] gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{event.text || event.event_type}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{event.source || event.category}</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{formatDateTime(event.created_at)}</span>
            </div>
          ))}
          {!timeline.length ? (
            <div className="flex gap-3 text-sm text-slate-500">
              <CalendarClock size={17} />
              <p className="font-semibold">{t("deals.noTimeline")}</p>
            </div>
          ) : null}
          <Button variant="ghost" size="sm" className="w-fit text-blue-700">
            {t("deals.allEvents")} <ArrowRight size={15} />
          </Button>
        </div>
      </WidgetShell>
    </section>
  );
}
