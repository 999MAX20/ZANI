import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardList, Download, MessageCircle, Paperclip, StickyNote } from "lucide-react";
import { useEffect, useState } from "react";

import { notesApi } from "../../../api/activities";
import { customFieldValuesApi } from "../../../api/customFields";
import { leadsApi } from "../../../api/leads";
import { tasksApi } from "../../../api/tasks";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { CrmCardPayload } from "../../../types";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { StatusBadge } from "../../ui/StatusBadge";
import { Textarea } from "../../ui/Textarea";
import { EmptyBlock, getChannelLabel } from "./shared";
import type { CrmDrawerEntity } from "./types";

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

export function EntityDealsPanel({ data }: { data: CrmCardPayload }) {
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

export function EntityCustomFieldsPanel({ data, entity }: { data: CrmCardPayload; entity: CrmDrawerEntity }) {
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
