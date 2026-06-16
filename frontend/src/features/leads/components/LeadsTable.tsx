import { CheckCheck, ClipboardList, MessageCircle, MoreHorizontal, Phone } from "lucide-react";

import { cn } from "../../../lib/cn";
import { formatDateTime } from "../../../lib/format";
import type { Client, Id, Lead, Service } from "../../../types";
import { kanbanStatuses, leadColumnWidths, statusClass, type LeadAiInsight, type LeadColumnKey, type Translate } from "../types";
import { formatRelativeTime, getClient, getService, getSourceLabel, getStatusLabel, initials, leadAiInsight, nextAction, TruncatedText } from "../utils/leadFormat";
import { SourceBadge } from "./common/SourceBadge";

function ManagerAvatar({ name }: { name?: string }) {
  if (!name) return <span className="text-xs font-bold text-slate-500">-</span>;
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-black text-brand-700 ring-1 ring-white" title={name}>
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
  const needsWideTable = activeColumns.length > 5;
  const gridTemplateColumns = `32px ${activeColumns.map((column) => leadColumnWidths[column]).join(" ")} 72px`;
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
    ai: (
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2 text-xs font-black">
          <span className={cn(aiInsight.lossRisk >= 70 ? "text-red-700" : aiInsight.score >= 75 ? "text-emerald-700" : "text-amber-700")}>{aiInsight.score}</span>
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
        "group grid min-w-0 items-center border-b border-slate-100 px-4 py-3.5 text-left text-sm transition hover:bg-slate-50",
        needsWideTable && "min-w-[1120px]",
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
      <span className="flex w-[72px] items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="hidden h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-brand-700 group-hover:grid" onClick={onCall} aria-label={t("leads.call")}>
          <Phone size={16} />
        </button>
        <button type="button" className="hidden h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-emerald-700 group-hover:grid" onClick={onWhatsApp} aria-label="WhatsApp">
          <MessageCircle size={16} />
        </button>
        <button type="button" className="hidden h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-midnight group-hover:grid" onClick={onTask} aria-label={t("leads.createTask")}>
          <ClipboardList size={16} />
        </button>
        <span className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 group-hover:hidden">
          <MoreHorizontal size={18} />
        </span>
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
  const activeColumns = columnOrder.filter((column) => visibleColumns[column]);
  const needsWideTable = activeColumns.length > 5;
  const gridTemplateColumns = `32px ${activeColumns.map((column) => leadColumnWidths[column]).join(" ")} 72px`;

  return (
    <div className="hidden h-full overflow-auto lg:block">
      <div className={cn("min-w-0", needsWideTable && "min-w-[1120px]")}>
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
        {!rows.length ? null : (
          <div className={cn("grid h-0 min-w-0", needsWideTable && "min-w-[1120px]")} style={{ gridTemplateColumns }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
