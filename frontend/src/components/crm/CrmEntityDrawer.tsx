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
import { notesApi } from "../../api/activities";
import { crmCardsApi } from "../../api/crmCards";
import { customFieldValuesApi } from "../../api/customFields";
import { dealsApi } from "../../api/deals";
import { leadsApi } from "../../api/leads";
import { tasksApi } from "../../api/tasks";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Appointment, CrmCardPayload, CrmEntityType, Deal, Id, Lead } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { ErrorState, LoadingState } from "../ui/StateViews";
import { StatusBadge } from "../ui/StatusBadge";
import { Textarea } from "../ui/Textarea";

export type CrmDrawerEntity = {
  type: CrmEntityType;
  id: Id;
  initialTab?: CrmCardTab;
};

export type CrmCardTab = "overview" | "timeline" | "tasks" | "messages" | "notes" | "deals" | "files";

type TabId = CrmCardTab;

const tabs: { id: TabId; labelKey: string }[] = [
  { id: "overview", labelKey: "crmCard.overview" },
  { id: "timeline", labelKey: "crmCard.timeline" },
  { id: "tasks", labelKey: "crmCard.tasks" },
  { id: "messages", labelKey: "crmCard.messages" },
  { id: "notes", labelKey: "crmCard.notes" },
  { id: "deals", labelKey: "nav.deals" },
  { id: "files", labelKey: "crmCard.attachments" },
];

function getTitle(data: CrmCardPayload | undefined, t: (key: string, vars?: Record<string, string | number>) => string, entity?: CrmDrawerEntity | null) {
  if (!data) return t("crmCard.title");
  if (entity?.type === "client") return data.client?.full_name || t("crmCard.title");
  if (data.deal) return data.deal.title;
  if (data.appointment) return t("crmCard.appointmentNumber", { id: data.appointment.id });
  if (data.lead) return t("crmCard.leadNumber", { id: data.lead.id });
  return data.client?.full_name || t("crmCard.title");
}

function getSubtitle(data: CrmCardPayload | undefined, t: (key: string) => string) {
  const client = data?.client;
  if (!client) return t("crmCard.subtitle");
  return [client.phone, client.email, client.source].filter(Boolean).join(" · ") || t("crmCard.noContacts");
}

function getChannelLabel(channel: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    website: "channel.website",
    telegram: "channel.telegram",
    whatsapp: "channel.whatsapp",
    instagram: "channel.instagram",
    manual: "channel.manual",
  };
  return labels[channel] ? t(labels[channel]) : channel;
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

export function CrmEntityHeader({ data, entity, titleId, onClose }: { data?: CrmCardPayload; entity: CrmDrawerEntity; titleId: string; onClose: () => void }) {
  const { t } = useI18n();
  const activeStatus = entity.type === "client" ? undefined : data?.deal?.status || data?.appointment?.status || data?.lead?.status;

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
          <h2 id={titleId} className="truncate text-2xl font-black tracking-tight text-midnight">{getTitle(data, t, entity)}</h2>
          <p className="mt-1 text-sm text-slate-500">{getSubtitle(data, t)}</p>
        </div>
        <Button type="button" variant="ghost" className="h-12 w-12 shrink-0 rounded-full px-0" onClick={onClose} aria-label={t("crmCard.close")}>
          <X size={28} strokeWidth={2.4} />
        </Button>
      </div>
    </div>
  );
}

export function CrmEntityTabs({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  const { t } = useI18n();
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
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}

export function EntityQuickActions({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  const phone = data.client?.phone;
  const cleanPhone = phone?.replace(/\D/g, "");

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={!phone} onClick={() => phone && (window.location.href = `tel:${phone}`)}>
        <Phone size={17} /> {t("crmCard.call")}
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
  const { t } = useI18n();
  const client = data.client;

  return (
    <div className="space-y-5">
      <EntityQuickActions data={data} />
      <EntityDecisionSnapshot data={data} />
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
        <SummaryItem icon={UserRound} label={t("common.client")} value={client?.full_name} />
        <SummaryItem icon={ClipboardList} label={t("nav.leads")} value={data.leads.length} />
        <SummaryItem icon={WalletCards} label={t("nav.deals")} value={data.deals.length} />
        <SummaryItem icon={CalendarClock} label={t("nav.appointments")} value={data.appointments.length} />
      </div>
      {client?.notes ? <div className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{client.notes}</div> : null}
      <EntityAttachmentsPanel data={data} />
    </div>
  );
}

function EntityDecisionSnapshot({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  const openTasks = data.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const latestEvent = data.timeline[0];
  const latestConversation = data.conversations[0];

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">{t("crmCard.snapshotNext")}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          {openTasks[0]?.title || t("crmCard.snapshotNoTasks")}
        </p>
      </div>
      <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("crmCard.snapshotHistory")}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          {latestEvent ? `${latestEvent.text || latestEvent.event_type} · ${formatDateTime(latestEvent.created_at)}` : t("crmCard.emptyTimelineText")}
        </p>
      </div>
      <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("crmCard.snapshotMessages")}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          {latestConversation?.last_message?.text || t("crmCard.noDialogsText")}
        </p>
      </div>
    </div>
  );
}

