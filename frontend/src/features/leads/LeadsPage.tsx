import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  Archive,
  Bot,
  BriefcaseBusiness,
  CalendarPlus,
  ClipboardList,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleDot,
  Columns3,
  Download,
  Flame,
  Globe2,
  Instagram,
  KanbanSquare,
  Keyboard,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Mic,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Send,
  Share2,
  Table2,
  Undo2,
  UserCheck,
  Users,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import writeXlsxFile from "write-excel-file/browser";

import { clientsApi } from "../../api/clients";
import { getApiErrorMessage } from "../../api/client";
import { fileAttachmentsApi } from "../../api/fileAttachments";
import { leadsApi } from "../../api/leads";
import { tasksApi } from "../../api/tasks";
import { teamApi } from "../../api/team";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { LeadForm } from "../../components/forms/LeadForm";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { ErrorState, PageSkeleton } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import { captureFrontendError, trackFrontendEvent } from "../../lib/monitoring";
import { realtimeIntervals } from "../../lib/realtime";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Client, Id, Lead, Service, Task } from "../../types";
import { useAuth } from "../auth/AuthProvider";

type LeadFilter = "all" | "new" | "hot" | "unanswered" | "mine" | "attention";
type LeadAction = "take" | "contacted" | "deal" | "closed" | "lost" | "reopen" | "assign";
type LeadViewMode = "table" | "kanban";
type LeadColumnKey = "lead" | "phone" | "source" | "ai" | "status" | "priority" | "manager" | "activity" | "next";
type OfflineLeadAction =
  | { id: string; type: "note"; leadId: Id; text: string; createdAt: string }
  | { id: string; type: "task"; leadId: Id; title: string; due_at: string; assignee: string; priority: Task["priority"]; createdAt: string };

type FilterPreset = {
  id: string;
  name: string;
  filter: LeadFilter;
  source: string;
  search: string;
};

type UndoToast = {
  message: string;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
};

type ActionHistoryItem = UndoToast & {
  id: string;
};

type LeadAiInsight = {
  score: number;
  lossRisk: number;
  stale: boolean;
  duplicateLeads: Lead[];
  duplicateClients: Client[];
  summary: string;
  intent: string;
  recommendation: string;
};

const LEADS_PAGE_SIZE = 6;
const LEAD_PRESETS_KEY = "zani_leads_filter_presets";
const LEAD_COLUMNS_KEY = "zani_leads_columns";
const LEAD_COLUMN_ORDER_KEY = "zani_leads_column_order";
const LEAD_OFFLINE_QUEUE_KEY = "zani_leads_offline_queue";
const LEAD_CACHE_KEY = "zani_leads_cache";

const leadFilters: LeadFilter[] = ["all", "new", "hot", "unanswered", "mine", "attention"];
const leadViewModes: LeadViewMode[] = ["table", "kanban"];
const leadColumnOrder: LeadColumnKey[] = ["lead", "phone", "source", "ai", "status", "priority", "manager", "activity", "next"];
const leadColumnWidths: Record<LeadColumnKey, string> = {
  lead: "minmax(220px,1.55fr)",
  phone: "minmax(130px,0.8fr)",
  source: "minmax(115px,0.75fr)",
  ai: "minmax(120px,0.7fr)",
  status: "minmax(120px,0.75fr)",
  priority: "minmax(110px,0.7fr)",
  manager: "minmax(140px,0.75fr)",
  activity: "minmax(130px,0.75fr)",
  next: "minmax(220px,1.2fr)",
};
const defaultVisibleColumns: Record<LeadColumnKey, boolean> = {
  lead: true,
  phone: true,
  source: true,
  ai: true,
  status: true,
  priority: true,
  manager: true,
  activity: true,
  next: true,
};

const kanbanStatuses: Lead["status"][] = ["new", "contacted", "in_progress", "appointment_created", "closed", "lost"];

const statusLabels: Record<Lead["status"], string> = {
  new: "leads.statusNew",
  contacted: "leads.statusContacted",
  in_progress: "leads.statusInProgress",
  appointment_created: "leads.statusAppointmentCreated",
  closed: "leads.statusClosed",
  lost: "leads.statusLost",
};

const statusClass: Record<Lead["status"], string> = {
  new: "bg-amber-50 text-amber-700 ring-amber-200",
  contacted: "bg-blue-50 text-blue-700 ring-blue-200",
  in_progress: "bg-violet-50 text-violet-700 ring-violet-200",
  appointment_created: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-900 text-white ring-slate-900",
  lost: "bg-red-50 text-red-700 ring-red-200",
};

const sourceLabels: Record<string, string> = {
  website: "leads.sourceWebsite",
  landing: "leads.sourceLanding",
  telegram: "leads.sourceTelegram",
  whatsapp: "leads.sourceWhatsApp",
  instagram: "leads.sourceInstagram",
  manual: "leads.sourceManual",
  parser: "leads.sourceParser",
  other: "leads.sourceOther",
};

type Translate = ReturnType<typeof useI18n>["t"];

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1", className)}>{children}</span>;
}

