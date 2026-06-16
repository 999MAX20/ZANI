import { useMemo } from "react";

import type { Appointment, BotConversation, Client, Deal, Id, Lead, Task } from "../../../types";
import type { ClientKpi, ClientQuickFilter, ClientTableRow, ClientTag } from "../types";
import { compareDescDate, latestDate } from "../utils";

function groupByClient<T extends { client: number | null }>(items: T[]) {
  const map = new Map<number, T[]>();
  items.forEach((item) => {
    if (!item.client) return;
    const list = map.get(item.client) || [];
    list.push(item);
    map.set(item.client, list);
  });
  return map;
}

export function useClientRows({
  clients,
  leads,
  deals,
  appointments,
  tasks,
  conversations,
  tagsByClient,
  quickFilter,
  currentUserId,
  totalOverride,
  serverSummary,
}: {
  clients: Client[];
  leads: Lead[];
  deals: Deal[];
  appointments: Appointment[];
  tasks: Task[];
  conversations: BotConversation[];
  tagsByClient: Record<string, ClientTag[]>;
  quickFilter: ClientQuickFilter;
  currentUserId?: Id | null;
  totalOverride?: number;
  serverSummary?: {
    total: number;
    active: number;
    no_reply: number;
    repeat: number;
  };
}) {
  function sortByDateDesc<T>(items: T[], getDate: (item: T) => string | null | undefined) {
    return [...items].sort((a, b) => {
      const byDate = compareDescDate(getDate(a), getDate(b));
      if (byDate !== 0) return byDate;
      return 0;
    });
  }

  const tableRows = useMemo<ClientTableRow[]>(() => {
    const leadsByClient = groupByClient(leads);
    const dealsByClient = groupByClient(deals);
    const appointmentsByClient = groupByClient(appointments);
    const tasksByClient = groupByClient(tasks);
    const conversationsByClient = groupByClient(conversations);

    return clients.map((client) => {
      const clientLeads = sortByDateDesc([...(leadsByClient.get(client.id) || [])], (lead) => lead.created_at);
      const clientDeals = sortByDateDesc([...(dealsByClient.get(client.id) || [])], (deal) => deal.updated_at);
      const clientAppointments = sortByDateDesc([...(appointmentsByClient.get(client.id) || [])], (appointment) => appointment.start_at);
      const clientTasks = sortByDateDesc(
        [...(tasksByClient.get(client.id) || [])].filter((task) => !["done", "cancelled"].includes(task.status)),
        (task) => task.due_at,
      );
      const clientConversations = sortByDateDesc(
        [...(conversationsByClient.get(client.id) || [])],
        (conversation) => conversation.last_message_at || conversation.updated_at,
      );
      const tagsForClient = tagsByClient[String(client.id)] || [];
      const isVip = tagsForClient.some((tag) => String(tag.tag_name || "").toLowerCase().includes("vip"));
      const serverIsVip = client.is_vip;
      const serverActive = client.is_active;
      const serverNoReply = client.has_no_reply;
      const serverManager = client.manager_user_id;
      const latestConversation = clientConversations[0];
      const hasNoReply =
        typeof serverNoReply === "boolean"
          ? serverNoReply
          : Boolean(latestConversation && (latestConversation.unread_count || latestConversation.handoff_required)) ||
            clientLeads.some((lead) => lead.status === "new");
      const isActive =
        typeof client.is_active === "boolean"
          ? client.is_active
          : Boolean(clientDeals.some((deal) => deal.status === "open") || clientAppointments.length || clientConversations.length || clientLeads.length);
      const status: ClientTableRow["status"] = client.is_archived
        ? "archived"
        : serverIsVip
          ? "vip"
          : hasNoReply
            ? "no_reply"
            : isActive
              ? "active"
              : "new";
      const latestDeal = clientDeals[0];
      const latestTask = clientTasks[0];
      const latestLead = clientLeads[0];
      const latestAppointment = clientAppointments[0];
      const latestManagerId =
        serverManager ?? [latestTask?.assignee, latestDeal?.owner, latestLead?.responsible_user, latestConversation?.assigned_to].find((candidate) => Boolean(candidate));
      const managerIdNumber = latestManagerId ? Number(latestManagerId) : null;
      const isMine = currentUserId ? managerIdNumber !== null && Number(currentUserId) === managerIdNumber : false;
      const lastContactAt = latestDate([
        clientConversations[0]?.last_message_at || clientConversations[0]?.updated_at,
        latestAppointment?.start_at,
        latestLead?.updated_at,
        latestDeal?.updated_at,
        client.last_activity_at,
        client.updated_at,
      ]);
      const nextStep = latestTask
        ? { title: latestTask.title, date: latestTask.due_at, priority: latestTask.priority }
        : client.next_step_title
          ? { title: client.next_step_title, date: client.next_step_date || null, priority: client.next_step_priority || "normal" }
        : latestDeal?.next_action_at
          ? { title: "Связаться по сделке", date: latestDeal.next_action_at }
        : hasNoReply
          ? { title: "Ответить клиенту", date: null }
          : { title: latestAppointment ? "Подтвердить запись" : "Позвонить", date: latestAppointment?.start_at || null };

      return {
        client,
        tags: tagsForClient,
        leads: clientLeads,
        deals: clientDeals,
        appointments: clientAppointments,
        tasks: clientTasks,
        conversations: clientConversations,
        status,
        lastContactAt,
        nextStep,
        manager: latestManagerId ? `Менеджер ${latestManagerId}` : "Не назначен",
        managerUserId: isMine ? currentUserId || null : (latestManagerId ? Number(latestManagerId) : null),
      };
    });
  }, [appointments, clients, conversations, currentUserId, deals, leads, tagsByClient, tasks]);

  const rows = useMemo(() => {
    return tableRows.filter((row) => {
      if (quickFilter === "new") return row.status === "new";
      if (quickFilter === "vip") return row.status === "vip";
      if (quickFilter === "no_reply") return row.status === "no_reply";
      if (quickFilter === "mine") return Boolean(currentUserId && row.managerUserId === currentUserId);
      return true;
    });
  }, [currentUserId, quickFilter, tableRows]);

  const kpi = useMemo<ClientKpi>(
    () => ({
      total: serverSummary?.total ?? (typeof totalOverride === "number" ? totalOverride : tableRows.length),
      active: serverSummary?.active ?? tableRows.filter((row) => row.status === "active" || row.status === "vip").length,
      noReply: serverSummary?.no_reply ?? tableRows.filter((row) => row.status === "no_reply").length,
      repeat: serverSummary?.repeat ?? tableRows.filter((row) => row.appointments.length > 1 || row.deals.length > 1).length,
    }),
    [serverSummary, tableRows, totalOverride],
  );

  return { rows, tableRows, kpi };
}