export function EntityAttachmentsPanel({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        <Paperclip size={14} /> {t("crmCard.attachments")}
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
        <p className="text-sm leading-6 text-slate-500">{t("crmCard.noAttachments")}</p>
      )}
    </div>
  );
}

export function LeadCardContent({ lead }: { lead: Lead | null }) {
  const { t } = useI18n();
  if (!lead) return null;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-midnight">{t("crmCard.leadNumber", { id: lead.id })}</h3>
        <StatusBadge status={lead.status} />
      </div>
      <p className="text-sm leading-6 text-slate-600">{lead.message || t("crmCard.noLeadMessage")}</p>
      <p className="mt-3 text-xs font-semibold text-slate-400">{lead.source} · {formatDateTime(lead.created_at)}</p>
    </div>
  );
}

export function DealCardContent({ deal }: { deal: Deal | null }) {
  const { t } = useI18n();
  if (!deal) return null;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-midnight">{deal.title}</h3>
        <StatusBadge status={deal.status} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryItem icon={WalletCards} label={t("crmCard.amount")} value={`${Number(deal.amount || 0).toLocaleString("ru-RU")} ${deal.currency}`} />
        <SummaryItem icon={CheckCircle2} label={t("crmCard.probability")} value={`${deal.probability}%`} />
        <SummaryItem icon={CalendarClock} label={t("crmCard.closeDate")} value={formatDateTime(deal.expected_close_at)} />
      </div>
      {deal.notes ? <p className="mt-4 text-sm leading-6 text-slate-600">{deal.notes}</p> : null}
    </div>
  );
}

export function AppointmentCardContent({ appointment }: { appointment: Appointment | null }) {
  const { t } = useI18n();
  if (!appointment) return null;

  return (
    <div className="rounded-3xl border border-brand-100 bg-gradient-to-r from-brand-50 to-ai-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-midnight">{t("crmCard.appointmentNumber", { id: appointment.id })}</h3>
        <StatusBadge status={appointment.status} />
      </div>
      <p className="text-sm font-semibold text-slate-700">{formatDateTime(appointment.start_at)} - {formatDateTime(appointment.end_at)}</p>
      {appointment.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{appointment.notes}</p> : null}
    </div>
  );
}

function EntityInlineEditPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
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
          <h3 className="font-black text-midnight">{t("crmCard.quickEdit")}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{t("crmCard.quickEditText")}</p>
        </div>
        <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
          {t("clients.save")}
        </Button>
      </div>
      {mutation.error ? <div className="mb-3"><ErrorState message={t("crmCard.saveError")} /></div> : null}
      {entity.type === "lead" ? (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <Select
            label={t("crmCard.leadStatus")}
            value={leadStatus}
            onChange={(event) => setLeadStatus(event.target.value as Lead["status"])}
            options={[
              { value: "new", label: t("leads.columnNew") },
              { value: "contacted", label: t("leads.contacted") },
              { value: "in_progress", label: t("leads.metricActive") },
              { value: "appointment_created", label: t("appointment.statusCreated") },
              { value: "closed", label: t("leads.close") },
              { value: "lost", label: t("leads.lost") },
            ]}
          />
          <Input label={t("crmCard.messageNote")} value={leadMessage} onChange={(event) => setLeadMessage(event.target.value)} />
        </div>
      ) : null}
      {entity.type === "deal" ? (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <Select
            label={t("crmCard.dealStatus")}
            value={dealStatus}
            onChange={(event) => setDealStatus(event.target.value as Deal["status"])}
            options={[
              { value: "open", label: t("crmCard.open") },
              { value: "won", label: t("crmCard.won") },
              { value: "lost", label: t("leads.lost") },
            ]}
          />
          <Input label={t("clients.notes")} value={dealNotes} onChange={(event) => setDealNotes(event.target.value)} />
        </div>
      ) : null}
      {entity.type === "appointment" ? (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <Select
            label={t("crmCard.appointmentStatus")}
            value={appointmentStatus}
            onChange={(event) => setAppointmentStatus(event.target.value as Appointment["status"])}
            options={[
              { value: "created", label: t("appointment.statusCreated") },
              { value: "confirmed", label: t("appointment.statusConfirmed") },
              { value: "cancelled", label: t("appointment.statusCancelled") },
              { value: "rescheduled", label: t("appointment.statusRescheduled") },
              { value: "completed", label: t("appointment.statusCompleted") },
              { value: "no_show", label: t("appointment.statusNoShow") },
            ]}
          />
          <Input label={t("clients.notes")} value={appointmentNotes} onChange={(event) => setAppointmentNotes(event.target.value)} />
        </div>
      ) : null}
    </div>
  );
}

