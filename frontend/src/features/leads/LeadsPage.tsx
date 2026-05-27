import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarPlus,
  ClipboardList,
  CheckCheck,
  CircleDollarSign,
  CircleDot,
  MessageCircle,
  Phone,
  Plus,
  Search,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { leadsApi } from "../../api/leads";
import { tasksApi } from "../../api/tasks";
import { teamApi } from "../../api/team";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { LeadForm } from "../../components/forms/LeadForm";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Appointment, Client, Id, Lead, Service, Task } from "../../types";
import { useAuth } from "../auth/AuthProvider";

type LeadFilter = "all" | "new" | "unassigned" | "mine" | "active" | "closed";
type LeadAction = "take" | "contacted" | "deal" | "closed" | "lost" | "reopen" | "assign";

const statusLabels: Record<Lead["status"], string> = {
  new: "Новая",
  contacted: "Связались",
  in_progress: "В работе",
  appointment_created: "Запись",
  closed: "Закрыта",
  lost: "Отказ",
};

const statusClass: Record<Lead["status"], string> = {
  new: "bg-amber-50 text-amber-700 ring-amber-200",
  contacted: "bg-blue-50 text-blue-700 ring-blue-200",
  in_progress: "bg-violet-50 text-violet-700 ring-violet-200",
  appointment_created: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-900 text-white ring-slate-900",
  lost: "bg-red-50 text-red-700 ring-red-200",
};

const sourceLabels: Record<string, string> = {
  website: "Сайт",
  landing: "Лендинг",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  manual: "Вручную",
  parser: "Парсер",
  other: "Другое",
};

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1", className)}>{children}</span>;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "L";
}

function getClient(lead: Lead, clients: Client[]) {
  return clients.find((client) => client.id === lead.client);
}

function getService(lead: Lead, services: Service[]) {
  return services.find((service) => service.id === lead.service);
}

function leadTitle(lead: Lead | null | undefined, clients: Client[]) {
  if (!lead) return "Выберите заявку";
  return getClient(lead, clients)?.full_name || `Заявка #${lead.id}`;
}

function nextAction(lead: Lead) {
  if (lead.status === "new") return "Связаться с клиентом";
  if (lead.status === "contacted") return "Квалифицировать потребность";
  if (lead.status === "in_progress") return "Создать сделку или запись";
  if (lead.status === "appointment_created") return "Проконтролировать визит";
  if (lead.status === "closed") return "Проверить результат";
  return "Понять причину отказа";
}

