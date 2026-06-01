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
import { WorkQueueDetailPane, WorkQueueLayout, WorkQueueListPane } from "../../components/layout/WorkQueueLayout";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { LeadForm } from "../../components/forms/LeadForm";
import { Button } from "../../components/ui/Button";
import { FilterBar } from "../../components/ui/FilterBar";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Client, Id, Lead, Service, Task } from "../../types";
import { useAuth } from "../auth/AuthProvider";

type LeadFilter = "all" | "new" | "unassigned" | "mine" | "active" | "closed";
type LeadAction = "take" | "contacted" | "deal" | "closed" | "lost" | "reopen" | "assign";

const statusLabels: Record<Lead["status"], string> = {
  new: "leads.statusNew",
  contacted: "leads.statusContacted",
  in_progress: "leads.statusInProgress",
  appointment_created: "leads.statusAppointmentCreated",
  closed: "leads.statusClosed",
  lost: "leads.statusLost",
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
  website: "leads.sourceWebsite",
  landing: "leads.sourceLanding",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  manual: "leads.sourceManual",
  parser: "leads.sourceParser",
  other: "leads.sourceOther",
};

type Translate = ReturnType<typeof useI18n>["t"];

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

function getStatusLabel(status: Lead["status"], t: Translate) {
  return t(statusLabels[status]);
}

function getSourceLabel(source: string, t: Translate) {
  const label = sourceLabels[source];
  return label ? t(label) : source;
}

function leadTitle(lead: Lead | null | undefined, clients: Client[], t: Translate) {
  if (!lead) return t("leads.selectLead");
  return getClient(lead, clients)?.full_name || t("leads.leadFallback", { id: lead.id });
}

