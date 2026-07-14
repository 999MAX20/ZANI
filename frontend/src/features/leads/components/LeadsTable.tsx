import { CheckCheck, MessageCircle, MoreHorizontal, Phone, SquareArrowOutUpRight } from "lucide-react";

import {
  CRM_TABLE_ACTIONS_COLUMN,
  CRM_TABLE_CHECKBOX_COLUMN,
  CRM_TABLE_MIN_WIDTH,
  CRM_TABLE_ROW_GRID_CLASS,
  CRM_TABLE_WIDE_MIN_WIDTH,
} from "../../../components/crm";
import { cn } from "../../../lib/cn";
import { formatDateTime } from "../../../lib/format";
import type { Client, Id, Lead, Service } from "../../../types";
import { leadColumnWidths, statusClass, type LeadAiInsight, type LeadColumnKey, type Translate } from "../types";
import { formatRelativeTime, getClient, getService, getSourceLabel, getStatusLabel, initials, leadAiInsight, nextAction, TruncatedText } from "../utils/leadFormat";
import { SourceBadge } from "./common/SourceBadge";

function ManagerAvatar({ name }: { name?: string }) {
  if (!name) return <span className="text-xs font-bold text-slate-500">-</span>;
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-black text-brand-700 ring-1 ring-white">
      {initials(name)}
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
  onAssign,
  onCall,
  onWhatsApp,
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
  onAssign: (userId?: Id) => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  t: Translate;
}) {
  const title = client?.full_name || t("leads.leadFallback", { id: lead.id });
  const isHot = lead.status === "new" && !lead.responsible_user;
  const activeColumns = columnOrder.filter((column) => visibleColumns[column]);
  const needsWideTable = activeColumns.length > 5;
  const gridTemplateColumns = `${CRM_TABLE_CHECKBOX_COLUMN} ${activeColumns.map((column) => leadColumnWidths[column]).join(" ")} ${CRM_TABLE_ACTIONS_COLUMN}`;
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
    source: <span className="flex min-w-0"><SourceBadge source={lead.source} t={t} /></span>,
    status: (
      <span className={cn("inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-black ring-1", statusClass[lead.status])}>
        {getStatusLabel(lead.status, t)}
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
        CRM_TABLE_ROW_GRID_CLASS,
        selected && "bg-brand-50/70 shadow-[inset_3px_0_0_#2563eb]",
        bulkSelected && "bg-slate-50",
        aiInsight.stale && !selected && "bg-amber-50/35",
      )}
      style={{ gridTemplateColumns, minWidth: needsWideTable ? CRM_TABLE_WIDE_MIN_WIDTH : CRM_TABLE_MIN_WIDTH }}
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
      <span className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        {[
          { label: t("leads.open"), icon: SquareArrowOutUpRight, onClick },
          { label: t("leads.call"), icon: Phone, onClick: onCall },
          { label: "WhatsApp", icon: MessageCircle, onClick: onWhatsApp },
          { label: t("leads.moreActions"), icon: MoreHorizontal, onClick: (event: React.MouseEvent) => onContextMenu(event) },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className="grid h-8 w-8 place-items-center rounded-control border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              aria-label={item.label}
              title={item.label}
              onClick={(event) => {
                event.stopPropagation();
                item.onClick(event);
              }}
            >
              <Icon size={15} />
            </button>
          );
        })}
      </span>
    </div>
  );
}

export function VirtualizedLeadTableRows({
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
  assignLead,
  callLead,
  whatsAppLead,
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
  assignLead: (lead: Lead, userId?: Id) => void;
  callLead: (lead: Lead) => void;
  whatsAppLead: (lead: Lead) => void;
  openContextMenu: (event: React.MouseEvent, lead: Lead) => void;
  t: Translate;
}) {
  const activeColumns = columnOrder.filter((column) => visibleColumns[column]);
  const needsWideTable = activeColumns.length > 5;
  const gridTemplateColumns = `${CRM_TABLE_CHECKBOX_COLUMN} ${activeColumns.map((column) => leadColumnWidths[column]).join(" ")} ${CRM_TABLE_ACTIONS_COLUMN}`;

  return (
    <div className="hidden overflow-x-auto lg:block">
      <div className="min-w-0" style={{ minWidth: needsWideTable ? CRM_TABLE_WIDE_MIN_WIDTH : undefined }}>
        {rows.map((lead, index) => {
          const responsible = teamList.find((member) => member.user.id === lead.responsible_user);
          return (
            <div
              key={lead.id}
              data-index={index}
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
                onAssign={(userId) => assignLead(lead, userId)}
                onCall={() => callLead(lead)}
                onWhatsApp={() => whatsAppLead(lead)}
                onContextMenu={(event) => openContextMenu(event, lead)}
                t={t}
              />
            </div>
          );
        })}
        {!rows.length ? null : (
          <div
            className="grid h-0"
            style={{ gridTemplateColumns, minWidth: needsWideTable ? CRM_TABLE_WIDE_MIN_WIDTH : CRM_TABLE_MIN_WIDTH }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