function EntityDealsPanel({ data }: { data: CrmCardPayload }) {
  return (
    <div className="space-y-3">
      {data.deals.length ? (
        data.deals.map((deal) => (
          <div key={deal.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-midnight">{deal.title}</p>
              <StatusBadge status={deal.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">#{deal.id} · {deal.amount || 0} {deal.currency}</p>
            {deal.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{deal.notes}</p> : null}
          </div>
        ))
      ) : (
        <EmptyBlock title="Сделок пока нет" text="Сделок пока нет." />
      )}
    </div>
  );
}

export function EntityTimeline({ data }: { data: CrmCardPayload }) {
  const { language, t } = useI18n();
  const grouped = data.timeline.reduce<Record<string, typeof data.timeline>>((acc, event) => {
    const locale = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
    const key = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(new Date(event.created_at));
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
      {!data.timeline.length ? <EmptyBlock title={t("crmCard.emptyTimeline")} text={t("crmCard.emptyTimelineText")} /> : null}
    </div>
  );
}

export function EntityTasksPanel({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [taskTitle, setTaskTitle] = useState("");
  const businessId = data.client?.business || data.lead?.business || data.deal?.business || data.appointment?.business;
  const mutation = useMutation({
    mutationFn: () => {
      if (!businessId || !taskTitle.trim()) throw new Error("Task title is required.");
      return tasksApi.create({
        business: businessId,
        title: taskTitle.trim(),
        client: data.client?.id || null,
        lead: data.lead?.id || null,
        deal: data.deal?.id || null,
        appointment: data.appointment?.id || null,
        priority: "normal",
        status: "open",
      });
    },
    onSuccess: () => {
      setTaskTitle("");
      queryClient.invalidateQueries({ queryKey: ["crm-card"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-brand-100 bg-white/85 p-4 shadow-sm">
        <h3 className="font-black text-midnight">{t("crmCard.quickTask")}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{t("crmCard.quickTaskText")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder={t("crmCard.taskPlaceholder")} />
          <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("crmCard.createTask")}
          </Button>
        </div>
        {mutation.error ? <p className="mt-2 text-sm font-semibold text-red-600">{t("crmCard.taskError")}</p> : null}
      </div>
      {data.tasks.map((task) => (
        <div key={task.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-midnight">{task.title}</p>
            <StatusBadge status={task.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{task.priority} · {t("crmCard.deadline")} {formatDateTime(task.due_at)}</p>
          {task.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{task.description}</p> : null}
        </div>
      ))}
      {!data.tasks.length ? <EmptyBlock title={t("crmCard.noTasks")} text={t("crmCard.noTasksText")} /> : null}
    </div>
  );
}

export function EntityConversationsPanel({ data }: { data: CrmCardPayload }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {data.conversations.map((conversation) => (
        <div key={conversation.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-midnight">{getChannelLabel(conversation.channel, t)}</p>
            <StatusBadge status={conversation.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("crmCard.unread")}: {conversation.unread_count || 0} · {formatDateTime(conversation.last_message_at || conversation.updated_at)}</p>
          {conversation.last_message?.text ? <p className="mt-3 text-sm leading-6 text-slate-600">{conversation.last_message.text}</p> : null}
        </div>
      ))}
      {!data.conversations.length ? <EmptyBlock title={t("crmCard.noDialogs")} text={t("crmCard.noDialogsText")} /> : null}
    </div>
  );
}

export function EntityNotesPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const businessId = data.client?.business || data.lead?.business || data.deal?.business || data.appointment?.business;
  const entityType = entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
  const mutation = useMutation({
    mutationFn: () => {
      const noteText = text.trim();
      if (!noteText) throw new Error("Note text is required.");
      if (entity.type === "lead" && data.lead) {
        return leadsApi.addNote({ id: data.lead.id, text: noteText });
      }
      if (!businessId) throw new Error("Business is required.");
      return notesApi.create({
        business: businessId,
        client: data.client?.id || null,
        entity_type: entityType,
        entity_id: String(entity.id),
        text: noteText,
      });
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["crm-card", entity.type, entity.id] });
      queryClient.invalidateQueries({ queryKey: ["activity-events"] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-brand-100 bg-white/85 p-4 shadow-sm">
        <h3 className="font-black text-midnight">{t("crmCard.comment")}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{t("crmCard.commentText")}</p>
        <Textarea className="mt-3" value={text} onChange={(event) => setText(event.target.value)} placeholder={t("crmCard.commentPlaceholder")} />
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("crmCard.addComment")}
          </Button>
        </div>
        {mutation.error ? <p className="mt-2 text-sm font-semibold text-red-600">{t("crmCard.commentError")}</p> : null}
      </div>
      {data.notes.map((note) => (
        <div key={note.id} className="rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            <StickyNote size={14} /> Note · {formatDateTime(note.created_at)}
          </div>
          <p className="text-sm leading-6 text-slate-700">{note.text}</p>
        </div>
      ))}
      {!data.notes.length ? <EmptyBlock title={t("crmCard.noNotes")} text={t("crmCard.noNotesText")} /> : null}
    </div>
  );
}

function EntityCustomFieldsPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
  const { t } = useI18n();
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
          <h3 className="font-black text-midnight">{t("crmCard.customFields")}</h3>
          <p className="mt-1 text-sm text-slate-500">{t("crmCard.customFieldsText")}</p>
        </div>
        <Button type="button" variant="secondary" isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
          {t("crmCard.saveFields")}
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
                  { value: "false", label: t("crmCard.no") },
                  { value: "true", label: t("crmCard.yes") },
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
                options={[{ value: "", label: t("crmCard.notSelected") }, ...options.map((option) => ({ value: option, label: option }))]}
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
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>(entity?.initialTab || "overview");
  const [isOpen, setIsOpen] = useState(false);
  const titleId = "crm-entity-drawer-title";
  const query = useQuery({
    queryKey: ["crm-card", entity?.type, entity?.id],
    queryFn: () => crmCardsApi.get({ type: entity!.type, id: entity!.id }),
    enabled: Boolean(entity),
  });
  const data = query.data;
  useEffect(() => {
    setActiveTab(entity?.initialTab || "overview");
  }, [entity?.id, entity?.initialTab, entity?.type]);
  useEffect(() => {
    if (!entity) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => {
      cancelAnimationFrame(frame);
      setIsOpen(false);
    };
  }, [entity?.id, entity?.type]);
  const tabContent = useMemo(() => {
    if (!data) return null;
    if (activeTab === "timeline") return <EntityTimeline data={data} />;
    if (activeTab === "tasks") return <EntityTasksPanel data={data} />;
    if (activeTab === "deals") return <EntityDealsPanel data={data} />;
    if (activeTab === "files") return <EntityAttachmentsPanel data={data} />;
    if (activeTab === "messages") return <EntityConversationsPanel data={data} />;
    if (activeTab === "notes") return <EntityNotesPanel data={data} entity={entity!} />;
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
    <div
      className={cn(
        "fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm transition-opacity duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
      onMouseDown={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden bg-slate-50 shadow-premium transition-transform duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform sm:rounded-l-[2rem]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <CrmEntityHeader data={data} entity={entity} titleId={titleId} onClose={onClose} />
        <CrmEntityTabs active={activeTab} onChange={setActiveTab} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 sm:px-7">
          {query.isLoading ? <LoadingState /> : null}
          {query.error ? <ErrorState message={t("crmCard.loadError")} /> : null}
          {tabContent}
        </div>
      </aside>
    </div>
  );
}
