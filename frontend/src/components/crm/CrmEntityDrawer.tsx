import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  StickyNote,
  Tags,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { appointmentsApi } from "../../api/appointments";
import { crmCardsApi } from "../../api/crmCards";
import { customFieldValuesApi } from "../../api/customFields";
import { dealsApi } from "../../api/deals";
import { leadsApi } from "../../api/leads";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import type { Appointment, CrmCardPayload, CrmEntityType, Deal, Id, Lead } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { ErrorState, LoadingState } from "../ui/StateViews";
import { StatusBadge } from "../ui/StatusBadge";

export type CrmDrawerEntity = {
  type: CrmEntityType;
  id: Id;
};

type TabId = "overview" | "timeline" | "tasks" | "messages" | "notes";

const tabs: { id: TabId; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "timeline", label: "История" },
  { id: "tasks", label: "Задачи" },
  { id: "messages", label: "Диалоги" },
  { id: "notes", label: "Заметки" },
];

function getTitle(data?: CrmCardPayload) {
  if (!data) return "CRM карточка";
  if (data.deal) return data.deal.title;
  if (data.appointment) return `Запись #${data.appointment.id}`;
  if (data.lead) return `Заявка #${data.lead.id}`;
  return data.client?.full_name || "CRM карточка";
}

function getSubtitle(data?: CrmCardPayload) {
  const client = data?.client;
  if (!client) return "Контекст клиента, продаж и коммуникаций";
  return [client.phone, client.email, client.source].filter(Boolean).join(" · ") || "Контакты пока не заполнены";
}

function SummaryItem({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-brand-600">
        <Icon size={19} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-bold text-midnight">{value || "-"}</div>
    </div>
  );
}

export function CrmEntityHeader({ data, onClose }: { data?: CrmCardPayload; onClose: () => void }) {
  const activeStatus = data?.deal?.status || data?.appointment?.status || data?.lead?.status;

  return (
    <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/88 px-5 py-4 backdrop-blur-xl sm:px-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-ai-gradient text-white shadow-glow">
              <UserRound size={18} />
            </span>
            {activeStatus ? <StatusBadge status={activeStatus} /> : null}
          </div>
          <h2 className="truncate text-2xl font-black tracking-tight text-midnight">{getTitle(data)}</h2>
          <p className="mt-1 text-sm text-slate-500">{getSubtitle(data)}</p>
        </div>
        <Button type="button" variant="ghost" className="h-12 w-12 shrink-0 rounded-full px-0" onClick={onClose} aria-label="Закрыть карточку">
          <X size={28} strokeWidth={2.4} />
        </Button>
      </div>
    </div>
  );
}

export function CrmEntityTabs({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-4 sm:px-7">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn(
            "shrink-0 rounded-2xl px-4 py-2 text-sm font-bold transition",
            active === tab.id ? "bg-midnight text-white shadow-premium" : "bg-white/70 text-slate-500 hover:bg-white hover:text-midnight",
          )}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function EntityQuickActions({ data }: { data: CrmCardPayload }) {
  const phone = data.client?.phone;
  const cleanPhone = phone?.replace(/\D/g, "");

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={!phone} onClick={() => phone && (window.location.href = `tel:${phone}`)}>
        <Phone size={17} /> Позвонить
      </Button>
      <Button
        variant="secondary"
        disabled={!cleanPhone}
        onClick={() => cleanPhone && window.open(`https://wa.me/${cleanPhone}`, "_blank", "noopener,noreferrer")}
      >
        <MessageCircle size={17} /> WhatsApp
      </Button>
      <Button variant="ghost" disabled={!data.client?.email} onClick={() => data.client?.email && (window.location.href = `mailto:${data.client.email}`)}>
        <Mail size={17} /> Email
      </Button>
    </div>
  );
}

