import type { Appointment, BotConversation, Client, Deal, Id, Lead, SegmentFilter, Task } from "../../types";
import type { useI18n } from "../../lib/i18n";

export type SegmentDraft = {
  name: string;
  field: SegmentFilter["field"];
  operator: SegmentFilter["operator"];
  value: string;
};

export type ClientQuickFilter = "all" | "new" | "vip" | "no_reply" | "mine";

export type Translate = ReturnType<typeof useI18n>["t"];

export type ClientTag = {
  id: Id;
  tag_name?: string;
  tag_color?: string;
};

export type ClientTableRow = {
  client: Client;
  tags: ClientTag[];
  leads: Lead[];
  deals: Deal[];
  appointments: Appointment[];
  tasks: Task[];
  conversations: BotConversation[];
  status: "active" | "new" | "vip" | "no_reply" | "archived";
  lastContactAt: string | null;
  nextStep: {
    title: string;
    date: string | null;
    priority?: Task["priority"];
  };
  manager: string;
  managerUserId: Id | null;
};

export type ClientKpi = {
  total: number;
  active: number;
  noReply: number;
  repeat: number;
};
