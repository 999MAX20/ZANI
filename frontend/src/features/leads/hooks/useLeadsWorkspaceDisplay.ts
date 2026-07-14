import { useMemo } from "react";

import type { Id, Lead } from "../../../types";
import type { LeadAiInsight, LeadFilter, Translate } from "../types";

type LeadSummary = {
  total?: number;
  new?: number;
  hot?: number;
  unanswered?: number;
  attention?: number;
  mine?: number;
};

export function useLeadsWorkspaceDisplay({
  t,
  leadSummary,
  totalLeadCount,
  allLeads,
  aiInsights,
  userId,
  pageRows,
  safePage,
  pageSize,
  pageCount,
}: {
  t: Translate;
  leadSummary?: LeadSummary;
  totalLeadCount: number;
  allLeads: Lead[];
  aiInsights: Map<Id, LeadAiInsight>;
  userId?: Id;
  pageRows: Lead[];
  safePage: number;
  pageSize: number;
  pageCount: number;
}) {
  const filters = useMemo(() => [
    { value: "all" as LeadFilter, label: t("leads.filterAll"), count: leadSummary?.total ?? totalLeadCount },
    { value: "new" as LeadFilter, label: t("leads.filterNew"), count: leadSummary?.new ?? allLeads.filter((lead) => lead.status === "new").length },
    { value: "hot" as LeadFilter, label: t("leads.filterHot"), count: leadSummary?.hot ?? allLeads.filter((lead) => lead.status === "new" && !lead.responsible_user).length },
    { value: "unanswered" as LeadFilter, label: t("leads.filterUnanswered"), count: leadSummary?.unanswered ?? allLeads.filter((lead) => !lead.responsible_user).length },
    { value: "attention" as LeadFilter, label: t("leads.filterAttention"), count: leadSummary?.attention ?? allLeads.filter((lead) => {
      const insight = aiInsights.get(lead.id);
      return insight?.stale || (insight?.lossRisk || 0) >= 70;
    }).length },
    { value: "mine" as LeadFilter, label: t("leads.filterMine"), count: leadSummary?.mine ?? allLeads.filter((lead) => userId && lead.responsible_user === userId).length },
  ], [aiInsights, allLeads, leadSummary, t, totalLeadCount, userId]);

  const pageStart = pageRows.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = pageRows.length ? pageStart + pageRows.length - 1 : 0;
  const visiblePages = Array.from({ length: pageCount })
    .map((_, index) => index + 1)
    .filter((itemPage) => pageCount <= 5 || itemPage === 1 || itemPage === pageCount || Math.abs(itemPage - safePage) <= 1)
    .slice(0, 7);

  return { filters, pageStart, pageEnd, visiblePages };
}
