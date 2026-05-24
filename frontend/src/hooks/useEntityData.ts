import { useQuery } from "@tanstack/react-query";

import { appointmentsApi } from "../api/appointments";
import { activityEventsApi, segmentsApi, taggedObjectsApi, tagsApi } from "../api/activities";
import { automationRulesApi } from "../api/automations";
import { botChannelsApi, botConversationsApi, botMessagesApi, botsApi } from "../api/bots";
import { clientsApi } from "../api/clients";
import { dealsApi, pipelineStagesApi, pipelinesApi } from "../api/deals";
import { leadsApi } from "../api/leads";
import { notificationsApi } from "../api/notifications";
import { resourcesApi } from "../api/resources";
import { servicesApi } from "../api/services";
import { tasksApi } from "../api/tasks";
import { workingHoursApi } from "../api/workingHours";

type EntityDataOptions = {
  enabled?: boolean;
  clients?: boolean;
  services?: boolean;
  resources?: boolean;
  leads?: boolean;
  appointments?: boolean;
  workingHours?: boolean;
  pipelines?: boolean;
  pipelineStages?: boolean;
  deals?: boolean;
  tasks?: boolean;
  notifications?: boolean;
  activityEvents?: boolean;
  tags?: boolean;
  taggedObjects?: boolean;
  segments?: boolean;
  automationRules?: boolean;
  bots?: boolean;
  botChannels?: boolean;
  botConversations?: boolean;
  botMessages?: boolean;
};

export function useEntityData(options?: EntityDataOptions) {
  const defaultEnabled = options === undefined;
  const globalEnabled = options?.enabled ?? true;
  const shouldLoad = (key: keyof EntityDataOptions) => globalEnabled && (defaultEnabled || options?.[key] === true);

  const clients = useQuery({ queryKey: ["clients"], queryFn: clientsApi.list, enabled: shouldLoad("clients") });
  const services = useQuery({ queryKey: ["services"], queryFn: servicesApi.list, enabled: shouldLoad("services") });
  const resources = useQuery({ queryKey: ["resources"], queryFn: resourcesApi.list, enabled: shouldLoad("resources") });
  const leads = useQuery({ queryKey: ["leads"], queryFn: leadsApi.list, enabled: shouldLoad("leads") });
  const appointments = useQuery({ queryKey: ["appointments"], queryFn: appointmentsApi.list, enabled: shouldLoad("appointments") });
  const workingHours = useQuery({ queryKey: ["working-hours"], queryFn: workingHoursApi.list, enabled: shouldLoad("workingHours") });
  const pipelines = useQuery({ queryKey: ["pipelines"], queryFn: pipelinesApi.list, enabled: shouldLoad("pipelines") });
  const pipelineStages = useQuery({ queryKey: ["pipeline-stages"], queryFn: pipelineStagesApi.list, enabled: shouldLoad("pipelineStages") });
  const deals = useQuery({ queryKey: ["deals"], queryFn: dealsApi.list, enabled: shouldLoad("deals") });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list, enabled: shouldLoad("tasks") });
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: notificationsApi.list, enabled: shouldLoad("notifications") });
  const activityEvents = useQuery({ queryKey: ["activity-events"], queryFn: activityEventsApi.list, enabled: shouldLoad("activityEvents") });
  const tags = useQuery({ queryKey: ["tags"], queryFn: tagsApi.list, enabled: shouldLoad("tags") });
  const taggedObjects = useQuery({ queryKey: ["tagged-objects"], queryFn: taggedObjectsApi.list, enabled: shouldLoad("taggedObjects") });
  const segments = useQuery({ queryKey: ["segments"], queryFn: segmentsApi.list, enabled: shouldLoad("segments") });
  const automationRules = useQuery({ queryKey: ["automation-rules"], queryFn: automationRulesApi.list, enabled: shouldLoad("automationRules") });
  const bots = useQuery({ queryKey: ["bots"], queryFn: botsApi.list, enabled: shouldLoad("bots") });
  const botChannels = useQuery({ queryKey: ["bot-channels"], queryFn: botChannelsApi.list, enabled: shouldLoad("botChannels") });
  const botConversations = useQuery({ queryKey: ["bot-conversations"], queryFn: botConversationsApi.list, enabled: shouldLoad("botConversations") });
  const botMessages = useQuery({ queryKey: ["bot-messages"], queryFn: botMessagesApi.list, enabled: shouldLoad("botMessages") });

  return {
    clients,
    services,
    resources,
    leads,
    appointments,
    workingHours,
    pipelines,
    pipelineStages,
    deals,
    tasks,
    notifications,
    activityEvents,
    tags,
    taggedObjects,
    segments,
    automationRules,
    bots,
    botChannels,
    botConversations,
    botMessages,
  };
}
