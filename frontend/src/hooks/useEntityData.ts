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
import type {
  ActivityEvent,
  Appointment,
  AutomationRule,
  Bot,
  BotChannel,
  BotConversation,
  BotMessage,
  Client,
  Deal,
  Lead,
  Notification,
  Pipeline,
  PipelineStage,
  Resource,
  Segment,
  Service,
  TaggedObject,
  Tag,
  Task,
  WorkingHours,
} from "../types";

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

  const clients = useQuery<Client[]>({ queryKey: ["clients"], queryFn: () => clientsApi.list(), enabled: shouldLoad("clients") });
  const services = useQuery<Service[]>({ queryKey: ["services"], queryFn: () => servicesApi.list(), enabled: shouldLoad("services") });
  const resources = useQuery<Resource[]>({ queryKey: ["resources"], queryFn: () => resourcesApi.list(), enabled: shouldLoad("resources") });
  const leads = useQuery<Lead[]>({ queryKey: ["leads"], queryFn: () => leadsApi.list(), enabled: shouldLoad("leads") });
  const appointments = useQuery<Appointment[]>({ queryKey: ["appointments"], queryFn: () => appointmentsApi.list(), enabled: shouldLoad("appointments") });
  const workingHours = useQuery<WorkingHours[]>({ queryKey: ["working-hours"], queryFn: () => workingHoursApi.list(), enabled: shouldLoad("workingHours") });
  const pipelines = useQuery<Pipeline[]>({ queryKey: ["pipelines"], queryFn: () => pipelinesApi.list(), enabled: shouldLoad("pipelines") });
  const pipelineStages = useQuery<PipelineStage[]>({ queryKey: ["pipeline-stages"], queryFn: () => pipelineStagesApi.list(), enabled: shouldLoad("pipelineStages") });
  const deals = useQuery<Deal[]>({ queryKey: ["deals"], queryFn: () => dealsApi.list(), enabled: shouldLoad("deals") });
  const tasks = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: () => tasksApi.list(), enabled: shouldLoad("tasks") });
  const notifications = useQuery<Notification[]>({ queryKey: ["notifications"], queryFn: () => notificationsApi.list(), enabled: shouldLoad("notifications") });
  const activityEvents = useQuery<ActivityEvent[]>({ queryKey: ["activity-events"], queryFn: () => activityEventsApi.list(), enabled: shouldLoad("activityEvents") });
  const tags = useQuery<Tag[]>({ queryKey: ["tags"], queryFn: () => tagsApi.list(), enabled: shouldLoad("tags") });
  const taggedObjects = useQuery<TaggedObject[]>({ queryKey: ["tagged-objects"], queryFn: () => taggedObjectsApi.list(), enabled: shouldLoad("taggedObjects") });
  const segments = useQuery<Segment[]>({ queryKey: ["segments"], queryFn: () => segmentsApi.list(), enabled: shouldLoad("segments") });
  const automationRules = useQuery<AutomationRule[]>({ queryKey: ["automation-rules"], queryFn: () => automationRulesApi.list(), enabled: shouldLoad("automationRules") });
  const bots = useQuery<Bot[]>({ queryKey: ["bots"], queryFn: () => botsApi.list(), enabled: shouldLoad("bots") });
  const botChannels = useQuery<BotChannel[]>({ queryKey: ["bot-channels"], queryFn: () => botChannelsApi.list(), enabled: shouldLoad("botChannels") });
  const botConversations = useQuery<BotConversation[]>({ queryKey: ["bot-conversations"], queryFn: () => botConversationsApi.list(), enabled: shouldLoad("botConversations") });
  const botMessages = useQuery<BotMessage[]>({ queryKey: ["bot-messages"], queryFn: () => botMessagesApi.list(), enabled: shouldLoad("botMessages") });

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
