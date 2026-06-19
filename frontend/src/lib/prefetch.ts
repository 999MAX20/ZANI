import type { QueryClient } from "@tanstack/react-query";

import { botConversationsApi } from "../api/bots";
import { clientsApi } from "../api/clients";
import { dealsApi, pipelineStagesApi, pipelinesApi } from "../api/deals";
import { leadsApi } from "../api/leads";
import { notificationsApi } from "../api/notifications";
import { tasksApi } from "../api/tasks";
import { inboxApi, inboxQueryKeys, normalizeFilters } from "../api/inbox";

const prefetchOptions = {
  staleTime: 5 * 60_000,
};

export function prefetchRouteData(path: string, queryClient: QueryClient, businessId?: number | null | string) {
  if (path === "/app") {
    void Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: ["leads"], queryFn: leadsApi.list, ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: ["clients"], queryFn: clientsApi.list, ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: ["tasks"], queryFn: tasksApi.list, ...prefetchOptions }),
    ]);
    return;
  }

  if (path.startsWith("/app/leads")) {
    void Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: ["leads"], queryFn: leadsApi.list, ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: ["clients"], queryFn: clientsApi.list, ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: ["tasks"], queryFn: tasksApi.list, ...prefetchOptions }),
    ]);
    return;
  }

  if (path.startsWith("/app/clients")) {
    void Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: ["clients"], queryFn: clientsApi.list, ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: ["leads"], queryFn: leadsApi.list, ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: ["deals"], queryFn: dealsApi.list, ...prefetchOptions }),
    ]);
    return;
  }

  if (path.startsWith("/app/deals")) {
    void Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: ["deals"], queryFn: dealsApi.list, ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: ["pipelines"], queryFn: pipelinesApi.list, ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: ["pipeline-stages"], queryFn: pipelineStagesApi.list, ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: ["clients"], queryFn: clientsApi.list, ...prefetchOptions }),
    ]);
    return;
  }

  if (path.startsWith("/app/conversations")) {
    const summaryKey = ["inbox-summary", businessId];
    const conversationFilters = normalizeFilters({});
    void Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: inboxQueryKeys.conversations(conversationFilters), queryFn: () => inboxApi.listConversations(conversationFilters), ...prefetchOptions }),
      queryClient.prefetchQuery({ queryKey: summaryKey, queryFn: inboxApi.getSummary, ...prefetchOptions }),
    ]);
    return;
  }

  if (path.startsWith("/app/tasks")) {
    void queryClient.prefetchQuery({ queryKey: ["tasks"], queryFn: tasksApi.list, ...prefetchOptions });
    return;
  }

  if (path.startsWith("/app/ai-agents")) {
    void queryClient.prefetchQuery({ queryKey: ["bot-conversations"], queryFn: botConversationsApi.list, ...prefetchOptions });
    return;
  }

  if (path.startsWith("/app/settings")) {
    void queryClient.prefetchQuery({ queryKey: ["notifications"], queryFn: notificationsApi.list, ...prefetchOptions });
  }
}
