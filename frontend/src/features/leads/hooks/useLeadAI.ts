import { useMemo } from "react";

import type { Client, Lead, Service } from "../../../types";
import type { LeadAiInsight, Translate } from "../types";

export function useLeadAI({
  leads,
  clients,
  services,
  getInsight,
  t,
}: {
  leads: Lead[];
  clients: Client[];
  services: Service[];
  getInsight: (lead: Lead, clients: Client[], services: Service[], leads: Lead[], t: Translate) => LeadAiInsight;
  t: Translate;
}) {
  const insights = useMemo(() => {
    const result = new Map<Lead["id"], LeadAiInsight>();
    leads.forEach((lead) => result.set(lead.id, getInsight(lead, clients, services, leads, t)));
    return result;
  }, [clients, getInsight, leads, services, t]);

  const priorityLead = useMemo(() => {
    return leads
      .filter((lead) => lead.status === "new" && !lead.responsible_user)
      .sort((a, b) => (insights.get(b.id)?.score || 0) - (insights.get(a.id)?.score || 0))[0] || null;
  }, [insights, leads]);

  return { insights, priorityLead };
}
