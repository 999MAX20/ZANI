import { Activity, BriefcaseBusiness, CalendarDays, ClipboardList, Inbox, MessageCircle, Phone, TrendingUp, UserRound } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";

import { EntityWorkspaceMetric, EntityWorkspaceSection as SharedEntityWorkspaceSection } from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate, formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { Client, Deal, Lead, PipelineStage } from "../../../types";
import { initials, money, sourceLabel, stageProbability } from "../utils/dealHelpers";

export function DealWorkspaceSection({ title, icon: Icon, children, className }: { title: string; icon: ElementType; children: ReactNode; className?: string }) {
  return <SharedEntityWorkspaceSection title={title} icon={Icon} className={className}>{children}</SharedEntityWorkspaceSection>;
}

export function DealWorkspaceMetric({ label, value }: { label: string; value: number | string }) {
  return <EntityWorkspaceMetric label={label} value={value} />;
}

export function DealClientPanel({ deal, client }: { deal: Deal; client: Client | null }) {
  const { t } = useI18n();
  const phone = client?.phone || deal.client_phone || "";
  const phoneDigits = phone.replace(/\D/g, "");
  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 items-center gap-3 rounded-control bg-[#F2EDE6] px-3 py-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-50 text-sm font-black text-brand-700">
          {initials(client?.full_name || deal.client_name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#17120F]">{client?.full_name || deal.client_name || t("deals.clientMissing")}</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-[#8A7B70]">{phone || client?.email || deal.client_email || t("deals.noContacts")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" disabled={!phoneDigits} onClick={() => phoneDigits && window.open(`tel:${phoneDigits}`, "_self")}>
          <Phone size={16} />
          {t("clients.call")}
        </Button>
        <Button type="button" variant="secondary" disabled={!phoneDigits} onClick={() => phoneDigits && window.open(`https://wa.me/${phoneDigits}`, "_blank", "noopener,noreferrer")}>
          <MessageCircle size={16} />
          {t("clients.openWhatsapp")}
        </Button>
      </div>
      {client ? (
        <Link
          to={`/app/clients/${client.id}`}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-[#E6DDD2] bg-white px-4 py-2 text-sm font-semibold text-midnight shadow-sm transition duration-150 hover:border-[#D96718] hover:bg-[#F2EDE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {t("leads.openClient")}
        </Link>
      ) : null}
    </div>
  );
}

export function DealOverviewPanel({ deal, stage }: { deal: Deal; stage?: PipelineStage }) {
  const { t } = useI18n();
  const probability = stageProbability(deal, stage);
  return (
    <div className="grid gap-3">
      <MetaRow label={t("deals.amount")} value={money(deal.amount, deal.currency)} />
      <MetaRow label={t("deals.stage")} value={stage?.name || deal.stage_name || t("deals.noStage")} />
      <MetaRow label={t("deals.probability")} value={`${probability}%`} />
      <MetaRow label={t("deals.source")} value={sourceLabel(deal.source, t)} />
      <MetaRow label={t("deals.responsible")} value={deal.owner_name || t("deals.unassigned")} />
      <MetaRow label={t("deals.closing")} value={deal.expected_close_at ? formatDate(deal.expected_close_at) : t("deals.notSet")} />
      <div className="flex items-center justify-between gap-3 rounded-control bg-[#F2EDE6] px-3 py-2">
        <span className="text-xs font-semibold text-[#8A7B70]">{t("deals.status")}</span>
        <StatusBadge status={deal.status} />
      </div>
      {deal.notes ? <p className="rounded-control bg-[#F2EDE6] p-3 text-sm font-semibold leading-6 text-[#5F554D]">{deal.notes}</p> : null}
    </div>
  );
}

export function DealLinkedLeadPanel({ lead }: { lead: Lead | null }) {
  const { t } = useI18n();
  if (!lead) return <p className="text-sm font-semibold text-[#8A7B70]">{t("deals.notLinked")}</p>;
  return (
    <Link to={`/app/leads/${lead.id}`} className="block rounded-control border border-[#E6DDD2] bg-[#F2EDE6] px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-bold text-[#17120F]">{lead.client_name || t("crmCard.leadNumber", { id: lead.id })}</p>
        <StatusBadge status={lead.status} />
      </div>
      <p className="mt-1 text-xs font-semibold text-[#8A7B70]">{sourceLabel(lead.source, t)} / {formatDateTime(lead.created_at)}</p>
    </Link>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-control bg-[#F2EDE6] px-3 py-2">
      <span className="shrink-0 text-xs font-semibold text-[#8A7B70]">{label}</span>
      <span className="min-w-0 truncate text-sm font-bold text-[#17120F]">{value}</span>
    </div>
  );
}

export const dealWorkspaceIcons = {
  actions: ClipboardList,
  appointments: CalendarDays,
  client: UserRound,
  conversations: MessageCircle,
  deal: BriefcaseBusiness,
  lead: Inbox,
  metrics: TrendingUp,
  tasks: ClipboardList,
  timeline: Activity,
};