export function ClientCardContent({ data }: { data: CrmCardPayload }) {
  const client = data.client;

  return (
    <div className="space-y-5">
      <EntityQuickActions data={data} />
      {data.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {data.tags.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
              style={{ backgroundColor: `${item.tag_color || "#2563eb"}18`, color: item.tag_color || "#2563eb" }}
            >
              <Tags size={13} /> {item.tag_name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem icon={UserRound} label="Клиент" value={client?.full_name} />
        <SummaryItem icon={ClipboardList} label="Заявки" value={data.leads.length} />
        <SummaryItem icon={WalletCards} label="Сделки" value={data.deals.length} />
        <SummaryItem icon={CalendarClock} label="Записи" value={data.appointments.length} />
      </div>
      {client?.notes ? <div className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{client.notes}</div> : null}
      <EntityAttachmentsPanel data={data} />
    </div>
  );
}

export function EntityAttachmentsPanel({ data }: { data: CrmCardPayload }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        <Paperclip size={14} /> Вложения
      </div>
      {data.attachments.length ? (
        <div className="space-y-2">
          {data.attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.download_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-midnight transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip size={15} className="shrink-0 text-slate-500" />
                <span className="truncate">{attachment.original_name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                {Math.max(1, Math.round(attachment.size / 1024))} KB <Download size={14} />
              </span>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-slate-500">Файлы из inbox и CRM будут доступны здесь через приватную загрузку.</p>
      )}
    </div>
  );
}

export function LeadCardContent({ lead }: { lead: Lead | null }) {
  if (!lead) return null;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-midnight">Заявка #{lead.id}</h3>
        <StatusBadge status={lead.status} />
      </div>
      <p className="text-sm leading-6 text-slate-600">{lead.message || "Сообщение заявки не заполнено."}</p>
      <p className="mt-3 text-xs font-semibold text-slate-400">{lead.source} · {formatDateTime(lead.created_at)}</p>
    </div>
  );
}

export function DealCardContent({ deal }: { deal: Deal | null }) {
  if (!deal) return null;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-midnight">{deal.title}</h3>
        <StatusBadge status={deal.status} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryItem icon={WalletCards} label="Сумма" value={`${Number(deal.amount || 0).toLocaleString("ru-RU")} ${deal.currency}`} />
        <SummaryItem icon={CheckCircle2} label="Вероятность" value={`${deal.probability}%`} />
        <SummaryItem icon={CalendarClock} label="Закрытие" value={formatDateTime(deal.expected_close_at)} />
      </div>
      {deal.notes ? <p className="mt-4 text-sm leading-6 text-slate-600">{deal.notes}</p> : null}
    </div>
  );
}

export function AppointmentCardContent({ appointment }: { appointment: Appointment | null }) {
  if (!appointment) return null;

  return (
    <div className="rounded-3xl border border-brand-100 bg-gradient-to-r from-brand-50 to-ai-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-midnight">Запись #{appointment.id}</h3>
        <StatusBadge status={appointment.status} />
      </div>
      <p className="text-sm font-semibold text-slate-700">{formatDateTime(appointment.start_at)} - {formatDateTime(appointment.end_at)}</p>
      {appointment.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{appointment.notes}</p> : null}
    </div>
  );
}

function EntityInlineEditPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const queryClient = useQueryClient();
  const lead = data.lead;
  const deal = data.deal;
  const appointment = data.appointment;
  const [leadStatus, setLeadStatus] = useState<Lead["status"]>(lead?.status || "new");
  const [leadMessage, setLeadMessage] = useState(lead?.message || "");
  const [dealStatus, setDealStatus] = useState<Deal["status"]>(deal?.status || "open");
  const [dealNotes, setDealNotes] = useState(deal?.notes || "");
  const [appointmentStatus, setAppointmentStatus] = useState<Appointment["status"]>(appointment?.status || "created");
  const [appointmentNotes, setAppointmentNotes] = useState(appointment?.notes || "");

  useEffect(() => {
    setLeadStatus(lead?.status || "new");
    setLeadMessage(lead?.message || "");
    setDealStatus(deal?.status || "open");
    setDealNotes(deal?.notes || "");
    setAppointmentStatus(appointment?.status || "created");
    setAppointmentNotes(appointment?.notes || "");
  }, [appointment, deal, lead]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (entity.type === "lead" && lead) {
        return leadsApi.update({ id: lead.id, payload: { status: leadStatus, message: leadMessage } });
      }
      if (entity.type === "deal" && deal) {
        return dealsApi.update({ id: deal.id, payload: { status: dealStatus, notes: dealNotes } });
      }
      if (entity.type === "appointment" && appointment) {
        return appointmentsApi.update({ id: appointment.id, payload: { status: appointmentStatus, notes: appointmentNotes } });
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  if (entity.type === "client") return null;
  if (entity.type === "lead" && !lead) return null;
  if (entity.type === "deal" && !deal) return null;
  if (entity.type === "appointment" && !appointment) return null;

  return (
    <div className="rounded-3xl border border-brand-100 bg-white/85 p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-black text-midnight">Быстрое редактирование</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">Статус и рабочая заметка меняются прямо из CRM-карточки.</p>
        </div>
        <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
          Сохранить
        </Button>
      </div>
      {mutation.error ? <div className="mb-3"><ErrorState message="Не удалось сохранить изменения карточки." /></div> : null}
      {entity.type === "lead" ? (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <Select
            label="Статус заявки"
            value={leadStatus}
            onChange={(event) => setLeadStatus(event.target.value as Lead["status"])}
            options={[
              { value: "new", label: "Новая" },
              { value: "contacted", label: "Связались" },
              { value: "in_progress", label: "В работе" },
              { value: "appointment_created", label: "Запись создана" },
              { value: "closed", label: "Закрыта" },
              { value: "lost", label: "Потеряна" },
            ]}
          />
          <Input label="Сообщение / заметка" value={leadMessage} onChange={(event) => setLeadMessage(event.target.value)} />
        </div>
      ) : null}
      {entity.type === "deal" ? (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <Select
            label="Статус сделки"
            value={dealStatus}
            onChange={(event) => setDealStatus(event.target.value as Deal["status"])}
            options={[
              { value: "open", label: "Открыта" },
              { value: "won", label: "Выиграна" },
              { value: "lost", label: "Потеряна" },
            ]}
          />
          <Input label="Заметка" value={dealNotes} onChange={(event) => setDealNotes(event.target.value)} />
        </div>
      ) : null}
      {entity.type === "appointment" ? (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <Select
            label="Статус записи"
            value={appointmentStatus}
            onChange={(event) => setAppointmentStatus(event.target.value as Appointment["status"])}
            options={[
              { value: "created", label: "Создана" },
              { value: "confirmed", label: "Подтверждена" },
              { value: "cancelled", label: "Отменена" },
              { value: "rescheduled", label: "Перенесена" },
              { value: "completed", label: "Завершена" },
              { value: "no_show", label: "Не пришёл" },
            ]}
          />
          <Input label="Заметка" value={appointmentNotes} onChange={(event) => setAppointmentNotes(event.target.value)} />
        </div>
      ) : null}
    </div>
  );
}

export function EntityTimeline({ data }: { data: CrmCardPayload }) {
  const grouped = data.timeline.reduce<Record<string, typeof data.timeline>>((acc, event) => {
    const key = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(event.created_at));
    acc[key] = acc[key] || [];
    acc[key].push(event);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([date, events]) => (
        <div key={date} className="space-y-3">
          <p className="px-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">{date}</p>
          {events.map((event) => (
            <div key={event.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-brand-600">
                  {event.category === "message" ? <MessageCircle size={17} /> : event.category === "appointment" ? <CalendarClock size={17} /> : event.category === "task" ? <CheckCircle2 size={17} /> : <ClipboardList size={17} />}
                </span>
                <div>
                  <p className="font-bold text-midnight">{event.text || event.event_type}</p>
                  <p className="mt-1 text-xs text-slate-500">{event.category} · {event.source || "crm"} · {formatDateTime(event.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      {!data.timeline.length ? <EmptyBlock title="История пока пустая" text="Действия менеджеров, автоматизаций и коммуникаций появятся здесь." /> : null}
    </div>
  );
}

export function EntityTasksPanel({ data }: { data: CrmCardPayload }) {
  return (
    <div className="space-y-3">
      {data.tasks.map((task) => (
        <div key={task.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-midnight">{task.title}</p>
            <StatusBadge status={task.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{task.priority} · дедлайн {formatDateTime(task.due_at)}</p>
          {task.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{task.description}</p> : null}
        </div>
      ))}
      {!data.tasks.length ? <EmptyBlock title="Задач нет" text="Когда появится follow-up или SLA-задача, она будет видна в карточке." /> : null}
    </div>
  );
}

export function EntityConversationsPanel({ data }: { data: CrmCardPayload }) {
  return (
    <div className="space-y-3">
      {data.conversations.map((conversation) => (
        <div key={conversation.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold capitalize text-midnight">{conversation.channel}</p>
            <StatusBadge status={conversation.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Непрочитано: {conversation.unread_count || 0} · {formatDateTime(conversation.last_message_at || conversation.updated_at)}</p>
          {conversation.last_message?.text ? <p className="mt-3 text-sm leading-6 text-slate-600">{conversation.last_message.text}</p> : null}
        </div>
      ))}
      {!data.conversations.length ? <EmptyBlock title="Диалогов нет" text="WhatsApp, Telegram, Instagram и web-chat будут собираться в этой вкладке." /> : null}
    </div>
  );
}

export function EntityNotesPanel({ data }: { data: CrmCardPayload }) {
  return (
    <div className="space-y-3">
      {data.notes.map((note) => (
        <div key={note.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            <StickyNote size={14} /> Note · {formatDateTime(note.created_at)}
          </div>
          <p className="text-sm leading-6 text-slate-700">{note.text}</p>
        </div>
      ))}
      {!data.notes.length ? <EmptyBlock title="Заметок нет" text="Внутренние комментарии команды будут храниться здесь." /> : null}
    </div>
  );
}

function EntityCustomFieldsPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<number, string>>({});
  useEffect(() => {
    const nextValues: Record<number, string> = {};
    data.custom_fields.forEach((field) => {
      const value = field.value?.value_json?.value;
      nextValues[field.definition.id] = typeof value === "boolean" ? String(value) : String(value ?? "");
    });
    setValues(nextValues);
  }, [data.custom_fields]);

  const mutation = useMutation({
    mutationFn: () =>
      customFieldValuesApi.bulkUpsert({
        business: data.client?.business || data.lead?.business || data.deal?.business || data.appointment?.business || 0,
        entity_type: entity.type,
        entity_id: String(entity.id),
        values: data.custom_fields.map((field) => ({
          definition: field.definition.id,
          value_json: {
            value: field.definition.field_type === "boolean" ? values[field.definition.id] === "true" : values[field.definition.id] || "",
          },
        })),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] }),
  });

  if (!data.custom_fields.length) return null;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-midnight">Дополнительные поля</h3>
          <p className="mt-1 text-sm text-slate-500">Поля настраиваются в Settings → Custom fields.</p>
        </div>
        <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
          Сохранить поля
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.custom_fields.map((field) => {
          const options = field.definition.options_json?.options || [];
          if (field.definition.field_type === "boolean") {
            return (
              <Select
                key={field.definition.id}
                label={field.definition.label}
                value={values[field.definition.id] || "false"}
                onChange={(event) => setValues({ ...values, [field.definition.id]: event.target.value })}
                options={[
                  { value: "false", label: "Нет" },
                  { value: "true", label: "Да" },
                ]}
              />
            );
          }
          if (field.definition.field_type === "select" && options.length) {
            return (
              <Select
                key={field.definition.id}
                label={field.definition.label}
                value={values[field.definition.id] || ""}
                onChange={(event) => setValues({ ...values, [field.definition.id]: event.target.value })}
                options={[{ value: "", label: "Не выбрано" }, ...options.map((option) => ({ value: option, label: option }))]}
              />
            );
          }
          return (
            <Input
              key={field.definition.id}
              label={field.definition.label}
              type={field.definition.field_type === "number" || field.definition.field_type === "money" ? "number" : field.definition.field_type === "date" ? "date" : "text"}
              value={values[field.definition.id] || ""}
              onChange={(event) => setValues({ ...values, [field.definition.id]: event.target.value })}
            />
          );
        })}
      </div>
    </div>
  );
}

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
      <p className="font-bold text-midnight">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

export function CrmEntityDrawer({ entity, onClose }: { entity: CrmDrawerEntity | null; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const query = useQuery({
    queryKey: ["crm-card", entity?.type, entity?.id],
    queryFn: () => crmCardsApi.get({ type: entity!.type, id: entity!.id }),
    enabled: Boolean(entity),
  });
  const data = query.data;
  const tabContent = useMemo(() => {
    if (!data) return null;
    if (activeTab === "timeline") return <EntityTimeline data={data} />;
    if (activeTab === "tasks") return <EntityTasksPanel data={data} />;
    if (activeTab === "messages") return <EntityConversationsPanel data={data} />;
    if (activeTab === "notes") return <EntityNotesPanel data={data} />;
    return (
      <div className="space-y-4">
        <ClientCardContent data={data} />
        <EntityInlineEditPanel data={data} entity={entity!} />
        <EntityCustomFieldsPanel data={data} entity={entity!} />
        <LeadCardContent lead={data.lead} />
        <DealCardContent deal={data.deal} />
        <AppointmentCardContent appointment={data.appointment} />
      </div>
    );
  }, [activeTab, data, entity]);

  if (!entity) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm" onMouseDown={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden bg-slate-50 shadow-premium sm:rounded-l-[2rem]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <CrmEntityHeader data={data} onClose={onClose} />
        <CrmEntityTabs active={activeTab} onChange={setActiveTab} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 sm:px-7">
          {query.isLoading ? <LoadingState /> : null}
          {query.error ? <ErrorState message="Не удалось загрузить CRM карточку." /> : null}
          {tabContent}
        </div>
      </aside>
    </div>
  );
}
