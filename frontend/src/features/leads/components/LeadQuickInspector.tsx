import {
  BriefcaseBusiness,
  CalendarDays,
  MessageCircle,
  Phone,
  SquareArrowOutUpRight,
  UserRound,
} from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDateTime } from "../../../lib/format";
import type { Client, Lead, Service } from "../../../types";
import type { LeadAiInsight, Translate } from "../types";
import {
  getSourceLabel,
  leadTitle,
  nextAction,
  TruncatedText,
} from "../utils/leadFormat";
import { SourceBadge } from "./common/SourceBadge";

export function LeadQuickInspector({
  lead,
  client,
  service,
  aiInsight,
  related,
  t,
  onOpen,
  onCall,
  onWhatsApp,
}: {
  lead: Lead | null;
  client?: Client;
  service?: Service;
  aiInsight: LeadAiInsight | null;
  related: {
    deals: number;
    appointments: number;
    conversations: number;
  };
  t: Translate;
  onOpen: (lead: Lead) => void;
  onCall: (lead: Lead) => void;
  onWhatsApp: (lead: Lead) => void;
}) {
  if (!lead) {
    return (
      <div className="grid min-h-[260px] place-items-center p-4 text-center">
        <div>
          <p className="text-sm font-bold text-zani-text">
            {t("leads.selectLead")}
          </p>
          <p className="mt-1 text-sm font-semibold text-zani-muted">
            {t("leads.emptyText")}
          </p>
        </div>
      </div>
    );
  }

  const title = leadTitle(lead, client ? [client] : [], t);
  const phone = client?.phone || lead.client_phone || "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-zani-border p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zani-muted">
              {t("leads.selectLead")}
            </p>
            <h2 className="mt-1 truncate text-base font-bold text-zani-text">
              {title}
            </h2>
          </div>
          <StatusBadge status={lead.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SourceBadge source={lead.source} t={t} />
          <span className="inline-flex items-center rounded-lg bg-surface-muted px-2 py-1 text-xs font-bold text-zani-muted ring-1 ring-zani-border">
            {service?.name || getSourceLabel(lead.source, t)}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <section className="rounded-card border border-zani-border bg-surface-muted p-3">
          <p className="text-xs font-semibold text-zani-muted">
            {t("leads.nextStep")}
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-zani-text">
            {lead.recommended_action || nextAction(lead, t)}
          </p>
          <p className="mt-1 text-xs font-semibold text-zani-muted">
            {formatDateTime(lead.updated_at)}
          </p>
        </section>

        <div className="grid gap-2">
          <MetaRow
            icon={Phone}
            label={t("leads.tablePhone")}
            value={phone || t("leads.phoneMissing")}
          />
          <MetaRow
            icon={UserRound}
            label={t("leads.responsible")}
            value={lead.responsible_name || t("leads.unassigned")}
          />
        </div>

        <section className="rounded-card border border-ai-100 bg-ai-50 p-3">
          <p className="flex items-center justify-between gap-2 text-xs font-semibold text-ai-700">
            <span>{t("leads.aiNextBestAction")}</span>
            <span>
              {t("leads.aiScoreShort")}:{" "}
              {aiInsight?.score ?? lead.ai_score ?? "-"}
            </span>
          </p>
          <TruncatedText className="mt-2 text-sm font-bold text-ai-700">
            {aiInsight?.recommendation ||
              lead.recommended_action ||
              nextAction(lead, t)}
          </TruncatedText>
        </section>

        <div className="grid grid-cols-3 gap-2">
          <RelatedStat
            icon={BriefcaseBusiness}
            value={related.deals}
            label={t("leads.relatedDeals")}
          />
          <RelatedStat
            icon={CalendarDays}
            value={related.appointments}
            label={t("leads.relatedBookings")}
          />
          <RelatedStat
            icon={MessageCircle}
            value={related.conversations}
            label={t("leads.relatedConversations")}
          />
        </div>
      </div>

      <div className="grid gap-2 border-t border-zani-border p-4">
        <Button type="button" onClick={() => onOpen(lead)}>
          <SquareArrowOutUpRight size={16} />
          {t("leads.open")}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!phone}
            onClick={() => onCall(lead)}
          >
            <Phone size={16} />
            {t("leads.call")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!phone}
            onClick={() => onWhatsApp(lead)}
          >
            <MessageCircle size={16} />
            WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2">
      <Icon size={16} className="shrink-0 text-zani-muted" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zani-muted">{label}</p>
        <p className="truncate text-sm font-bold text-zani-text">{value}</p>
      </div>
    </div>
  );
}

function RelatedStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Phone;
  value: number;
  label: string;
}) {
  return (
    <div className="min-w-0 rounded-control bg-surface-muted p-2">
      <Icon size={15} className="text-zani-muted" />
      <p className="mt-2 text-base font-bold text-zani-text">{value}</p>
      <p className="truncate text-[11px] font-semibold text-zani-muted">
        {label}
      </p>
    </div>
  );
}
