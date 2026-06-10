import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, CalendarCheck, ChevronDown, ClipboardList, Edit3, Inbox, Mail, MessageCircle, MoreHorizontal, Phone, Plus, Sparkles, X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { ClientTableRow, Translate } from "../types";
import { money, priorityLabel, sourceLabel } from "../utils";
import { ClientAvatar, ClientStatusBadge, TagPill } from "./ClientPrimitives";

function DetailSection({ title, icon: Icon, action, children }: { title: string; icon?: LucideIcon; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
          {Icon ? <Icon size={16} className="text-slate-500" /> : null}
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ContactLine({ icon: Icon, children, action }: { icon: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 items-center gap-2 text-slate-700">
        <Icon size={15} className="shrink-0 text-slate-500" />
        <span className="truncate">{children}</span>
      </div>
      {action}
    </div>
  );
}

function TimelineRow({
  icon: Icon,
  title,
  meta,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  meta: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 text-sm">
      <p className="text-xs font-medium text-slate-500">{meta}</p>
      <div className="flex min-w-0 items-center gap-2 text-slate-700">
        <Icon size={15} className="shrink-0 text-slate-500" />
        <span className="min-w-0 truncate font-medium">{title}</span>
        {badge}
      </div>
    </div>
  );
}

export function ClientInspector({
  row,
  onClose,
  onEdit,
  onFullCard,
  onAddTag,
  onArchive,
  t,
}: {
  row: ClientTableRow | null;
  onClose: () => void;
  onEdit: () => void;
  onFullCard: () => void;
  onAddTag: () => void;
  onArchive: () => void;
  t: Translate;
}) {
  if (!row) {
    return (
      <aside className="min-h-[640px] border-l border-slate-200 bg-white">
        <div className="grid h-full place-items-center p-8 text-center">
          <div>
            <ClientAvatar name="Client" size="lg" />
            <p className="mt-4 text-sm font-bold text-slate-900">{t("clients.listHintTitle")}</p>
            <p className="mt-2 text-sm text-slate-500">{t("clients.listHintText")}</p>
          </div>
        </div>
      </aside>
    );
  }

  const { client } = row;
  const latestDeal = row.deals[0];
  const latestLead = row.leads[0];
  const latestAppointment = row.appointments[0];
  const openDealValue = row.deals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const mainTask = row.tasks[0];
  const historyItems: Array<{ key: string; icon: LucideIcon; title: string; meta: string; badge?: React.ReactNode }> = [
    ...row.conversations.slice(0, 2).map((conversation) => ({
      key: `conversation-${conversation.id}`,
      icon: Phone,
      title: conversation.last_message?.direction === "outbound" ? "Исходящий контакт" : "Входящий контакт",
      meta: formatDateTime(conversation.last_message_at || conversation.updated_at),
    })),
    ...row.leads.slice(0, 2).map((lead) => ({
      key: `lead-${lead.id}`,
      icon: Inbox,
      title: t("clients.leadFallback", { id: lead.id }),
      meta: formatDateTime(lead.created_at),
      badge: <StatusBadge status={lead.status} />,
    })),
    ...row.appointments.slice(0, 2).map((appointment) => ({
      key: `appointment-${appointment.id}`,
      icon: CalendarCheck,
      title: t("clients.bookingFallback", { id: appointment.id }),
      meta: formatDateTime(appointment.start_at),
      badge: <StatusBadge status={appointment.status} />,
    })),
  ].slice(0, 4);

  return (
    <aside className="min-h-0 border-l border-slate-200 bg-white xl:h-[calc(100vh-96px)] xl:overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <ClientAvatar name={client.full_name} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-bold text-slate-950">{client.full_name}</h2>
                <button type="button" className="text-slate-500 transition hover:text-slate-700" aria-label="Избранное">
                  <Sparkles size={14} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <ClientStatusBadge status={row.status} />
                <span className="text-xs font-medium text-slate-500">{formatDate(client.created_at)}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-1 border-b border-slate-200 text-center text-xs font-semibold text-slate-500">
          {["Обзор", `Сделки ${row.deals.length}`, `Задачи ${row.tasks.length}`, "Файлы"].map((tab, index) => (
            <button key={tab} type="button" className={index === 0 ? "border-b-2 border-blue-600 px-1 pb-2 text-blue-700" : "border-b-2 border-transparent px-1 pb-2 transition hover:text-slate-800"}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <DetailSection
        title="Контакты"
        action={
          <div className="flex items-center gap-1">
            <button type="button" onClick={onEdit} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label={t("clients.edit")}>
              <Edit3 size={15} />
            </button>
            <button type="button" onClick={onArchive} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label={t("clients.archiveAction")}>
              <MoreHorizontal size={15} />
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <ContactLine
            icon={Phone}
            action={
              client.phone ? (
                <button type="button" onClick={() => window.open(`https://wa.me/${client.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")} className="text-emerald-600 transition hover:text-emerald-700" aria-label="WhatsApp">
                  <MessageCircle size={16} />
                </button>
              ) : null
            }
          >
            {client.phone || t("clients.noContacts")}
          </ContactLine>
          <ContactLine icon={Mail}>{client.email || "Email не указан"}</ContactLine>
          <ContactLine icon={BriefcaseBusiness}>{sourceLabel(client.source, t)}</ContactLine>
        </div>
      </DetailSection>

      <DetailSection title="Теги" action={<button type="button" onClick={onAddTag} className="text-slate-500 transition hover:text-slate-900" aria-label={t("clients.addTag")}><Plus size={15} /></button>}>
        <div className="flex flex-wrap gap-2">
          {row.tags.slice(0, 6).map((tag) => (
            <TagPill key={tag.id} className="bg-blue-50 text-blue-700">{tag.tag_name}</TagPill>
          ))}
          {!row.tags.length ? <span className="text-sm font-medium text-slate-500">{t("clients.noTagsYet")}</span> : null}
        </div>
      </DetailSection>

      <DetailSection title="Последняя сделка" action={<ChevronDown size={16} className="text-slate-500" />}>
        {latestDeal ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">{latestDeal.title}</p>
              <p className="text-sm font-semibold text-slate-900">{money(latestDeal.amount, latestDeal.currency)}</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(12, Math.min(100, latestDeal.probability || 35))}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs font-medium text-slate-500">
              <span>{latestDeal.status === "open" ? "Переговоры" : latestDeal.status}</span>
              <span>{formatDate(latestDeal.updated_at)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium text-slate-500">Сделок пока нет. Открыто: {money(openDealValue)}</p>
        )}
      </DetailSection>

      <DetailSection title="Следующая задача" icon={ClipboardList}>
        {mainTask ? (
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{mainTask.title}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{mainTask.due_at ? formatDateTime(mainTask.due_at) : "Без срока"}</p>
              </div>
              {priorityLabel(mainTask.priority) ? <TagPill className="bg-blue-50 text-blue-700">{priorityLabel(mainTask.priority)}</TagPill> : null}
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium text-slate-500">Активных задач нет.</p>
        )}
      </DetailSection>

      <DetailSection title="История" action={<button type="button" onClick={onFullCard} className="text-xs font-semibold text-blue-600 transition hover:text-blue-700">Смотреть все</button>}>
        <div className="space-y-3">
          {historyItems.map((item) => (
            <TimelineRow key={item.key} icon={item.icon} title={item.title} meta={item.meta} badge={item.badge} />
          ))}
          {!historyItems.length ? <p className="text-sm font-medium text-slate-500">{t("clients.emptyHistory")}</p> : null}
        </div>
      </DetailSection>

      <div className="px-5 pb-5">
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
          <div className="flex items-start gap-3">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-bold text-blue-950">AI-подсказка</p>
              <p className="mt-1 text-sm leading-5 text-slate-700">
                {latestLead || latestAppointment ? "Клиент уже взаимодействовал с CRM. Проверьте следующий шаг и контакт." : "Клиент давно не получал предложение. Рекомендуется связаться сегодня."}
              </p>
              <Button type="button" size="sm" variant="secondary" className="mt-3 bg-white" onClick={onFullCard}>
                Связаться сейчас
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
