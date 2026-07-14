import type { Lead } from "../../../types";
import type { LeadMetrics } from "../types";

export function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function isWithinLastDays(value: string, days: number) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export function calculateLeadMetrics(leads: Lead[]): LeadMetrics {
  return {
    total: leads.length,
    newToday: leads.filter((lead) => isToday(lead.created_at)).length,
    newThisWeek: leads.filter((lead) => isWithinLastDays(lead.created_at, 7)).length,
    unanswered: leads.filter((lead) => !lead.responsible_user).length,
    unansweredThisWeek: leads.filter((lead) => !lead.responsible_user && isWithinLastDays(lead.created_at, 7)).length,
    inProgress: leads.filter((lead) => ["contacted", "in_progress"].includes(lead.status)).length,
    inProgressThisWeek: leads.filter((lead) => ["contacted", "in_progress"].includes(lead.status) && isWithinLastDays(lead.created_at, 7)).length,
    hot: leads.filter((lead) => lead.status === "new" && !lead.responsible_user).length,
    hotThisWeek: leads.filter((lead) => lead.status === "new" && !lead.responsible_user && isWithinLastDays(lead.created_at, 7)).length,
  };
}
