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

export function useEntityData() {
  const clients = useQuery({ queryKey: ["clients"], queryFn: clientsApi.list });
  const services = useQuery({ queryKey: ["services"], queryFn: servicesApi.list });
  const resources = useQuery({ queryKey: ["resources"], queryFn: resourcesApi.list });
  const leads = useQuery({ queryKey: ["leads"], queryFn: leadsApi.list });
  const appointments = useQuery({ queryKey: ["appointments"], queryFn: appointmentsApi.list });
  const workingHours = useQuery({ queryKey: ["working-hours"], queryFn: workingHoursApi.list });
  const pipelines = useQuery({ queryKey: ["pipelines"], queryFn: pipelinesApi.list });
  const pipelineStages = useQuery({ queryKey: ["pipeline-stages"], queryFn: pipelineStagesApi.list });
  const deals = useQuery({ queryKey: ["deals"], queryFn: dealsApi.list });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: tasksApi.list });
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: notificationsApi.list });
  const activityEvents = useQuery({ queryKey: ["activity-events"], queryFn: activityEventsApi.list });
  const tags = useQuery({ queryKey: ["tags"], queryFn: tagsApi.list });
  const taggedObjects = useQuery({ queryKey: ["tagged-objects"], queryFn: taggedObjectsApi.list });
  const segments = useQuery({ queryKey: ["segments"], queryFn: segmentsApi.list });
  const automationRules = useQuery({ queryKey: ["automation-rules"], queryFn: automationRulesApi.list });
  const bots = useQuery({ queryKey: ["bots"], queryFn: botsApi.list });
  const botChannels = useQuery({ queryKey: ["bot-channels"], queryFn: botChannelsApi.list });
  const botConversations = useQuery({ queryKey: ["bot-conversations"], queryFn: botConversationsApi.list });
  const botMessages = useQuery({ queryKey: ["bot-messages"], queryFn: botMessagesApi.list });

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