function toDateTimeLocal(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function LeadQueueItem({
  lead,
  client,
  service,
  selected,
  onClick,
}: {
  lead: Lead;
  client?: Client;
  service?: Service;
  selected: boolean;
  onClick: () => void;
}) {
  const title = client?.full_name || `Заявка #${lead.id}`;
  return (
    <button
      type="button"
      className={cn(
        "w-full border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50",
        selected ? "bg-brand-50/80" : "bg-white",
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black text-brand-700 ring-1 ring-slate-200">
          {initials(title)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-black text-midnight">{title}</p>
            <span className="shrink-0 text-xs font-bold text-slate-400">{formatDateTime(lead.created_at)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-500">
            {client?.phone || "без телефона"} · {service?.name || sourceLabels[lead.source] || lead.source}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill className={statusClass[lead.status]}>{statusLabels[lead.status]}</Pill>
            <span className="text-xs font-bold text-slate-400">{nextAction(lead)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function LeadsPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const { clients, services, resources, leads, tasks, deals, appointments, botConversations } = useEntityData({
    clients: true,
    services: true,
    resources: true,
    leads: true,
    tasks: true,
    deals: true,
    appointments: true,
    botConversations: true,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(searchParams.get("lead")) || null);
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "1");
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [nextActionDraft, setNextActionDraft] = useState({
    title: "Связаться с клиентом",
    due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    assignee: "",
    priority: "normal" as Task["priority"],
  });

  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
    retry: false,
  });

  const allLeads = leads.data || [];
  const clientList = clients.data || [];
  const serviceList = services.data || [];
  const taskList = tasks.data || [];
  const dealList = deals.data || [];
  const appointmentList = appointments.data || [];
  const conversationList = botConversations.data || [];
  const teamList = Array.isArray(teamMembers.data) ? teamMembers.data : [];

  const rows = useMemo(() => {
    const value = search.trim().toLowerCase();
    return allLeads.filter((lead) => {
      const client = getClient(lead, clientList);
      const service = getService(lead, serviceList);
      const matchesSearch = !value || [client?.full_name, client?.phone, client?.email, lead.message, service?.name]
        .join(" ")
        .toLowerCase()
        .includes(value);
      const matchesSource = !source || lead.source === source;
      const matchesFilter =
        filter === "all" ||
        (filter === "new" && lead.status === "new") ||
        (filter === "unassigned" && !lead.responsible_user) ||
        (filter === "mine" && Boolean(user?.id && lead.responsible_user === user.id)) ||
        (filter === "active" && ["contacted", "in_progress", "appointment_created"].includes(lead.status)) ||
        (filter === "closed" && ["closed", "lost"].includes(lead.status));
      return matchesSearch && matchesSource && matchesFilter;
    });
  }, [allLeads, clientList, filter, search, serviceList, source, user?.id]);

  const selected = useMemo(() => rows.find((lead) => lead.id === selectedId) || rows[0] || null, [rows, selectedId]);
  const selectedClient = selected ? getClient(selected, clientList) : undefined;
  const selectedService = selected ? getService(selected, serviceList) : undefined;
  const selectedResponsible = selected ? teamList.find((member) => member.user.id === selected.responsible_user) : undefined;
  const selectedTasks = selected
    ? taskList
        .filter((task) => task.lead === selected.id && !["done", "cancelled"].includes(task.status))
        .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")))
    : [];
  const selectedNextTask = selectedTasks[0];
  const selectedDeals = selected ? dealList.filter((deal) => deal.lead === selected.id || deal.client === selected.client) : [];
  const selectedAppointments = selected ? appointmentList.filter((appointment) => appointment.lead === selected.id || appointment.client === selected.client) : [];
  const selectedConversations = selected ? conversationList.filter((conversation) => conversation.lead === selected.id || conversation.client === selected.client) : [];

  const leadMutation = useMutation({
    mutationFn: (payload: Partial<Lead>) => leadsApi.create(payload),
    onSuccess: async (lead) => {
      setCreateOpen(false);
      setNotice("Заявка создана.");
      setSelectedId(lead.id);
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, lead, user_id, lost_reason }: { action: LeadAction; lead: Lead; user_id?: Id; lost_reason?: string }) => {
      if (action === "take") return leadsApi.takeInWork({ id: lead.id });
      if (action === "contacted") return leadsApi.markContacted({ id: lead.id });
      if (action === "deal") return leadsApi.createDeal({ id: lead.id });
      if (action === "closed") return leadsApi.markClosed({ id: lead.id });
      if (action === "reopen") return leadsApi.reopen({ id: lead.id });
      if (action === "assign") return leadsApi.assign({ id: lead.id, user_id });
      if (!lost_reason) throw new Error("Нужна причина отказа.");
      return leadsApi.markLost({ id: lead.id, lost_reason });
    },
    onSuccess: async (_, variables) => {
      const labels = {
        take: "Заявка взята в работу.",
        contacted: "Статус обновлен: связались.",
        deal: "Сделка создана.",
        closed: "Заявка закрыта успешно.",
        lost: "Заявка закрыта как отказ.",
        reopen: "Заявка возвращена в работу.",
        assign: "Заявка назначена на вас.",
      };
      setNotice(labels[variables.action]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
      ]);
    },
  });

  const nextActionMutation = useMutation({
    mutationFn: (lead: Lead) =>
      tasksApi.create({
        business: business!.id,
        title: nextActionDraft.title,
        description: "",
        client: lead.client,
        lead: lead.id,
        deal: null,
        appointment: null,
        parent_task: null,
        assignee: nextActionDraft.assignee ? Number(nextActionDraft.assignee) : lead.responsible_user || null,
        created_by: null,
        watchers: [],
        due_at: new Date(nextActionDraft.due_at).toISOString(),
        reminder_at: null,
        snoozed_until: null,
        priority: nextActionDraft.priority,
        status: "open",
        recurrence_rule: "",
      }),
    onSuccess: async () => {
      setNextActionOpen(false);
      setNotice("Следующее действие создано.");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const appointmentMutation = useMutation({
    mutationFn: (payload: Partial<Appointment>) => {
      if (!selected?.id || !payload.service || !payload.start_at) throw new Error("Выберите услугу и время записи.");
      return leadsApi.createAppointment({
        leadId: selected.id,
        payload: { service: payload.service, resource: payload.resource || null, start_at: payload.start_at },
      });
    },
    onSuccess: async () => {
      setAppointmentOpen(false);
      setNotice("Запись создана из заявки.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      ]);
    },
  });

  function openLead(lead: Lead) {
    setSelectedId(lead.id);
    const next = new URLSearchParams(searchParams);
    next.set("lead", String(lead.id));
    next.delete("create");
    setSearchParams(next, { replace: true });
  }

  function closeCreateModal() {
    setCreateOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }

  if (!business) return <ErrorState message="Сначала выберите бизнес." />;
  if (leads.isLoading || clients.isLoading || services.isLoading || tasks.isLoading) return <LoadingState label="Загружаю заявки" />;

  const actionError = leadMutation.error || actionMutation.error || appointmentMutation.error || nextActionMutation.error || clients.error || services.error || leads.error;
  const filters = [
    { value: "all" as const, label: "Все", count: allLeads.length },
    { value: "new" as const, label: "Новые", count: allLeads.filter((lead) => lead.status === "new").length },
    { value: "unassigned" as const, label: "Без менеджера", count: allLeads.filter((lead) => !lead.responsible_user).length },
    { value: "mine" as const, label: "Мои", count: allLeads.filter((lead) => user?.id && lead.responsible_user === user.id).length },
    { value: "active" as const, label: "В работе", count: allLeads.filter((lead) => ["contacted", "in_progress", "appointment_created"].includes(lead.status)).length },
    { value: "closed" as const, label: "Закрытые", count: allLeads.filter((lead) => ["closed", "lost"].includes(lead.status)).length },
  ];

  return (
    <div className="space-y-3">
      {notice ? <div className="rounded-2xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-bold text-ai-800">{notice}</div> : null}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      <section className="grid min-h-[720px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-soft lg:h-[calc(100vh-132px)] lg:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-midnight">Заявки</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">{rows.length} в текущей очереди</p>
              </div>
              <Button className="h-11 rounded-xl px-4" variant="ai" onClick={() => setCreateOpen(true)}>
                <Plus size={17} /> Новая
              </Button>
            </div>

            <label className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-500">
              <Search size={18} />
              <input
                className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-slate-400"
                placeholder="Поиск по имени, телефону или запросу"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "shrink-0 rounded-xl px-3 py-2 text-sm font-black transition",
                    filter === item.value ? "bg-midnight text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                  )}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label} <span className="opacity-70">{item.count}</span>
                </button>
              ))}
            </div>

            <Select
              className="rounded-xl"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              options={[
                { value: "", label: "Все источники" },
                ...Object.entries(sourceLabels).map(([value, label]) => ({ value, label })),
              ]}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!rows.length ? (
              <div className="p-5">
                <EmptyState title="Заявок нет" description="Новые заявки из форм, inbox и ручного ввода появятся в этой очереди." />
              </div>
            ) : null}
            {rows.map((lead) => (
              <LeadQueueItem
                key={lead.id}
                lead={lead}
                client={getClient(lead, clientList)}
                service={getService(lead, serviceList)}
                selected={lead.id === selected?.id}
                onClick={() => openLead(lead)}
              />
            ))}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col bg-slate-50/40">
          {!selected ? (
            <div className="grid flex-1 place-items-center p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
                  <CircleDot size={26} />
                </div>
                <p className="text-2xl font-black text-slate-400">Выберите заявку</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black text-midnight">{leadTitle(selected, clientList)}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill className={statusClass[selected.status]}>{statusLabels[selected.status]}</Pill>
                      <Pill className="bg-white text-slate-500 ring-slate-200">{sourceLabels[selected.source] || selected.source}</Pill>
                      {selectedService ? <Pill className="bg-white text-slate-500 ring-slate-200">{selectedService.name}</Pill> : null}
                      <Pill className={selected.responsible_user ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-amber-50 text-amber-700 ring-amber-200"}>
                        {selectedResponsible?.user.full_name || selectedResponsible?.user.email || "без менеджера"}
                      </Pill>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={!selectedClient?.phone} onClick={() => selectedClient?.phone && (window.location.href = `tel:${selectedClient.phone}`)}>
                      <Phone size={17} /> Позвонить
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!selectedClient?.phone}
                      onClick={() => {
                        const phone = selectedClient?.phone?.replace(/\D/g, "");
                        if (phone) window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <MessageCircle size={17} /> WhatsApp
                    </Button>
                    <Button variant="ai" onClick={() => actionMutation.mutate({ action: "assign", lead: selected })} isLoading={actionMutation.isPending}>
                      <UserCheck size={17} /> Взять
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Запрос клиента</p>
                      <p className="mt-3 min-h-24 text-base leading-7 text-slate-700">{selected.message || "Комментарий по заявке не указан."}</p>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Следующее действие</p>
                      {selectedNextTask ? (
                        <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                          <p className="text-xl font-black text-midnight">{selectedNextTask.title}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(selectedNextTask.due_at)} · {selectedNextTask.priority}</p>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl bg-amber-50 p-4">
                          <p className="text-xl font-black text-amber-900">{nextAction(selected)}</p>
                          <p className="mt-1 text-sm font-semibold text-amber-700">Реальная задача еще не создана.</p>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setNextActionDraft({
                              title: nextAction(selected),
                              due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
                              assignee: selected.responsible_user ? String(selected.responsible_user) : "",
                              priority: "normal",
                            });
                            setNextActionOpen(true);
                          }}
                        >
                          <ClipboardList size={17} /> Задача
                        </Button>
                        {selected.status === "new" ? (
                          <Button variant="secondary" onClick={() => actionMutation.mutate({ action: "contacted", lead: selected })} isLoading={actionMutation.isPending}>
                            <CheckCheck size={17} /> Связались
                          </Button>
                        ) : null}
                        {["new", "contacted", "lost"].includes(selected.status) ? (
                          <Button variant="secondary" onClick={() => actionMutation.mutate({ action: "take", lead: selected })} isLoading={actionMutation.isPending}>
                            <UserCheck size={17} /> В работу
                          </Button>
                        ) : null}
                        {!["closed", "lost"].includes(selected.status) ? (
                          <>
                            <Button variant="ai" onClick={() => actionMutation.mutate({ action: "deal", lead: selected })} isLoading={actionMutation.isPending}>
                              <CircleDollarSign size={17} /> Сделка
                            </Button>
                            <Button variant="secondary" onClick={() => setAppointmentOpen(true)}>
                              <CalendarPlus size={17} /> Запись
                            </Button>
                            <Button variant="secondary" onClick={() => actionMutation.mutate({ action: "closed", lead: selected })} isLoading={actionMutation.isPending}>
                              <CheckCheck size={17} /> Успешно
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setLostLead(selected);
                                setLostReason(selected.lost_reason || "");
                              }}
                              isLoading={actionMutation.isPending}
                            >
                              <XCircle size={17} /> Отказ
                            </Button>
                          </>
                        ) : (
                          <Button variant="secondary" onClick={() => actionMutation.mutate({ action: "reopen", lead: selected })} isLoading={actionMutation.isPending}>
                            <CircleDot size={17} /> Вернуть
                          </Button>
                        )}
                      </div>
                    </div>
                  </section>

                  <aside className="space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Клиент</p>
                      <p className="mt-3 text-lg font-black text-midnight">{selectedClient?.full_name || `client #${selected.client}`}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{selectedClient?.phone || "телефон не указан"}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{selectedClient?.email || "email не указан"}</p>
                      <Button className="mt-4 w-full justify-center" variant="secondary" onClick={() => setDrawerEntity({ type: "client", id: selected.client })}>
                        Открыть клиента
                      </Button>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Контроль</p>
                      <div className="mt-3 space-y-3 text-sm font-semibold text-slate-600">
                        <Select
                          label="Ответственный"
                          value={selected.responsible_user ? String(selected.responsible_user) : ""}
                          onChange={(event) => actionMutation.mutate({ action: "assign", lead: selected, user_id: event.target.value ? Number(event.target.value) : undefined })}
                          options={[
                            { value: "", label: "Назначить на себя" },
                            ...teamList.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                          ]}
                        />
                        <div className="flex items-center justify-between gap-3">
                          <span>Создана</span>
                          <span className="text-right text-slate-900">{formatDateTime(selected.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Обновлена</span>
                          <span className="text-right text-slate-900">{formatDateTime(selected.updated_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Источник</span>
                          <span className="text-right text-slate-900">{sourceLabels[selected.source] || selected.source}</span>
                        </div>
                        {selected.lost_reason ? (
                          <div className="rounded-2xl bg-red-50 p-3 text-red-700">
                            <AlertTriangle size={16} className="mb-2" />
                            {selected.lost_reason}
                          </div>
                        ) : null}
                      </div>
                      <Button className="mt-4 w-full justify-center" variant="secondary" onClick={() => setDrawerEntity({ type: "lead", id: selected.id })}>
                        Полная карточка
                      </Button>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Связанные данные</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-lg font-black text-midnight">{selectedDeals.length}</p>
                          <p className="text-xs font-bold text-slate-400">сделки</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-lg font-black text-midnight">{selectedAppointments.length}</p>
                          <p className="text-xs font-bold text-slate-400">записи</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-lg font-black text-midnight">{selectedConversations.length}</p>
                          <p className="text-xs font-bold text-slate-400">диалоги</p>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </>
          )}
        </main>
      </section>

      <Modal title="Новая заявка" open={createOpen} onClose={closeCreateModal}>
        <LeadForm
          businessId={business.id}
          clients={clientList}
          services={serviceList}
          teamMembers={teamList}
          onSubmit={(payload) => leadMutation.mutateAsync(payload)}
          onOpenClient={(id) => {
            setCreateOpen(false);
            setDrawerEntity({ type: "client", id });
          }}
        />
      </Modal>

      <Modal title="Запись из заявки" open={appointmentOpen} onClose={() => setAppointmentOpen(false)}>
        <AppointmentForm
          businessId={business.id}
          clients={clientList}
          services={serviceList}
          resources={resources.data || []}
          leads={allLeads}
          prefill={{
            client: selected?.client,
            service: selected?.service,
            lead: selected?.id,
            source: "manual",
          }}
          onSubmit={(payload) => appointmentMutation.mutateAsync({ ...payload, lead: selected?.id || payload.lead, client: selected?.client || payload.client, service: selected?.service || payload.service })}
        />
      </Modal>

      <Modal title="Следующее действие" open={nextActionOpen} onClose={() => setNextActionOpen(false)}>
        {selected ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              nextActionMutation.mutate(selected);
            }}
          >
            <Input label="Задача" value={nextActionDraft.title} onChange={(event) => setNextActionDraft({ ...nextActionDraft, title: event.target.value })} required />
            <Input label="Дедлайн" type="datetime-local" value={nextActionDraft.due_at} onChange={(event) => setNextActionDraft({ ...nextActionDraft, due_at: event.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Ответственный"
                value={nextActionDraft.assignee}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, assignee: event.target.value })}
                options={[
                  { value: "", label: "Ответственный заявки" },
                  ...teamList.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                ]}
              />
              <Select
                label="Приоритет"
                value={nextActionDraft.priority}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, priority: event.target.value as Task["priority"] })}
                options={[
                  { value: "low", label: "Низкий" },
                  { value: "normal", label: "Обычный" },
                  { value: "high", label: "Высокий" },
                  { value: "urgent", label: "Срочно" },
                ]}
              />
            </div>
            <Button type="submit" isLoading={nextActionMutation.isPending}>Создать задачу</Button>
          </form>
        ) : null}
      </Modal>

      <Modal title="Закрыть заявку как отказ" open={Boolean(lostLead)} onClose={() => setLostLead(null)}>
        {lostLead ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              actionMutation.mutate({ action: "lost", lead: lostLead, lost_reason: lostReason });
              setLostLead(null);
              setLostReason("");
            }}
          >
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="font-black text-midnight">{leadTitle(lostLead, clientList)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{lostLead.message || "Без комментария"}</p>
            </div>
            <Select
              label="Тип причины"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              options={[
                { value: "", label: "Выберите причину" },
                { value: "Не отвечает", label: "Не отвечает" },
                { value: "Дорого", label: "Дорого" },
                { value: "Выбрал конкурента", label: "Выбрал конкурента" },
                { value: "Нет бюджета", label: "Нет бюджета" },
                { value: "Дубль", label: "Дубль" },
                { value: "Неактуально", label: "Неактуально" },
              ]}
            />
            <Input label="Комментарий" value={lostReason} onChange={(event) => setLostReason(event.target.value)} required />
            <Button type="submit" variant="danger" isLoading={actionMutation.isPending} disabled={!lostReason}>Закрыть как отказ</Button>
          </form>
        ) : null}
      </Modal>

      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </div>
  );
}
