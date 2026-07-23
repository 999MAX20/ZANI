import type React from "react";

import { cn } from "../../../lib/cn";
import type { Client, Lead, Service } from "../../../types";
import {
  sourceLabels,
  statusLabels,
  type LeadAiInsight,
  type Translate,
} from "../types";
import { normalizePhoneDigits } from "./leadFilters";

export function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TruncatedText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("min-w-0", className)}>
      <span className="block max-w-[220px] truncate">{children}</span>
    </span>
  );
}

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "L"
  );
}

export function getClient(lead: Lead, clients: Client[]) {
  const client = clients.find((client) => client.id === lead.client);
  if (client) return client;
  if (!lead.client_name && !lead.client_phone && !lead.client_email)
    return undefined;
  return {
    id: lead.client,
    business: lead.business,
    full_name: lead.client_name || "",
    phone: lead.client_phone || "",
    email: lead.client_email || "",
    whatsapp_id: "",
    telegram_id: "",
    instagram_id: "",
    source: "manual" as const,
    source_detail: "",
    source_context_json: {},
    notes: "",
    created_at: lead.created_at,
    updated_at: lead.updated_at,
  };
}

export function getService(lead: Lead, services: Service[]) {
  const service = services.find((service) => service.id === lead.service);
  if (service || !lead.service || !lead.service_name) return service;
  return {
    id: lead.service,
    business: lead.business,
    name: lead.service_name,
    description: "",
    duration_minutes: 0,
    price_from: null,
    is_active: true,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
  };
}

export function getStatusLabel(status: Lead["status"], t: Translate) {
  return t(statusLabels[status]);
}

export function getSourceLabel(source: string, t: Translate) {
  const label = sourceLabels[source];
  return label ? t(label) : source;
}

export function leadTitle(
  lead: Lead | null | undefined,
  clients: Client[],
  t: Translate,
) {
  if (!lead) return t("leads.selectLead");
  return (
    getClient(lead, clients)?.full_name ||
    t("leads.leadFallback", { id: lead.id })
  );
}

export function nextAction(lead: Lead, t: Translate) {
  if (lead.status === "new") return t("leads.nextActionContactClient");
  if (lead.status === "contacted") return t("leads.nextActionQualifyNeed");
  if (lead.status === "in_progress")
    return t("leads.nextActionCreateDealOrBooking");
  if (lead.status === "appointment_created")
    return t("leads.nextActionControlVisit");
  if (lead.status === "closed") return t("leads.nextActionReviewResult");
  return t("leads.nextActionUnderstandLoss");
}

export function formatRelativeTime(value: string, t: Translate) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 1) return t("leads.justNow");
  if (minutes < 60) return t("leads.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("leads.hoursAgo", { count: hours });
  const days = Math.round(hours / 24);
  return t("leads.daysAgo", { count: days });
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}

export function hoursSince(value: string) {
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000);
}

export function isStaleLead(lead: Lead) {
  return (
    !["closed", "lost"].includes(lead.status) &&
    hoursSince(lead.updated_at) > 72
  );
}

export function leadAiInsight(
  lead: Lead,
  clients: Client[],
  services: Service[],
  allLeads: Lead[],
  t: Translate,
): LeadAiInsight {
  const client = getClient(lead, clients);
  const service = getService(lead, services);
  const ageHours = hoursSince(lead.created_at);
  const idleHours = hoursSince(lead.updated_at);
  const sourceBoost: Record<string, number> = {
    whatsapp: 18,
    instagram: 14,
    telegram: 12,
    website: 10,
    landing: 8,
    manual: 6,
  };
  const statusBoost: Record<Lead["status"], number> = {
    new: 18,
    contacted: 14,
    in_progress: 12,
    appointment_created: 20,
    closed: 6,
    lost: -10,
  };
  const responsePenalty = !lead.responsible_user
    ? Math.min(26, Math.round(idleHours / 2))
    : Math.min(14, Math.round(idleHours / 8));
  const recencyBoost =
    ageHours < 1
      ? 18
      : ageHours < 6
        ? 12
        : ageHours < 24
          ? 8
          : ageHours < 72
            ? 3
            : -5;
  const messageBoost =
    lead.message?.length > 80 ? 7 : lead.message?.length > 20 ? 4 : 0;
  const serviceBoost = service ? 4 : 0;
  const duplicatesByClient = client
    ? clients.filter(
        (item) =>
          item.id !== client.id &&
          ((client.phone &&
            normalizePhoneDigits(item.phone || "") ===
              normalizePhoneDigits(client.phone)) ||
            (client.email &&
              item.email &&
              item.email.toLowerCase() === client.email.toLowerCase())),
      )
    : [];
  const duplicateLeads = client
    ? allLeads.filter(
        (item) =>
          item.id !== lead.id &&
          item.client !== lead.client &&
          duplicatesByClient.some((duplicate) => duplicate.id === item.client),
      )
    : [];
  const duplicatePenalty = duplicateLeads.length ? 8 : 0;
  const score = Math.max(
    0,
    Math.min(
      100,
      48 +
        (sourceBoost[lead.source] || 4) +
        statusBoost[lead.status] +
        recencyBoost +
        messageBoost +
        serviceBoost -
        responsePenalty -
        duplicatePenalty,
    ),
  );
  const lossRisk = Math.max(
    0,
    Math.min(
      100,
      100 -
        score +
        (isStaleLead(lead) ? 22 : 0) +
        (!lead.responsible_user ? 10 : 0),
    ),
  );
  const intent =
    service?.name ||
    (lead.message ? lead.message.slice(0, 80) : getSourceLabel(lead.source, t));
  const recommendation = isStaleLead(lead)
    ? t("leads.aiRecommendationStale")
    : !lead.responsible_user
      ? t("leads.aiRecommendationAssign")
      : score >= 75
        ? t("leads.aiRecommendationCallFast")
        : t("leads.aiRecommendationQualify");
  return {
    score,
    lossRisk,
    stale: isStaleLead(lead),
    duplicateLeads,
    duplicateClients: duplicatesByClient,
    summary: lead.message
      ? lead.message.slice(0, 150)
      : t("leads.aiNoDialogSummary"),
    intent,
    recommendation,
  };
}
