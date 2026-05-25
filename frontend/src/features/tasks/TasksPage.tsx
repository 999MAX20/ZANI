import { BellPlus, CalendarPlus, Check, Clock, MessageSquare, Play, Plus, RotateCcw, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "../../api/client";
import { tasksApi } from "../../api/tasks";
import { PageAiHints, type PageAiHint } from "../../components/ai/PageAiHints";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useAuth } from "../auth/AuthProvider";
import type { ReactNode } from "react";
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
};

function RelatedAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TasksPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const { appointments, clients, deals, leads, services, tasks } = useEntityData({ appointments: true, clients: true, deals: true, leads: true, services: true, tasks: true });
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    const taskId = Number(searchParams.get("task") || "");
    if (!taskId || !tasks.data?.length) return;
    const task = tasks.data.find((item) => item.id === taskId);
    if (task) setSelectedTask(task);
  }, [searchParams, tasks.data]);

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Task>) => tasksApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
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
  const assignMutation = useMutation({
    mutationFn: tasksApi.assign,
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
  if (tasks.isLoading || clients.isLoading || leads.isLoading || deals.isLoading || appointments.isLoading || services.isLoading) return <LoadingState />;

  const taskList = tasks.data || [];
  const activeTasks = taskList.filter((task) => !["done", "cancelled"].includes(task.status));
  const todayKey = new Date().toISOString().slice(0, 10);
  const currentUserId = user?.id;
  const visibleTasks = taskList.filter((task) => {
    if (tabFilter === "my" && currentUserId && task.assignee !== currentUserId && !task.watchers?.includes(currentUserId)) return false;
    if (tabFilter === "today" && task.due_at?.slice(0, 10) !== todayKey) return false;
    if (tabFilter === "overdue" && (!task.due_at || new Date(task.due_at) >= new Date() || ["done", "cancelled"].includes(task.status))) return false;
    if (statusFilter === "active") return !["done", "cancelled"].includes(task.status);
    if (statusFilter === "all") return true;
    return task.status === statusFilter;
  });
  const overdueTasks = activeTasks.filter((task) => task.due_at && new Date(task.due_at) < new Date()).length;
  const highPriorityTasks = activeTasks.filter((task) => ["high", "urgent"].includes(task.priority)).length;
  const taskAiHints: PageAiHint[] = [
    overdueTasks > 0
      ? {
          id: "overdue",
          title: t("tasks.aiOverdueTitle"),
          description: t("tasks.aiOverdueDesc", { count: overdueTasks }),
          actionLabel: t("tasks.aiOpenOverdue"),
          href: "/dashboard/tasks",
          icon: Clock,
          severity: "critical",
        }
      : {
          id: "no-overdue",
          title: t("tasks.aiNoOverdueTitle"),
          description: t("tasks.aiNoOverdueDesc"),
          icon: Check,
          severity: "good",
        },
    highPriorityTasks > 0
      ? {
          id: "priority",
          title: t("tasks.aiPriorityTitle"),
          description: t("tasks.aiPriorityDesc", { count: highPriorityTasks }),
          icon: BellPlus,
          severity: "warning",
        }
      : {
          id: "priority-clear",
          title: t("tasks.aiPlanTitle"),
          description: t("tasks.aiPlanDesc"),
          icon: CalendarPlus,
          severity: "info",
        },
  ];

  return (
    <>
      <PageHeader title={t("tasks.title")} description={t("tasks.description")} actions={<Button onClick={() => setOpen(true)}><Plus size={18} />{t("tasks.quickTask")}</Button>} />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Check size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{t("tasks.active")}</p>
              <p className="text-2xl font-semibold text-midnight">{activeTasks.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{t("tasks.overdue")}</p>
              <p className="text-2xl font-semibold text-midnight">{overdueTasks}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-700">
              <Play size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{t("tasks.highPriority")}</p>
              <p className="text-2xl font-semibold text-midnight">{highPriorityTasks}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <PageAiHints items={taskAiHints} className="mb-5" />

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

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleTasks.map((task) => {
          const client = clients.data?.find((item) => item.id === task.client);
          const lead = leads.data?.find((item) => item.id === task.lead);
          const deal = deals.data?.find((item) => item.id === task.deal);
          const appointment = appointments.data?.find((item) => item.id === task.appointment);
          const appointmentService = services.data?.find((item) => item.id === appointment?.service);
          return (
            <Card key={task.id}>
              <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-midnight">{task.title}</h2>
                    <StatusBadge status={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                  {task.description ? <p className="mt-2 text-sm leading-6 text-slate-500">{task.description}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                    {client ? <RelatedAction onClick={() => setDrawerEntity({ type: "client", id: client.id })}>{client.full_name}</RelatedAction> : <span className="rounded-full bg-slate-100 px-3 py-1">{t("tasks.noClient")}</span>}
                    {lead ? <RelatedAction onClick={() => setDrawerEntity({ type: "lead", id: lead.id })}>{t("crmCard.leadNumber", { id: lead.id })}</RelatedAction> : null}
                    {deal ? <RelatedAction onClick={() => setDrawerEntity({ type: "deal", id: deal.id })}>{deal.title}</RelatedAction> : null}
                    {appointment ? <RelatedAction onClick={() => setDrawerEntity({ type: "appointment", id: appointment.id })}>{appointmentService?.name || t("nav.appointments")} · {formatDateTime(appointment.start_at)}</RelatedAction> : null}
                    {task.due_at ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{t("tasks.due")} {formatDateTime(task.due_at)}</span> : null}
                    {task.snoozed_until ? <span className="rounded-full bg-purple-50 px-3 py-1 text-purple-700">{t("tasks.snoozed")} {formatDateTime(task.snoozed_until)}</span> : null}
                    <span className="rounded-full bg-slate-100 px-3 py-1">{t("tasks.commentsCount", { count: task.comments_count || 0 })}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">{t("tasks.watchersCount", { count: task.watchers_count || task.watchers?.length || 0 })}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button variant="secondary" className="h-10 rounded-full px-3" onClick={() => setSelectedTask(task)}>
                    <MessageSquare size={16} /> {t("tasks.details")}
                  </Button>
                  {task.status === "open" ? (
                    <Button variant="secondary" className="h-10 w-10 rounded-full px-0" onClick={() => startMutation.mutate(task.id)} aria-label={t("tasks.start")}>
                      <Play size={16} />
                    </Button>
                  ) : null}
                  {!["done", "cancelled"].includes(task.status) ? (
                    <Button variant="secondary" className="h-10 w-10 rounded-full px-0" onClick={() => completeMutation.mutate(task.id)} aria-label={t("tasks.complete")}>
                      <Check size={16} />
                    </Button>
                  ) : null}
                  {!["done", "cancelled"].includes(task.status) ? (
                    <Button variant="ghost" className="h-10 w-10 rounded-full px-0" onClick={() => cancelMutation.mutate(task.id)} aria-label={t("tasks.cancel")}>
                      <X size={16} />
                    </Button>
                  ) : null}
                  {["done", "cancelled"].includes(task.status) ? (
                    <Button variant="secondary" className="h-10 w-10 rounded-full px-0" onClick={() => reopenMutation.mutate(task.id)} aria-label={t("tasks.reopen")}>
                      <RotateCcw size={16} />
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          );
        })}
        {!visibleTasks.length ? (
          <EmptyState
            title={t("tasks.emptyTitle")}
            description={t("tasks.emptyText")}
            action={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />{t("tasks.create")}</Button>}
          />
        ) : null}
      </div>

      <Modal title={t("tasks.create")} open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate({
              business: business.id,
              title: form.title,
              description: form.description,
              client: form.client ? Number(form.client) : null,
              lead: form.lead ? Number(form.lead) : null,
              deal: form.deal ? Number(form.deal) : null,
              appointment: form.appointment ? Number(form.appointment) : null,
              priority: form.priority as Task["priority"],
              due_at: form.due_at || null,
            });
          }}
        >
          <Input placeholder={t("tasks.titlePlaceholder")} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Input placeholder={t("tasks.descriptionPlaceholder")} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
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
          <Input type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
          {createMutation.error ? <ErrorState message={getApiErrorMessage(createMutation.error)} /> : null}
          <Button type="submit" isLoading={createMutation.isPending}>{t("clients.save")}</Button>
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