function nextAction(lead: Lead, t: Translate) {
  if (lead.status === "new") return t("leads.nextActionContactClient");
  if (lead.status === "contacted") return t("leads.nextActionQualifyNeed");
  if (lead.status === "in_progress") return t("leads.nextActionCreateDealOrBooking");
  if (lead.status === "appointment_created") return t("leads.nextActionControlVisit");
  if (lead.status === "closed") return t("leads.nextActionReviewResult");
  return t("leads.nextActionUnderstandLoss");
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
  t,
}: {
  lead: Lead;
  client?: Client;
  service?: Service;
  selected: boolean;
  onClick: () => void;
  t: Translate;
}) {
  const title = client?.full_name || t("leads.leadFallback", { id: lead.id });
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
            {client?.phone || t("leads.noPhoneLower")} · {service?.name || getSourceLabel(lead.source, t)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill className={statusClass[lead.status]}>{getStatusLabel(lead.status, t)}</Pill>
            <span className="text-xs font-bold text-slate-400">{nextAction(lead, t)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function LeadsPage() {
  const { t } = useI18n();
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
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
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
    title: t("leads.nextActionContactClient"),
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
      setNotice(t("leads.noticeCreated"));
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
      if (!lost_reason) throw new Error(t("leads.lostReasonRequired"));
      return leadsApi.markLost({ id: lead.id, lost_reason });
    },
    onSuccess: async (_, variables) => {
      const labels = {
        take: t("leads.noticeTaken"),
        contacted: t("leads.noticeContacted"),
        deal: t("leads.noticeDealCreated"),
        closed: t("leads.noticeClosed"),
        lost: t("leads.noticeLost"),
        reopen: t("leads.noticeReopened"),
        assign: t("leads.noticeAssigned"),
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
      setNotice(t("leads.noticeNextActionCreated"));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const appointmentMutation = useMutation({
    mutationFn: (payload: Partial<Appointment>) => {
      if (!selected?.id || !payload.service || !payload.start_at) throw new Error(t("leads.appointmentSelectionRequired"));
      return leadsApi.createAppointment({
        leadId: selected.id,
        payload: { service: payload.service, resource: payload.resource || null, start_at: payload.start_at },
      });
    },
    onSuccess: async () => {
      setAppointmentOpen(false);
      setNotice(t("leads.appointmentCreated"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      ]);
    },
  });

  function openLead(lead: Lead) {
    setSelectedId(lead.id);
    setMobileDetailOpen(true);
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

  if (!business) return <ErrorState message={t("leads.noBusiness")} />;
  if (leads.isLoading || clients.isLoading || services.isLoading || tasks.isLoading) return <LoadingState label={t("leads.loading")} />;

  const actionError = leadMutation.error || actionMutation.error || appointmentMutation.error || nextActionMutation.error || clients.error || services.error || leads.error;
  const filters = [
    { value: "all" as const, label: t("leads.filterAll"), count: allLeads.length },
    { value: "new" as const, label: t("leads.filterNew"), count: allLeads.filter((lead) => lead.status === "new").length },
    { value: "unassigned" as const, label: t("leads.filterUnassigned"), count: allLeads.filter((lead) => !lead.responsible_user).length },
    { value: "mine" as const, label: t("leads.filterMine"), count: allLeads.filter((lead) => user?.id && lead.responsible_user === user.id).length },
    { value: "active" as const, label: t("leads.filterActive"), count: allLeads.filter((lead) => ["contacted", "in_progress", "appointment_created"].includes(lead.status)).length },
    { value: "closed" as const, label: t("leads.filterClosed"), count: allLeads.filter((lead) => ["closed", "lost"].includes(lead.status)).length },
  ];

  return (
    <div className="space-y-3">
      {notice ? <div className="rounded-2xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-bold text-ai-800">{notice}</div> : null}
      {actionError ? <ErrorState message={getApiErrorMessage(actionError)} /> : null}

      <WorkQueueLayout className="lg:grid-cols-[430px_minmax(0,1fr)]">
        <WorkQueueListPane mobileDetailOpen={mobileDetailOpen}>
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-midnight">{t("leads.queueTitle")}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">{t("leads.currentQueueCount", { count: rows.length })}</p>
              </div>
              <Button className="h-11 rounded-xl px-4" onClick={() => setCreateOpen(true)}>
                <Plus size={17} /> {t("leads.newShort")}
              </Button>
            </div>

            <label className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-500">
              <Search size={18} />
              <input
                className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:text-slate-400"
                placeholder={t("leads.queueSearch")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <FilterBar options={filters} value={filter} onChange={setFilter} ariaLabel={t("leads.filtersLabel")} />

            <Select
              className="rounded-xl"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              options={[
                { value: "", label: t("leads.allSources") },
                ...Object.keys(sourceLabels).map((value) => ({ value, label: getSourceLabel(value, t) })),
              ]}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-28 lg:pb-0">
            {!rows.length ? (
              <div className="p-5">
                <EmptyState title={t("leads.emptyTitle")} description={t("leads.emptyText")} />
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
                t={t}
              />
            ))}
          </div>
        </WorkQueueListPane>

        <WorkQueueDetailPane mobileDetailOpen={mobileDetailOpen} closeLabel={t("common.close")} onMobileClose={() => setMobileDetailOpen(false)}>
          {!selected ? (
            <div className="grid flex-1 place-items-center p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
                  <CircleDot aria-hidden="true" size={26} />
                </div>
                <p className="text-2xl font-black text-slate-400">{t("leads.selectLead")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black text-midnight">{leadTitle(selected, clientList, t)}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill className={statusClass[selected.status]}>{getStatusLabel(selected.status, t)}</Pill>
                      <Pill className="bg-white text-slate-500 ring-slate-200">{getSourceLabel(selected.source, t)}</Pill>
                      {selectedService ? <Pill className="bg-white text-slate-500 ring-slate-200">{selectedService.name}</Pill> : null}
                      <Pill className={selected.responsible_user ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-amber-50 text-amber-700 ring-amber-200"}>
                        {selectedResponsible?.user.full_name || selectedResponsible?.user.email || t("leads.withoutManager")}
                      </Pill>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={!selectedClient?.phone} onClick={() => selectedClient?.phone && (window.location.href = `tel:${selectedClient.phone}`)}>
                      <Phone size={17} /> {t("leads.call")}
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
                    <Button onClick={() => actionMutation.mutate({ action: "assign", lead: selected })} isLoading={actionMutation.isPending}>
                      <UserCheck size={17} /> {t("leads.take")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-28 lg:pb-5">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("leads.clientRequest")}</p>
                      <p className="mt-3 min-h-24 text-base leading-7 text-slate-700">{selected.message || t("leads.noLeadComment")}</p>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("leads.nextStep")}</p>
                      {selectedNextTask ? (
                        <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                          <p className="text-xl font-black text-midnight">{selectedNextTask.title}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(selectedNextTask.due_at)} · {selectedNextTask.priority}</p>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl bg-amber-50 p-4">
                          <p className="text-xl font-black text-amber-900">{nextAction(selected, t)}</p>
                          <p className="mt-1 text-sm font-semibold text-amber-700">{t("leads.noRealTask")}</p>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setNextActionDraft({
                              title: nextAction(selected, t),
                              due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
                              assignee: selected.responsible_user ? String(selected.responsible_user) : "",
                              priority: "normal",
                            });
                            setNextActionOpen(true);
                          }}
                        >
                          <ClipboardList size={17} /> {t("leads.task")}
                        </Button>
                        {selected.status === "new" ? (
                          <Button variant="secondary" onClick={() => actionMutation.mutate({ action: "contacted", lead: selected })} isLoading={actionMutation.isPending}>
                            <CheckCheck size={17} /> {t("leads.contacted")}
                          </Button>
                        ) : null}
                        {["new", "contacted", "lost"].includes(selected.status) ? (
                          <Button variant="secondary" onClick={() => actionMutation.mutate({ action: "take", lead: selected })} isLoading={actionMutation.isPending}>
                            <UserCheck size={17} /> {t("leads.takeWork")}
                          </Button>
                        ) : null}
                        {!["closed", "lost"].includes(selected.status) ? (
                          <>
                            <Button onClick={() => actionMutation.mutate({ action: "deal", lead: selected })} isLoading={actionMutation.isPending}>
                              <CircleDollarSign size={17} /> {t("leads.deal")}
                            </Button>
                            <Button variant="secondary" onClick={() => setAppointmentOpen(true)}>
                              <CalendarPlus size={17} /> {t("leads.book")}
                            </Button>
                            <Button variant="secondary" onClick={() => actionMutation.mutate({ action: "closed", lead: selected })} isLoading={actionMutation.isPending}>
                              <CheckCheck size={17} /> {t("leads.success")}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setLostLead(selected);
                                setLostReason(selected.lost_reason || "");
                              }}
                              isLoading={actionMutation.isPending}
                            >
                              <XCircle size={17} /> {t("leads.lost")}
                            </Button>
                          </>
                        ) : (
                          <Button variant="secondary" onClick={() => actionMutation.mutate({ action: "reopen", lead: selected })} isLoading={actionMutation.isPending}>
                            <CircleDot size={17} /> {t("leads.reopen")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </section>

                  <aside className="space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("leads.client")}</p>
                      <p className="mt-3 text-lg font-black text-midnight">{selectedClient?.full_name || t("leads.clientFallbackWithId", { id: selected.client })}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{selectedClient?.phone || t("leads.phoneMissing")}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{selectedClient?.email || t("leads.emailMissing")}</p>
                      <Button className="mt-4 w-full justify-center" variant="secondary" onClick={() => setDrawerEntity({ type: "client", id: selected.client })}>
                        {t("leads.openClient")}
                      </Button>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("leads.control")}</p>
                      <div className="mt-3 space-y-3 text-sm font-semibold text-slate-600">
                        <Select
                          label={t("leads.responsible")}
                          value={selected.responsible_user ? String(selected.responsible_user) : ""}
                          onChange={(event) => actionMutation.mutate({ action: "assign", lead: selected, user_id: event.target.value ? Number(event.target.value) : undefined })}
                          options={[
                            { value: "", label: t("leads.assignToMe") },
                            ...teamList.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                          ]}
                        />
                        <div className="flex items-center justify-between gap-3">
                          <span>{t("leads.createdAt")}</span>
                          <span className="text-right text-slate-900">{formatDateTime(selected.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t("leads.updatedAt")}</span>
                          <span className="text-right text-slate-900">{formatDateTime(selected.updated_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{t("leads.source")}</span>
                          <span className="text-right text-slate-900">{getSourceLabel(selected.source, t)}</span>
                        </div>
                        {selected.lost_reason ? (
                          <div className="rounded-2xl bg-red-50 p-3 text-red-700">
                            <AlertTriangle aria-hidden="true" size={16} className="mb-2" />
                            {selected.lost_reason}
                          </div>
                        ) : null}
                      </div>
                      <Button className="mt-4 w-full justify-center" variant="secondary" onClick={() => setDrawerEntity({ type: "lead", id: selected.id })}>
                        {t("leads.fullCard")}
                      </Button>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("leads.relatedData")}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-lg font-black text-midnight">{selectedDeals.length}</p>
                          <p className="text-xs font-bold text-slate-400">{t("leads.relatedDeals")}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-lg font-black text-midnight">{selectedAppointments.length}</p>
                          <p className="text-xs font-bold text-slate-400">{t("leads.relatedBookings")}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-lg font-black text-midnight">{selectedConversations.length}</p>
                          <p className="text-xs font-bold text-slate-400">{t("leads.relatedConversations")}</p>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </>
          )}
        </WorkQueueDetailPane>
      </WorkQueueLayout>

      <Modal title={t("leads.new")} open={createOpen} onClose={closeCreateModal}>
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

      <Modal title={t("leads.bookFromLead")} open={appointmentOpen} onClose={() => setAppointmentOpen(false)}>
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

      <Modal title={t("leads.nextActionModal")} open={nextActionOpen} onClose={() => setNextActionOpen(false)}>
        {selected ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              nextActionMutation.mutate(selected);
            }}
          >
            <Input label={t("leads.task")} value={nextActionDraft.title} onChange={(event) => setNextActionDraft({ ...nextActionDraft, title: event.target.value })} required />
            <Input label={t("leads.deadline")} type="datetime-local" value={nextActionDraft.due_at} onChange={(event) => setNextActionDraft({ ...nextActionDraft, due_at: event.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t("leads.responsible")}
                value={nextActionDraft.assignee}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, assignee: event.target.value })}
                options={[
                  { value: "", label: t("leads.leadResponsible") },
                  ...teamList.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                ]}
              />
              <Select
                label={t("leads.priority")}
                value={nextActionDraft.priority}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, priority: event.target.value as Task["priority"] })}
                options={[
                  { value: "low", label: t("leads.priorityLow") },
                  { value: "normal", label: t("leads.priorityNormalLabel") },
                  { value: "high", label: t("leads.priorityHigh") },
                  { value: "urgent", label: t("leads.priorityUrgent") },
                ]}
              />
            </div>
            <Button type="submit" isLoading={nextActionMutation.isPending}>{t("leads.createTask")}</Button>
          </form>
        ) : null}
      </Modal>

      <Modal title={t("leads.closeAsLost")} open={Boolean(lostLead)} onClose={() => setLostLead(null)}>
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
              <p className="font-black text-midnight">{leadTitle(lostLead, clientList, t)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{lostLead.message || t("leads.noComment")}</p>
            </div>
            <Select
              label={t("leads.reasonType")}
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              options={[
                { value: "", label: t("leads.selectReason") },
                { value: t("leads.reasonNoAnswer"), label: t("leads.reasonNoAnswer") },
                { value: t("leads.reasonExpensive"), label: t("leads.reasonExpensive") },
                { value: t("leads.reasonCompetitor"), label: t("leads.reasonCompetitor") },
                { value: t("leads.reasonNoBudget"), label: t("leads.reasonNoBudget") },
                { value: t("leads.reasonDuplicate"), label: t("leads.reasonDuplicate") },
                { value: t("leads.reasonIrrelevant"), label: t("leads.reasonIrrelevant") },
              ]}
            />
            <Input label={t("leads.comment")} value={lostReason} onChange={(event) => setLostReason(event.target.value)} required />
            <Button type="submit" variant="danger" isLoading={actionMutation.isPending} disabled={!lostReason}>{t("leads.closeAsLost")}</Button>
          </form>
        ) : null}
      </Modal>

      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </div>
  );
}
