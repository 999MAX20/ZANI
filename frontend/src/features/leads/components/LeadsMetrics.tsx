import { AlertTriangle, BriefcaseBusiness, Flame, MessageCircle, Users } from "lucide-react";

import type { LeadMetrics, Translate } from "../types";
import { MetricCard } from "./common/MetricCard";

export function LeadsMetrics({ metrics, weeklyDelta, t }: { metrics: LeadMetrics; weeklyDelta: (count: number) => string; t: Translate }) {
  return (
    <section className="grid min-h-[88px] gap-4 border-b border-gray-200 bg-white py-3 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard icon={Users} label={t("leads.totalLeads")} value={metrics.total} delta={weeklyDelta(metrics.newThisWeek)} />
      <MetricCard icon={Flame} label={t("leads.newToday")} value={metrics.newToday} delta={weeklyDelta(metrics.newThisWeek)} variant="success" />
      <MetricCard icon={MessageCircle} label={t("leads.filterUnanswered")} value={metrics.unanswered} delta={weeklyDelta(metrics.unansweredThisWeek)} variant="warning" />
      <MetricCard icon={BriefcaseBusiness} label={t("leads.filterActive")} value={metrics.inProgress} delta={weeklyDelta(metrics.inProgressThisWeek)} variant="info" />
      <MetricCard icon={AlertTriangle} label={t("leads.filterHot")} value={metrics.hot} delta={weeklyDelta(metrics.hotThisWeek)} variant="danger" />
    </section>
  );
}
