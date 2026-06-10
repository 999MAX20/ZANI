import { useMemo } from "react";

import type { Appointment, BotConversation, Client, Deal, Lead, Task } from "../../../types";
import type { ClientKpi, ClientQuickFilter, ClientTableRow, ClientTag } from "../types";
import { latestDate } from "../utils";

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
}: {
  clients: Client[];
  leads: Lead[];
  deals: Deal[];
  appointments: Appointment[];
  tasks: Task[];
  conversations: BotConversation[];
  tagsByClient: Record<string, ClientTag[]>;
  quickFilter: ClientQuickFilter;
}) {
  const tableRows = useMemo<ClientTableRow[]>(() => {
    const leadsByClient = groupByClient(leads);
    const dealsByClient = groupByClient(deals);
    const appointmentsByClient = groupByClient(appointments);
    const tasksByClient = groupByClient(tasks);
    const conversationsByClient = groupByClient(conversations);

    return clients.map((client) => {
      const clientLeads = [...(leadsByClient.get(client.id) || [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const clientDeals = [...(dealsByClient.get(client.id) || [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      const clientAppointments = [...(appointmentsByClient.get(client.id) || [])].sort((a, b) => b.start_at.localeCompare(a.start_at));
      const clientTasks = [...(tasksByClient.get(client.id) || [])]
        .filter((task) => !["done", "cancelled"].includes(task.status))
        .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")));
      const clientConversations = [...(conversationsByClient.get(client.id) || [])].sort((a, b) =>
        String(b.last_message_at || b.updated_at).localeCompare(String(a.last_message_at || a.updated_at)),
      );
      const tagsForClient = tagsByClient[String(client.id)] || [];
      const isVip = tagsForClient.some((tag) => String(tag.tag_name || "").toLowerCase().includes("vip"));
      const hasNoReply = clientConversations.some((conversation) => conversation.unread_count || conversation.handoff_required) || clientLeads.some((lead) => lead.status === "new");
      const isActive = Boolean(clientDeals.some((deal) => deal.status === "open") || clientAppointments.length || clientConversations.length || clientLeads.length);
      const status: ClientTableRow["status"] = client.is_archived ? "archived" : isVip ? "vip" : hasNoReply ? "no_reply" : isActive ? "active" : "new";
      const latestDeal = clientDeals[0];
      const latestTask = clientTasks[0];
      const latestLead = clientLeads[0];
      const latestAppointment = clientAppointments[0];
      const managerId = latestDeal?.owner || latestTask?.assignee || latestLead?.responsible_user;
      const lastContactAt = latestDate([
        clientConversations[0]?.last_message_at || clientConversations[0]?.updated_at,
        latestAppointment?.start_at,
        latestLead?.updated_at,
        latestDeal?.updated_at,
        client.updated_at,
      ]);
      const nextStep = latestTask
        ? { title: latestTask.title, date: latestTask.due_at, priority: latestTask.priority }
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
        manager: managerId ? `Менеджер ${managerId}` : "Не назначен",
      };
    });
  }, [appointments, clients, conversations, deals, leads, tagsByClient, tasks]);

  const rows = useMemo(() => {
    return tableRows.filter((row) => {
      if (quickFilter === "new") return row.status === "new";
      if (quickFilter === "vip") return row.status === "vip";
      if (quickFilter === "no_reply") return row.status === "no_reply";
      if (quickFilter === "mine") return row.manager !== "Не назначен";
      return true;
    });
  }, [quickFilter, tableRows]);

  const kpi = useMemo<ClientKpi>(
    () => ({
      total: tableRows.length,
      active: tableRows.filter((row) => row.status === "active" || row.status === "vip").length,
      noReply: tableRows.filter((row) => row.status === "no_reply").length,
      repeat: tableRows.filter((row) => row.appointments.length > 1 || row.deals.length > 1).length,
    }),
    [tableRows],
  );

  return { rows, tableRows, kpi };
}
