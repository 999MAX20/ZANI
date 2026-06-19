import { BellPlus, CalendarPlus, Check, Clock, MessageSquare, Play, Plus, RotateCcw, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "../../api/client";
import { tasksApi, type TaskCreatePayload, type TaskUpdatePayload } from "../../api/tasks";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { KeyboardEvent, ReactNode } from "react";
import type { Task } from "../../types";

const emptyForm = {
  title: "",
  description: "",
  client: "",
  lead: "",
  deal: "",
  appointment: "",
  priority: "normal",
  due_at: "",
  reminder_at: "",
};

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function taskToForm(task: Task) {
  return {
    title: task.title,
    description: task.description || "",
    client: task.client ? String(task.client) : "",
    lead: task.lead ? String(task.lead) : "",
    deal: task.deal ? String(task.deal) : "",
    appointment: task.appointment ? String(task.appointment) : "",
    priority: task.priority,
    due_at: toDateTimeLocal(task.due_at),
    reminder_at: toDateTimeLocal(task.reminder_at),
  };
}

function priorityMarkerClass(priority: Task["priority"]) {
  if (priority === "urgent") return "bg-red-500";
  if (priority === "high") return "bg-amber-500";
  if (priority === "low") return "bg-slate-300";
  return "bg-cyan-500";
}

function RelatedAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function CompactActionButton({ label, onClick, children, variant = "secondary" }: { label: string; onClick: () => void; children: ReactNode; variant?: "secondary" | "ghost" }) {
  return (
    <Button
      type="button"
      variant={variant}
      className="h-8 min-h-8 w-8 min-w-8 rounded-md px-0"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

export function TasksPage() {
  const { t } = useI18n();
  const { setPageHeader } = usePageHeader();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { appointments, clients, deals, leads, services } = useEntityData({ appointments: true, clients: true, deals: true, leads: true, services: true });
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [tabFilter, setTabFilter] = useState<"my" | "today" | "overdue" | "team">("my");
  const [statusFilter, setStatusFilter] = useState("active");
  const [commentText, setCommentText] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const taskComments = useQuery({
    queryKey: ["task-comments", selectedTask?.id],
    queryFn: () => tasksApi.comments(selectedTask!.id),
    enabled: Boolean(selectedTask?.id),
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks", { tab: tabFilter, status: statusFilter }],
    queryFn: () =>
      tasksApi.list({
        tab: tabFilter === "team" ? undefined : tabFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const openQuickTask = useCallback(() => {
    setEditingTask(null);
    setForm(emptyForm);
    setOpen(true);
  }, []);

  useEffect(() => {
    const taskId = Number(searchParams.get("task") || "");
    if (!taskId || !tasksQuery.data?.length) return;
    const task = tasksQuery.data.find((item) => item.id === taskId);
    if (task) setSelectedTask(task);
  }, [searchParams, tasksQuery.data]);

  useEffect(() => {
    setPageHeader({
      title: t("tasks.title"),
      primaryAction: {
        label: t("tasks.quickTask"),
        icon: Plus,
        onClick: openQuickTask,
      },
    });
    return () => setPageHeader(null);
  }, [openQuickTask, setPageHeader, t]);

  const createMutation = useMutation({
    mutationFn: (payload: TaskCreatePayload) => tasksApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setForm(emptyForm);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: Task["id"]; payload: TaskUpdatePayload }) => tasksApi.update({ id, payload }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setEditingTask(null);
      setSelectedTask((current) => (current?.id === task.id ? task : current));
      setForm(emptyForm);
    },
  });
  const completeMutation = useMutation({
    mutationFn: tasksApi.complete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const startMutation = useMutation({
    mutationFn: tasksApi.start,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const cancelMutation = useMutation({
    mutationFn: tasksApi.cancel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const reopenMutation = useMutation({
    mutationFn: tasksApi.reopen,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const assignToMeMutation = useMutation({
    mutationFn: tasksApi.assignToMe,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const dueTodayMutation = useMutation({
    mutationFn: tasksApi.dueToday,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const dueTomorrowMutation = useMutation({
    mutationFn: tasksApi.dueTomorrow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const watcherMutation = useMutation({
    mutationFn: tasksApi.addWatcher,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const snoozeMutation = useMutation({
    mutationFn: tasksApi.snooze,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const commentMutation = useMutation({
    mutationFn: tasksApi.addComment,
    onSuccess: async () => {
      setCommentText("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task-comments", selectedTask?.id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
    },
  });

  if (!business) return <ErrorState message={t("tasks.noBusiness")} />;
  if (tasksQuery.isLoading || clients.isLoading || leads.isLoading || deals.isLoading || appointments.isLoading || services.isLoading) return <LoadingState />;
  if (tasksQuery.error) return <ErrorState message={getApiErrorMessage(tasksQuery.error)} />;

  const visibleTasks = tasksQuery.data || [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { value: "my", label: t("tasks.my") },
          { value: "today", label: t("common.today") },
          { value: "overdue", label: t("tasks.overdue") },
          { value: "team", label: t("tasks.team") },
        ].map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant={tabFilter === tab.value ? "primary" : "secondary"}
            onClick={() => setTabFilter(tab.value as typeof tabFilter)}
          >
            {tab.label}
          </Button>
        ))}
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { value: "active", label: t("tasks.active") },
            { value: "open", label: t("tasks.open") },
            { value: "in_progress", label: t("tasks.inProgress") },
            { value: "done", label: t("tasks.done") },
            { value: "cancelled", label: t("tasks.cancelled") },
            { value: "all", label: t("tasks.all") },
          ]}
        />
      </div>

      <Card variant="outlined" className="overflow-hidden">
        {visibleTasks.map((task) => {
          const openTask = () => setSelectedTask(task);
          const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openTask();
            }
          };

          return (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              className="grid min-h-[76px] cursor-pointer grid-cols-[10px_minmax(0,1fr)] gap-0 border-b border-slate-100 bg-white transition last:border-b-0 hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-brand-200 md:grid-cols-[10px_minmax(0,1fr)_auto]"
              onClick={openTask}
              onKeyDown={onKeyDown}
            >
              <div className={priorityMarkerClass(task.priority)} />
              <div className="min-w-0 px-4 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="min-w-0 max-w-full truncate text-sm font-black text-midnight">{task.title}</h2>
                  <StatusBadge status={task.priority} />
                  <StatusBadge status={task.status} />
                  {task.due_at ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{t("tasks.due")} {formatDateTime(task.due_at)}</span> : null}
                  {task.snoozed_until ? <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700">{t("tasks.snoozed")} {formatDateTime(task.snoozed_until)}</span> : null}
                </div>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
                  {task.client ? <RelatedAction onClick={() => setDrawerEntity({ type: "client", id: Number(task.client) })}>{task.client_name || t("common.client")}</RelatedAction> : <span className="rounded-full bg-slate-100 px-2.5 py-1">{t("tasks.noClient")}</span>}
                  {task.lead ? <RelatedAction onClick={() => setDrawerEntity({ type: "lead", id: Number(task.lead) })}>{task.lead_title || t("crmCard.leadNumber", { id: task.lead })}</RelatedAction> : null}
                  {task.deal ? <RelatedAction onClick={() => setDrawerEntity({ type: "deal", id: Number(task.deal) })}>{task.deal_title || t("nav.deals")}</RelatedAction> : null}
                  {task.appointment ? <RelatedAction onClick={() => setDrawerEntity({ type: "appointment", id: Number(task.appointment) })}>{task.appointment_service_name || t("nav.appointments")}{task.appointment_start_at ? ` · ${formatDateTime(task.appointment_start_at)}` : ""}</RelatedAction> : null}
                  {task.assignee_name || task.assignee_email ? <span className="rounded-full bg-slate-100 px-2.5 py-1">{task.assignee_name || task.assignee_email}</span> : null}
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">{t("tasks.commentsCount", { count: task.comments_count || 0 })}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">{t("tasks.watchersCount", { count: task.watchers_count || task.watchers?.length || 0 })}</span>
                </div>
                {task.description ? <p className="mt-2 truncate text-xs font-medium text-slate-500">{task.description}</p> : null}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-1.5 border-t border-slate-50 px-4 py-2 md:col-span-1 md:border-t-0 md:py-3 md:pl-2">
                <CompactActionButton label={t("tasks.details")} onClick={openTask}>
                  <MessageSquare size={15} />
                </CompactActionButton>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 min-h-8 rounded-md px-2.5 text-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingTask(task);
                    setForm(taskToForm(task));
                    setOpen(true);
                  }}
                >
                  {t("tasks.edit")}
                </Button>
                {task.status === "open" ? (
                  <CompactActionButton label={t("tasks.start")} onClick={() => startMutation.mutate(task.id)}>
                    <Play size={15} />
                  </CompactActionButton>
                ) : null}
                {!["done", "cancelled"].includes(task.status) ? (
                  <CompactActionButton label={t("tasks.complete")} onClick={() => completeMutation.mutate(task.id)}>
                    <Check size={15} />
                  </CompactActionButton>
                ) : null}
                {!["done", "cancelled"].includes(task.status) ? (
                  <CompactActionButton label={t("tasks.cancel")} variant="ghost" onClick={() => cancelMutation.mutate(task.id)}>
                    <X size={15} />
                  </CompactActionButton>
                ) : null}
                {["done", "cancelled"].includes(task.status) ? (
                  <CompactActionButton label={t("tasks.reopen")} onClick={() => reopenMutation.mutate(task.id)}>
                    <RotateCcw size={15} />
                  </CompactActionButton>
                ) : null}
              </div>
            </div>
          );
        })}
        {!visibleTasks.length ? (
          <EmptyState
            title={t("tasks.emptyTitle")}
            description={t("tasks.emptyText")}
            action={<Button variant="secondary" onClick={() => { setEditingTask(null); setForm(emptyForm); setOpen(true); }}><Plus size={16} />{t("tasks.create")}</Button>}
          />
        ) : null}
      </Card>

      <Modal title={editingTask ? t("tasks.editTitle") : t("tasks.create")} open={open} onClose={() => { setOpen(false); setEditingTask(null); setForm(emptyForm); }}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const payload: TaskCreatePayload | TaskUpdatePayload = {
              business: business.id,
              title: form.title.trim(),
              description: form.description,
              client: form.client ? Number(form.client) : null,
              lead: form.lead ? Number(form.lead) : null,
              deal: form.deal ? Number(form.deal) : null,
              appointment: form.appointment ? Number(form.appointment) : null,
              priority: form.priority as Task["priority"],
              due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
              reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : null,
            };
            if (editingTask) updateMutation.mutate({ id: editingTask.id, payload });
            else createMutation.mutate(payload);
          }}
        >
          <Input label={t("tasks.formTitle")} placeholder={t("tasks.titlePlaceholder")} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Input label={t("tasks.formDescription")} placeholder={t("tasks.descriptionPlaceholder")} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <Select value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })} options={[{ value: "", label: t("tasks.noClient") }, ...(clients.data || []).map((client) => ({ value: String(client.id), label: client.full_name }))]} />
          <Select
            value={form.lead}
            onChange={(event) => setForm({ ...form, lead: event.target.value })}
            options={[
              { value: "", label: t("tasks.noLead") },
              ...(leads.data || []).map((lead) => {
                const client = clients.data?.find((item) => item.id === lead.client);
                return { value: String(lead.id), label: `${client?.full_name || t("crmCard.leadNumber", { id: lead.id })} · ${lead.status}` };
              }),
            ]}
          />
          <Select
            value={form.deal}
            onChange={(event) => setForm({ ...form, deal: event.target.value })}
            options={[
              { value: "", label: t("tasks.noDeal") },
              ...(deals.data || []).map((deal) => {
                const client = clients.data?.find((item) => item.id === deal.client);
                return { value: String(deal.id), label: `${deal.title} · ${client?.full_name || t("common.client")} · ${deal.status}` };
              }),
            ]}
          />
          <Select
            value={form.appointment}
            onChange={(event) => setForm({ ...form, appointment: event.target.value })}
            options={[
              { value: "", label: t("tasks.noAppointment") },
              ...(appointments.data || []).map((appointment) => {
                const client = clients.data?.find((item) => item.id === appointment.client);
                const service = services.data?.find((item) => item.id === appointment.service);
                return { value: String(appointment.id), label: `${client?.full_name || t("common.client")} · ${service?.name || t("common.service")} · ${formatDateTime(appointment.start_at)}` };
              }),
            ]}
          />
          <Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} options={[{ value: "normal", label: t("tasks.priorityNormal") }, { value: "high", label: t("tasks.priorityHigh") }, { value: "urgent", label: t("tasks.priorityUrgent") }, { value: "low", label: t("tasks.priorityLow") }]} />
          <Input label={t("tasks.dueAt")} type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
          <Input label={t("tasks.reminderAt")} type="datetime-local" value={form.reminder_at} onChange={(event) => setForm({ ...form, reminder_at: event.target.value })} />
          {createMutation.error || updateMutation.error ? <ErrorState message={getApiErrorMessage(createMutation.error || updateMutation.error)} /> : null}
          <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>{t("clients.save")}</Button>
        </form>
      </Modal>

      <Modal title={selectedTask?.title || t("tasks.task")} open={Boolean(selectedTask)} onClose={() => setSelectedTask(null)}>
        {selectedTask ? (
          <div className="space-y-5">
            <div className="rounded-3xl bg-slate-50 p-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={selectedTask.status} />
                <StatusBadge status={selectedTask.priority} />
                {selectedTask.due_at ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{t("tasks.due")} {formatDateTime(selectedTask.due_at)}</span> : null}
              </div>
              {selectedTask.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{selectedTask.description}</p> : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="secondary" onClick={() => { setEditingTask(selectedTask); setForm(taskToForm(selectedTask)); setOpen(true); }}>
                {t("tasks.edit")}
              </Button>
              <Button variant="secondary" onClick={() => assignToMeMutation.mutate(selectedTask.id)} isLoading={assignToMeMutation.isPending}>
                <UserPlus size={16} /> {t("tasks.assignToMe")}
              </Button>
              <Button variant="secondary" onClick={() => watcherMutation.mutate({ id: selectedTask.id })} isLoading={watcherMutation.isPending}>
                <BellPlus size={16} /> {t("tasks.watch")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(10, 0, 0, 0);
                  snoozeMutation.mutate({ id: selectedTask.id, snoozed_until: tomorrow.toISOString() });
                }}
                isLoading={snoozeMutation.isPending}
              >
                <Clock size={16} /> {t("tasks.snooze")}
              </Button>
              <Button variant="secondary" onClick={() => dueTodayMutation.mutate(selectedTask.id)} isLoading={dueTodayMutation.isPending}>
                <CalendarPlus size={16} /> {t("common.today")}
              </Button>
              <Button variant="secondary" onClick={() => dueTomorrowMutation.mutate(selectedTask.id)} isLoading={dueTomorrowMutation.isPending}>
                <CalendarPlus size={16} /> {t("tasks.tomorrow")}
              </Button>
            </div>

            <div>
              <h3 className="font-bold text-midnight">{t("tasks.comments")}</h3>
              <div className="mt-3 space-y-2">
                {(taskComments.data || []).map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-slate-100 bg-white p-3">
                    <p className="text-sm leading-6 text-slate-700">{comment.text}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {comment.author_name || comment.author_email || t("resources.typeStaff")} · {formatDateTime(comment.created_at)}
                    </p>
                  </div>
                ))}
                {!taskComments.isLoading && !taskComments.data?.length ? <p className="text-sm text-slate-500">{t("tasks.noComments")}</p> : null}
              </div>
              <form
                className="mt-3 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (commentText.trim()) commentMutation.mutate({ id: selectedTask.id, text: commentText.trim() });
                }}
              >
                <Textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={t("tasks.commentPlaceholder")} />
                <Button type="submit" isLoading={commentMutation.isPending}>{t("tasks.addComment")}</Button>
              </form>
            </div>
          </div>
        ) : null}
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
