import type { Client, Lead, Service } from "../../../types";
import type { LeadFilter, LeadAiInsight } from "../types";

export function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePhoneDigits(value: string) {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  if (digits.length === 10) return `7${digits}`;
  return digits;
}

export function normalizePhoneSearchInput(value: string) {
  const trimmed = value.trim();
  const digits = phoneDigits(trimmed);
  if (!digits || /[a-zа-яё]/i.test(trimmed)) return value;
  if (trimmed.startsWith("+")) return value;
  if (digits.length >= 3 && digits.length <= 10) return `+7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  return value;
}

export function fuzzyScore(source: string, query: string) {
  const normalizedSource = source.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ").trim();
  const sourcePhone = normalizePhoneDigits(source);
  const queryPhone = normalizePhoneDigits(query);
  if (queryPhone && sourcePhone) {
    if (sourcePhone === queryPhone) return 1200;
    if (sourcePhone.includes(queryPhone)) return 1000 - Math.max(0, sourcePhone.length - queryPhone.length);
    if (queryPhone.includes(sourcePhone)) return 900 - Math.max(0, queryPhone.length - sourcePhone.length);
  }
  if (!normalizedQuery) return 1;
  if (!normalizedSource) return 0;
  if (normalizedSource === normalizedQuery) return 1000;
  if (normalizedSource.startsWith(normalizedQuery)) return 800 - normalizedSource.length / 100;
  const index = normalizedSource.indexOf(normalizedQuery);
  if (index >= 0) return 600 - index - normalizedSource.length / 100;
  let cursor = 0;
  let score = 300;
  let lastMatch = -1;
  for (const char of normalizedQuery) {
    cursor = normalizedSource.indexOf(char, cursor);
    if (cursor === -1) return 0;
    if (lastMatch >= 0) score -= Math.max(0, cursor - lastMatch - 1);
    lastMatch = cursor;
    cursor += 1;
  }
  return Math.max(1, score - normalizedSource.length / 100);
}

export function fuzzyIncludes(source: string, query: string) {
  return fuzzyScore(source, query) > 0;
}

export function filterAndSortLeads({
  leads,
  clients,
  services,
  aiInsights,
  search,
  source,
  filter,
  userId,
  sortByAi,
}: {
  leads: Lead[];
  clients: Client[];
  services: Service[];
  aiInsights: Map<Lead["id"], LeadAiInsight>;
  search: string;
  source: string;
  filter: LeadFilter;
  userId?: number;
  sortByAi: boolean;
}) {
  const value = search.trim().toLowerCase();
  return leads
    .map((lead) => {
      const client = clients.find((item) => item.id === lead.client);
      const service = services.find((item) => item.id === lead.service);
      const ai = aiInsights.get(lead.id);
      const searchable = [client?.full_name, client?.phone, client?.email, lead.message, service?.name].join(" ");
      return { lead, score: value ? fuzzyScore(searchable, value) : sortByAi ? ai?.score || 1 : 1 };
    })
    .filter(({ lead, score }) => {
      const matchesSearch = !value || score > 0;
      const matchesSource = !source || (source === "website" ? ["website", "landing"].includes(lead.source) : lead.source === source);
      const insight = aiInsights.get(lead.id);
      const matchesFilter =
        filter === "all" ||
        (filter === "new" && lead.status === "new") ||
        (filter === "hot" && lead.status === "new" && !lead.responsible_user) ||
        (filter === "unanswered" && !lead.responsible_user) ||
        (filter === "attention" && Boolean(insight?.stale || (insight?.lossRisk || 0) >= 70)) ||
        (filter === "mine" && Boolean(userId && lead.responsible_user === userId));
      return matchesSearch && matchesSource && matchesFilter;
    })
    .sort((a, b) => b.score - a.score || (sortByAi ? (aiInsights.get(b.lead.id)?.score || 0) - (aiInsights.get(a.lead.id)?.score || 0) : 0) || new Date(b.lead.updated_at).getTime() - new Date(a.lead.updated_at).getTime())
    .map(({ lead }) => lead);
}
