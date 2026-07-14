import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "../../../api/client";
import { leadsApi } from "../../../api/leads";
import { teamApi } from "../../../api/team";
import { useActiveBusiness } from "../../../hooks/useBusiness";
import { useEntityData } from "../../../hooks/useEntityData";
import { useAuth } from "../../auth/AuthProvider";
import type { Id } from "../../../types";
import type { LeadAiInsight, LeadFilter, Translate } from "../types";
import { leadAiInsight } from "../utils/leadFormat";
import { useLeadOfflineQueue } from "./useLeadOfflineQueue";
import { useLeadRealtime } from "./useLeadRealtime";
import { useLeadSelectionContext } from "./useLeadSelectionContext";
import { useLeadsWorkspaceDisplay } from "./useLeadsWorkspaceDisplay";

export function useLeadsWorkspaceData({
  filter,
  source,
  search,
  sortByAi,
  page,
  pageSize,
  selectedId,
  t,
  setNotice,
  showWarning,
}: {
  filter: LeadFilter;
  source: string;
  search: string;
  sortByAi: boolean;
  page: number;
  pageSize: number;
  selectedId: Id | null;
  t: Translate;
  setNotice: (message: string | null, tone?: "success" | "info" | "warning" | "danger") => void;
  showWarning: (message: string) => void;
}) {
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const { clients, services, resources, tasks, deals, appointments, botConversations } = useEntityData({
    clients: true,
    services: true,
    resources: true,
    tasks: true,
    deals: true,
    appointments: true,
    botConversations: true,
  });

  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
    retry: false,
  });
  const leadListParams = useMemo(() => {
    const params: NonNullable<Parameters<typeof leadsApi.listPaginated>[0]> = {
      page,
      page_size: pageSize,
      ordering: sortByAi ? "-updated_at" : "-created_at",
    };
    const trimmedSearch = search.trim();
    if (trimmedSearch) params.search = trimmedSearch;
    if (source) params.source = source;
    if (filter === "new") params.status = "new";
    if (filter === "hot") {
      params.status = "new";
      params.unassigned = true;
    }
    if (filter === "unanswered") params.unassigned = true;
    if (filter === "attention") params.attention = true;
    if (filter === "mine") params.mine = true;
    return params;
  }, [filter, page, pageSize, search, sortByAi, source]);

  const leads = useQuery({
    queryKey: ["leads", "paginated", business?.id, leadListParams],
    queryFn: () => leadsApi.listPaginated(leadListParams),
    enabled: Boolean(business),
    retry: false,
  });
  const leadSummary = useQuery({
    queryKey: ["leads", "summary", business?.id],
    queryFn: leadsApi.summary,
    enabled: Boolean(business),
    retry: false,
  });

  const onlineLeads = leads.data?.results || [];
  const { isOnline, offlineQueue, cachedLeads, enqueueOfflineAction } = useLeadOfflineQueue({
    businessId: business?.id,
    onlineLeads,
    t,
    onNotice: setNotice,
    onWarning: showWarning,
  });
  const allLeads = onlineLeads.length ? onlineLeads : (!isOnline ? cachedLeads : []);
  useLeadRealtime({
    businessReady: Boolean(business),
    isOnline,
    leadsQuery: leads,
    t,
    onNotice: setNotice,
  });

  const clientList = clients.data || [];
  const serviceList = services.data || [];
  const taskList = tasks.data || [];
  const dealList = deals.data || [];
  const appointmentList = appointments.data || [];
  const conversationList = botConversations.data || [];
  const resourceList = resources.data || [];
  const teamList = Array.isArray(teamMembers.data) ? teamMembers.data : [];
  const aiInsights = useMemo(() => {
    const result = new Map<Id, LeadAiInsight>();
    allLeads.forEach((lead) => {
      const insight = leadAiInsight(lead, clientList, serviceList, allLeads, t);
      result.set(lead.id, {
        ...insight,
        score: typeof lead.ai_score === "number" ? lead.ai_score : insight.score,
        lossRisk: typeof lead.loss_risk === "number" ? lead.loss_risk : insight.lossRisk,
        recommendation: lead.recommended_action || insight.recommendation,
      });
    });
    return result;
  }, [allLeads, clientList, serviceList, t]);

  const rows = useMemo(() => allLeads, [allLeads]);
  const totalLeadCount = leads.data?.count ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(totalLeadCount / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows;
  const selectedContext = useLeadSelectionContext({
    businessId: business?.id,
    rows,
    pageRows,
    selectedId,
    clients: clientList,
    services: serviceList,
    tasks: taskList,
    deals: dealList,
    appointments: appointmentList,
    conversations: conversationList,
    aiInsights,
    t,
  });
  const display = useLeadsWorkspaceDisplay({
    t,
    leadSummary: leadSummary.data,
    totalLeadCount,
    allLeads,
    aiInsights,
    userId: user?.id,
    pageRows,
    safePage,
    pageSize,
    pageCount,
  });

  return {
    business,
    clients,
    services,
    resources,
    tasks,
    leads,
    pageError: clients.error || services.error || leads.error,
    pageErrorMessage: getApiErrorMessage(clients.error || services.error || leads.error),
    isPageLoading: leads.isLoading || clients.isLoading || services.isLoading || tasks.isLoading,
    allLeads,
    rows,
    pageRows,
    totalLeadCount,
    pageCount,
    safePage,
    offlineQueue,
    enqueueOfflineAction,
    clientList,
    serviceList,
    resourceList,
    teamList,
    aiInsights,
    ...selectedContext,
    ...display,
  };
}