function TruncatedText({ children, className }: { children: React.ReactNode; className?: string }) {
  const text = typeof children === "string" ? children : undefined;
  return (
    <span className={cn("group relative min-w-0", className)} title={text}>
      <span className="block max-w-[220px] truncate">{children}</span>
      {text ? (
        <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-700 shadow-xl group-hover:block">
          {text}
        </span>
      ) : null}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "L";
}

function getClient(lead: Lead, clients: Client[]) {
  return clients.find((client) => client.id === lead.client);
}

function getService(lead: Lead, services: Service[]) {
  return services.find((service) => service.id === lead.service);
}

function getStatusLabel(status: Lead["status"], t: Translate) {
  return t(statusLabels[status]);
}

function getSourceLabel(source: string, t: Translate) {
  const label = sourceLabels[source];
  return label ? t(label) : source;
}

function leadTitle(lead: Lead | null | undefined, clients: Client[], t: Translate) {
  if (!lead) return t("leads.selectLead");
  return getClient(lead, clients)?.full_name || t("leads.leadFallback", { id: lead.id });
}

function nextAction(lead: Lead, t: Translate) {
  if (lead.status === "new") return t("leads.nextActionContactClient");
  if (lead.status === "contacted") return t("leads.nextActionQualifyNeed");
  if (lead.status === "in_progress") return t("leads.nextActionCreateDealOrBooking");
  if (lead.status === "appointment_created") return t("leads.nextActionControlVisit");
  if (lead.status === "closed") return t("leads.nextActionReviewResult");
  return t("leads.nextActionUnderstandLoss");
}

function toDateTimeLocal(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function isWithinLastDays(value: string, days: number) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function formatRelativeTime(value: string, t: Translate) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 1) return t("leads.justNow");
  if (minutes < 60) return t("leads.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("leads.hoursAgo", { count: hours });
  const days = Math.round(hours / 24);
  return t("leads.daysAgo", { count: days });
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function fuzzyIncludes(source: string, query: string) {
  return fuzzyScore(source, query) > 0;
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePhoneDigits(value: string) {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  if (digits.length === 10) return `7${digits}`;
  return digits;
}

function normalizePhoneSearchInput(value: string) {
  const trimmed = value.trim();
  const digits = phoneDigits(trimmed);
  if (!digits || /[a-zа-яё]/i.test(trimmed)) return value;
  if (trimmed.startsWith("+")) return value;
  if (digits.length >= 3 && digits.length <= 10) return `+7${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  return value;
}

function fuzzyScore(source: string, query: string) {
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

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}

function hoursSince(value: string) {
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 3_600_000);
}

function isStaleLead(lead: Lead) {
  return !["closed", "lost"].includes(lead.status) && hoursSince(lead.updated_at) > 72;
}

function leadAiInsight(lead: Lead, clients: Client[], services: Service[], allLeads: Lead[], t: Translate): LeadAiInsight {
  const client = getClient(lead, clients);
  const service = getService(lead, services);
  const ageHours = hoursSince(lead.created_at);
  const idleHours = hoursSince(lead.updated_at);
  const sourceBoost: Record<string, number> = { whatsapp: 18, instagram: 14, telegram: 12, website: 10, landing: 8, manual: 6 };
  const statusBoost: Record<Lead["status"], number> = {
    new: 18,
    contacted: 14,
    in_progress: 12,
    appointment_created: 20,
    closed: 6,
    lost: -10,
  };
  const responsePenalty = !lead.responsible_user ? Math.min(26, Math.round(idleHours / 2)) : Math.min(14, Math.round(idleHours / 8));
  const recencyBoost = ageHours < 1 ? 18 : ageHours < 6 ? 12 : ageHours < 24 ? 8 : ageHours < 72 ? 3 : -5;
  const messageBoost = lead.message?.length > 80 ? 7 : lead.message?.length > 20 ? 4 : 0;
  const serviceBoost = service ? 4 : 0;
  const duplicatesByClient = client
    ? clients.filter((item) => item.id !== client.id && ((client.phone && normalizePhoneDigits(item.phone || "") === normalizePhoneDigits(client.phone)) || (client.email && item.email && item.email.toLowerCase() === client.email.toLowerCase())))
    : [];
  const duplicateLeads = client
    ? allLeads.filter((item) => item.id !== lead.id && item.client !== lead.client && duplicatesByClient.some((duplicate) => duplicate.id === item.client))
    : [];
  const duplicatePenalty = duplicateLeads.length ? 8 : 0;
  const score = Math.max(0, Math.min(100, 48 + (sourceBoost[lead.source] || 4) + statusBoost[lead.status] + recencyBoost + messageBoost + serviceBoost - responsePenalty - duplicatePenalty));
  const lossRisk = Math.max(0, Math.min(100, 100 - score + (isStaleLead(lead) ? 22 : 0) + (!lead.responsible_user ? 10 : 0)));
  const intent = service?.name || (lead.message ? lead.message.slice(0, 80) : getSourceLabel(lead.source, t));
  const recommendation =
    isStaleLead(lead)
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
    summary: lead.message ? lead.message.slice(0, 150) : t("leads.aiNoDialogSummary"),
    intent,
    recommendation,
  };
}

function SourceIcon({ source }: { source: string }) {
  if (source === "whatsapp") return <MessageCircle size={14} />;
  if (source === "telegram") return <Send size={14} />;
  if (source === "instagram") return <Instagram size={14} />;
  if (source === "website" || source === "landing") return <Globe2 size={14} />;
  return <Tag size={14} />;
}

function ManagerAvatar({ name }: { name?: string }) {
  if (!name) return <span className="text-xs font-bold text-slate-500">-</span>;
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-black text-brand-700 ring-1 ring-white" title={name}>
      {initials(name)}
    </span>
  );
}

function LeadQueueItem({
  lead,
  client,
  service,
  selected,
  onClick,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  t,
}: {
  lead: Lead;
  client?: Client;
  service?: Service;
  selected: boolean;
  onClick: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  t: Translate;
}) {
  const title = client?.full_name || t("leads.leadFallback", { id: lead.id });
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);

  function clearLongPress() {
    if (longPressTimer) window.clearTimeout(longPressTimer);
    setLongPressTimer(null);
  }

  return (
    <button
      type="button"
      className={cn(
        "group relative w-full touch-pan-y overflow-hidden border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50",
        selected ? "bg-brand-50/80" : "bg-white",
      )}
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        onLongPress(event);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
        const timer = window.setTimeout(() => onLongPress(event), 520);
        setLongPressTimer(timer);
      }}
      onTouchMove={(event) => {
        if (!touchStart) return;
        const touch = event.touches[0];
        if (Math.abs(touch.clientX - touchStart.x) > 12 || Math.abs(touch.clientY - touchStart.y) > 12) clearLongPress();
      }}
      onTouchEnd={(event) => {
        clearLongPress();
        if (!touchStart) return;
        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = Math.abs(touch.clientY - touchStart.y);
        setTouchStart(null);
        if (deltaY > 45 || Math.abs(deltaX) < 72) return;
        if (deltaX < 0) onSwipeLeft();
        else onSwipeRight();
      }}
      onTouchCancel={() => {
        clearLongPress();
        setTouchStart(null);
      }}
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 hidden w-1 bg-brand-500 group-active:block" />
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black text-brand-700 ring-1 ring-slate-200">
          {initials(title)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-black text-midnight">{title}</p>
            <span className="shrink-0 text-xs font-bold text-slate-400">{formatDateTime(lead.created_at)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-500">
            {client?.phone || t("leads.noPhoneLower")} · {service?.name || getSourceLabel(lead.source, t)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill className={statusClass[lead.status]}>{getStatusLabel(lead.status, t)}</Pill>
            <span className="text-xs font-bold text-slate-400">{nextAction(lead, t)}</span>
          </div>
          <p className="mt-2 text-[11px] font-bold text-slate-400 lg:hidden">{t("leads.mobileSwipeHint")}</p>
        </div>
      </div>
    </button>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  delta,
  tone = "brand",
}: {
  icon: typeof Users;
  label: string;
  value: React.ReactNode;
  delta?: string;
  tone?: "brand" | "green" | "amber" | "blue" | "pink";
}) {
  const toneClass = {
    brand: "bg-brand-50 text-brand-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-orange-50 text-orange-700",
    blue: "bg-sky-50 text-sky-700",
    pink: "bg-rose-50 text-rose-700",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", toneClass)}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
          <div className="mt-1 flex items-end gap-2">
            <p className="text-2xl font-bold leading-none text-midnight">{value}</p>
            {delta ? <span className="text-xs font-bold text-emerald-600">{delta}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source, t }: { source: string; t: Translate }) {
  const sourceTone: Record<string, string> = {
    whatsapp: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    telegram: "bg-sky-50 text-sky-700 ring-sky-100",
    instagram: "bg-pink-50 text-pink-700 ring-pink-100",
    website: "bg-slate-50 text-slate-700 ring-slate-200",
    landing: "bg-violet-50 text-violet-700 ring-violet-100",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold ring-1", sourceTone[source] || "bg-slate-50 text-slate-600 ring-slate-200")}>
      <SourceIcon source={source} />
      {getSourceLabel(source, t)}
    </span>
  );
}

function LeadTableRow({
  lead,
  client,
  service,
  responsibleName,
  aiInsight,
  teamList,
  selected,
  bulkSelected,
  visibleColumns,
  columnOrder,
  onClick,
  onToggleBulk,
  onStatusChange,
  onAssign,
  onCall,
  onWhatsApp,
  onTask,
  onContextMenu,
  t,
}: {
  lead: Lead;
  client?: Client;
  service?: Service;
  responsibleName?: string;
  aiInsight: LeadAiInsight;
  teamList: Array<{ user: { id: Id; full_name?: string; email: string } }>;
  selected: boolean;
  bulkSelected: boolean;
  visibleColumns: Record<LeadColumnKey, boolean>;
  columnOrder: LeadColumnKey[];
  onClick: () => void;
  onToggleBulk: () => void;
  onStatusChange: (status: Lead["status"]) => void;
  onAssign: (userId?: Id) => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onTask: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  t: Translate;
}) {
  const title = client?.full_name || t("leads.leadFallback", { id: lead.id });
  const isHot = lead.status === "new" && !lead.responsible_user;
  const activeColumns = columnOrder.filter((column) => visibleColumns[column]);
  const gridTemplateColumns = `36px ${activeColumns.map((column) => leadColumnWidths[column]).join(" ")} 92px`;
  const cells: Record<LeadColumnKey, React.ReactNode> = {
    lead: (
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-xs font-black text-brand-700">
          {initials(title)}
        </span>
        <span className="min-w-0">
          <TruncatedText className="font-bold text-midnight">{title}</TruncatedText>
          <TruncatedText className="text-xs font-semibold text-slate-400">{service?.name || getSourceLabel(lead.source, t)}</TruncatedText>
        </span>
      </span>
    ),
    phone: <span className="truncate font-semibold text-slate-700">{client?.phone || t("leads.noPhoneLower")}</span>,
    source: <span><SourceBadge source={lead.source} t={t} /></span>,
    ai: (
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2 text-xs font-black text-midnight">
          <span>{aiInsight.score}</span>
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", aiInsight.lossRisk >= 70 ? "bg-red-50 text-red-700" : aiInsight.score >= 75 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
            {aiInsight.lossRisk >= 70 ? t("leads.aiRiskShort") : t("leads.aiScoreShort")}
          </span>
        </span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
          <span className={cn("block h-full rounded-full", aiInsight.score >= 75 ? "bg-emerald-500" : aiInsight.score >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${aiInsight.score}%` }} />
        </span>
      </span>
    ),
    status: (
      <span onClick={(event) => event.stopPropagation()}>
        <select
          className={cn("max-w-[118px] rounded-full border-0 px-2.5 py-1 text-xs font-black outline-none ring-1", statusClass[lead.status])}
          value={lead.status}
          onChange={(event) => onStatusChange(event.target.value as Lead["status"])}
          aria-label={t("leads.tableStatus")}
        >
          {kanbanStatuses.map((status) => (
            <option key={status} value={status}>{getStatusLabel(status, t)}</option>
          ))}
        </select>
      </span>
    ),
    priority: (
      <span className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", isHot ? "bg-red-500" : lead.status === "new" ? "bg-amber-400" : "bg-emerald-500")} />
        <span className="text-xs font-bold text-slate-600">{isHot ? t("leads.priorityHot") : t("leads.priorityNormal")}</span>
      </span>
    ),
    manager: (
      <span className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <ManagerAvatar name={responsibleName} />
        <select
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent text-xs font-bold text-slate-600 outline-none hover:border-slate-200 hover:bg-white"
          value={lead.responsible_user ? String(lead.responsible_user) : ""}
          onChange={(event) => onAssign(event.target.value ? Number(event.target.value) : undefined)}
          aria-label={t("leads.responsible")}
        >
          <option value="">{t("leads.withoutManager")}</option>
          {teamList.map((member) => (
            <option key={member.user.id} value={member.user.id}>{member.user.full_name || member.user.email}</option>
          ))}
        </select>
      </span>
    ),
    activity: <span className="truncate text-xs font-bold text-slate-600">{formatRelativeTime(lead.updated_at, t)}</span>,
    next: (
      <span className="min-w-0">
        <TruncatedText className="font-bold text-slate-700">{nextAction(lead, t)}</TruncatedText>
        <span className="block truncate text-xs text-slate-400">{formatDateTime(lead.updated_at)}</span>
      </span>
    ),
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group grid min-w-[1180px] items-center border-b border-slate-100 px-4 py-3 text-left text-sm transition hover:bg-slate-50",
        selected && "bg-brand-50/70 shadow-[inset_3px_0_0_#2563eb]",
        bulkSelected && "bg-slate-50",
        aiInsight.stale && !selected && "bg-amber-50/35",
      )}
      style={{ gridTemplateColumns }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      onContextMenu={onContextMenu}
    >
      <label className="flex h-8 w-8 items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <input className="sr-only" type="checkbox" checked={bulkSelected} onChange={onToggleBulk} aria-label={t("leads.selectLeadRow")} />
        <span className={cn("grid h-5 w-5 place-items-center rounded border", bulkSelected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white")}>
          {bulkSelected ? <CheckCheck size={13} /> : null}
        </span>
      </label>
      {activeColumns.map((column) => <span key={column} className="min-w-0">{cells[column]}</span>)}
      <span className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="hidden h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-brand-700 group-hover:grid" onClick={onCall} aria-label={t("leads.call")}>
          <Phone size={16} />
        </button>
        <button type="button" className="hidden h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-emerald-700 group-hover:grid" onClick={onWhatsApp} aria-label="WhatsApp">
          <MessageCircle size={16} />
        </button>
        <button type="button" className="hidden h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-midnight group-hover:grid" onClick={onTask} aria-label={t("leads.createTask")}>
          <ClipboardList size={16} />
        </button>
        <span className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 group-hover:hidden">
          <MoreHorizontal size={18} />
        </span>
      </span>
    </div>
  );
}

function VirtualizedLeadTableRows({
  rows,
  selected,
  selectedLeadIds,
  clientList,
  serviceList,
  teamList,
  aiInsights,
  allLeads,
  visibleColumns,
  columnOrder,
  openLead,
  toggleBulkLead,
  changeLeadStatus,
  assignLead,
  callLead,
  whatsAppLead,
  createTaskForLead,
  openContextMenu,
  t,
}: {
  rows: Lead[];
  selected: Lead | null;
  selectedLeadIds: Id[];
  clientList: Client[];
  serviceList: Service[];
  teamList: Array<{ user: { id: Id; full_name?: string; email: string } }>;
  aiInsights: Map<Id, LeadAiInsight>;
  allLeads: Lead[];
  visibleColumns: Record<LeadColumnKey, boolean>;
  columnOrder: LeadColumnKey[];
  openLead: (lead: Lead) => void;
  toggleBulkLead: (id: Id) => void;
  changeLeadStatus: (lead: Lead, status: Lead["status"]) => void;
  assignLead: (lead: Lead, userId?: Id) => void;
  callLead: (lead: Lead) => void;
  whatsAppLead: (lead: Lead) => void;
  createTaskForLead: (lead: Lead) => void;
  openContextMenu: (event: React.MouseEvent, lead: Lead) => void;
  t: Translate;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 66,
    overscan: 6,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="hidden h-full overflow-auto lg:block">
      <div className="relative min-w-[1180px]" style={{ height: rowVirtualizer.getTotalSize() }}>
        {virtualItems.map((virtualRow) => {
          const lead = rows[virtualRow.index];
          if (!lead) return null;
          const responsible = teamList.find((member) => member.user.id === lead.responsible_user);
          return (
            <div
              key={lead.id}
              className="absolute left-0 right-0 top-0"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
            >
              <LeadTableRow
                lead={lead}
                client={getClient(lead, clientList)}
                service={getService(lead, serviceList)}
                responsibleName={responsible?.user.full_name || responsible?.user.email}
                aiInsight={aiInsights.get(lead.id) || leadAiInsight(lead, clientList, serviceList, allLeads, t)}
                teamList={teamList}
                selected={lead.id === selected?.id}
                bulkSelected={selectedLeadIds.includes(lead.id)}
                visibleColumns={visibleColumns}
                columnOrder={columnOrder}
                onClick={() => openLead(lead)}
                onToggleBulk={() => toggleBulkLead(lead.id)}
                onStatusChange={(status) => changeLeadStatus(lead, status)}
                onAssign={(userId) => assignLead(lead, userId)}
                onCall={() => callLead(lead)}
                onWhatsApp={() => whatsAppLead(lead)}
                onTask={() => createTaskForLead(lead)}
                onContextMenu={(event) => openContextMenu(event, lead)}
                t={t}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeadDetailPanel({
  selected,
  selectedClient,
  selectedService,
  selectedNextTask,
  selectedDeals,
  selectedAppointments,
  selectedConversations,
  aiInsight,
  clientList,
  teamList,
  priorityLead,
  actionMutation,
  mergeClientMutation,
  noteMutation,
  openLead,
  onWhatsAppTemplate,
  setAppointmentOpen,
  setLostLead,
  setLostReason,
  setNextActionOpen,
  setDrawerEntity,
  onClose,
  collapsed,
  onToggleCollapsed,
  t,
}: {
  selected: Lead;
  selectedClient?: Client;
  selectedService?: Service;
  selectedNextTask?: Task;
  selectedDeals: unknown[];
  selectedAppointments: unknown[];
  selectedConversations: unknown[];
  aiInsight: LeadAiInsight;
  clientList: Client[];
  teamList: Array<{ user: { id: Id; full_name?: string; email: string } }>;
  priorityLead: Lead | null;
  actionMutation: {
    mutate: (variables: { action: LeadAction; lead: Lead; user_id?: Id; lost_reason?: string }) => void;
    isPending: boolean;
  };
  mergeClientMutation: {
    mutate: (variables: { targetId: Id; duplicateId: Id }) => void;
    isPending: boolean;
  };
  noteMutation: {
    mutate: (variables: { lead: Lead; text: string; files: File[] }) => void;
    isPending: boolean;
  };
  openLead: (lead: Lead) => void;
  onWhatsAppTemplate: (lead: Lead, template?: string) => void;
  setAppointmentOpen: (value: boolean) => void;
  setLostLead: (lead: Lead) => void;
  setLostReason: (value: string) => void;
  setNextActionOpen: (value: boolean) => void;
  setDrawerEntity: (entity: CrmDrawerEntity | null) => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  t: Translate;
}) {
  const [noteDraft, setNoteDraft] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<{ stop: () => void } | null>(null);
  const templates = [
    { id: "greeting", label: t("leads.templateGreeting"), text: t("leads.templateGreetingText") },
    { id: "price", label: t("leads.templatePrice"), text: t("leads.templatePriceText") },
    { id: "booking", label: t("leads.templateBooking"), text: t("leads.templateBookingText") },
  ];
  const mentionQuery = noteDraft.match(/@([\p{L}\d._-]*)$/u)?.[1]?.toLowerCase() ?? null;
  const templateQuery = noteDraft.match(/(?:^|\s)\/([\p{L}\d_-]*)$/u)?.[1]?.toLowerCase() ?? null;
  const mentionSuggestions = mentionQuery === null ? [] : teamList
    .filter((member) => fuzzyIncludes(`${member.user.full_name || ""} ${member.user.email}`, mentionQuery))
    .slice(0, 4);
  const templateSuggestions = templateQuery === null ? [] : templates
    .filter((template) => fuzzyIncludes(`${template.label} ${template.text}`, templateQuery))
    .slice(0, 4);

  function replaceCommand(pattern: RegExp, value: string) {
    setNoteDraft((current) => current.replace(pattern, value));
  }

  function submitNote() {
    const mentions = Array.from(new Set((noteDraft.match(/@[\p{L}\d._-]+/gu) || []).map((item) => item.trim())));
    const mentionsText = mentions.length ? `\n\n${t("leads.mentions")}: ${mentions.join(", ")}` : "";
    noteMutation.mutate({ lead: selected, text: `${noteDraft.trim()}${mentionsText}`, files: attachedFiles });
    setNoteDraft("");
    setAttachedFiles([]);
  }

  async function startVoiceNote() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNoteDraft((value) => `${value}${value ? "\n" : ""}${t("leads.voiceUnsupported")}`);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    voiceChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) voiceChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const file = new File([blob], `lead-${selected.id}-voice-${Date.now()}.webm`, { type: blob.type });
      setAttachedFiles((value) => [...value, file].slice(0, 6));
      setNoteDraft((value) => value || t("leads.voiceNoteAttached"));
      stream.getTracks().forEach((track) => track.stop());
    };
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null; start: () => void; stop: () => void }; webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null; start: () => void; stop: () => void } }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null; start: () => void; stop: () => void } }).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "ru-RU";
      recognition.onresult = (event) => {
        const text = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
        if (text) setNoteDraft(text);
      };
      recognition.start();
      speechRecognitionRef.current = recognition;
    }
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stopVoiceNote() {
    speechRecognitionRef.current?.stop();
    speechRecognitionRef.current = null;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  if (collapsed) {
    return (
      <div className="flex h-full w-16 flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white py-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-200">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={onToggleCollapsed} aria-label={t("leads.expandPanel")}>
          <ChevronLeft size={18} />
        </Button>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-xs font-black text-brand-700">{initials(leadTitle(selected, clientList, t))}</span>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" disabled={!selectedClient?.phone} onClick={() => selectedClient?.phone && (window.location.href = `tel:${selectedClient.phone}`)}>
          <Phone size={17} />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={() => setNextActionOpen(true)}>
          <ClipboardList size={17} />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={() => setDrawerEntity({ type: "lead", id: selected.id })}>
          <MoreHorizontal size={17} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-96 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-200">
      <div className="shrink-0 border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-midnight" title={leadTitle(selected, clientList, t)}>{leadTitle(selected, clientList, t)}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill className={statusClass[selected.status]}>{getStatusLabel(selected.status, t)}</Pill>
              <SourceBadge source={selected.source} t={t} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onToggleCollapsed ? (
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={onToggleCollapsed} aria-label={t("leads.collapsePanel")}>
                <ChevronRight size={18} />
              </Button>
            ) : null}
            {onClose ? (
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={onClose}>
                <XCircle size={18} />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
          <div className="flex min-w-0 items-center gap-2"><Phone size={16} /> <span className="truncate">{selectedClient?.phone || t("leads.phoneMissing")}</span></div>
          <div className="flex min-w-0 items-center gap-2"><Mail size={16} /> <span className="truncate">{selectedClient?.email || t("leads.emailMissing")}</span></div>
          <div className="flex min-w-0 items-center gap-2"><Tag size={16} /> <span className="truncate">{selectedService?.name || getSourceLabel(selected.source, t)}</span></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="rounded-lg px-2 text-xs" disabled={!selectedClient?.phone} onClick={() => selectedClient?.phone && (window.location.href = `tel:${selectedClient.phone}`)}>
            <Phone size={15} /> {t("leads.call")}
          </Button>
          <Button
            variant="secondary"
            className="rounded-lg px-2 text-xs"
            disabled={!selectedClient?.phone}
            onClick={() => onWhatsAppTemplate(selected)}
          >
            <MessageCircle size={15} /> WhatsApp
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pr-2">
        <section className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-brand-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-black text-midnight"><Bot size={16} /> {t("leads.aiPriorityTitle")}</p>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-brand-700">{aiInsight.score}/100</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <span className={cn("block h-full rounded-full", aiInsight.score >= 75 ? "bg-emerald-500" : aiInsight.score >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${aiInsight.score}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{aiInsight.recommendation}</p>
          <p className="mt-2 text-xs font-black text-red-700">{t("leads.aiLossRisk", { value: aiInsight.lossRisk })}</p>
          <Button className="mt-3 w-full justify-center rounded-lg bg-brand-600" onClick={() => priorityLead && openLead(priorityLead)} disabled={!priorityLead}>
            <Phone size={15} /> {t("leads.callNow")}
          </Button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.aiConversationSummary")}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-midnight">{aiInsight.summary}</p>
          <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600">
            <p><span className="font-black text-slate-400">{t("leads.aiIntent")}:</span> {aiInsight.intent}</p>
            <p><span className="font-black text-slate-400">{t("leads.aiNextBestAction")}:</span> {aiInsight.recommendation}</p>
          </div>
        </section>

        {(aiInsight.stale || aiInsight.duplicateClients.length) ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-black text-amber-900">{aiInsight.stale ? t("leads.staleLeadTitle") : t("leads.duplicatesTitle")}</p>
            {aiInsight.stale ? <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">{t("leads.staleLeadText")}</p> : null}
            {aiInsight.duplicateClients.length ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">{t("leads.duplicatesText", { count: aiInsight.duplicateClients.length })}</p>
                {aiInsight.duplicateClients.slice(0, 3).map((duplicate) => (
                  <div key={duplicate.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-2">
                    <span className="min-w-0 truncate text-xs font-bold text-midnight">{duplicate.full_name}</span>
                    {selectedClient ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 rounded-lg px-2 text-xs"
                        isLoading={mergeClientMutation.isPending}
                        onClick={() => mergeClientMutation.mutate({ targetId: selectedClient.id, duplicateId: duplicate.id })}
                      >
                        {t("leads.mergeDuplicate")}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.clientRequest")}</p>
          <p className="mt-2 line-clamp-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">{selected.message || t("leads.noLeadComment")}</p>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.control")}</p>
          <Select
            label={t("leads.responsible")}
            value={selected.responsible_user ? String(selected.responsible_user) : ""}
            onChange={(event) => actionMutation.mutate({ action: "assign", lead: selected, user_id: event.target.value ? Number(event.target.value) : undefined })}
            options={[
              { value: "", label: t("leads.assignToMe") },
              ...teamList.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            {selected.status === "new" ? (
              <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => actionMutation.mutate({ action: "contacted", lead: selected })} isLoading={actionMutation.isPending}>
                <CheckCheck size={16} /> {t("leads.contacted")}
              </Button>
            ) : null}
            {["new", "contacted", "lost"].includes(selected.status) ? (
              <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => actionMutation.mutate({ action: "take", lead: selected })} isLoading={actionMutation.isPending}>
                <UserCheck size={16} /> {t("leads.takeWork")}
              </Button>
            ) : null}
            {!["closed", "lost"].includes(selected.status) ? (
              <>
                <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => setAppointmentOpen(true)}>
                  <CalendarPlus size={16} /> {t("leads.book")}
                </Button>
                <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => actionMutation.mutate({ action: "closed", lead: selected })} isLoading={actionMutation.isPending}>
                  <CheckCheck size={16} /> {t("leads.success")}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-lg px-2 text-xs"
                  onClick={() => {
                    setLostLead(selected);
                    setLostReason(selected.lost_reason || "");
                  }}
                  isLoading={actionMutation.isPending}
                >
                  <XCircle size={16} /> {t("leads.lost")}
                </Button>
              </>
            ) : (
              <Button variant="secondary" className="rounded-lg px-2 text-xs" onClick={() => actionMutation.mutate({ action: "reopen", lead: selected })} isLoading={actionMutation.isPending}>
                <CircleDot size={16} /> {t("leads.reopen")}
              </Button>
            )}
          </div>
        </section>

        <section>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.history")}</p>
            <div className="mt-3 space-y-3">
              <div className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-midnight">{t("leads.leadCreated")}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(selected.created_at)}</p>
                </div>
              </div>
              {selectedNextTask ? (
                <div className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <div className="min-w-0">
                    <TruncatedText className="text-sm font-bold text-midnight">{selectedNextTask.title}</TruncatedText>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(selectedNextTask.due_at)}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.nextStep")}</p>
          <TruncatedText className="mt-2 text-sm font-bold text-midnight">{nextAction(selected, t)}</TruncatedText>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(selected.updated_at)}</p>
        </section>

        <section>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.quickActions")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-14 flex-col rounded-xl px-1 text-xs" disabled={!selectedClient?.phone} onClick={() => selectedClient?.phone && (window.location.href = `tel:${selectedClient.phone}`)}>
              <Phone size={16} /> {t("leads.call")}
            </Button>
            <Button
              variant="secondary"
              className="h-14 flex-col rounded-xl px-1 text-xs"
              disabled={!selectedClient?.phone}
              onClick={() => onWhatsAppTemplate(selected)}
            >
              <MessageCircle size={16} /> WhatsApp
            </Button>
            <Button className="h-14 flex-col rounded-xl px-1 text-xs" onClick={() => actionMutation.mutate({ action: "deal", lead: selected })} isLoading={actionMutation.isPending}>
              <CircleDollarSign size={16} /> {t("leads.deal")}
            </Button>
            <Button variant="secondary" className="h-14 flex-col rounded-xl px-1 text-xs" onClick={() => setNextActionOpen(true)}>
              <ClipboardList size={16} /> {t("leads.task")}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.internalNotes")}</p>
          <div className="relative">
            <textarea
              className="mt-3 min-h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-brand-300 focus:bg-white"
              placeholder={t("leads.notePlaceholder")}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            {mentionSuggestions.length || templateSuggestions.length ? (
              <div className="absolute inset-x-2 top-full z-20 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {mentionSuggestions.map((member) => (
                  <button
                    key={member.user.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                    onClick={() => replaceCommand(/@([\p{L}\d._-]*)$/u, `@${(member.user.full_name || member.user.email).replace(/\s+/g, "_")} `)}
                  >
                    <span className="truncate">{member.user.full_name || member.user.email}</span>
                    <span className="text-xs text-slate-400">@</span>
                  </button>
                ))}
                {templateSuggestions.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50"
                    onClick={() => replaceCommand(/(?:^|\s)\/([\p{L}\d_-]*)$/u, ` ${template.text}`)}
                  >
                    {template.label}
                    <span className="block truncate text-xs font-semibold text-slate-400">{template.text}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {attachedFiles.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachedFiles.map((file) => (
                <span key={`${file.name}-${file.size}`} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-slate-400">{formatFileSize(file.size)}</span>
                  <button type="button" className="shrink-0 text-slate-400 hover:text-red-600" onClick={() => setAttachedFiles((value) => value.filter((item) => item !== file))}>
                    <XCircle size={13} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer text-xs font-bold text-brand-700 hover:text-brand-800">
                {t("leads.attachFiles")}
                <input
                  className="sr-only"
                  type="file"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    setAttachedFiles((value) => [...value, ...files].slice(0, 6));
                    event.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                className={cn("inline-flex items-center gap-1 text-xs font-bold", recording ? "text-red-600" : "text-brand-700 hover:text-brand-800")}
                onClick={recording ? stopVoiceNote : startVoiceNote}
              >
                <Mic size={14} /> {recording ? t("leads.voiceStop") : t("leads.voiceRecord")}
              </button>
            </div>
            <Button
              size="sm"
              className="rounded-lg"
              disabled={!noteDraft.trim() && !attachedFiles.length}
              isLoading={noteMutation.isPending}
              onClick={submitNote}
            >
              {t("leads.addNote")}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.templates")}</p>
          <div className="mt-3 grid gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-midnight hover:border-brand-200 hover:bg-brand-50"
                onClick={() => onWhatsAppTemplate(selected, template.text)}
              >
                {template.label}
                <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{template.text}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-base font-black text-midnight">{selectedDeals.length}</p>
            <p className="truncate text-[10px] font-bold text-slate-400">{t("leads.relatedDeals")}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-base font-black text-midnight">{selectedAppointments.length}</p>
            <p className="truncate text-[10px] font-bold text-slate-400">{t("leads.relatedBookings")}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2">
            <p className="text-base font-black text-midnight">{selectedConversations.length}</p>
            <p className="truncate text-[10px] font-bold text-slate-400">{t("leads.relatedConversations")}</p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Button className="justify-center rounded-lg" variant="secondary" onClick={() => setDrawerEntity({ type: "lead", id: selected.id })}>
            {t("leads.fullCard")}
          </Button>
          <Button className="justify-center rounded-lg bg-brand-600" onClick={() => priorityLead && openLead(priorityLead)} disabled={!priorityLead}>
            {t("leads.callNow")}
          </Button>
        </div>

        {selected.lost_reason ? (
          <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
            <AlertTriangle aria-hidden="true" size={16} className="mb-2" />
            {selected.lost_reason}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function LeadsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const { clients, services, resources, leads, tasks, deals, appointments, botConversations } = useEntityData({
    clients: true,
    services: true,
    resources: true,
    leads: true,
    tasks: true,
    deals: true,
    appointments: true,
    botConversations: true,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(searchParams.get("lead")) || null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "1");
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [filter, setFilter] = useState<LeadFilter>(() => {
    const param = searchParams.get("filter") as LeadFilter | null;
    return param && leadFilters.includes(param) ? param : "all";
  });
  const [source, setSource] = useState(searchParams.get("source") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState<LeadViewMode>(() => {
    const param = searchParams.get("view") as LeadViewMode | null;
    return param && leadViewModes.includes(param) ? param : "table";
  });
  const [sortByAi, setSortByAi] = useState(true);
  const [assignmentMode, setAssignmentMode] = useState<"round_robin" | "workload" | "specialization" | "language">("workload");
  const [page, setPage] = useState(1);
  const [pageDraft, setPageDraft] = useState("1");
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Id[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lead: Lead } | null>(null);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => loadJson<FilterPreset[]>(LEAD_PRESETS_KEY, []));
  const [presetName, setPresetName] = useState("");
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<LeadColumnKey, boolean>>(() => ({
    ...defaultVisibleColumns,
    ...loadJson<Partial<Record<LeadColumnKey, boolean>>>(LEAD_COLUMNS_KEY, {}),
  }));
  const [columnOrder, setColumnOrder] = useState<LeadColumnKey[]>(() => {
    const saved = loadJson<LeadColumnKey[]>(LEAD_COLUMN_ORDER_KEY, leadColumnOrder);
    return [...saved.filter((column): column is LeadColumnKey => leadColumnOrder.includes(column)), ...leadColumnOrder.filter((column) => !saved.includes(column))];
  });
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [undoStack, setUndoStack] = useState<ActionHistoryItem[]>([]);
  const [redoStack, setRedoStack] = useState<ActionHistoryItem[]>([]);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineLeadAction[]>(() => loadJson<OfflineLeadAction[]>(LEAD_OFFLINE_QUEUE_KEY, []));
  const [cachedLeads, setCachedLeads] = useState<Lead[]>(() => loadJson<Lead[]>(LEAD_CACHE_KEY, []));
  const [notice, setNotice] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [nextActionDraft, setNextActionDraft] = useState({
    title: t("leads.nextActionContactClient"),
    due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    assignee: "",
    priority: "normal" as Task["priority"],
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const knownLeadIdsRef = useRef<Set<Id> | null>(null);

  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
    retry: false,
  });

  const allLeads = leads.data?.length ? leads.data : (!isOnline ? cachedLeads : leads.data || []);
  const clientList = clients.data || [];
  const serviceList = services.data || [];
  const taskList = tasks.data || [];
  const dealList = deals.data || [];
  const appointmentList = appointments.data || [];
  const conversationList = botConversations.data || [];
  const teamList = Array.isArray(teamMembers.data) ? teamMembers.data : [];
  const aiInsights = useMemo(() => {
    const result = new Map<Id, LeadAiInsight>();
    allLeads.forEach((lead) => result.set(lead.id, leadAiInsight(lead, clientList, serviceList, allLeads, t)));
    return result;
  }, [allLeads, clientList, serviceList, t]);

  const rows = useMemo(() => {
    const value = search.trim().toLowerCase();
    return allLeads
      .map((lead) => {
        const client = getClient(lead, clientList);
        const service = getService(lead, serviceList);
        const ai = aiInsights.get(lead.id);
        const searchable = [client?.full_name, client?.phone, client?.email, lead.message, service?.name].join(" ");
        return { lead, score: value ? fuzzyScore(searchable, value) : sortByAi ? ai?.score || 1 : 1 };
      })
      .filter(({ lead, score }) => {
        const matchesSearch = !value || score > 0;
        const matchesSource = !source || (source === "website" ? ["website", "landing"].includes(lead.source) : lead.source === source);
        const matchesFilter =
          filter === "all" ||
          (filter === "new" && lead.status === "new") ||
          (filter === "hot" && lead.status === "new" && !lead.responsible_user) ||
          (filter === "unanswered" && !lead.responsible_user) ||
          (filter === "attention" && Boolean(aiInsights.get(lead.id)?.stale || (aiInsights.get(lead.id)?.lossRisk || 0) >= 70)) ||
          (filter === "mine" && Boolean(user?.id && lead.responsible_user === user.id));
        return matchesSearch && matchesSource && matchesFilter;
      })
      .sort((a, b) => b.score - a.score || (sortByAi ? (aiInsights.get(b.lead.id)?.score || 0) - (aiInsights.get(a.lead.id)?.score || 0) : 0) || new Date(b.lead.updated_at).getTime() - new Date(a.lead.updated_at).getTime())
      .map(({ lead }) => lead);
  }, [aiInsights, allLeads, clientList, filter, search, serviceList, sortByAi, source, user?.id]);

  const pageCount = Math.max(1, Math.ceil(rows.length / LEADS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => rows.slice((safePage - 1) * LEADS_PAGE_SIZE, safePage * LEADS_PAGE_SIZE), [rows, safePage]);
  const selected = useMemo(() => rows.find((lead) => lead.id === selectedId) || pageRows[0] || null, [pageRows, rows, selectedId]);
  const selectedClient = selected ? getClient(selected, clientList) : undefined;
  const selectedService = selected ? getService(selected, serviceList) : undefined;
  const selectedTasks = selected
    ? taskList
        .filter((task) => task.lead === selected.id && !["done", "cancelled"].includes(task.status))
        .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")))
    : [];
  const selectedNextTask = selectedTasks[0];
  const selectedDeals = selected ? dealList.filter((deal) => deal.lead === selected.id || deal.client === selected.client) : [];
  const selectedAppointments = selected ? appointmentList.filter((appointment) => appointment.lead === selected.id || appointment.client === selected.client) : [];
  const selectedConversations = selected ? conversationList.filter((conversation) => conversation.lead === selected.id || conversation.client === selected.client) : [];
  const duplicateCheck = useQuery({
    queryKey: ["lead-duplicates", business?.id, selected?.id, selectedClient?.phone, selectedClient?.email],
    queryFn: () =>
      leadsApi.checkDuplicates({
        business: business!.id,
        client: selectedClient?.id,
        phone: selectedClient?.phone,
        email: selectedClient?.email,
      }),
    enabled: Boolean(business && selectedClient && (selectedClient.phone || selectedClient.email)),
    retry: false,
  });
  const selectedAiInsight = useMemo(() => {
    if (!selected) return null;
    const base = aiInsights.get(selected.id) || leadAiInsight(selected, clientList, serviceList, allLeads, t);
    const serverDuplicates = (duplicateCheck.data?.duplicates || []).map((duplicate) => {
      const existing = clientList.find((client) => client.id === duplicate.id);
      if (existing) return existing;
      return {
        id: duplicate.id,
        business: business?.id || selected.business,
        full_name: duplicate.full_name,
        phone: duplicate.phone,
        email: duplicate.email,
        whatsapp_id: "",
        telegram_id: "",
        instagram_id: "",
        source: "manual" as const,
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
  }, [aiInsights, allLeads, business?.id, clientList, duplicateCheck.data?.duplicates, selected, serviceList, t]);

  const searchSuggestions = useMemo(() => {
    const value = search.trim();
    if (value.length < 2) return [];
    const leadSuggestions = allLeads
      .map((lead) => {
        const client = getClient(lead, clientList);
        const service = getService(lead, serviceList);
        const label = client?.full_name || t("leads.leadFallback", { id: lead.id });
        const meta = service?.name || getSourceLabel(lead.source, t);
        return { id: `lead-${lead.id}`, type: t("leads.suggestionLead"), label, meta, lead, score: fuzzyScore(`${label} ${meta}`, value) };
      })
      .filter((item) => item.score > 0);
    const clientSuggestions = clientList
      .map((client) => {
        const meta = client.phone || client.email || "";
        return { id: `client-${client.id}`, type: t("leads.suggestionClient"), label: client.full_name, meta, lead: undefined, score: fuzzyScore(`${client.full_name} ${meta}`, value) };
      })
      .filter((item) => item.score > 0);
    const serviceSuggestions = serviceList
      .map((service) => ({ id: `service-${service.id}`, type: t("leads.suggestionService"), label: service.name, meta: "", lead: undefined, score: fuzzyScore(service.name, value) }))
      .filter((item) => item.score > 0);
    return [...leadSuggestions, ...clientSuggestions, ...serviceSuggestions].sort((a, b) => b.score - a.score).slice(0, 7);
  }, [allLeads, clientList, search, serviceList, t]);

  useEffect(() => {
    setPage(1);
  }, [filter, search, source]);

  useEffect(() => {
    setCreateOpen(searchParams.get("create") === "1");
  }, [searchParams]);

  useEffect(() => {
    const leadId = Number(searchParams.get("lead"));
    if (Number.isFinite(leadId) && leadId > 0) setSelectedId(leadId);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedId) return;
    const index = rows.findIndex((lead) => lead.id === selectedId);
    if (index >= 0) setPage(Math.floor(index / LEADS_PAGE_SIZE) + 1);
  }, [rows, selectedId]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    setPageDraft(String(safePage));
  }, [safePage]);

  useEffect(() => {
    saveJson(LEAD_PRESETS_KEY, filterPresets);
  }, [filterPresets]);

  useEffect(() => {
    saveJson(LEAD_COLUMNS_KEY, visibleColumns);
  }, [visibleColumns]);

  useEffect(() => {
    saveJson(LEAD_COLUMN_ORDER_KEY, columnOrder);
  }, [columnOrder]);

  useEffect(() => {
    if (!undoToast) return;
    const timer = window.setTimeout(() => setUndoToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undoToast]);

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine);
    }
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (leads.data?.length) {
      setCachedLeads(leads.data);
      saveJson(LEAD_CACHE_KEY, leads.data.slice(0, 50));
    }
  }, [leads.data]);

  useEffect(() => {
    saveJson(LEAD_OFFLINE_QUEUE_KEY, offlineQueue);
  }, [offlineQueue]);

  useEffect(() => {
    if (!isOnline || !business || !offlineQueue.length) return;
    let cancelled = false;
    async function syncOfflineQueue() {
      const synced: string[] = [];
      for (const item of offlineQueue) {
        if (cancelled) return;
        try {
          if (item.type === "note") await leadsApi.addNote({ id: item.leadId, text: item.text });
          if (item.type === "task") {
            const lead = allLeads.find((row) => row.id === item.leadId);
            if (!lead) continue;
            await tasksApi.create({
              business: business.id,
              title: item.title,
              description: "",
              client: lead.client,
              lead: lead.id,
              deal: null,
              appointment: null,
              parent_task: null,
              assignee: item.assignee ? Number(item.assignee) : lead.responsible_user || null,
              created_by: null,
              watchers: [],
              due_at: new Date(item.due_at).toISOString(),
              reminder_at: null,
              snoozed_until: null,
              priority: item.priority,
              status: "open",
              recurrence_rule: "",
            });
          }
          synced.push(item.id);
        } catch {
          break;
        }
      }
      if (!synced.length) return;
      setOfflineQueue((value) => value.filter((item) => !synced.includes(item.id)));
      setNotice(t("leads.offlineSynced", { count: synced.length }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-events"] }),
      ]);
    }
    syncOfflineQueue();
    return () => {
      cancelled = true;
    };
  }, [allLeads, business, isOnline, offlineQueue, queryClient, t]);

  useEffect(() => {
    if (!business || !isOnline) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void leads.refetch().catch((error) => captureFrontendError(error, { feature: "leads", action: "poll" }));
      }
    }, realtimeIntervals.leadsPollingMs);
    return () => window.clearInterval(timer);
  }, [business, isOnline, leads]);

  useEffect(() => {
    if (!leads.data) return;
    const currentIds = new Set(leads.data.map((lead) => lead.id));
    const knownIds = knownLeadIdsRef.current;
    if (knownIds) {
      const added = leads.data.filter((lead) => !knownIds.has(lead.id));
      if (added.length) {
        setNotice(t("leads.realtimeNewLeads", { count: added.length }));
        trackFrontendEvent("leads_realtime_added", { count: added.length });
      }
    }
    knownLeadIdsRef.current = currentIds;
  }, [leads.data, t]);

  const leadMutation = useMutation({
    mutationFn: (payload: Partial<Lead>) => leadsApi.create(payload),
    onSuccess: async (lead) => {
      setCreateOpen(false);
      setNotice(t("leads.noticeCreated"));
      setSelectedId(lead.id);
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, lead, user_id, lost_reason }: { action: LeadAction; lead: Lead; user_id?: Id; lost_reason?: string }) => {
      if (action === "take") return leadsApi.takeInWork({ id: lead.id });
      if (action === "contacted") return leadsApi.markContacted({ id: lead.id });
      if (action === "deal") return leadsApi.createDeal({ id: lead.id });
      if (action === "closed") return leadsApi.markClosed({ id: lead.id });
      if (action === "reopen") return leadsApi.reopen({ id: lead.id });
      if (action === "assign") return leadsApi.assign({ id: lead.id, user_id });
      if (!lost_reason) throw new Error(t("leads.lostReasonRequired"));
      return leadsApi.markLost({ id: lead.id, lost_reason });
    },
    onSuccess: async (_, variables) => {
      const labels = {
        take: t("leads.noticeTaken"),
        contacted: t("leads.noticeContacted"),
        deal: t("leads.noticeDealCreated"),
        closed: t("leads.noticeClosed"),
        lost: t("leads.noticeLost"),
        reopen: t("leads.noticeReopened"),
        assign: t("leads.noticeAssigned"),
      };
      setNotice(labels[variables.action]);
      if (variables.action === "assign") {
        pushHistory({
          message: t("leads.noticeAssigned"),
          undo: async () => {
            await leadsApi.assign({ id: variables.lead.id, user_id: variables.lead.responsible_user || undefined });
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
          },
          redo: async () => {
            await leadsApi.assign({ id: variables.lead.id, user_id: variables.user_id });
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
          },
        });
      } else if (variables.action !== "deal") {
        pushHistory({
          message: labels[variables.action],
          undo: async () => {
            await leadsApi.update({
              id: variables.lead.id,
              payload: {
                status: variables.lead.status,
                responsible_user: variables.lead.responsible_user,
                lost_reason: variables.lead.lost_reason || "",
              },
            });
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
          },
          redo: async () => {
            if (variables.action === "take") await leadsApi.takeInWork({ id: variables.lead.id });
            if (variables.action === "contacted") await leadsApi.markContacted({ id: variables.lead.id });
            if (variables.action === "closed") await leadsApi.markClosed({ id: variables.lead.id });
            if (variables.action === "lost") await leadsApi.markLost({ id: variables.lead.id, lost_reason: variables.lost_reason || variables.lead.lost_reason || t("leads.archiveReasonDefault") });
            if (variables.action === "reopen") await leadsApi.reopen({ id: variables.lead.id });
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
          },
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
      ]);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ lead, status }: { lead: Lead; status: Lead["status"] }) => leadsApi.update({ id: lead.id, payload: { status } }),
    onSuccess: async (_, variables) => {
      setNotice(t("leads.noticeStatusUpdated"));
      pushHistory({
        message: t("leads.statusUpdated"),
        undo: async () => {
          await leadsApi.update({ id: variables.lead.id, payload: { status: variables.lead.status } });
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
        redo: async () => {
          await leadsApi.update({ id: variables.lead.id, payload: { status: variables.status } });
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ leads, reason }: { leads: Lead[]; reason: string }) => Promise.all(leads.map((lead) => leadsApi.archive({ id: lead.id, reason }))),
    onSuccess: async (_, variables) => {
      setSelectedLeadIds([]);
      setContextMenu(null);
      setNotice(t("leads.noticeArchived", { count: variables.leads.length }));
      pushHistory({
        message: t("leads.noticeArchived", { count: variables.leads.length }),
        undo: async () => {
          await Promise.all(variables.leads.map((lead) => leadsApi.restore(lead.id)));
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
        redo: async () => {
          await Promise.all(variables.leads.map((lead) => leadsApi.archive({ id: lead.id, reason: variables.reason })));
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const bulkContactMutation = useMutation({
    mutationFn: (selectedLeads: Lead[]) => Promise.all(selectedLeads.map((lead) => leadsApi.markContacted({ id: lead.id }))),
    onSuccess: async (_, selectedLeads) => {
      setSelectedLeadIds([]);
      setNotice(t("leads.bulkDone"));
      pushHistory({
        message: t("leads.bulkDone"),
        undo: async () => {
          await Promise.all(selectedLeads.map((lead) => leadsApi.update({ id: lead.id, payload: { status: lead.status } })));
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
        redo: async () => {
          await Promise.all(selectedLeads.map((lead) => leadsApi.markContacted({ id: lead.id })));
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const smartAssignMutation = useMutation({
    mutationFn: async ({ mode, leads }: { mode: typeof assignmentMode; leads: Lead[] }) => {
      if (!teamList.length) return [];
      const workload = new Map<Id, number>();
      teamList.forEach((member) => workload.set(member.user.id, allLeads.filter((lead) => lead.responsible_user === member.user.id && !["closed", "lost"].includes(lead.status)).length));
      return Promise.all(
        leads.map((lead, index) => {
          let member = teamList[index % teamList.length];
          if (mode === "workload") {
            member = [...teamList].sort((a, b) => (workload.get(a.user.id) || 0) - (workload.get(b.user.id) || 0))[0];
          }
          if (mode === "specialization" && lead.source !== "manual") {
            const sourceIndex = Math.abs(lead.source.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % teamList.length;
            member = teamList[sourceIndex];
          }
          if (mode === "language") {
            member = teamList.find((item) => /kz|kaz|қаз|каз/i.test(`${item.user.full_name || ""} ${item.user.email}`)) || teamList[index % teamList.length];
          }
          workload.set(member.user.id, (workload.get(member.user.id) || 0) + 1);
          return leadsApi.assign({ id: lead.id, user_id: member.user.id });
        }),
      );
    },
    onSuccess: async (_, variables) => {
      setNotice(t("leads.smartAssignmentDone", { count: variables.leads.length }));
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const mergeClientMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: Id; duplicateId: Id }) => clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: async () => {
      setNotice(t("leads.duplicatesMerged"));
      await queryClient.invalidateQueries();
    },
  });

  const noteMutation = useMutation({
    mutationFn: async ({ lead, text, files }: { lead: Lead; text: string; files: File[] }) => {
      if (!navigator.onLine) {
        enqueueOfflineAction({
          id: `note-${lead.id}-${Date.now()}`,
          type: "note",
          leadId: lead.id,
          text: `${text.trim() || t("leads.filesAttachedNote")}${files.length ? `\n\n${t("leads.offlineFilesSkipped")}` : ""}`,
          createdAt: new Date().toISOString(),
        });
        return { offline: true };
      }
      const uploaded = await Promise.all(
        files.map((file) =>
          fileAttachmentsApi.upload({
            business: business!.id,
            entityType: "lead",
            entityId: lead.id,
            file,
          }),
        ),
      );
      const attachmentText = uploaded.length
        ? `\n\n${t("leads.attachments")}:\n${uploaded.map((attachment) => `- ${attachment.original_name}: ${attachment.download_url}`).join("\n")}`
        : "";
      const noteText = `${text.trim() || t("leads.filesAttachedNote")}${attachmentText}`;
      return leadsApi.addNote({ id: lead.id, text: noteText });
    },
    onSuccess: async (result, variables) => {
      if (result && "offline" in result) {
        setNotice(t("leads.offlineQueued"));
        return;
      }
      setNotice(t("leads.noteAdded"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm-card", "lead", variables.lead.id] }),
        queryClient.invalidateQueries({ queryKey: ["file-attachments"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-events"] }),
      ]);
    },
  });

  const nextActionMutation = useMutation<Task | { offline: true }, Error, Lead>({
    mutationFn: (lead: Lead) => {
      if (!navigator.onLine) {
        enqueueOfflineAction({
          id: `task-${lead.id}-${Date.now()}`,
          type: "task",
          leadId: lead.id,
          title: nextActionDraft.title,
          due_at: nextActionDraft.due_at,
          assignee: nextActionDraft.assignee,
          priority: nextActionDraft.priority,
          createdAt: new Date().toISOString(),
        });
        return Promise.resolve({ offline: true });
      }
      return tasksApi.create({
        business: business!.id,
        title: nextActionDraft.title,
        description: "",
        client: lead.client,
        lead: lead.id,
        deal: null,
        appointment: null,
        parent_task: null,
        assignee: nextActionDraft.assignee ? Number(nextActionDraft.assignee) : lead.responsible_user || null,
        created_by: null,
        watchers: [],
        due_at: new Date(nextActionDraft.due_at).toISOString(),
        reminder_at: null,
        snoozed_until: null,
        priority: nextActionDraft.priority,
        status: "open",
        recurrence_rule: "",
      });
    },
    onSuccess: async (result) => {
      setNextActionOpen(false);
      if (result && "offline" in result) {
        setNotice(t("leads.offlineQueued"));
        return;
      }
      setNotice(t("leads.noticeNextActionCreated"));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const appointmentMutation = useMutation({
    mutationFn: (payload: Partial<Appointment>) => {
      if (!selected?.id || !payload.service || !payload.start_at) throw new Error(t("leads.appointmentSelectionRequired"));
      return leadsApi.createAppointment({
        leadId: selected.id,
        payload: { service: payload.service, resource: payload.resource || null, start_at: payload.start_at },
      });
    },
    onSuccess: async () => {
      setAppointmentOpen(false);
      setNotice(t("leads.appointmentCreated"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      ]);
    },
  });

  function pushHistory(item: UndoToast) {
    const nextItem = { ...item, id: String(Date.now()) };
    setUndoStack((value) => [nextItem, ...value].slice(0, 20));
    setRedoStack([]);
    setUndoToast(item);
  }

  function enqueueOfflineAction(action: OfflineLeadAction) {
    setOfflineQueue((value) => [...value, action].slice(-40));
    setNotice(t("leads.offlineQueued"));
  }

  async function runUndo() {
    const [item, ...rest] = undoStack;
    if (!item) return;
    await item.undo();
    setUndoStack(rest);
    setRedoStack((value) => [item, ...value].slice(0, 20));
    setUndoToast(null);
    setNotice(t("leads.actionUndone"));
  }

  async function runRedo() {
    const [item, ...rest] = redoStack;
    if (!item) return;
    await item.redo();
    setRedoStack(rest);
    setUndoStack((value) => [item, ...value].slice(0, 20));
    setNotice(t("leads.actionRedone"));
  }

  function openLead(lead: Lead) {
    setSelectedId(lead.id);
    setMobileDetailOpen(true);
    setContextMenu(null);
    const next = new URLSearchParams(searchParams);
    next.set("lead", String(lead.id));
    next.delete("create");
    setSearchParams(next, { replace: true });
  }

  function callLead(lead: Lead) {
    const client = getClient(lead, clientList);
    if (client?.phone) window.location.href = `tel:${client.phone}`;
  }

  function whatsAppLead(lead: Lead, template?: string) {
    const client = getClient(lead, clientList);
    const phone = client?.phone?.replace(/\D/g, "");
    if (!phone) return;
    const service = getService(lead, serviceList);
    const text = template
      ?.replace(/\{\{имя\}\}/g, client?.full_name || "")
      .replace(/\{\{name\}\}/g, client?.full_name || "")
      .replace(/\{\{услуга\}\}/g, service?.name || "")
      .replace(/\{\{service\}\}/g, service?.name || "");
    window.open(`https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`, "_blank", "noopener,noreferrer");
  }

  function createTaskForLead(lead: Lead) {
    setSelectedId(lead.id);
    setNextActionDraft((value) => ({ ...value, title: nextAction(lead, t) }));
    setNextActionOpen(true);
  }

  function changeLeadStatus(lead: Lead, status: Lead["status"]) {
    if (status === lead.status) return;
    if (status === "contacted") {
      actionMutation.mutate({ action: "contacted", lead });
      return;
    }
    if (status === "in_progress") {
      actionMutation.mutate({ action: "take", lead });
      return;
    }
    if (status === "closed") {
      actionMutation.mutate({ action: "closed", lead });
      return;
    }
    if (status === "lost") {
      setLostLead(lead);
      setLostReason(lead.lost_reason || "");
      return;
    }
    statusMutation.mutate({ lead, status });
  }

  function toggleBulkLead(id: Id) {
    setSelectedLeadIds((value) => (value.includes(id) ? value.filter((item) => item !== id) : [...value, id]));
  }

  function toggleAllPageRows() {
    const pageIds = pageRows.map((lead) => lead.id);
    const allSelected = pageIds.every((id) => selectedLeadIds.includes(id));
    setSelectedLeadIds((value) => (allSelected ? value.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...value, ...pageIds]))));
  }

  function savePreset() {
    const name = presetName.trim() || t("leads.defaultPresetName");
    setFilterPresets((value) => [{ id: String(Date.now()), name, filter, source, search }, ...value].slice(0, 8));
    setPresetName("");
    setNotice(t("leads.filterSaved"));
  }

  function applyPreset(preset: FilterPreset) {
    setFilter(preset.filter);
    setSource(preset.source);
    setSearch(preset.search);
  }

  function moveColumn(column: LeadColumnKey, direction: -1 | 1) {
    setColumnOrder((value) => {
      const index = value.indexOf(column);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= value.length) return value;
      const next = [...value];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function getExportRows() {
    const headers = [t("leads.tableLead"), t("leads.tablePhone"), t("leads.source"), t("leads.tableStatus"), t("leads.priority"), t("leads.responsible"), t("leads.lastActivity"), t("leads.nextStep")];
    const data = rows.map((lead) => {
      const client = getClient(lead, clientList);
      const service = getService(lead, serviceList);
      const responsible = teamList.find((member) => member.user.id === lead.responsible_user);
      return {
        [headers[0]]: client?.full_name || t("leads.leadFallback", { id: lead.id }),
        [headers[1]]: client?.phone || "",
        [headers[2]]: getSourceLabel(lead.source, t),
        [headers[3]]: getStatusLabel(lead.status, t),
        [headers[4]]: lead.status === "new" && !lead.responsible_user ? t("leads.priorityHot") : t("leads.priorityNormal"),
        [headers[5]]: responsible?.user.full_name || responsible?.user.email || t("leads.withoutManager"),
        [headers[6]]: formatDateTime(lead.updated_at),
        [headers[7]]: nextAction(lead, t),
      };
    });
    return { headers, data };
  }

  async function exportRows(kind: "csv" | "excel") {
    const { headers, data } = getExportRows();
    if (kind === "excel") {
      await writeXlsxFile(
        [
          headers.map((header) => ({ value: header, fontWeight: "bold" as const })),
          ...data.map((row) => headers.map((header) => ({ value: String(row[header] ?? "") }))),
        ],
        { sheet: t("nav.leads").slice(0, 31), columns: headers.map(() => ({ width: 24 })) },
      ).toFile("zani-leads.xlsx");
      return;
    }
    const lines = data.map((row) => headers.map((header) => toCsvValue(row[header])).join(","));
    downloadText("zani-leads.csv", [headers.map(toCsvValue).join(","), ...lines].join("\n"), "text/csv;charset=utf-8");
  }

  async function shareView() {
    const params = new URLSearchParams(searchParams);
    params.set("filter", filter);
    if (source) params.set("source", source);
    else params.delete("source");
    if (search) params.set("search", search);
    else params.delete("search");
    params.set("view", viewMode);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    await navigator.clipboard?.writeText(url);
    setNotice(t("leads.viewCopied"));
  }

  function closeCreateModal() {
    setCreateOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    }

    function handleKeyDown(event: KeyboardEvent) {
      const editable = isEditableTarget(event.target);
      if (editable && event.key !== "Escape") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setMobileDetailOpen(false);
        setContextMenu(null);
        setShortcutsOpen(false);
        setColumnMenuOpen(false);
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreateOpen(true);
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (!selected && !rows.length) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = selected ? rows.findIndex((lead) => lead.id === selected.id) : -1;
        const nextIndex = event.key === "ArrowDown" ? Math.min(rows.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
        const nextLead = rows[nextIndex] || rows[0];
        if (nextLead) openLead(nextLead);
        return;
      }

      if (event.key === "Enter" && selected) {
        event.preventDefault();
        openLead(selected);
        return;
      }

      if (event.key.toLowerCase() === "c" && selected) {
        event.preventDefault();
        callLead(selected);
        return;
      }

      if (event.key.toLowerCase() === "w" && selected) {
        event.preventDefault();
        whatsAppLead(selected);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, searchParams, setSearchParams]);

  if (!business) return <ErrorState message={t("leads.noBusiness")} />;
  if (leads.isLoading || clients.isLoading || services.isLoading || tasks.isLoading) return <PageSkeleton />;

  const actionError =
    leadMutation.error ||
    actionMutation.error ||
    statusMutation.error ||
    archiveMutation.error ||
    bulkContactMutation.error ||
    smartAssignMutation.error ||
    mergeClientMutation.error ||
    noteMutation.error ||
    appointmentMutation.error ||
    nextActionMutation.error ||
    clients.error ||
    services.error ||
    leads.error;
  const filters = [
    { value: "all" as const, label: t("leads.filterAll"), count: allLeads.length },
    { value: "new" as const, label: t("leads.filterNew"), count: allLeads.filter((lead) => lead.status === "new").length },
    { value: "hot" as const, label: t("leads.filterHot"), count: allLeads.filter((lead) => lead.status === "new" && !lead.responsible_user).length },
    { value: "unanswered" as const, label: t("leads.filterUnanswered"), count: allLeads.filter((lead) => !lead.responsible_user).length },
    { value: "attention" as const, label: t("leads.filterAttention"), count: allLeads.filter((lead) => {
      const insight = aiInsights.get(lead.id);
      return insight?.stale || (insight?.lossRisk || 0) >= 70;
    }).length },
    { value: "mine" as const, label: t("leads.filterMine"), count: allLeads.filter((lead) => user?.id && lead.responsible_user === user.id).length },
  ];
  const newLeadCount = allLeads.filter((lead) => isToday(lead.created_at)).length;
  const weekLeadCount = allLeads.filter((lead) => isWithinLastDays(lead.created_at, 7)).length;
  const unansweredLeadCount = allLeads.filter((lead) => !lead.responsible_user).length;
  const unansweredWeekCount = allLeads.filter((lead) => !lead.responsible_user && isWithinLastDays(lead.created_at, 7)).length;
  const waitingLeadCount = allLeads.filter((lead) => ["contacted", "in_progress"].includes(lead.status)).length;
  const waitingWeekCount = allLeads.filter((lead) => ["contacted", "in_progress"].includes(lead.status) && isWithinLastDays(lead.created_at, 7)).length;
  const hotLeadCount = allLeads.filter((lead) => lead.status === "new" && !lead.responsible_user).length;
  const hotWeekCount = allLeads.filter((lead) => lead.status === "new" && !lead.responsible_user && isWithinLastDays(lead.created_at, 7)).length;
  const priorityLead = allLeads.find((lead) => !lead.responsible_user && lead.status === "new") || allLeads[0] || null;
  const priorityLeadClient = priorityLead ? getClient(priorityLead, clientList) : undefined;
  const priorityLeadName = priorityLeadClient?.full_name || (priorityLead ? t("leads.leadFallback", { id: priorityLead.id }) : t("leads.emptyTitle"));
  const pageStart = rows.length ? (safePage - 1) * LEADS_PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(safePage * LEADS_PAGE_SIZE, rows.length);
  const weeklyDelta = (count: number) => t("leads.weeklyDelta", { count });
  const visiblePages = Array.from({ length: pageCount })
    .map((_, index) => index + 1)
    .filter((itemPage) => pageCount <= 5 || itemPage === 1 || itemPage === pageCount || Math.abs(itemPage - safePage) <= 1)
    .slice(0, 7);
  function jumpToPage(value: string) {
    const nextPage = Number(value);
    if (!Number.isFinite(nextPage)) return;
    setPage(Math.min(pageCount, Math.max(1, Math.trunc(nextPage))));
  }

  return (
    <div className="space-y-5">
      {notice ? <div className="rounded-xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-bold text-ai-800">{notice}</div> : null}
      {!isOnline || offlineQueue.length ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <WifiOff size={17} />
            {!isOnline ? t("leads.offlineMode") : t("leads.offlinePending", { count: offlineQueue.length })}
          </span>
          {offlineQueue.length ? <span className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">{t("leads.offlinePending", { count: offlineQueue.length })}</span> : null}
        </div>
      ) : null}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight text-midnight">{t("nav.leads")}</h1>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{t("leads.incomingDescription", { count: allLeads.length })}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex h-11 min-w-[min(100%,360px)] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 shadow-sm">
            <Search size={18} />
            <input
              ref={searchInputRef}
              className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-slate-400"
              placeholder={t("leads.search")}
              value={search}
              onChange={(event) => setSearch(normalizePhoneSearchInput(event.target.value))}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 140)}
            />
            {searchFocused && search.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 top-12 z-30 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{t("leads.searchSuggestions")}</p>
                {searchSuggestions.length ? searchSuggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setSearch(item.label);
                      if (item.lead) openLead(item.lead);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-midnight">{item.label}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">{item.meta}</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">{item.type}</span>
                  </button>
                )) : (
                  <p className="px-2 py-3 text-sm font-semibold text-slate-500">{t("leads.noSuggestions")}</p>
                )}
              </div>
            ) : null}
          </label>
          <div className="flex h-11 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" className={cn("grid h-9 w-9 place-items-center rounded-lg", viewMode === "table" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50")} onClick={() => setViewMode("table")} aria-label={t("leads.viewTable")}>
              <Table2 size={17} />
            </button>
            <button type="button" className={cn("grid h-9 w-9 place-items-center rounded-lg", viewMode === "kanban" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50")} onClick={() => setViewMode("kanban")} aria-label={t("leads.viewKanban")}>
              <KanbanSquare size={17} />
            </button>
          </div>
          <div className="relative">
            <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl px-0" aria-label={t("leads.columns")} onClick={() => setColumnMenuOpen((value) => !value)}>
              <Columns3 size={18} />
            </Button>
            {columnMenuOpen ? (
              <div className="absolute right-0 top-12 z-30 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{t("leads.columns")}</p>
                {columnOrder.map((column, index) => (
                  <div key={column} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={visibleColumns[column]}
                        onChange={() => setVisibleColumns((value) => ({ ...value, [column]: !value[column] }))}
                      />
                      <span className="truncate">{t(`leads.column.${column}`)}</span>
                    </label>
                    <button type="button" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-white hover:text-midnight" disabled={index === 0} onClick={() => moveColumn(column, -1)} aria-label={t("leads.moveColumnLeft")}>
                      <ChevronLeft size={14} />
                    </button>
                    <button type="button" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-white hover:text-midnight" disabled={index === columnOrder.length - 1} onClick={() => moveColumn(column, 1)} aria-label={t("leads.moveColumnRight")}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl px-0" aria-label={t("leads.exportCsv")} onClick={() => exportRows("csv")}>
            <Download size={18} />
          </Button>
          <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl px-0" aria-label={t("leads.shareView")} onClick={shareView}>
            <Share2 size={18} />
          </Button>
          <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl px-0" aria-label={t("leads.undo")} disabled={!undoStack.length} onClick={runUndo}>
            <Undo2 size={18} />
          </Button>
          <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl px-0" aria-label={t("leads.redo")} disabled={!redoStack.length} onClick={runRedo}>
            <ChevronRight size={18} />
          </Button>
          <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl px-0" aria-label={t("leads.shortcuts")} onClick={() => setShortcutsOpen(true)}>
            <Keyboard size={18} />
          </Button>
          <Button className="min-h-11 rounded-xl px-5" onClick={() => setCreateOpen(true)}>
            <Plus size={18} />
            {t("leads.create")}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:hidden">
        <MetricTile icon={Users} label={t("leads.totalLeads")} value={allLeads.length} delta={weeklyDelta(weekLeadCount)} />
        <MetricTile icon={Flame} label={t("leads.newToday")} value={newLeadCount} delta={weeklyDelta(weekLeadCount)} tone="green" />
        <MetricTile icon={MessageCircle} label={t("leads.filterUnanswered")} value={unansweredLeadCount} delta={weeklyDelta(unansweredWeekCount)} tone="amber" />
        <MetricTile icon={BriefcaseBusiness} label={t("leads.filterActive")} value={waitingLeadCount} delta={weeklyDelta(waitingWeekCount)} tone="blue" />
        <MetricTile icon={AlertTriangle} label={t("leads.filterHot")} value={hotLeadCount} delta={weeklyDelta(hotWeekCount)} tone="pink" />
      </section>

      <section className="rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-brand-50 p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] xl:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-violet-700 shadow-sm">
              <Bot size={19} />
            </div>
            <div className="min-w-0">
              <p className="font-black text-midnight">{t("leads.aiPriorityTitle")}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{t("leads.aiBannerText", { lead: priorityLeadName })}</p>
            </div>
          </div>
          <Button className="shrink-0 rounded-lg bg-brand-600" onClick={() => priorityLead && openLead(priorityLead)} disabled={!priorityLead}>
            <Phone size={16} />
            {t("leads.callNow")}
          </Button>
        </div>
      </section>

      <section className="-mx-1 overflow-x-auto px-1 xl:hidden">
        <div className="flex w-max items-center gap-2 pb-1">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setFilter(item.value);
            }}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition",
              filter === item.value ? "border-brand-200 bg-white text-brand-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight",
            )}
          >
            {item.label}
            <span className={cn("rounded-lg px-2 py-0.5 text-xs", filter === item.value ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>{item.count}</span>
          </button>
        ))}
        <span className="h-8 w-px shrink-0 bg-slate-200" />
        {["whatsapp", "telegram", "instagram", "website"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setSource(source === item ? "" : item);
            }}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition",
              source === item ? "border-brand-200 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight",
            )}
          >
            <SourceBadge source={item} t={t} />
          </button>
        ))}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{t("leads.savedFilters")}</span>
          {filterPresets.length ? filterPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
            </button>
          )) : (
            <span className="text-xs font-semibold text-slate-400">{t("leads.noSavedFilters")}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            className="h-9 w-44 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-brand-300"
            placeholder={t("leads.filterPresetName")}
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
          />
          <Button variant="secondary" size="sm" className="rounded-lg" onClick={savePreset}>{t("leads.saveFilter")}</Button>
          <Button variant="secondary" size="sm" className="hidden rounded-lg sm:inline-flex" onClick={() => exportRows("excel")}>{t("leads.exportExcel")}</Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-gradient-to-r from-white via-violet-50 to-white p-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-midnight">{t("leads.aiAutomationTitle")}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{t("leads.aiAutomationText")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={sortByAi ? "primary" : "secondary"} size="sm" className="rounded-lg" onClick={() => setSortByAi((value) => !value)}>
            <Flame size={15} /> {t("leads.sortByHeat")}
          </Button>
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none"
            value={assignmentMode}
            onChange={(event) => setAssignmentMode(event.target.value as typeof assignmentMode)}
          >
            <option value="workload">{t("leads.assignmentWorkload")}</option>
            <option value="round_robin">{t("leads.assignmentRoundRobin")}</option>
            <option value="specialization">{t("leads.assignmentSpecialization")}</option>
            <option value="language">{t("leads.assignmentLanguage")}</option>
          </select>
          <Button
            size="sm"
            className="rounded-lg bg-brand-600"
            disabled={!teamList.length || !allLeads.some((lead) => !lead.responsible_user)}
            isLoading={smartAssignMutation.isPending}
            onClick={() => smartAssignMutation.mutate({ mode: assignmentMode, leads: allLeads.filter((lead) => !lead.responsible_user && !["closed", "lost"].includes(lead.status)) })}
          >
            <UserCheck size={15} /> {t("leads.smartAssign")}
          </Button>
        </div>
      </section>

      <section className={cn(
        "grid gap-4 xl:h-[calc(100vh-250px)] xl:min-h-[680px]",
        detailCollapsed ? "xl:grid-cols-[minmax(0,1fr)_64px]" : "xl:grid-cols-[minmax(0,1fr)_384px]",
      )}>
        <div className="flex min-h-0 flex-col gap-4">
          <section className="hidden shrink-0 gap-3 xl:grid xl:grid-cols-5">
            <MetricTile icon={Users} label={t("leads.totalLeads")} value={allLeads.length} delta={weeklyDelta(weekLeadCount)} />
            <MetricTile icon={Flame} label={t("leads.newToday")} value={newLeadCount} delta={weeklyDelta(weekLeadCount)} tone="green" />
            <MetricTile icon={MessageCircle} label={t("leads.filterUnanswered")} value={unansweredLeadCount} delta={weeklyDelta(unansweredWeekCount)} tone="amber" />
            <MetricTile icon={BriefcaseBusiness} label={t("leads.filterActive")} value={waitingLeadCount} delta={weeklyDelta(waitingWeekCount)} tone="blue" />
            <MetricTile icon={AlertTriangle} label={t("leads.filterHot")} value={hotLeadCount} delta={weeklyDelta(hotWeekCount)} tone="pink" />
          </section>

          <section className="hidden shrink-0 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-brand-50 p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] xl:block">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-violet-700 shadow-sm">
                  <Bot size={19} />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-midnight">{t("leads.aiPriorityTitle")}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{t("leads.aiBannerText", { lead: priorityLeadName })}</p>
                </div>
              </div>
              <Button className="shrink-0 rounded-lg bg-brand-600" onClick={() => priorityLead && openLead(priorityLead)} disabled={!priorityLead}>
                <Phone size={16} />
                {t("leads.callNow")}
              </Button>
            </div>
          </section>

          <section className="hidden shrink-0 overflow-x-auto xl:block">
            <div className="flex w-max items-center gap-2 pb-1">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setFilter(item.value);
                }}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition",
                  filter === item.value ? "border-brand-200 bg-white text-brand-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight",
                )}
              >
                {item.label}
                <span className={cn("rounded-lg px-2 py-0.5 text-xs", filter === item.value ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500")}>{item.count}</span>
              </button>
            ))}
            <span className="h-8 w-px shrink-0 bg-slate-200" />
            {["whatsapp", "telegram", "instagram", "website"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setSource(source === item ? "" : item);
                }}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition",
                  source === item ? "border-brand-200 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-brand-100 hover:text-midnight",
                )}
              >
                <SourceBadge source={item} t={t} />
              </button>
            ))}
            </div>
          </section>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
          {viewMode === "table" ? (
            <div className="hidden shrink-0 overflow-x-auto lg:block">
              <div
                className="sticky top-0 z-10 grid min-w-[1180px] border-b border-slate-100 bg-slate-50/95 px-4 py-3 text-xs font-bold text-slate-500 backdrop-blur"
                style={{ gridTemplateColumns: `36px ${columnOrder.filter((column) => visibleColumns[column]).map((column) => leadColumnWidths[column]).join(" ")} 92px` }}
              >
                <label className="flex h-5 w-5 items-center justify-center">
                  <input className="sr-only" type="checkbox" checked={pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id))} onChange={toggleAllPageRows} aria-label={t("leads.selectAll")} />
                  <span className={cn("grid h-5 w-5 place-items-center rounded border", pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id)) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white")}>
                    {pageRows.length > 0 && pageRows.every((lead) => selectedLeadIds.includes(lead.id)) ? <CheckCheck size={13} /> : null}
                  </span>
                </label>
                {columnOrder.filter((column) => visibleColumns[column]).map((column) => (
                  <span key={column}>{t(`leads.column.${column}`)}</span>
                ))}
                <span />
              </div>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-hidden">
            {!rows.length ? (
              <div className="grid h-full min-h-[320px] place-items-center p-5">
                <div className="max-w-sm text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <Plus size={22} />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-midnight">{t("leads.emptyTitle")}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{t("leads.emptyText")}</p>
                  <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus size={16} /> {t("leads.createFirstLead")}
                    </Button>
                    <Button variant="secondary" onClick={() => { window.location.href = "/dashboard/integrations"; }}>
                      <SlidersHorizontal size={16} /> {t("leads.setupIntegrations")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              viewMode === "kanban" ? (
                <div className="grid h-full min-h-[520px] gap-3 overflow-x-auto p-4 lg:grid-cols-3 xl:grid-cols-6">
                  {kanbanStatuses.map((status) => {
                    const columnRows = rows.filter((lead) => lead.status === status);
                    return (
                      <section
                        key={status}
                        className="min-h-[320px] min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 p-3"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          const leadId = Number(event.dataTransfer.getData("text/plain"));
                          const lead = rows.find((item) => item.id === leadId);
                          if (lead && lead.status !== status) changeLeadStatus(lead, status);
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="font-black text-midnight">{getStatusLabel(status, t)}</p>
                            <p className="text-xs font-semibold text-slate-500">{t("leads.dropHere")}</p>
                          </div>
                          <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-slate-500">{columnRows.length}</span>
                        </div>
                        <div className="space-y-2">
                          {columnRows.map((lead) => {
                            const client = getClient(lead, clientList);
                            const service = getService(lead, serviceList);
                            return (
                              <button
                                key={lead.id}
                                type="button"
                                draggable
                                onDragStart={(event) => event.dataTransfer.setData("text/plain", String(lead.id))}
                                onClick={() => openLead(lead)}
                                className={cn("w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-200", selected?.id === lead.id && "border-brand-300 bg-brand-50")}
                              >
                                <p className="truncate text-sm font-black text-midnight">{client?.full_name || t("leads.leadFallback", { id: lead.id })}</p>
                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{client?.phone || service?.name || getSourceLabel(lead.source, t)}</p>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <SourceBadge source={lead.source} t={t} />
                                  <span className="text-xs font-bold text-slate-400">{formatRelativeTime(lead.updated_at, t)}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <>
                <VirtualizedLeadTableRows
                  rows={pageRows}
                  selected={selected}
                  selectedLeadIds={selectedLeadIds}
                  clientList={clientList}
                  serviceList={serviceList}
                  teamList={teamList}
                  aiInsights={aiInsights}
                  allLeads={allLeads}
                  visibleColumns={visibleColumns}
                  columnOrder={columnOrder}
                  openLead={openLead}
                  toggleBulkLead={toggleBulkLead}
                  changeLeadStatus={changeLeadStatus}
                  assignLead={(lead, userId) => actionMutation.mutate({ action: "assign", lead, user_id: userId })}
                  callLead={callLead}
                  whatsAppLead={whatsAppLead}
                  createTaskForLead={createTaskForLead}
                  openContextMenu={(event, lead) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, lead });
                  }}
                  t={t}
                />
                <div className="divide-y divide-slate-100 lg:hidden">
                  {pageRows.map((lead) => (
                    <LeadQueueItem
                      key={lead.id}
                      lead={lead}
                      client={getClient(lead, clientList)}
                      service={getService(lead, serviceList)}
                      selected={lead.id === selected?.id}
                      onClick={() => openLead(lead)}
                      onSwipeLeft={() => archiveMutation.mutate({ leads: [lead], reason: t("leads.archiveReasonDefault") })}
                      onSwipeRight={() => actionMutation.mutate({ action: "take", lead })}
                      onLongPress={(event) => {
                        const touch = "touches" in event ? event.touches[0] || event.changedTouches[0] : event;
                        setContextMenu({ x: touch?.clientX || window.innerWidth / 2, y: touch?.clientY || window.innerHeight / 2, lead });
                      }}
                      t={t}
                    />
                  ))}
                </div>
                </>
              )
            )}
          </div>
          {viewMode === "table" ? (
          <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <span>{t("leads.tableShowingRange", { start: pageStart, end: pageEnd, total: rows.length })}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-lg px-0" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft size={16} />
              </Button>
              {visiblePages.map((itemPage, index) => (
                <button
                  key={`${itemPage}-${index}`}
                  type="button"
                  onClick={() => setPage(itemPage)}
                  className={cn("grid h-8 w-8 place-items-center rounded-lg border text-sm font-bold", itemPage === safePage ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:text-midnight")}
                >
                  {itemPage}
                </button>
              ))}
              <Button variant="secondary" size="icon" className="h-8 w-8 rounded-lg px-0" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                <ChevronRight size={16} />
              </Button>
              <form
                className="ml-2 flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  jumpToPage(pageDraft);
                }}
              >
                <input
                  className="h-8 w-14 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-bold text-midnight outline-none focus:border-brand-300"
                  inputMode="numeric"
                  value={pageDraft}
                  onChange={(event) => setPageDraft(event.target.value)}
                  onBlur={() => jumpToPage(pageDraft)}
                  aria-label={t("leads.pageNumber")}
                />
                <span className="text-slate-400">/ {pageCount}</span>
              </form>
            </div>
          </div>
          ) : null}
          </div>
        </div>

        <aside className="hidden min-h-0 xl:sticky xl:top-4 xl:block xl:h-[calc(100vh-8rem)] xl:self-start">
          {!selected ? (
            <div className="grid h-full place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
              <div>
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <CircleDot size={24} />
                </div>
                <p className="font-black text-slate-500">{t("leads.selectLead")}</p>
              </div>
            </div>
          ) : (
            <LeadDetailPanel
              selected={selected}
              selectedClient={selectedClient}
              selectedService={selectedService}
              selectedNextTask={selectedNextTask}
              selectedDeals={selectedDeals}
              selectedAppointments={selectedAppointments}
              selectedConversations={selectedConversations}
              aiInsight={selectedAiInsight!}
              clientList={clientList}
              teamList={teamList}
              priorityLead={priorityLead}
              actionMutation={actionMutation}
              mergeClientMutation={mergeClientMutation}
              noteMutation={noteMutation}
              openLead={openLead}
              onWhatsAppTemplate={whatsAppLead}
              setAppointmentOpen={setAppointmentOpen}
              setLostLead={setLostLead}
              setLostReason={setLostReason}
              setNextActionOpen={setNextActionOpen}
              setDrawerEntity={setDrawerEntity}
              collapsed={detailCollapsed}
              onToggleCollapsed={() => setDetailCollapsed((value) => !value)}
              t={t}
            />
          )}
        </aside>
      </section>

      {selected ? (
        <div className={cn("fixed inset-0 z-50 bg-slate-950/30 transition lg:hidden", mobileDetailOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")} onClick={() => setMobileDetailOpen(false)}>
          <div className={cn("absolute inset-x-0 bottom-0 h-[88vh] rounded-t-2xl bg-white p-3 shadow-2xl transition-transform", mobileDetailOpen ? "translate-y-0" : "translate-y-full")} onClick={(event) => event.stopPropagation()}>
            <LeadDetailPanel
              selected={selected}
              selectedClient={selectedClient}
              selectedService={selectedService}
              selectedNextTask={selectedNextTask}
              selectedDeals={selectedDeals}
              selectedAppointments={selectedAppointments}
              selectedConversations={selectedConversations}
              aiInsight={selectedAiInsight!}
              clientList={clientList}
              teamList={teamList}
              priorityLead={priorityLead}
              actionMutation={actionMutation}
              mergeClientMutation={mergeClientMutation}
              noteMutation={noteMutation}
              openLead={openLead}
              onWhatsAppTemplate={whatsAppLead}
              setAppointmentOpen={setAppointmentOpen}
              setLostLead={setLostLead}
              setLostReason={setLostReason}
              setNextActionOpen={setNextActionOpen}
              setDrawerEntity={setDrawerEntity}
              onClose={() => setMobileDetailOpen(false)}
              t={t}
            />
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)}>
          <div
            className="absolute w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            {[
              { label: t("leads.open"), icon: CircleDot, onClick: () => openLead(contextMenu.lead) },
              { label: t("leads.call"), icon: Phone, onClick: () => callLead(contextMenu.lead) },
              { label: "WhatsApp", icon: MessageCircle, onClick: () => whatsAppLead(contextMenu.lead) },
              { label: t("leads.assignToMe"), icon: UserCheck, onClick: () => actionMutation.mutate({ action: "take", lead: contextMenu.lead }) },
              { label: t("leads.archive"), icon: XCircle, onClick: () => archiveMutation.mutate({ leads: [contextMenu.lead], reason: t("leads.archiveReasonDefault") }) },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-midnight"
                  onClick={() => {
                    item.onClick();
                    setContextMenu(null);
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedLeadIds.length ? (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <span className="mr-2 text-sm font-black">{t("leads.bulkSelected", { count: selectedLeadIds.length })}</span>
            <select
              className="h-9 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-bold text-white outline-none"
              defaultValue=""
              onChange={(event) => {
                const userId = event.target.value ? Number(event.target.value) : undefined;
                const selectedLeads = allLeads.filter((lead) => selectedLeadIds.includes(lead.id));
                selectedLeads.forEach((lead) => actionMutation.mutate({ action: "assign", lead, user_id: userId }));
                setSelectedLeadIds([]);
              }}
            >
              <option className="text-slate-900" value="">{t("leads.bulkAssign")}</option>
              {teamList.map((member) => (
                <option className="text-slate-900" key={member.user.id} value={member.user.id}>{member.user.full_name || member.user.email}</option>
              ))}
            </select>
            <Button size="sm" variant="secondary" className="rounded-lg bg-white text-slate-950 hover:bg-slate-100" onClick={() => bulkContactMutation.mutate(allLeads.filter((lead) => selectedLeadIds.includes(lead.id)))}>
              <MessageCircle size={15} /> {t("leads.bulkContact")}
            </Button>
            <Button size="sm" variant="secondary" className="rounded-lg bg-white text-slate-950 hover:bg-slate-100" onClick={() => archiveMutation.mutate({ leads: allLeads.filter((lead) => selectedLeadIds.includes(lead.id)), reason: t("leads.archiveReasonDefault") })}>
              <XCircle size={15} /> {t("leads.bulkArchive")}
            </Button>
            <Button size="sm" variant="ghost" className="rounded-lg text-white hover:bg-white/10" onClick={() => setSelectedLeadIds([])}>
              {t("leads.bulkReset")}
            </Button>
          </div>
        </div>
      ) : null}

      {undoToast ? (
        <div className="fixed bottom-24 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-2xl">
          <Undo2 size={17} className="text-brand-700" />
          <span className="min-w-0 flex-1">{undoToast.message}</span>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-black text-brand-700"
            onClick={async () => {
              await runUndo();
            }}
          >
            {t("leads.undo")}
          </button>
        </div>
      ) : null}

      <Modal title={t("leads.shortcuts")} open={shortcutsOpen} onClose={() => setShortcutsOpen(false)}>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["N", t("leads.shortcutNew")],
            ["F", t("leads.shortcutSearch")],
            ["↑ / ↓", t("leads.shortcutNavigate")],
            ["Enter", t("leads.shortcutOpen")],
            ["C", t("leads.shortcutCall")],
            ["W", t("leads.shortcutWhatsApp")],
            ["Esc", t("leads.shortcutClose")],
            ["?", t("leads.shortcutHelp")],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm font-bold text-slate-600">{label}</span>
              <kbd className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-midnight shadow-sm">{key}</kbd>
            </div>
          ))}
        </div>
      </Modal>

      <Modal title={t("leads.new")} open={createOpen} onClose={closeCreateModal}>
        <LeadForm
          businessId={business.id}
          clients={clientList}
          services={serviceList}
          teamMembers={teamList}
          onSubmit={(payload) => leadMutation.mutateAsync(payload)}
          onOpenClient={(id) => {
            setCreateOpen(false);
            setDrawerEntity({ type: "client", id });
          }}
        />
      </Modal>

      <Modal title={t("leads.bookFromLead")} open={appointmentOpen} onClose={() => setAppointmentOpen(false)}>
        <AppointmentForm
          businessId={business.id}
          clients={clientList}
          services={serviceList}
          resources={resources.data || []}
          leads={allLeads}
          prefill={{
            client: selected?.client,
            service: selected?.service,
            lead: selected?.id,
            source: "manual",
          }}
          onSubmit={(payload) => appointmentMutation.mutateAsync({ ...payload, lead: selected?.id || payload.lead, client: selected?.client || payload.client, service: selected?.service || payload.service })}
        />
      </Modal>

      <Modal title={t("leads.nextActionModal")} open={nextActionOpen} onClose={() => setNextActionOpen(false)}>
        {selected ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              nextActionMutation.mutate(selected);
            }}
          >
            <Input label={t("leads.task")} value={nextActionDraft.title} onChange={(event) => setNextActionDraft({ ...nextActionDraft, title: event.target.value })} required />
            <Input label={t("leads.deadline")} type="datetime-local" value={nextActionDraft.due_at} onChange={(event) => setNextActionDraft({ ...nextActionDraft, due_at: event.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t("leads.responsible")}
                value={nextActionDraft.assignee}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, assignee: event.target.value })}
                options={[
                  { value: "", label: t("leads.leadResponsible") },
                  ...teamList.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                ]}
              />
              <Select
                label={t("leads.priority")}
                value={nextActionDraft.priority}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, priority: event.target.value as Task["priority"] })}
                options={[
                  { value: "low", label: t("leads.priorityLow") },
                  { value: "normal", label: t("leads.priorityNormalLabel") },
                  { value: "high", label: t("leads.priorityHigh") },
                  { value: "urgent", label: t("leads.priorityUrgent") },
                ]}
              />
            </div>
            <Button type="submit" isLoading={nextActionMutation.isPending}>{t("leads.createTask")}</Button>
          </form>
        ) : null}
      </Modal>

      <Modal title={t("leads.closeAsLost")} open={Boolean(lostLead)} onClose={() => setLostLead(null)}>
        {lostLead ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              actionMutation.mutate({ action: "lost", lead: lostLead, lost_reason: lostReason });
              setLostLead(null);
              setLostReason("");
            }}
          >
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="font-black text-midnight">{leadTitle(lostLead, clientList, t)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{lostLead.message || t("leads.noComment")}</p>
            </div>
            <Select
              label={t("leads.reasonType")}
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              options={[
                { value: "", label: t("leads.selectReason") },
                { value: t("leads.reasonNoAnswer"), label: t("leads.reasonNoAnswer") },
                { value: t("leads.reasonExpensive"), label: t("leads.reasonExpensive") },
                { value: t("leads.reasonCompetitor"), label: t("leads.reasonCompetitor") },
                { value: t("leads.reasonNoBudget"), label: t("leads.reasonNoBudget") },
                { value: t("leads.reasonDuplicate"), label: t("leads.reasonDuplicate") },
                { value: t("leads.reasonIrrelevant"), label: t("leads.reasonIrrelevant") },
              ]}
            />
            <Input label={t("leads.comment")} value={lostReason} onChange={(event) => setLostReason(event.target.value)} required />
            <Button type="submit" variant="danger" isLoading={actionMutation.isPending} disabled={!lostReason}>{t("leads.closeAsLost")}</Button>
          </form>
        ) : null}
      </Modal>

      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </div>
  );
}
