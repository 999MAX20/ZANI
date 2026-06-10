import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Edit3,
  Filter,
  Globe2,
  Inbox,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { segmentFiltersApi, segmentsApi, taggedObjectsApi, tagsApi } from "../../api/activities";
import { clientsApi } from "../../api/clients";
import { getApiErrorMessage, unwrapList } from "../../api/client";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { ClientForm } from "../../components/forms/ClientForm";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { cn } from "../../lib/cn";
import { formatDate, formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Appointment, BotConversation, Client, Deal, Id, Lead, SegmentFilter, Task } from "../../types";

type SegmentDraft = {
  name: string;
  field: SegmentFilter["field"];
  operator: SegmentFilter["operator"];
  value: string;
};

type ClientQuickFilter = "all" | "new" | "vip" | "no_reply" | "mine";

type Translate = ReturnType<typeof useI18n>["t"];

type ClientTag = {
  id: Id;
  tag_name?: string;
  tag_color?: string;
};

type ClientTableRow = {
  client: Client;
  tags: ClientTag[];
  leads: Lead[];
  deals: Deal[];
  appointments: Appointment[];
  tasks: Task[];
  conversations: BotConversation[];
  status: "active" | "new" | "vip" | "no_reply" | "archived";
  lastContactAt: string | null;
  nextStep: {
    title: string;
    date: string | null;
    priority?: Task["priority"];
  };
  manager: string;
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "C"
  );
}

function sourceLabel(source: string | undefined, t: Translate) {
  const labels: Record<string, string> = {
    website: "clients.sourceWebsite",
    landing: "clients.sourceLanding",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    manual: "clients.sourceManual",
    parser: "clients.sourceParser",
    other: "clients.sourceOther",
  };
  const label = labels[source || ""];
  return label ? t(label) : source || t("clients.sourceOther");
}

function money(value: string | number, currency = "KZT") {
  return `${Number(value || 0).toLocaleString("ru-RU")} ${currency}`;
}

function latestDate(values: Array<string | null | undefined>) {
  const timestamps = values.filter(Boolean).map((value) => String(value));
  if (!timestamps.length) return null;
  return timestamps.sort((a, b) => b.localeCompare(a))[0] || null;
}

function statusMeta(status: ClientTableRow["status"]) {
  const map = {
    active: { label: "Активный", className: "bg-emerald-50 text-emerald-700 before:bg-emerald-500" },
    new: { label: "Новый", className: "bg-blue-50 text-blue-700 before:bg-blue-500" },
    vip: { label: "VIP", className: "bg-violet-50 text-violet-700 before:bg-violet-500" },
    no_reply: { label: "Без ответа", className: "bg-amber-50 text-amber-700 before:bg-amber-500" },
    archived: { label: "Архив", className: "bg-slate-100 text-slate-600 before:bg-slate-400" },
  } satisfies Record<ClientTableRow["status"], { label: string; className: string }>;
  return map[status];
}

function priorityLabel(priority?: Task["priority"]) {
  const labels: Record<Task["priority"], string> = {
    low: "Низкий",
    normal: "Обычный",
    high: "Высокий",
    urgent: "Срочный",
  };
  return priority ? labels[priority] : null;
}

function SourceIcon({ source }: { source: string | undefined }) {
  if (source === "whatsapp" || source === "telegram" || source === "instagram") return <MessageCircle size={15} />;
  if (source === "website" || source === "landing") return <Globe2 size={15} />;
  return <Phone size={15} />;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  delta: string;
  tone: "blue" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    blue: "text-blue-600 bg-blue-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    violet: "text-violet-600 bg-violet-50",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-4">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", tones[tone])}>
          <Icon size={22} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="text-2xl font-bold leading-none text-slate-950">{value}</p>
            <span className="text-xs font-semibold text-emerald-600">{delta}</span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-400">за месяц</p>
        </div>
      </div>
    </div>
  );
}

function TagPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-600", className)}>
      {children}
    </span>
  );
}

function ClientAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full bg-blue-50 font-bold text-blue-700 ring-1 ring-blue-100", sizes[size])}>
      {initials(name)}
    </div>
  );
}

function ClientStatusBadge({ status }: { status: ClientTableRow["status"] }) {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full", meta.className)}>
      {meta.label}
    </span>
  );
}

function ClientRow({
  row,
  selected,
  onSelect,
  t,
}: {
  row: ClientTableRow;
  selected: boolean;
  onSelect: () => void;
  t: Translate;
}) {
  return (
    <tr
      className={cn(
        "group cursor-pointer border-b border-slate-100 bg-white transition-colors hover:bg-slate-50/80",
        selected && "bg-blue-50/40 outline outline-1 -outline-offset-1 outline-blue-400 hover:bg-blue-50/55",
      )}
      onClick={onSelect}
    >
      <td className="w-10 px-4 py-3 align-middle">
        <input
          type="checkbox"
          checked={selected}
          readOnly
          aria-label={row.client.full_name}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
      <td className="min-w-[220px] px-2 py-3">
        <div className="flex items-center gap-3">
          <ClientAvatar name={row.client.full_name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">{row.client.full_name}</p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{row.client.phone || row.client.email || t("clients.noContacts")}</p>
          </div>
        </div>
      </td>
      <td className="min-w-[130px] px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <SourceIcon source={row.client.source} />
          <span>{sourceLabel(row.client.source, t)}</span>
        </div>
      </td>
      <td className="min-w-[120px] px-3 py-3">
        <ClientStatusBadge status={row.status} />
      </td>
      <td className="min-w-[150px] px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
            {initials(row.manager)}
          </div>
          <span className="truncate text-sm font-medium text-slate-600">{row.manager}</span>
        </div>
      </td>
      <td className="min-w-[150px] px-3 py-3">
        <p className="text-sm font-medium text-slate-700">{row.lastContactAt ? formatDateTime(row.lastContactAt) : "Нет контакта"}</p>
      </td>
      <td className="min-w-[170px] px-3 py-3">
        <p className="text-sm font-semibold text-slate-700">{row.nextStep.title}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-400">{row.nextStep.date ? formatDate(row.nextStep.date) : "Сегодня"}</p>
      </td>
      <td className="w-12 px-3 py-3 text-right">
        <button
          type="button"
          className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          aria-label="Действия"
        >
          <MoreHorizontal size={18} />
        </button>
      </td>
    </tr>
  );
}

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

function ClientInspector({
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
                <button type="button" className="text-slate-400 transition hover:text-slate-700" aria-label="Избранное">
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
            <button key={tab} type="button" className={cn("border-b-2 px-1 pb-2 transition", index === 0 ? "border-blue-600 text-blue-700" : "border-transparent hover:text-slate-800")}>
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

      <DetailSection title="Последняя сделка" action={<ChevronDown size={16} className="text-slate-400" />}>
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

export function ClientsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { clients, leads, deals, appointments, tasks, botConversations, tags, taggedObjects, segments } = useEntityData({
    clients: true,
    leads: true,
    deals: true,
    appointments: true,
    tasks: true,
    botConversations: true,
    tags: true,
    taggedObjects: true,
    segments: true,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<Id | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [quickFilter, setQuickFilter] = useState<ClientQuickFilter>("all");
  const [tagDraft, setTagDraft] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>({ name: "", field: "source", operator: "equals", value: "" });

  const filteredClients = useQuery({
    queryKey: ["clients", "filtered", search, source, selectedTag, selectedSegment],
    queryFn: () => clientsApi.listFiltered({ q: search || undefined, source: source || undefined, tag: selectedTag || undefined, segment: selectedSegment || undefined }),
  });

  const mutation = useMutation({
    mutationFn: (payload: Partial<Client>) => (editing ? clientsApi.update({ id: editing.id, payload }) : clientsApi.create(payload)),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setEditing(undefined);
      setSelectedClientId(client.id);
      clearCreateParam();
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: number; duplicateId: number }) => clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setOpen(false);
      setEditing(undefined);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: clientsApi.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setArchiveOpen(false);
      setArchiveReason("");
    },
  });

  const tagList = unwrapList(tags.data);
  const addTagMutation = useMutation({
    mutationFn: async ({ clientId, tagName }: { clientId: Id; tagName: string }) => {
      const existing = tagList.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
      const tag = existing || (await tagsApi.create({ business: business!.id, name: tagName, color: "#2563eb", source: "manual" }));
      return taggedObjectsApi.create({ business: business!.id, tag: tag.id, entity_type: "client", entity_id: String(clientId) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["tagged-objects"] });
      queryClient.invalidateQueries({ queryKey: ["crm-card"] });
      setTagOpen(false);
      setTagDraft("");
    },
  });

  const createSegmentMutation = useMutation({
    mutationFn: async () => {
      const segment = await segmentsApi.create({
        business: business!.id,
        name: segmentDraft.name,
        description: "Saved client filter",
        entity_type: "client",
        is_active: true,
      });
      await segmentFiltersApi.create({
        business: business!.id,
        segment: segment.id,
        field: segmentDraft.field,
        operator: segmentDraft.operator,
        value_json: { value: segmentDraft.value },
        sort_order: 1,
      });
      await segmentsApi.refreshCount(segment.id);
      return segment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      setSegmentDraft({ name: "", field: "source", operator: "equals", value: "" });
      setSegmentOpen(false);
    },
  });

  function clearCreateParam() {
    if (!searchParams.get("create")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    const clientId = Number(searchParams.get("client") || "");
    if (clientId) setSelectedClientId(clientId);
    if (searchParams.get("create") === "1") {
      setEditing(undefined);
      setOpen(true);
    }
  }, [searchParams]);

  const clientList = unwrapList<Client>(clients.data);
  const leadList = unwrapList<Lead>(leads.data);
  const dealList = unwrapList<Deal>(deals.data);
  const appointmentList = unwrapList<Appointment>(appointments.data);
  const taskList = unwrapList<Task>(tasks.data);
  const conversationList = unwrapList<BotConversation>(botConversations.data);
  const taggedObjectList = unwrapList(taggedObjects.data);
  const segmentList = unwrapList(segments.data);
  const hasActiveFilters = Boolean(search || source || selectedTag || selectedSegment);
  const baseRows = hasActiveFilters ? unwrapList<Client>(filteredClients.data) : clientList;

  const clientTags = useMemo(() => {
    const map: Record<string, ClientTag[]> = {};
    taggedObjectList.forEach((item) => {
      if (item.entity_type !== "client") return;
      map[item.entity_id] = map[item.entity_id] || [];
      map[item.entity_id]?.push({ id: item.id, tag_name: item.tag_name, tag_color: item.tag_color });
    });
    return map;
  }, [taggedObjectList]);

  const tableRows = useMemo<ClientTableRow[]>(() => {
    return baseRows.map((client) => {
      const clientLeads = leadList.filter((lead) => lead.client === client.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const clientDeals = dealList.filter((deal) => deal.client === client.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      const clientAppointments = appointmentList.filter((appointment) => appointment.client === client.id).sort((a, b) => b.start_at.localeCompare(a.start_at));
      const clientTasks = taskList
        .filter((task) => task.client === client.id && !["done", "cancelled"].includes(task.status))
        .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")));
      const clientConversations = conversationList
        .filter((conversation) => conversation.client === client.id)
        .sort((a, b) => String(b.last_message_at || b.updated_at).localeCompare(String(a.last_message_at || a.updated_at)));
      const tagsForClient = clientTags[String(client.id)] || [];
      const isVip = tagsForClient.some((tag) => String(tag.tag_name || "").toLowerCase().includes("vip"));
      const hasNoReply = clientConversations.some((conversation) => conversation.unread_count || conversation.handoff_required) || clientLeads.some((lead) => lead.status === "new");
      const isActive = Boolean(clientDeals.some((deal) => deal.status === "open") || clientAppointments.length || clientConversations.length || clientLeads.length);
      const status: ClientTableRow["status"] = client.is_archived ? "archived" : isVip ? "vip" : hasNoReply ? "no_reply" : isActive ? "active" : "new";
      const latestDeal = clientDeals[0];
      const latestTask = clientTasks[0];
      const latestLead = clientLeads[0];
      const latestAppointment = clientAppointments[0];
      const managerId = latestDeal?.owner || latestTask?.assignee || latestLead?.responsible_user;
      const lastContactAt = latestDate([
        clientConversations[0]?.last_message_at || clientConversations[0]?.updated_at,
        latestAppointment?.start_at,
        latestLead?.updated_at,
        latestDeal?.updated_at,
        client.updated_at,
      ]);
      const nextStep = latestTask
        ? { title: latestTask.title, date: latestTask.due_at, priority: latestTask.priority }
        : latestDeal?.next_action_at
          ? { title: "Связаться по сделке", date: latestDeal.next_action_at }
          : hasNoReply
            ? { title: "Ответить клиенту", date: null }
            : { title: latestAppointment ? "Подтвердить запись" : "Позвонить", date: latestAppointment?.start_at || null };

      return {
        client,
        tags: tagsForClient,
        leads: clientLeads,
        deals: clientDeals,
        appointments: clientAppointments,
        tasks: clientTasks,
        conversations: clientConversations,
        status,
        lastContactAt,
        nextStep,
        manager: managerId ? `Менеджер ${managerId}` : "Не назначен",
      };
    });
  }, [appointmentList, baseRows, clientTags, conversationList, dealList, leadList, taskList]);

  const rows = tableRows.filter((row) => {
    if (quickFilter === "new") return row.status === "new";
    if (quickFilter === "vip") return row.status === "vip";
    if (quickFilter === "no_reply") return row.status === "no_reply";
    if (quickFilter === "mine") return row.manager !== "Не назначен";
    return true;
  });

  useEffect(() => {
    if (selectedClientId && rows.some((row) => row.client.id === selectedClientId)) return;
    setSelectedClientId(rows[0]?.client.id || null);
  }, [rows, selectedClientId]);

  const selectedRow = rows.find((row) => row.client.id === selectedClientId) || rows[0] || null;
  const clientsWithoutActivity = tableRows.filter((row) => row.status === "new").length;
  const activeClients = tableRows.filter((row) => row.status === "active" || row.status === "vip").length;
  const noReplyClients = tableRows.filter((row) => row.status === "no_reply").length;
  const repeatClients = tableRows.filter((row) => row.appointments.length > 1 || row.deals.length > 1).length;

  const quickFilterOptions: Array<{ value: ClientQuickFilter; label: string }> = [
    { value: "all", label: "Все" },
    { value: "new", label: "Новые" },
    { value: "vip", label: "VIP" },
    { value: "no_reply", label: "Без ответа" },
    { value: "mine", label: "Мои клиенты" },
  ];

  const sourceOptions = [
    { value: "", label: t("clients.allSources") },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "telegram", label: "Telegram" },
    { value: "instagram", label: "Instagram" },
    { value: "website", label: t("clients.sourceWebsite") },
    { value: "manual", label: t("clients.sourceManual") },
  ];

  if (!business) return <ErrorState message={t("clients.noBusiness")} />;
  if (clients.isLoading || filteredClients.isLoading || leads.isLoading || deals.isLoading || appointments.isLoading) return <LoadingState />;

  return (
    <>
      <section className="min-h-[calc(100vh-96px)] bg-[#f8fafc]">
        <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">{t("clients.title")}</h1>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 xl:hidden" aria-label="Уведомления">
                <Bell size={18} />
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row xl:max-w-[720px]">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Поиск клиентов, телефона, тегов..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-14 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-400">⌘ K</span>
              </div>
              <Button variant="secondary" size="icon" className="hidden h-11 w-11 shrink-0 sm:inline-flex" aria-label="Фильтры">
                <Filter size={18} />
              </Button>
              <Button className="h-11 shrink-0 bg-blue-600 px-5 hover:bg-blue-700" onClick={() => setOpen(true)}>
                {t("clients.create")} <Plus size={17} />
              </Button>
            </div>
          </div>
        </div>

        {mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error ? (
          <div className="px-4 pt-4 sm:px-6">
            <ErrorState message={getApiErrorMessage(mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error)} />
          </div>
        ) : null}

        <div className="grid min-h-0 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <main className="min-w-0 px-4 py-5 sm:px-6">
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <KpiCard icon={UsersRound} label="Всего клиентов" value={clientList.length} delta="+24" tone="blue" />
              <KpiCard icon={CheckCircle2} label="Активные" value={activeClients} delta={`${clientList.length ? Math.round((activeClients / clientList.length) * 100) : 0}%`} tone="emerald" />
              <KpiCard icon={MessageCircle} label="Без ответа" value={noReplyClients} delta="8%" tone="amber" />
              <KpiCard icon={RefreshCw} label="Повторные" value={repeatClients} delta={`${clientList.length ? Math.round((repeatClients / clientList.length) * 100) : 0}%`} tone="violet" />
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  {quickFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setQuickFilter(option.value)}
                      className={cn(
                        "h-9 rounded-lg px-3 text-sm font-semibold transition",
                        quickFilter === option.value ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={source} onChange={(event) => setSource(event.target.value)} options={sourceOptions} className="h-9 min-h-9 w-[170px] text-xs" />
                  <Select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} options={[{ value: "", label: t("clients.allTags") }, ...tagList.map((tag) => ({ value: tag.id, label: tag.name }))]} className="h-9 min-h-9 w-[160px] text-xs" />
                  <Button variant="secondary" size="sm" onClick={() => setSegmentOpen(true)}>
                    {t("clients.segment")} <ChevronDown size={14} />
                  </Button>
                  <Select value={selectedSegment} onChange={(event) => setSelectedSegment(event.target.value)} options={[{ value: "", label: t("clients.allSegments") }, ...segmentList.map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.cached_count})` }))]} className="h-9 min-h-9 w-[170px] text-xs" />
                  <Button variant="secondary" size="icon" className="h-9 w-9 min-h-9 min-w-9" aria-label="Еще">
                    <MoreHorizontal size={17} />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1040px] w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white text-left text-xs font-semibold text-slate-500">
                      <th className="w-10 px-4 py-3">
                        <input type="checkbox" readOnly className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" aria-label="Выбрать все" />
                      </th>
                      <th className="px-2 py-3">Клиент</th>
                      <th className="px-3 py-3">Источник</th>
                      <th className="px-3 py-3">Статус</th>
                      <th className="px-3 py-3">Менеджер</th>
                      <th className="px-3 py-3">Последний контакт</th>
                      <th className="px-3 py-3">Следующий шаг</th>
                      <th className="px-3 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <ClientRow key={row.client.id} row={row} selected={selectedRow?.client.id === row.client.id} onSelect={() => setSelectedClientId(row.client.id)} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>

              {!rows.length ? (
                <div className="px-6 py-12 text-center">
                  <UsersRound className="mx-auto text-slate-300" size={34} />
                  <p className="mt-3 font-bold text-slate-900">{t("clients.notFoundTitle")}</p>
                  <p className="mt-1 text-sm text-slate-500">{t("clients.notFoundText")}</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Показано 1-{rows.length} из {clientList.length}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">‹</button>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">1</button>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-sm font-semibold text-slate-600 transition hover:bg-slate-50">2</button>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-sm font-semibold text-slate-600 transition hover:bg-slate-50">3</button>
                  <span className="px-2">...</span>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">›</button>
                </div>
                <button type="button" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                  20 на странице <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </main>

          <ClientInspector
            row={selectedRow}
            onClose={() => setSelectedClientId(null)}
            onEdit={() => {
              if (!selectedRow) return;
              setEditing(selectedRow.client);
              setOpen(true);
            }}
            onFullCard={() => {
              if (!selectedRow) return;
              setDrawerEntity({ type: "client", id: selectedRow.client.id });
            }}
            onAddTag={() => setTagOpen(true)}
            onArchive={() => setArchiveOpen(true)}
            t={t}
          />
        </div>
      </section>

      <Modal title={editing ? t("clients.editTitle") : t("clients.create")} open={open} onClose={() => { setOpen(false); setEditing(undefined); clearCreateParam(); }}>
        <ClientForm
          businessId={business.id}
          initial={editing}
          onSubmit={(payload) => mutation.mutateAsync(payload)}
          onOpenClient={(id) => {
            setOpen(false);
            setEditing(undefined);
            setSelectedClientId(id);
          }}
          onMergeDuplicate={(duplicateId) => {
            if (!editing) return Promise.resolve();
            return mergeMutation.mutateAsync({ targetId: editing.id, duplicateId });
          }}
        />
      </Modal>

      <Modal title={t("clients.addTag")} open={tagOpen} onClose={() => { setTagOpen(false); setTagDraft(""); }}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const tagName = tagDraft.trim();
            if (!selectedRow || !tagName) return;
            addTagMutation.mutate({ clientId: selectedRow.client.id, tagName });
          }}
        >
          <Input label={t("clients.tagPrompt")} value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setTagOpen(false); setTagDraft(""); }}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" isLoading={addTagMutation.isPending} disabled={!tagDraft.trim()}>
              {t("clients.addTag")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title={t("clients.archiveClient")} open={archiveOpen} onClose={() => { setArchiveOpen(false); setArchiveReason(""); }}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedRow) return;
            archiveMutation.mutate({ id: selectedRow.client.id, reason: archiveReason.trim() });
          }}
        >
          <Input label={t("clients.archiveReason")} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder={t("clients.archiveReasonPlaceholder")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setArchiveOpen(false); setArchiveReason(""); }}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" isLoading={archiveMutation.isPending}>
              {t("clients.archiveAction")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title={t("clients.createSegment")} open={segmentOpen} onClose={() => setSegmentOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createSegmentMutation.mutate();
          }}
        >
          <Input label={t("clients.segmentName")} value={segmentDraft.name} onChange={(event) => setSegmentDraft({ ...segmentDraft, name: event.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t("clients.field")}
              value={segmentDraft.field}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, field: event.target.value as SegmentDraft["field"] })}
              options={[
                { value: "source", label: t("clients.source") },
                { value: "tag", label: t("clients.tag") },
                { value: "full_name", label: t("clients.name") },
                { value: "phone", label: t("clients.phone") },
                { value: "email", label: "Email" },
                { value: "notes", label: t("clients.notes") },
              ]}
            />
            <Select
              label={t("clients.condition")}
              value={segmentDraft.operator}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, operator: event.target.value as SegmentDraft["operator"] })}
              options={[
                { value: "equals", label: t("clients.equals") },
                { value: "contains", label: t("clients.contains") },
                { value: "in", label: t("clients.inList") },
                { value: "is_empty", label: t("clients.isEmpty") },
                { value: "not_empty", label: t("clients.notEmpty") },
              ]}
            />
          </div>
          {segmentDraft.field === "tag" ? (
            <Select
              label={t("clients.value")}
              value={segmentDraft.value}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })}
              options={[{ value: "", label: t("clients.selectTag") }, ...tagList.map((tag) => ({ value: String(tag.id), label: tag.name }))]}
            />
          ) : (
            <Input label={t("clients.value")} value={segmentDraft.value} onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })} />
          )}
          <Button type="submit" isLoading={createSegmentMutation.isPending} disabled={!segmentDraft.name}>
            {t("clients.saveSegment")}
          </Button>
        </form>
      </Modal>

      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
