import { BriefcaseBusiness, CalendarDays, ClipboardList, Inbox, Mail, MessageCircle, Phone, Tags } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";

import { EntityWorkspaceMetric, EntityWorkspaceSection as SharedEntityWorkspaceSection } from "../../../components/crm";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/StateViews";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { cn } from "../../../lib/cn";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { Appointment, BotConversation, Client, CrmCardActionDetail, Deal, Id, Lead, Task } from "../../../types";
import { money, sourceLabel } from "../utils";

export function ClientWorkspaceSection({ title, icon: Icon, children, className }: { title: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return <SharedEntityWorkspaceSection title={title} icon={Icon as ElementType} className={className}>{children as ReactNode}</SharedEntityWorkspaceSection>;
}

export function ClientWorkspaceMetric({ label, value }: { label: string; value: number | string }) {
  return <EntityWorkspaceMetric label={label} value={value} />;
}

function EmptyRelated({ title }: { title: string }) {
  return <EmptyState title={title} />;
}

export function ClientContactPanel({ client }: { client: Client }) {
  const { t } = useI18n();
  const phoneDigits = client.phone?.replace(/\D/g, "") || "";
  const contactRows = [
    { icon: Phone, label: t("clients.phone"), value: client.phone || t("clients.phoneMissing") },
    { icon: Mail, label: t("common.email"), value: client.email || t("clients.emailMissing") },
    { icon: BriefcaseBusiness, label: t("clients.source"), value: sourceLabel(client.source, t) },
  ];

  return (
    <div className="grid gap-3">
      {contactRows.map(({ icon: Icon, label, value }) => (
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
          {t("clients.call")}
        </Button>
        <Button type="button" variant="secondary" disabled={!phoneDigits} onClick={() => phoneDigits && window.open(`https://wa.me/${phoneDigits}`, "_blank", "noopener,noreferrer")}>
          <MessageCircle size={16} />
          {t("clients.openWhatsapp")}
        </Button>
      </div>
    </div>
  );
}

export function ActionPanel({ actions }: { actions: CrmCardActionDetail[] }) {
  const { t } = useI18n();
  if (!actions.length) return <EmptyRelated title={t("common.noResults")} />;
  return (
    <div className="space-y-2">
      {actions.slice(0, 6).map((action) => {
        const translatedLabel = t(action.label_key);
        const translatedScope = t(`permissions.scope.${action.scope}`);
        return (
          <div key={action.id} className={cn("rounded-control border px-3 py-2", action.allowed ? "border-emerald-100 bg-emerald-50" : "border-[#E6DDD2] bg-[#F2EDE6]")}>
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-bold text-[#17120F]">{translatedLabel === action.label_key ? action.id.replace(/_/g, " ") : translatedLabel}</p>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", action.allowed ? "bg-white text-emerald-700" : "bg-white text-[#8A7B70]")}>
                {translatedScope === `permissions.scope.${action.scope}` ? action.scope : translatedScope}
              </span>
            </div>
            {!action.allowed && action.reason ? <p className="mt-1 text-xs font-semibold text-[#8A7B70]">{action.reason}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export function DealsList({ deals }: { deals: Deal[] }) {
  const { t } = useI18n();
  if (!deals.length) return <EmptyRelated title={t("clients.noDeals")} />;
  return (
    <div className="space-y-2">
      {deals.map((deal) => (
        <Link key={deal.id} to={`/app/deals/${deal.id}`} className="block rounded-control border border-[#E6DDD2] bg-[#F2EDE6] px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-bold text-[#17120F]">{deal.title}</p>
            <StatusBadge status={deal.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-[#8A7B70]">{money(deal.amount, deal.currency)} · {deal.stage_name || t("nav.deals")}</p>
        </Link>
      ))}
    </div>
  );
}

export function LeadsList({ leads }: { leads: Lead[] }) {
  const { t } = useI18n();
  if (!leads.length) return <EmptyRelated title={t("leads.emptyTitle")} />;
  return (
    <div className="space-y-2">
      {leads.map((lead) => (
        <Link key={lead.id} to={`/app/leads/${lead.id}`} className="block rounded-control border border-[#E6DDD2] bg-[#F2EDE6] px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-bold text-[#17120F]">{lead.message || t("crmCard.leadNumber", { id: lead.id })}</p>
            <StatusBadge status={lead.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-[#8A7B70]">{sourceLabel(lead.source, t)} · {formatDateTime(lead.created_at)}</p>
        </Link>
      ))}
    </div>
  );
}

export function TasksList({ tasks }: { tasks: Task[] }) {
  const { t } = useI18n();
  if (!tasks.length) return <EmptyRelated title={t("clients.noActiveTasks")} />;
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-control border border-[#E6DDD2] bg-[#F2EDE6] px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-bold text-[#17120F]">{task.title}</p>
            <StatusBadge status={task.priority} />
          </div>
          <p className="mt-1 text-xs font-semibold text-[#8A7B70]">{task.due_at ? formatDateTime(task.due_at) : t("tasks.dueNone")}</p>
        </div>
      ))}
    </div>
  );
}

export function AppointmentsList({ appointments }: { appointments: Appointment[] }) {
  const { t } = useI18n();
  if (!appointments.length) return <EmptyRelated title={t("appointments.emptyTitle")} />;
  return (
    <div className="space-y-2">
      {appointments.map((appointment) => (
        <Link key={appointment.id} to={`/app/calendar?appointment=${appointment.id}`} className="block rounded-control border border-[#E6DDD2] bg-[#F2EDE6] px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-bold text-[#17120F]">{appointment.service_name || t("appointments.card")}</p>
            <StatusBadge status={appointment.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-[#8A7B70]">{formatDateTime(appointment.start_at)} · {appointment.resource_name || t("resources.noLinkedUser")}</p>
        </Link>
      ))}
    </div>
  );
}

export function ConversationsList({ conversations }: { conversations: BotConversation[] }) {
  const { t } = useI18n();
  if (!conversations.length) return <EmptyRelated title={t("conversations.emptyTitle")} />;
  return (
    <div className="space-y-2">
      {conversations.map((conversation) => (
        <Link key={conversation.id} to={`/app/conversations?conversation=${conversation.id}`} className="block rounded-control border border-[#E6DDD2] bg-[#F2EDE6] px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-bold text-[#17120F]">{conversation.last_message?.text || t("conversations.emptyMessage")}</p>
            <StatusBadge status={conversation.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-[#8A7B70]">{conversation.channel} · {formatDateTime(conversation.last_message_at || conversation.updated_at)}</p>
        </Link>
      ))}
    </div>
  );
}

export function TimelineList({ cardTimeline }: { cardTimeline: Array<{ id: Id; text: string; event_type: string; created_at: string }> }) {
  const { t } = useI18n();
  if (!cardTimeline.length) return <EmptyRelated title={t("clients.emptyHistory")} />;
  return (
    <div className="space-y-3">
      {cardTimeline.slice(0, 8).map((event) => (
        <div key={event.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-sm">
          <p className="text-xs font-semibold text-[#8A7B70]">{formatDateTime(event.created_at)}</p>
          <div className="min-w-0">
            <p className="truncate font-bold text-[#17120F]">{event.text || event.event_type}</p>
            <p className="mt-0.5 text-xs font-semibold text-[#8A7B70]">{event.event_type}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export const clientWorkspaceIcons = {
  actions: ClipboardList,
  appointments: CalendarDays,
  contacts: Phone,
  conversations: MessageCircle,
  deals: BriefcaseBusiness,
  leads: Inbox,
  tags: Tags,
  tasks: ClipboardList,
  timeline: CalendarDays,
};
