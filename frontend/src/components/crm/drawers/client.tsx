import { CalendarClock, CheckCircle2, ClipboardList, Mail, MessageCircle, Phone, Tags, WalletCards } from "lucide-react";

import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { CrmCardPayload } from "../../../types";
import { Button } from "../../ui/Button";
import { EntityAttachmentsPanel, EntityCustomFieldsPanel } from "./panels";
import { EmptyBlock, getChannelLabel, SummaryItem } from "./shared";
import type { CrmDrawerEntity } from "./types";

export function ClientDrawerContent({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const client = data.client;
  const cleanPhone = client?.phone?.replace(/\D/g, "");
  if (!client) return <EmptyBlock title={t("nav.clients")} text={t("crmCard.loadError")} />;
  const openTasks = data.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const latestEvent = data.timeline[0];
  const latestConversation = data.conversations[0];
  const nextStep = client.next_step_title || openTasks[0]?.title || t("crmCard.snapshotNoTasks");

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-brand-100 bg-white/90 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{getChannelLabel(client.source, t)}</span>
              {client.is_vip ? <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">VIP</span> : null}
              {client.has_no_reply ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">{t("conversations.noReply")}</span> : null}
            </div>
            <h3 className="truncate text-xl font-black text-midnight">{client.full_name}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{[client.phone, client.email].filter(Boolean).join(" · ") || t("crmCard.noContacts")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" disabled={!client.phone} onClick={() => client.phone && (window.location.href = `tel:${client.phone}`)}>
              <Phone size={16} /> {t("crmCard.call")}
            </Button>
            <Button variant="secondary" disabled={!cleanPhone} onClick={() => cleanPhone && window.open(`https://wa.me/${cleanPhone}`, "_blank", "noopener,noreferrer")}>
              <MessageCircle size={16} /> WhatsApp
            </Button>
            <Button variant="secondary" disabled={!client.email} onClick={() => client.email && (window.location.href = `mailto:${client.email}`)}>
              <Mail size={16} /> Email
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("crmCard.snapshotNext")}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{nextStep}</p>
          </div>
          {client.next_step_date ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{formatDateTime(client.next_step_date)}</span> : null}
        </div>
        <div className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("crmCard.snapshotHistory")}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
              {latestEvent ? `${latestEvent.text || latestEvent.event_type} · ${formatDateTime(latestEvent.created_at)}` : t("crmCard.emptyTimelineText")}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("crmCard.snapshotMessages")}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{latestConversation?.last_message?.text || t("crmCard.noDialogsText")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem icon={ClipboardList} label={t("nav.leads")} value={data.meta?.related_counts.leads ?? data.leads.length} />
        <SummaryItem icon={WalletCards} label={t("nav.deals")} value={data.meta?.related_counts.deals ?? data.deals.length} />
        <SummaryItem icon={CalendarClock} label={t("nav.appointments")} value={data.meta?.related_counts.appointments ?? data.appointments.length} />
        <SummaryItem icon={CheckCircle2} label={t("nav.tasks")} value={data.meta?.related_counts.tasks ?? data.tasks.length} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><WalletCards size={14} /> {t("nav.deals")}</p>
          <p className="font-bold text-midnight">{data.deals[0]?.title || "-"}</p>
          <p className="mt-1 text-sm text-slate-500">{data.deals[0] ? `${Number(data.deals[0].amount || 0).toLocaleString("ru-RU")} ${data.deals[0].currency}` : t("crmCard.snapshotNoTasks")}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><CalendarClock size={14} /> {t("nav.appointments")}</p>
          <p className="font-bold text-midnight">{data.appointments[0]?.service_name || data.appointments[0]?.service || "-"}</p>
          <p className="mt-1 text-sm text-slate-500">{data.appointments[0] ? formatDateTime(data.appointments[0].start_at) : t("crmCard.noTasksText")}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><MessageCircle size={14} /> {t("crmCard.messages")}</p>
          <p className="font-bold text-midnight">{latestConversation ? getChannelLabel(latestConversation.channel, t) : "-"}</p>
          <p className="mt-1 text-sm text-slate-500">{latestConversation?.last_message_at ? formatDateTime(latestConversation.last_message_at) : t("crmCard.noDialogsText")}</p>
        </div>
      </div>

      {data.tags.length ? (
        <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><Tags size={14} /> {t("clients.tags")}</p>
          <div className="flex flex-wrap gap-2">
            {data.tags.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ backgroundColor: `${item.tag_color || "#2563eb"}18`, color: item.tag_color || "#2563eb" }}>
                {item.tag_name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 text-sm leading-6 text-slate-700 shadow-sm">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("clients.notes")}</p>
        {client.notes || t("crmCard.noNotesText")}
      </div>
      <EntityCustomFieldsPanel data={data} entity={entity} />
      <EntityAttachmentsPanel data={data} />
    </div>
  );
}
