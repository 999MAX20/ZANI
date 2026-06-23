import { Archive, CalendarClock, CheckCircle2, ClipboardList, Mail, MessageCircle, Pencil, Phone, Tag, Tags, WalletCards } from "lucide-react";

import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { CrmCardPayload } from "../../../types";
import { Button } from "../../ui/Button";
import { EntityAttachmentsPanel, EntityCustomFieldsPanel } from "./panels";
import { drawerSurfaceClass, EmptyBlock, getChannelLabel, SummaryItem } from "./shared";
import type { CrmDrawerEntity } from "./types";
import type { ClientDrawerActions } from "../CrmEntityDrawer";

export function ClientDrawerContent({ data, entity, actions }: { data: CrmCardPayload; entity: CrmDrawerEntity; actions?: ClientDrawerActions }) {
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
      <div className={drawerSurfaceClass}>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{getChannelLabel(client.source, t)}</span>
            {client.is_vip ? <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">VIP</span> : null}
            {client.has_no_reply ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">{t("conversations.noReply")}</span> : null}
          </div>
          <h3 className="truncate text-xl font-black text-midnight">{client.full_name}</h3>
          <p className="mt-1 break-words text-sm font-semibold text-slate-500">{[client.phone, client.email].filter(Boolean).join(" · ") || t("crmCard.noContacts")}</p>
        </div>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2 border-t border-slate-100 pt-4">
          {actions?.onEdit ? (
            <Button variant="secondary" className="min-w-0 px-3" onClick={() => actions.onEdit?.(client)}>
              <Pencil className="shrink-0" size={16} />
              <span className="truncate">{t("clients.edit")}</span>
            </Button>
          ) : null}
          {actions?.onAddTag ? (
            <Button variant="secondary" className="min-w-0 px-3" onClick={() => actions.onAddTag?.(client)}>
              <Tag className="shrink-0" size={16} />
              <span className="truncate">{t("clients.addTag")}</span>
            </Button>
          ) : null}
          <Button variant="secondary" className="min-w-0 px-3" disabled={!client.phone} onClick={() => client.phone && (window.location.href = `tel:${client.phone}`)}>
            <Phone className="shrink-0" size={16} />
            <span className="truncate">{t("crmCard.call")}</span>
          </Button>
          <Button variant="secondary" className="min-w-0 px-3" disabled={!cleanPhone} onClick={() => cleanPhone && window.open(`https://wa.me/${cleanPhone}`, "_blank", "noopener,noreferrer")}>
            <MessageCircle className="shrink-0" size={16} />
            <span className="truncate">WhatsApp</span>
          </Button>
          <Button variant="secondary" className="min-w-0 px-3" disabled={!client.email} onClick={() => client.email && (window.location.href = `mailto:${client.email}`)}>
            <Mail className="shrink-0" size={16} />
            <span className="truncate">Email</span>
          </Button>
          {actions?.onArchive ? (
            <Button variant="danger" className="min-w-0 px-3" onClick={() => actions.onArchive?.(client)}>
              <Archive className="shrink-0" size={16} />
              <span className="truncate">{t("clients.archiveAction")}</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className={drawerSurfaceClass}>
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
        <div className={drawerSurfaceClass}>
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><WalletCards size={14} /> {t("nav.deals")}</p>
          <p className="font-bold text-midnight">{data.deals[0]?.title || "-"}</p>
          <p className="mt-1 text-sm text-slate-500">{data.deals[0] ? `${Number(data.deals[0].amount || 0).toLocaleString("ru-RU")} ${data.deals[0].currency}` : t("crmCard.snapshotNoTasks")}</p>
        </div>
        <div className={drawerSurfaceClass}>
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><CalendarClock size={14} /> {t("nav.appointments")}</p>
          <p className="font-bold text-midnight">{data.appointments[0]?.service_name || data.appointments[0]?.service || "-"}</p>
          <p className="mt-1 text-sm text-slate-500">{data.appointments[0] ? formatDateTime(data.appointments[0].start_at) : t("crmCard.noTasksText")}</p>
        </div>
        <div className={drawerSurfaceClass}>
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400"><MessageCircle size={14} /> {t("crmCard.messages")}</p>
          <p className="font-bold text-midnight">{latestConversation ? getChannelLabel(latestConversation.channel, t) : "-"}</p>
          <p className="mt-1 text-sm text-slate-500">{latestConversation?.last_message_at ? formatDateTime(latestConversation.last_message_at) : t("crmCard.noDialogsText")}</p>
        </div>
      </div>

      {data.tags.length ? (
        <div className={drawerSurfaceClass}>
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

      <div className={`${drawerSurfaceClass} text-sm leading-6 text-slate-700`}>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("clients.notes")}</p>
        {client.notes || t("crmCard.noNotesText")}
      </div>
      <EntityCustomFieldsPanel data={data} entity={entity} />
      <EntityAttachmentsPanel data={data} entity={entity} />
    </div>
  );
}
