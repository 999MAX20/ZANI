import { Archive, CalendarClock, CheckCircle2, ClipboardList, Mail, MessageCircle, Pencil, Phone, ShieldCheck, Tag, Tags, WalletCards } from "lucide-react";

import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { CrmCardPayload } from "../../../types";
import { Button } from "../../ui/Button";
import { EntityAttachmentsPanel, EntityCustomFieldsPanel } from "./panels";
import { drawerSurfaceClass, EmptyBlock, getChannelLabel, SummaryItem } from "./shared";
import type { CrmDrawerEntity } from "./types";
import type { ClientDrawerActions } from "../CrmEntityDrawer";

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function consentStatusLabel(status: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    opted_in: "clients.consentOptedIn",
    opted_out: "clients.consentOptedOut",
    unknown: "clients.consentUnknown",
  };
  return t(labels[status] || labels.unknown);
}

export function ClientDrawerContent({ data, entity, actions }: { data: CrmCardPayload; entity: CrmDrawerEntity; actions?: ClientDrawerActions }) {
  const { t } = useI18n();
  const client = data.client;
  const cleanPhone = client?.phone?.replace(/\D/g, "");
  if (!client) return <EmptyBlock title={t("nav.clients")} text={t("crmCard.loadError")} />;
  const openTasks = data.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const latestEvent = data.timeline[0];
  const latestConversation = data.conversations[0];
  const nextStep = client.next_step_title || openTasks[0]?.title || t("crmCard.snapshotNoTasks");
  const sourceContext = client.source_context_json || {};
  const attributionRows = [
    { label: t("clients.source"), value: getChannelLabel(client.source, t) },
    { label: t("clients.sourceDetail"), value: client.source_detail },
    { label: t("clients.sourceCampaign"), value: textValue(sourceContext.campaign) },
    { label: t("clients.sourceDomain"), value: textValue(sourceContext.page_domain) },
  ].filter((item) => item.value);
  const consents = data.consents || [];

  return (
    <div className="space-y-4">
      <div className={drawerSurfaceClass}>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-zani-muted">{getChannelLabel(client.source, t)}</span>
            {client.is_vip ? <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">VIP</span> : null}
            {client.has_no_reply ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">{t("conversations.noReply")}</span> : null}
          </div>
          <h3 className="truncate text-xl font-semibold text-zani-ink">{client.full_name}</h3>
          <p className="mt-1 break-words text-sm font-semibold text-zani-muted">{[client.phone, client.email].filter(Boolean).join(" В· ") || t("crmCard.noContacts")}</p>
        </div>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2 border-t border-zani-border pt-4">
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("crmCard.snapshotNext")}</p>
            <p className="mt-1 text-sm font-semibold text-zani-subtle">{nextStep}</p>
          </div>
          {client.next_step_date ? <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-zani-muted">{formatDateTime(client.next_step_date)}</span> : null}
        </div>
        <div className="grid gap-3 border-t border-zani-border pt-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("crmCard.snapshotHistory")}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-zani-text">
              {latestEvent ? `${latestEvent.text || latestEvent.event_type} В· ${formatDateTime(latestEvent.created_at)}` : t("crmCard.emptyTimelineText")}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("crmCard.snapshotMessages")}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-zani-text">{latestConversation?.last_message?.text || t("crmCard.noDialogsText")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem icon={ClipboardList} label={t("nav.leads")} value={data.meta?.related_counts.leads ?? data.leads.length} />
        <SummaryItem icon={WalletCards} label={t("nav.deals")} value={data.meta?.related_counts.deals ?? data.deals.length} />
        <SummaryItem icon={CalendarClock} label={t("nav.appointments")} value={data.meta?.related_counts.appointments ?? data.appointments.length} />
        <SummaryItem icon={CheckCircle2} label={t("nav.tasks")} value={data.meta?.related_counts.tasks ?? data.tasks.length} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className={drawerSurfaceClass}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("clients.sourceAttribution")}</p>
          <div className="space-y-2">
            {attributionRows.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-3 text-sm">
                <span className="font-semibold text-zani-muted">{item.label}</span>
                <span className="min-w-0 text-right font-bold text-zani-ink">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={drawerSurfaceClass}>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><ShieldCheck size={14} /> {t("clients.consentStatus")}</p>
          <div className="space-y-2">
            {consents.map((consent) => (
              <div key={consent.channel} className="rounded-control bg-surface-muted px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-zani-subtle">{getChannelLabel(consent.channel, t)}</span>
                  <span className="font-semibold text-zani-ink">{consentStatusLabel(consent.status, t)}</span>
                </div>
                {consent.source ? <p className="mt-1 text-xs font-semibold text-zani-muted">{consent.source}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className={drawerSurfaceClass}>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><WalletCards size={14} /> {t("nav.deals")}</p>
          <p className="font-bold text-zani-ink">{data.deals[0]?.title || "-"}</p>
          <p className="mt-1 text-sm text-zani-muted">{data.deals[0] ? `${Number(data.deals[0].amount || 0).toLocaleString("ru-RU")} ${data.deals[0].currency}` : t("crmCard.snapshotNoTasks")}</p>
        </div>
        <div className={drawerSurfaceClass}>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><CalendarClock size={14} /> {t("nav.appointments")}</p>
          <p className="font-bold text-zani-ink">{data.appointments[0]?.service_name || data.appointments[0]?.service || "-"}</p>
          <p className="mt-1 text-sm text-zani-muted">{data.appointments[0] ? formatDateTime(data.appointments[0].start_at) : t("crmCard.noTasksText")}</p>
        </div>
        <div className={drawerSurfaceClass}>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><MessageCircle size={14} /> {t("crmCard.messages")}</p>
          <p className="font-bold text-zani-ink">{latestConversation ? getChannelLabel(latestConversation.channel, t) : "-"}</p>
          <p className="mt-1 text-sm text-zani-muted">{latestConversation?.last_message_at ? formatDateTime(latestConversation.last_message_at) : t("crmCard.noDialogsText")}</p>
        </div>
      </div>

      {data.tags.length ? (
        <div className={drawerSurfaceClass}>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint"><Tags size={14} /> {t("clients.tags")}</p>
          <div className="flex flex-wrap gap-2">
            {data.tags.map((item) => (
              <span key={item.id} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: `${item.tag_color || "#2563eb"}18`, color: item.tag_color || "#2563eb" }}>
                {item.tag_name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className={`${drawerSurfaceClass} text-sm leading-6 text-zani-text`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zani-faint">{t("clients.notes")}</p>
        {client.notes || t("crmCard.noNotesText")}
      </div>
      <EntityCustomFieldsPanel data={data} entity={entity} />
      <EntityAttachmentsPanel data={data} entity={entity} />
    </div>
  );
}
