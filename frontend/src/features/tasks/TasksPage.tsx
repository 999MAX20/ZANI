import { Check, Clock, Play, Plus, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tasksApi } from "../../api/tasks";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Task } from "../../types";

const emptyForm = {
  title: "",
  description: "",
  client: "",
  lead: "",
  appointment: "",
  priority: "normal",
  due_at: "",
};

export function TasksPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { appointments, clients, leads, services, tasks } = useEntityData();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [form, setForm] = useState(emptyForm);

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

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы работать с задачами." />;
  if (tasks.isLoading || clients.isLoading || leads.isLoading || appointments.isLoading || services.isLoading) return <LoadingState />;

  const taskList = tasks.data || [];
  const activeTasks = taskList.filter((task) => !["done", "cancelled"].includes(task.status));
  const visibleTasks = taskList.filter((task) => {
    if (statusFilter === "active") return !["done", "cancelled"].includes(task.status);
    if (statusFilter === "all") return true;
    return task.status === statusFilter;
  });
  const overdueTasks = activeTasks.filter((task) => task.due_at && new Date(task.due_at) < new Date()).length;
  const highPriorityTasks = activeTasks.filter((task) => ["high", "urgent"].includes(task.priority)).length;

  return (
    <>
      <PageHeader title="Задачи" description="Follow-up по клиентам, заявкам и записям без потери контекста." actions={<Button onClick={() => setOpen(true)}><Plus size={18} />Быстрая задача</Button>} />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Check size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Активные</p>
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
              <p className="text-sm font-medium text-slate-500">Просрочены</p>
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
              <p className="text-sm font-medium text-slate-500">Высокий приоритет</p>
              <p className="text-2xl font-semibold text-midnight">{highPriorityTasks}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { value: "active", label: "Активные" },
            { value: "open", label: "Открытые" },
            { value: "in_progress", label: "В работе" },
            { value: "done", label: "Готовые" },
            { value: "cancelled", label: "Отменённые" },
            { value: "all", label: "Все" },
          ]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleTasks.map((task) => {
          const client = clients.data?.find((item) => item.id === task.client);
          const lead = leads.data?.find((item) => item.id === task.lead);
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
                    <span className="rounded-full bg-slate-100 px-3 py-1">{client?.full_name || "Без клиента"}</span>
                    {lead ? <span className="rounded-full bg-slate-100 px-3 py-1">Заявка #{lead.id}</span> : null}
                    {appointment ? <span className="rounded-full bg-slate-100 px-3 py-1">{appointmentService?.name || "Запись"} · {formatDateTime(appointment.start_at)}</span> : null}
                    {task.due_at ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">до {formatDateTime(task.due_at)}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {task.status === "open" ? (
                    <Button variant="secondary" className="h-10 w-10 rounded-full px-0" onClick={() => startMutation.mutate(task.id)} aria-label="Взять в работу">
                      <Play size={16} />
                    </Button>
                  ) : null}
                  {!["done", "cancelled"].includes(task.status) ? (
                    <Button variant="secondary" className="h-10 w-10 rounded-full px-0" onClick={() => completeMutation.mutate(task.id)} aria-label="Завершить">
                      <Check size={16} />
                    </Button>
                  ) : null}
                  {!["done", "cancelled"].includes(task.status) ? (
                    <Button variant="ghost" className="h-10 w-10 rounded-full px-0" onClick={() => cancelMutation.mutate(task.id)} aria-label="Отменить">
                      <X size={16} />
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          );
        })}
        {!visibleTasks.length ? (
          <EmptyState
            title="Задач пока нет"
            description="Создайте follow-up задачу и привяжите её к клиенту, заявке или записи."
            action={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />Создать задачу</Button>}
          />
        ) : null}
      </div>

      <Modal title="Создать задачу" open={open} onClose={() => setOpen(false)}>
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
              appointment: form.appointment ? Number(form.appointment) : null,
              priority: form.priority as Task["priority"],
              due_at: form.due_at || null,
            });
          }}
        >
          <Input placeholder="Что нужно сделать" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Input placeholder="Описание или контекст" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <Select value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })} options={[{ value: "", label: "Без клиента" }, ...(clients.data || []).map((client) => ({ value: String(client.id), label: client.full_name }))]} />
          <Select
            value={form.lead}
            onChange={(event) => setForm({ ...form, lead: event.target.value })}
            options={[
              { value: "", label: "Без заявки" },
              ...(leads.data || []).map((lead) => {
                const client = clients.data?.find((item) => item.id === lead.client);
                return { value: String(lead.id), label: `${client?.full_name || `Заявка #${lead.id}`} · ${lead.status}` };
              }),
            ]}
          />
          <Select
            value={form.appointment}
            onChange={(event) => setForm({ ...form, appointment: event.target.value })}
            options={[
              { value: "", label: "Без записи" },
              ...(appointments.data || []).map((appointment) => {
                const client = clients.data?.find((item) => item.id === appointment.client);
                const service = services.data?.find((item) => item.id === appointment.service);
                return { value: String(appointment.id), label: `${client?.full_name || "Клиент"} · ${service?.name || "Услуга"} · ${formatDateTime(appointment.start_at)}` };
              }),
            ]}
          />
          <Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} options={[{ value: "normal", label: "Обычная" }, { value: "high", label: "Высокая" }, { value: "urgent", label: "Срочная" }, { value: "low", label: "Низкая" }]} />
          <Input type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
          <Button type="submit" isLoading={createMutation.isPending}>Сохранить</Button>
        </form>
      </Modal>
    </>
  );
}
