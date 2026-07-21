import { Activity, BriefcaseBusiness, CalendarDays, ClipboardList, Inbox, Mail, MessageCircle, Phone, Sparkles, UserRound } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";

import { EntityWorkspaceMetric, EntityWorkspaceSection as SharedEntityWorkspaceSection } from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { Client, Lead } from "../../../types";
import { getSourceLabel, initials, nextAction } from "../utils/leadFormat";

export function LeadWorkspaceSection({ title, icon: Icon, children, className }: { title: string; icon: ElementType; children: ReactNode; className?: string }) {
  return <SharedEntityWorkspaceSection title={title} icon={Icon} className={className}>{children}</SharedEntityWorkspaceSection>;
}

export function LeadWorkspaceMetric({ label, value }: { label: string; value: number | string }) {
  return <EntityWorkspaceMetric label={label} value={value} />;
}

export function LeadContactPanel({ lead, client }: { lead: Lead; client: Client | null }) {
  const { t } = useI18n();
  const phone = client?.phone || lead.client_phone || "";
  const email = client?.email || lead.client_email || "";
  const phoneDigits = phone.replace(/\D/g, "");
  const rows = [
    { icon: Phone, label: t("leads.tablePhone"), value: phone || t("leads.phoneMissing") },
    { icon: Mail, label: t("common.email"), value: email || t("leads.emailMissing") },
    { icon: Inbox, label: t("leads.source"), value: getSourceLabel(lead.source, t) },
    { icon: UserRound, label: t("leads.responsible"), value: lead.responsible_name || t("leads.unassigned") },
  ];

  return (
    <div className="grid gap-3">
      {rows.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex min-w-0 items-center gap-3 rounded-control bg-[#F2EDE6] px-3 py-2">
          <Icon size={16} className="shrink-0 text-[#8A7B70]" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#8A7B70]">{label}</p>
            <p className="truncate text-sm font-bold text-[#17120F]">{value}</p>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" disabled={!phoneDigits} onClick={() => phoneDigits && window.open(`tel:${phoneDigits}`, "_self")}>
          <Phone size={16} />
          {t("leads.call")}
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

export function LeadIntakePanel({ lead }: { lead: Lead }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-control bg-[#F2EDE6] px-3 py-2">
        <span className="text-xs font-semibold text-[#8A7B70]">{t("leads.tableStatus")}</span>
        <StatusBadge status={lead.status} />
      </div>
      <div className="rounded-control bg-[#F2EDE6] p-3">
        <p className="text-xs font-semibold text-[#8A7B70]">{t("leads.clientRequest")}</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#5F554D]">{lead.message || t("leads.noLeadComment")}</p>
      </div>
      <div className="grid gap-2 text-sm">
        <MetaRow label={t("leads.nextStep")} value={lead.recommended_action || nextAction(lead, t)} />
        <MetaRow label={t("leads.createdAt")} value={formatDateTime(lead.created_at)} />
        <MetaRow label={t("leads.updatedAt")} value={formatDateTime(lead.updated_at)} />
      </div>
    </div>
  );
}

export function LeadAiPanel({ lead }: { lead: Lead }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Score label={t("leads.aiScoreShort")} value={lead.ai_score ?? "-"} />
        <Score label={t("leads.aiRiskShort")} value={lead.loss_risk ?? "-"} />
      </div>
      <p className="rounded-control bg-[#F2EDE6] p-3 text-sm font-semibold leading-6 text-[#5F554D]">{lead.recommended_action || nextAction(lead, t)}</p>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-control border border-[#E6DDD2] bg-white px-3 py-2">
      <p className="text-xs font-semibold text-[#8A7B70]">{label}</p>
      <p className="mt-1 text-xl font-black text-midnight">{value}</p>
    </div>
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

export function leadAvatarLabel(lead: Lead, client: Client | null, fallback: string) {
  return initials(client?.full_name || lead.client_name || fallback);
}

export const leadWorkspaceIcons = {
  actions: ClipboardList,
  ai: Sparkles,
  appointments: CalendarDays,
  contact: Phone,
  conversations: MessageCircle,
  deals: BriefcaseBusiness,
  intake: Inbox,
  tasks: ClipboardList,
  timeline: Activity,
};
