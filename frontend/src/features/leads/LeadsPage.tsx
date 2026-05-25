import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bot,
  CalendarPlus,
  CheckCircle2,
  Flame,
  GripVertical,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { leadsApi } from "../../api/leads";
import { teamApi } from "../../api/team";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { AppointmentForm } from "../../components/forms/AppointmentForm";
import { LeadForm } from "../../components/forms/LeadForm";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { Appointment, Lead } from "../../types";

const columns: { id: Lead["status"]; titleKey: string; hintKey: string }[] = [
  { id: "new", titleKey: "leads.columnNew", hintKey: "leads.columnNewHint" },
  { id: "contacted", titleKey: "leads.columnContacted", hintKey: "leads.columnContactedHint" },
  { id: "in_progress", titleKey: "leads.columnQualified", hintKey: "leads.columnQualifiedHint" },
  { id: "appointment_created", titleKey: "leads.columnBooked", hintKey: "leads.columnBookedHint" },
  { id: "closed", titleKey: "leads.columnWon", hintKey: "leads.columnWonHint" },
  { id: "lost", titleKey: "leads.columnLost", hintKey: "leads.columnLostHint" },
];

function LeadCommandHero({
  rows,
  onCreate,
  t,
}: {
  rows: Lead[];
  onCreate: () => void;
  t: (key: string) => string;
}) {
  const newCount = rows.filter((lead) => lead.status === "new").length;
  const activeCount = rows.filter((lead) => ["contacted", "in_progress"].includes(lead.status)).length;
  const bookedCount = rows.filter((lead) => lead.status === "appointment_created").length;
  const lostCount = rows.filter((lead) => lead.status === "lost").length;
  const metrics = [
    { label: t("leads.metricNew"), value: newCount, icon: Flame, className: "bg-amber-50 text-amber-700 ring-amber-100" },
    { label: t("leads.metricActive"), value: activeCount, icon: UserRoundCheck, className: "bg-brand-50 text-brand-700 ring-brand-100" },
    { label: t("leads.metricBooked"), value: bookedCount, icon: CalendarPlus, className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    { label: t("leads.metricLost"), value: lostCount, icon: CheckCircle2, className: "bg-slate-100 text-slate-700 ring-slate-200" },
  ];

  return (
    <section className="mb-5 overflow-hidden rounded-[2rem] border border-white/75 bg-white/82 p-4 shadow-premium backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-ai-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-ai-700 ring-1 ring-ai-100">
            <Sparkles size={14} />
            {t("leads.commandTitle")}
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-midnight sm:text-3xl">{t("leads.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t("leads.commandText")}</p>
        </div>
        <Button variant="ai" className="h-12 rounded-2xl px-5" onClick={onCreate}>
          <Plus size={18} />
          {t("leads.new")}
        </Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-3xl border border-slate-100 bg-white/85 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-3xl font-black text-midnight">{metric.value}</p>
                </div>
                <div className={`grid h-11 w-11 place-items-center rounded-2xl ring-1 ${metric.className}`}>
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LeadCard({
  lead,
  clientName,
  phone,
  serviceName,
  responsibleName,
  onOpen,
  onBook,
  onArchive,
  onAiReply,
  onTakeInWork,
  onMarkContacted,
  onCreateDeal,
  onCloseSuccess,
  onMarkLost,
  onReopen,
  isActionLoading,
  t,
}: {
  lead: Lead;
  clientName: string;
  phone?: string;
  serviceName?: string;
  responsibleName?: string;
  onOpen: () => void;
  onBook: () => void;
  onArchive: () => void;
  onAiReply: () => void;
  onTakeInWork: () => void;
  onMarkContacted: () => void;
  onCreateDeal: () => void;
  onCloseSuccess: () => void;
  onMarkLost: () => void;
  onReopen: () => void;
  isActionLoading?: boolean;
  t: (key: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(lead.id) });
  const [actionsOpen, setActionsOpen] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const isHot = ["new", "in_progress"].includes(lead.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-premium ${isDragging ? "opacity-60 ring-2 ring-brand-300" : ""}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              className="cursor-grab rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
              {...attributes}
              {...listeners}
              aria-label={t("leads.dragLead")}
            >
              <GripVertical size={14} />
            </button>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${isHot ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
              <Flame size={12} />
              {isHot ? t("leads.priorityHot") : t("leads.priorityNormal")}
            </span>
          </div>
          <p className="mt-3 truncate text-lg font-black text-midnight">{clientName}</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{phone || t("leads.noPhone")} · {serviceName || lead.source}</p>
          <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">{t("leads.responsible")}: {responsibleName || t("leads.unassigned")}</p>
        </div>
        <StatusBadge status={lead.status} />
      </div>
      <p className="line-clamp-3 min-h-[48px] text-sm leading-6 text-slate-600">{lead.message || t("leads.aiNote")}</p>
      <div className="mt-4 rounded-2xl border border-ai-100 bg-gradient-to-br from-ai-50 to-white p-3 text-xs leading-5 text-ai-700">
        <span className="font-black">ZANI:</span> {t("leads.aiCard")}
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
        <Button variant="ai" className="h-10 rounded-2xl px-3 text-xs" onClick={onOpen}>
          {t("leads.open")}
          <ArrowUpRight size={14} />
        </Button>
        <Button variant="secondary" className="h-10 w-10 rounded-2xl px-0" onClick={onBook} aria-label={t("leads.book")}>
          <CalendarPlus size={16} />
        </Button>
        {phone ? (
          <Button variant="secondary" className="h-10 w-10 rounded-2xl px-0" onClick={() => window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")} aria-label="WhatsApp">
            <MessageCircle size={15} />
          </Button>
        ) : null}
      </div>
      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-midnight"
        onClick={() => setActionsOpen((value) => !value)}
      >
        <MoreHorizontal size={15} />
        {t("leads.moreActions")}
      </button>
      {actionsOpen ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {lead.status === "new" ? <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" disabled={isActionLoading} onClick={onTakeInWork}>{t("leads.takeWork")}</Button> : null}
          {lead.status === "new" || lead.status === "in_progress" ? <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" disabled={isActionLoading} onClick={onMarkContacted}>{t("leads.contacted")}</Button> : null}
          {lead.status !== "closed" && lead.status !== "lost" ? <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" disabled={isActionLoading} onClick={onCreateDeal}>{t("leads.deal")}</Button> : null}
          {lead.status !== "closed" && lead.status !== "lost" ? <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" disabled={isActionLoading} onClick={onCloseSuccess}>{t("leads.close")}</Button> : null}
          {lead.status !== "lost" ? <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" disabled={isActionLoading} onClick={onMarkLost}>{t("leads.lost")}</Button> : null}
          {lead.status === "lost" ? <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" disabled={isActionLoading} onClick={onReopen}>{t("leads.reopen")}</Button> : null}
          <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" onClick={onArchive}>{t("leads.archive")}</Button>
          <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" onClick={onAiReply}><Bot size={15} />{t("leads.aiReply")}</Button>
        </div>
      ) : null}
      <p className="mt-3 text-[11px] font-medium text-slate-400">{formatDateTime(lead.created_at)}</p>
    </div>
  );
}

function KanbanColumn({
  id,
  title,
  hint,
  children,
}: {
  id: Lead["status"];
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={`min-h-[420px] min-w-[84vw] snap-start rounded-3xl border border-white/70 bg-white/45 p-3 shadow-soft backdrop-blur-xl transition sm:min-w-[340px] lg:min-w-0 ${isOver ? "ring-2 ring-brand-300" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="font-semibold text-midnight">{title}</h2>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function LeadsPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { clients, services, resources, leads } = useEntityData();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
    retry: false,
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function clearCreateParam() {
    if (!searchParams.get("create")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setSelected(undefined);
      setOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const leadId = Number(searchParams.get("lead") || "");
    if (leadId) setDrawerEntity({ type: "lead", id: leadId });
  }, [searchParams]);

  const leadMutation = useMutation({
    mutationFn: (payload: Partial<Lead>) => selected ? leadsApi.update({ id: selected.id, payload }) : leadsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false);
      setSelected(undefined);
      clearCreateParam();
    },
  });

  function closeLeadModal() {
    setOpen(false);
    setSelected(undefined);
    clearCreateParam();
  }

  const statusMutation = useMutation({
    mutationFn: ({ id, status, lost_reason }: { id: number; status: Lead["status"]; lost_reason?: string }) => leadsApi.update({ id, payload: { status, lost_reason } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });
  const archiveMutation = useMutation({
    mutationFn: leadsApi.archive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const quickActionMutation = useMutation({
    mutationFn: async ({ action, lead }: { action: "take" | "contacted" | "deal" | "closed" | "lost" | "reopen"; lead: Lead }): Promise<unknown> => {
      if (action === "take") return leadsApi.takeInWork({ id: lead.id });
      if (action === "contacted") return leadsApi.markContacted({ id: lead.id });
      if (action === "deal") return leadsApi.createDeal({ id: lead.id });
      if (action === "closed") return leadsApi.markClosed({ id: lead.id });
      if (action === "reopen") return leadsApi.reopen({ id: lead.id });
      const lostReason = window.prompt(t("leads.lostReason"));
      if (!lostReason) throw new Error(t("leads.lostReasonRequired"));
      return leadsApi.markLost({ id: lead.id, lost_reason: lostReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setNotice(t("leads.actionDone"));
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setAppointmentOpen(false);
      setNotice(t("leads.appointmentCreated"));
      setSelected(undefined);
    },
  });

  const rows = useMemo(() => {
    const searchValue = search.toLowerCase();
    return (leads.data || []).filter((lead) => {
      const client = clients.data?.find((item) => item.id === lead.client);
      const matchesSearch = !searchValue || [client?.full_name, client?.phone, lead.message].join(" ").toLowerCase().includes(searchValue);
      return matchesSearch && (!source || lead.source === source);
    });
  }, [clients.data, leads.data, search, source]);

  function handleDragEnd(event: DragEndEvent) {
    const activeId = Number(event.active.id);
    const overId = String(event.over?.id || "");
    const hoveredLead = rows.find((lead) => String(lead.id) === overId);
    const targetStatus = columns.find((column) => column.id === overId)?.id || hoveredLead?.status;
    const currentLead = rows.find((lead) => lead.id === activeId);
    if (!targetStatus || !activeId || currentLead?.status === targetStatus) return;
    if (targetStatus === "lost") {
      const lostReason = window.prompt(t("leads.lostReason"));
      if (!lostReason) return;
      statusMutation.mutate({ id: activeId, status: targetStatus, lost_reason: lostReason });
      return;
    }
    statusMutation.mutate({ id: activeId, status: targetStatus });
  }

  if (!business) return <ErrorState message={t("leads.noBusiness")} />;
  if (leads.isLoading || clients.isLoading || services.isLoading) return <LoadingState />;
  const teamMemberList = Array.isArray(teamMembers.data) ? teamMembers.data : [];

  return (
    <>
      <PageHeader
        title={t("leads.title")}
        description={t("leads.description")}
      />
      <LeadCommandHero rows={rows} onCreate={() => { setSelected(undefined); setOpen(true); }} t={t} />
      {leadMutation.error || appointmentMutation.error || statusMutation.error || archiveMutation.error || quickActionMutation.error ? (
        <div className="mb-4"><ErrorState message={getApiErrorMessage(leadMutation.error || appointmentMutation.error || statusMutation.error || archiveMutation.error || quickActionMutation.error)} /></div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-3xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-medium text-ai-800">
          {notice}
        </div>
      ) : null}
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px]">
        <Input placeholder={t("leads.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={source} onChange={(event) => setSource(event.target.value)} options={[
          { value: "", label: t("leads.allSources") },
          { value: "manual", label: t("source.manual") },
          { value: "website", label: t("source.website") },
          { value: "landing", label: t("source.landing") },
          { value: "telegram", label: t("source.telegram") },
          { value: "whatsapp", label: t("source.whatsapp") },
          { value: "instagram", label: t("source.instagram") },
        ]} />
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-3 2xl:grid-cols-6">
          {columns.map((column) => {
            const columnLeads = rows.filter((lead) => lead.status === column.id);
            return (
              <SortableContext key={column.id} items={columnLeads.map((lead) => String(lead.id))} strategy={verticalListSortingStrategy}>
                <KanbanColumn id={column.id} title={t(column.titleKey)} hint={t(column.hintKey)}>
                  <div className="mb-3 flex justify-end px-1">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 shadow-sm">{columnLeads.length}</span>
                  </div>
                  <div className="space-y-3">
                    {columnLeads.map((lead) => {
                      const client = clients.data?.find((item) => item.id === lead.client);
                      const service = services.data?.find((item) => item.id === lead.service);
                      const responsible = teamMemberList.find((member) => member.user.id === lead.responsible_user);
                      return (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          clientName={client?.full_name || `Lead #${lead.id}`}
                          phone={client?.phone}
                          serviceName={service?.name}
                          responsibleName={responsible?.user.full_name || responsible?.user.email}
                          onOpen={() => setDrawerEntity({ type: "lead", id: lead.id })}
                          onBook={() => { setSelected(lead); setAppointmentOpen(true); }}
                          onArchive={() => {
                            const reason = window.prompt(t("leads.archiveReason"));
                            if (reason !== null) archiveMutation.mutate({ id: lead.id, reason });
                          }}
                          onAiReply={() => setNotice(t("leads.aiDraftReady"))}
                          onTakeInWork={() => quickActionMutation.mutate({ action: "take", lead })}
                          onMarkContacted={() => quickActionMutation.mutate({ action: "contacted", lead })}
                          onCreateDeal={() => quickActionMutation.mutate({ action: "deal", lead })}
                          onCloseSuccess={() => quickActionMutation.mutate({ action: "closed", lead })}
                          onMarkLost={() => quickActionMutation.mutate({ action: "lost", lead })}
                          onReopen={() => quickActionMutation.mutate({ action: "reopen", lead })}
                          isActionLoading={quickActionMutation.isPending}
                          t={t}
                        />
                      );
                    })}
                    {!columnLeads.length ? (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/50 p-6 text-center text-sm text-slate-400">
                        {t("leads.dropHere")}
                      </div>
                    ) : null}
                  </div>
                </KanbanColumn>
              </SortableContext>
            );
          })}
        </div>
      </DndContext>

      <Modal title={selected ? t("leads.intelligence") : t("leads.create")} open={open} onClose={closeLeadModal}>
        {selected ? (
          <div className="mb-5 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="mt-1 text-ai-600" />
              <p>{selected.message || t("leads.aiSummary")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => {
                const phone = clients.data?.find((client) => client.id === selected.client)?.phone;
                if (phone) window.location.href = `tel:${phone}`;
              }}><Phone size={16} />{t("leads.call")}</Button>
              <Button variant="secondary" onClick={() => {
                const phone = clients.data?.find((client) => client.id === selected.client)?.phone?.replace(/\D/g, "");
                if (phone) window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
              }}><MessageCircle size={16} />WhatsApp</Button>
              <Button variant="ai" onClick={() => setNotice(t("leads.aiDraftReady"))}><Bot size={16} />{t("leads.aiReply")}</Button>
            </div>
          </div>
        ) : null}
        <LeadForm
          businessId={business.id}
          clients={clients.data || []}
          services={services.data || []}
          teamMembers={teamMemberList}
          initial={selected}
          onSubmit={(payload) => leadMutation.mutateAsync(payload)}
          onOpenClient={(id) => {
            setOpen(false);
            setSelected(undefined);
            setDrawerEntity({ type: "client", id });
          }}
        />
      </Modal>

      <Modal title={t("leads.bookFromLead")} open={appointmentOpen} onClose={() => setAppointmentOpen(false)}>
        <AppointmentForm
          businessId={business.id}
          clients={clients.data || []}
          services={services.data || []}
          resources={resources.data || []}
          leads={leads.data || []}
          prefill={{
            client: selected?.client,
            service: selected?.service,
            lead: selected?.id,
            source: "manual",
          }}
          onSubmit={(payload) => appointmentMutation.mutateAsync({ ...payload, lead: selected?.id || payload.lead, client: selected?.client || payload.client, service: selected?.service || payload.service })}
        />
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
