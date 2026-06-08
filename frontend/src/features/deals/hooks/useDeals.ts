import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { teamApi } from "../../../api/team";
import { useActiveBusiness } from "../../../hooks/useBusiness";
import { useEntityData } from "../../../hooks/useEntityData";
import type { Id, Task } from "../../../types";

export function useDeals() {
  const { business } = useActiveBusiness();
  const entityData = useEntityData({
    clients: true,
    leads: true,
    pipelines: true,
    pipelineStages: true,
    deals: true,
    tasks: true,
    activityEvents: true,
    botConversations: true,
  });
  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
    retry: false,
  });

  const clientMap = useMemo(() => new Map((entityData.clients.data || []).map((client) => [client.id, client])), [entityData.clients.data]);
  const stageMap = useMemo(() => new Map((entityData.pipelineStages.data || []).map((stage) => [stage.id, stage])), [entityData.pipelineStages.data]);
  const tasksByDeal = useMemo(() => {
    const map = new Map<Id, Task[]>();
    (entityData.tasks.data || []).forEach((task) => {
      if (!task.deal) return;
      map.set(task.deal, [...(map.get(task.deal) || []), task]);
    });
    return map;
  }, [entityData.tasks.data]);

  const isLoading =
    entityData.clients.isLoading ||
    entityData.pipelines.isLoading ||
    entityData.pipelineStages.isLoading ||
    entityData.deals.isLoading ||
    entityData.tasks.isLoading;

  return {
    business,
    queries: entityData,
    teamMembers,
    data: {
      clients: entityData.clients.data || [],
      leads: entityData.leads.data || [],
      pipelines: entityData.pipelines.data || [],
      stages: entityData.pipelineStages.data || [],
      deals: entityData.deals.data || [],
      tasks: entityData.tasks.data || [],
      activityEvents: entityData.activityEvents.data || [],
      conversations: entityData.botConversations.data || [],
      teamMembers: teamMembers.data || [],
      clientMap,
      stageMap,
      tasksByDeal,
    },
    isLoading,
  };
}
