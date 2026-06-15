import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, CalendarCheck, ChevronDown, ClipboardList, Edit3, Inbox, Mail, MessageCircle, MoreHorizontal, Phone, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { ClientTableRow, Translate } from "../types";
import { money, priorityLabel, sourceLabel } from "../utils";
import { ClientAvatar, ClientStatusBadge, TagPill } from "./ClientPrimitives";

function DetailSection({ title, icon: Icon, action, children }: { title: string; icon?: LucideIcon; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 px-4 py-1.5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
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

function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-center">
      <p className="text-sm font-medium text-slate-500">{text}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function MutedEmpty({ text }: { text: string }) {
  return <p className="text-sm font-medium text-slate-500">{text}</p>;
}

function ContactLine({ icon: Icon, children, action }: { icon: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
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
    <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-2 text-sm">
      <p className="text-xs font-medium text-slate-500">{meta}</p>
      <div className="flex min-w-0 items-center gap-2 text-slate-700">
        <Icon size={15} className="shrink-0 text-slate-500" />
        <span className="min-w-0 truncate font-medium">{title}</span>
        {badge}
      </div>
    </div>
  );
}

function DealsTab({ row }: { row: ClientTableRow }) {
  if (!row.deals.length) return <div className="p-4"><EmptyState text="Сделок пока нет." /></div>;
  return (
    <div className="space-y-2 p-4">
      {row.deals.map((deal) => (
        <div key={deal.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-bold text-slate-950">{deal.title}</p>
            <StatusBadge status={deal.status} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span>{money(deal.amount, deal.currency)}</span>
            <span>{formatDate(deal.updated_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksTab({ row }: { row: ClientTableRow }) {
  if (!row.tasks.length) return <div className="p-4"><EmptyState text="Активных задач нет." /></div>;
  return (
    <div className="space-y-2 p-4">
      {row.tasks.map((task) => (
        <div key={task.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm font-bold text-slate-950">{task.title}</p>
            {priorityLabel(task.priority) ? <TagPill className="bg-blue-50 text-blue-700">{priorityLabel(task.priority)}</TagPill> : null}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{task.due_at ? formatDateTime(task.due_at) : "Без срока"}</p>
        </div>
      ))}
    </div>
  );
}

function FilesTab() {
  return <div className="p-4"><EmptyState text="Файлы пока не добавлены." /></div>;
}

export function ClientInspector({
  row,
  onClose,
  onEdit,
  onFullCard,
  onOpenOverview,
  onOpenDeals,
  onOpenTasks,
  onOpenFiles,
  activeTab,
  onAddTag,
  onArchive,
  t,
}: {
  row: ClientTableRow | null;
  onClose: () => void;
  onEdit: () => void;
  onFullCard: () => void;
  onOpenOverview: () => void;
  onOpenDeals: () => void;
  onOpenTasks: () => void;
  onOpenFiles: () => void;
  activeTab: "overview" | "deals" | "tasks" | "files";
  onAddTag: () => void;
  onArchive: () => void;
  t: Translate;
}) {
  const [favoriteClientIds, setFavoriteClientIds] = useState<Set<number>>(() => new Set());

  if (!row) {
    return (
      <aside className="min-h-[640px] border-l border-slate-200 bg-white xl:min-h-0 xl:h-[calc(100vh-80px)]">
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
  const isFavorite = favoriteClientIds.has(client.id);
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

  function toggleFavorite() {
    setFavoriteClientIds((current) => {
      const next = new Set(current);
      if (next.has(client.id)) next.delete(client.id);
      else next.add(client.id);
      return next;
    });
  }

  return (
    <aside className="min-h-0 border-l border-slate-200 bg-white xl:h-[calc(100vh-80px)] xl:overflow-y-auto">
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
            <ClientAvatar name={client.full_name} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-bold text-slate-950">{client.full_name}</h2>
                <button
                  type="button"
                  className={isFavorite ? "text-indigo-600 transition hover:text-indigo-700" : "text-slate-500 transition hover:text-slate-700"}
                  aria-label="Избранное"
                  aria-pressed={isFavorite}
                  onClick={toggleFavorite}
                >
                  <Sparkles size={14} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <ClientStatusBadge status={row.status} />
                <span className="text-xs font-medium text-slate-500">{formatDate(client.created_at)}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 min-h-8 w-8 min-w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" aria-label={t("common.close")}>
            <X size={16} />
          </button>
        </div>

        <div role="tablist" aria-label="Карточка клиента" className="mt-1.5 grid grid-cols-4 gap-1 border-b border-slate-200 text-center text-xs font-semibold text-slate-500">
          {[
            { label: "Обзор", id: "overview", onClick: onOpenOverview },
            { label: `Сделки ${row.deals.length}`, id: "deals", onClick: onOpenDeals },
            { label: `Задачи ${row.tasks.length}`, id: "tasks", onClick: onOpenTasks },
            { label: "Файлы", id: "files", onClick: onOpenFiles },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={tab.onClick}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={
                activeTab === tab.id
                  ? "cursor-pointer border-b-2 border-blue-600 bg-blue-50 px-1 pb-1.5 text-blue-700 transition"
                  : "cursor-pointer border-b-2 border-transparent px-1 pb-1.5 transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "deals" ? <DealsTab row={row} /> : null}
      {activeTab === "tasks" ? <TasksTab row={row} /> : null}
      {activeTab === "files" ? <FilesTab /> : null}
      {activeTab === "overview" ? (
        <>
      <DetailSection
        title="Контакты"
        action={
          <div className="flex items-center gap-1">
            <button type="button" onClick={onEdit} className="grid h-7 min-h-7 w-7 min-w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label={t("clients.edit")}>
              <Edit3 size={15} />
            </button>
            <button type="button" onClick={onArchive} className="grid h-7 min-h-7 w-7 min-w-7 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label={t("clients.archiveAction")}>
              <MoreHorizontal size={15} />
            </button>
          </div>
        }
      >
        <div className="space-y-1.5">
          <ContactLine
            icon={Phone}
            action={
              client.phone ? (
                <button type="button" onClick={() => window.open(`https://wa.me/${client.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")} className="grid h-6 min-h-6 w-6 min-w-6 place-items-center text-emerald-600 transition hover:text-emerald-700" aria-label="WhatsApp">
                  <MessageCircle size={15} />
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

      <DetailSection title="Теги" action={<button type="button" onClick={onAddTag} className="grid h-7 min-h-7 w-7 min-w-7 place-items-center text-slate-500 transition hover:text-slate-900" aria-label={t("clients.addTag")}><Plus size={15} /></button>}>
        {row.tags.length ? (
          <div className="flex flex-wrap gap-2">
            {row.tags.slice(0, 6).map((tag) => (
              <TagPill key={tag.id} className="bg-indigo-50 text-indigo-700">{tag.tag_name}</TagPill>
            ))}
          </div>
        ) : (
          <MutedEmpty text={t("clients.noTagsYet")} />
        )}
      </DetailSection>

      <DetailSection title="Последняя сделка" action={<ChevronDown size={16} className="text-slate-500" />}>
        {latestDeal ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">{latestDeal.title}</p>
              <p className="text-sm font-semibold text-slate-900">{money(latestDeal.amount, latestDeal.currency)}</p>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-slate-100">
              <div className="h-1 rounded-full bg-blue-600" style={{ width: `${Math.max(12, Math.min(100, latestDeal.probability || 35))}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs font-medium text-slate-500">
              <span>{latestDeal.status === "open" ? "Переговоры" : latestDeal.status}</span>
              <span>{formatDate(latestDeal.updated_at)}</span>
            </div>
          </div>
        ) : (
          <MutedEmpty text={`Сделок пока нет. Открыто: ${money(openDealValue)}`} />
        )}
      </DetailSection>

      <DetailSection title="Следующая задача" icon={ClipboardList}>
        {mainTask ? (
          <div className="rounded-lg bg-slate-50 px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{mainTask.title}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">{mainTask.due_at ? formatDateTime(mainTask.due_at) : "Без срока"}</p>
              </div>
              {priorityLabel(mainTask.priority) ? <TagPill className="bg-blue-50 text-blue-700">{priorityLabel(mainTask.priority)}</TagPill> : null}
            </div>
          </div>
        ) : (
          <MutedEmpty text="Активных задач нет." />
        )}
      </DetailSection>

      <DetailSection title="История" action={<button type="button" onClick={onFullCard} className="text-xs font-semibold text-blue-600 transition hover:text-blue-700">Смотреть все</button>}>
        <div className="space-y-2">
          {historyItems.map((item) => (
            <TimelineRow key={item.key} icon={item.icon} title={item.title} meta={item.meta} badge={item.badge} />
          ))}
          {!historyItems.length ? <EmptyState text={t("clients.emptyHistory")} /> : null}
        </div>
      </DetailSection>

      <div className="px-4 pb-3">
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-2">
          <div className="flex items-start gap-2.5">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-indigo-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-indigo-950">AI-подсказка</p>
              <p className="mt-0.5 text-xs leading-4 text-indigo-900">
                {latestLead || latestAppointment ? "Клиент уже взаимодействовал с CRM. Проверьте следующий шаг и контакт." : "Клиент давно не получал предложение. Рекомендуется связаться сегодня."}
              </p>
              <Button type="button" size="sm" className="mt-1 h-7 min-h-7 bg-indigo-600 px-2.5 text-xs hover:bg-indigo-700" onClick={onFullCard}>
                Связаться сейчас
              </Button>
            </div>
          </div>
        </div>
      </div>
        </>
      ) : null}
    </aside>
  );
}
