import { ChevronLeft, ChevronRight, Mail, MessageCircle, MoreHorizontal, Phone, Tag, XCircle } from "lucide-react";

import type { CrmDrawerEntity } from "../../../components/crm/CrmEntityDrawer";
import { Button } from "../../../components/ui/Button";
import { formatDateTime } from "../../../lib/format";
import type { Client, Lead, Service } from "../../../types";
import { statusClass, type Translate } from "../types";
import { getSourceLabel, getStatusLabel, initials, leadTitle, nextAction, Pill, TruncatedText } from "../utils/leadFormat";
import { SourceBadge } from "./common/SourceBadge";

export function CollapsedLeadDetailPanel({
  selected,
  selectedClient,
  clientList,
  onToggleCollapsed,
  setNextActionOpen,
  setDrawerEntity,
  t,
}: {
  selected: Lead;
  selectedClient?: Client;
  clientList: Client[];
  onToggleCollapsed?: () => void;
  setNextActionOpen: (value: boolean) => void;
  setDrawerEntity: (entity: CrmDrawerEntity | null) => void;
  t: Translate;
}) {
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
        <Tag size={17} />
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg px-0" onClick={() => setDrawerEntity({ type: "lead", id: selected.id })}>
        <MoreHorizontal size={17} />
      </Button>
    </div>
  );
}

export function LeadContactSummary({
  selected,
  selectedClient,
  selectedService,
  clientList,
  onWhatsAppTemplate,
  onToggleCollapsed,
  onClose,
  t,
}: {
  selected: Lead;
  selectedClient?: Client;
  selectedService?: Service;
  clientList: Client[];
  onWhatsAppTemplate: (lead: Lead, template?: string) => void;
  onToggleCollapsed?: () => void;
  onClose?: () => void;
  t: Translate;
}) {
  return (
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
        <Button variant="secondary" className="rounded-lg px-2 text-xs" disabled={!selectedClient?.phone} onClick={() => onWhatsAppTemplate(selected)}>
          <MessageCircle size={15} /> WhatsApp
        </Button>
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("leads.nextStep")}</p>
        <TruncatedText className="mt-1 text-sm font-bold text-midnight">{nextAction(selected, t)}</TruncatedText>
        <p className="mt-1 text-xs text-slate-500">{formatDateTime(selected.updated_at)}</p>
      </div>
    </div>
  );
}
