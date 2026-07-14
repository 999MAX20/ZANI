import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { leadsApi } from "../../../api/leads";
import type { Appointment, BotConversation, Client, Deal, Id, Lead, Service, Task } from "../../../types";
import type { LeadAiInsight, Translate } from "../types";
import { getClient, getService, leadAiInsight } from "../utils/leadFormat";

export function useLeadSelectionContext({
  businessId,
  rows,
  pageRows,
  selectedId,
  clients,
  services,
  tasks,
  deals,
  appointments,
  conversations,
  aiInsights,
  t,
}: {
  businessId?: Id;
  rows: Lead[];
  pageRows: Lead[];
  selectedId: Id | null;
  clients: Client[];
  services: Service[];
  tasks: Task[];
  deals: Deal[];
  appointments: Appointment[];
  conversations: BotConversation[];
  aiInsights: Map<Id, LeadAiInsight>;
  t: Translate;
}) {
  const selected = useMemo(() => rows.find((lead) => lead.id === selectedId) || pageRows[0] || null, [pageRows, rows, selectedId]);
  const selectedClient = selected ? getClient(selected, clients) : undefined;
  const selectedService = selected ? getService(selected, services) : undefined;
  const selectedTasks = selected
    ? tasks
        .filter((task) => task.lead === selected.id && !["done", "cancelled"].includes(task.status))
        .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")))
    : [];
  const selectedNextTask = selectedTasks[0];
  const selectedDeals = selected ? deals.filter((deal) => deal.lead === selected.id || deal.client === selected.client) : [];
  const selectedAppointments = selected ? appointments.filter((appointment) => appointment.lead === selected.id || appointment.client === selected.client) : [];
  const selectedConversations = selected ? conversations.filter((conversation) => conversation.lead === selected.id || conversation.client === selected.client) : [];

  const duplicateCheck = useQuery({
    queryKey: ["lead-duplicates", businessId, selected?.id, selectedClient?.phone, selectedClient?.email],
    queryFn: () =>
      leadsApi.checkDuplicates({
        business: businessId!,
        client: selectedClient?.id,
        phone: selectedClient?.phone,
        email: selectedClient?.email,
      }),
    enabled: Boolean(businessId && selectedClient && (selectedClient.phone || selectedClient.email)),
    retry: false,
  });

  const selectedAiInsight = useMemo(() => {
    if (!selected) return null;
    const base = aiInsights.get(selected.id) || leadAiInsight(selected, clients, services, rows, t);
    const serverDuplicates = (duplicateCheck.data?.duplicates || []).map((duplicate) => {
      const existing = clients.find((client) => client.id === duplicate.id);
      if (existing) return existing;
      return {
        id: duplicate.id,
        business: businessId || selected.business,
        full_name: duplicate.full_name,
        phone: duplicate.phone,
        email: duplicate.email,
        whatsapp_id: "",
        telegram_id: "",
        instagram_id: "",
        source: "manual" as const,
        source_detail: "",
        source_context_json: {},
        notes: "",
        created_at: "",
        updated_at: "",
      };
    });
    const duplicateMap = new Map<Id, Client>();
    [...base.duplicateClients, ...serverDuplicates].forEach((client) => duplicateMap.set(client.id, client));
    return {
      ...base,
      duplicateClients: Array.from(duplicateMap.values()).filter((client) => client.id !== selected.client),
    };
  }, [aiInsights, businessId, clients, duplicateCheck.data?.duplicates, rows, selected, services, t]);

  return {
    selected,
    selectedClient,
    selectedService,
    selectedTasks,
    selectedNextTask,
    selectedDeals,
    selectedAppointments,
    selectedConversations,
    selectedAiInsight,
  };
}
