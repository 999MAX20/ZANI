/**
 * Leads Feature Module
 * 
 * Рефакторинг в соответствии с дизайн-референсами:
 * - Компактные компоненты (header, filters, metrics)
 * - Enhanced empty states
 * - Mobile-first подход (FAB, chips)
 * - AI integration как actionable summaries
 */

export { LeadsPage } from "./LeadsPage";
export { LeadsHeader } from "./components/LeadsHeader";
export { LeadsFilters } from "./components/LeadsFilters";
export { LeadsMetrics } from "./components/LeadsMetrics";
export { AIPriorityBanner } from "./components/AIPriorityBanner";
export { LeadsEmptyState } from "./components/LeadsEmptyState";
export { LeadsMobileFab } from "./components/LeadsMobileFab";
export { LeadDetailPanel } from "./components/LeadDetailPanel";
export { LeadQueueItem } from "./components/LeadQueueItem";
export { VirtualizedLeadTableRows } from "./components/LeadsTable";
export { SourceBadge } from "./components/common/SourceBadge";
export { MetricCard } from "./components/common/MetricCard";

export { useLeadData } from "./hooks/useLeadData";
export { useLeadActions } from "./hooks/useLeadActions";
export { useLeadFilters } from "./hooks/useLeadFilters";
export { useLeadSelection } from "./hooks/useLeadSelection";
export { useLeadView } from "./hooks/useLeadView";
export { useLeads } from "./hooks/useLeads";

export type * from "./types";
