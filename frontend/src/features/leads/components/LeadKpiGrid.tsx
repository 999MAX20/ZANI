import { AlertTriangle, BriefcaseBusiness, Flame, MessageCircle, Users } from "lucide-react";

import type { Translate } from "../types";
import { MetricTile } from "./common/MetricTile";

export function LeadKpiGrid({
  className,
  total,
  newToday,
  unanswered,
  inProgress,
  hot,
  weekLeadCount,
  unansweredWeekCount,
  inProgressWeekCount,
  hotWeekCount,
  weeklyDelta,
  t,
}: {
  className?: string;
  total: number;
  newToday: number;
  unanswered: number;
  inProgress: number;
  hot: number;
  weekLeadCount: number;
  unansweredWeekCount: number;
  inProgressWeekCount: number;
  hotWeekCount: number;
  weeklyDelta: (count: number) => string;
  t: Translate;
}) {
  return (
    <section className={className}>
      <MetricTile icon={Users} label={t("leads.totalLeads")} value={total} delta={weeklyDelta(weekLeadCount)} />
      <MetricTile icon={Flame} label={t("leads.newToday")} value={newToday} delta={weeklyDelta(weekLeadCount)} tone="green" />
      <MetricTile icon={MessageCircle} label={t("leads.filterUnanswered")} value={unanswered} delta={weeklyDelta(unansweredWeekCount)} tone="amber" />
      <MetricTile icon={BriefcaseBusiness} label={t("leads.filterActive")} value={inProgress} delta={weeklyDelta(inProgressWeekCount)} tone="blue" />
      <MetricTile icon={AlertTriangle} label={t("leads.filterHot")} value={hot} delta={weeklyDelta(hotWeekCount)} tone="pink" />
    </section>
  );
}
