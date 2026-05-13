import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, CalendarPlus, GripVertical, Flame, MessageCircle, Phone, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { getApiErrorMessage } from "../../api/client";
import { leadsApi } from "../../api/leads";
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

function LeadCard({
  lead,
  clientName,
  phone,
  serviceName,
  onOpen,
  onBook,
  onAiReply,
  t,
}: {
  lead: Lead;
  clientName: string;
  phone?: string;
  serviceName?: string;
  onOpen: () => void;
  onBook: () => void;
  onAiReply: () => void;
  t: (key: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(lead.id) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-3xl border border-white/70 bg-white/88 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-premium ${isDragging ? "opacity-60 ring-2 ring-brand-300" : ""}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              className="cursor-grab rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
              {...attributes}
              {...listeners}
              aria-label="Drag lead"
            >
              <GripVertical size={14} />
            </button>
            <Flame size={15} className="text-orange-500" />
            <p className="truncate font-semibold text-midnight">{clientName}</p>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{phone || "No phone"} · {serviceName || lead.source}</p>
        </div>
        <StatusBadge status={lead.status} />
      </div>
      <p className="line-clamp-3 min-h-[48px] text-sm leading-6 text-slate-600">{lead.message || t("leads.aiNote")}</p>
      <div className="mt-4 rounded-2xl bg-ai-50 p-3 text-xs leading-5 text-ai-700">
        <span className="font-bold">AI:</span> {t("leads.aiCard")}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" className="h-9 rounded-xl px-3 text-xs" onClick={onOpen}>{t("leads.open")}</Button>
        <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" onClick={onBook}><CalendarPlus size={14} />{t("leads.book")}</Button>
        {phone ? (
          <Button variant="ghost" className="h-9 w-9 rounded-xl px-0" onClick={() => window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}>
            <MessageCircle size={15} />
          </Button>
        ) : null}
        <Button variant="ghost" className="h-9 w-9 rounded-xl px-0" onClick={onAiReply}><Bot size={15} /></Button>
      </div>
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
      className={`min-h-[420px] min-w-[310px] rounded-3xl border border-white/70 bg-white/45 p-3 shadow-soft backdrop-blur-xl transition ${isOver ? "ring-2 ring-brand-300" : ""}`}
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
  const [open, setOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const leadMutation = useMutation({
    mutationFn: (payload: Partial<Lead>) => selected ? leadsApi.update({ id: selected.id, payload }) : leadsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false);
      setSelected(undefined);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Lead["status"] }) => leadsApi.update({ id, payload: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const appointmentMutation = useMutation({
    mutationFn: (payload: Partial<Appointment>) => {
      if (!selected?.id || !payload.service || !payload.start_at) throw new Error("Не выбрана заявка, услуга или слот.");
      return leadsApi.createAppointment({
        leadId: selected.id,
        payload: { service: payload.service, resource: payload.resource || null, start_at: payload.start_at },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setAppointmentOpen(false);
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
    statusMutation.mutate({ id: activeId, status: targetStatus });
  }

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы работать с заявками." />;
  if (leads.isLoading || clients.isLoading || services.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title={t("leads.title")}
        description={t("leads.description")}
        actions={<Button variant="ai" onClick={() => { setSelected(undefined); setOpen(true); }}><Plus size={18} />{t("leads.new")}</Button>}
      />
      {leadMutation.error || appointmentMutation.error || statusMutation.error ? (
        <div className="mb-4"><ErrorState message={getApiErrorMessage(leadMutation.error || appointmentMutation.error || statusMutation.error)} /></div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-3xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-medium text-ai-800">
          {notice}
        </div>
      ) : null}
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px]">
        <Input placeholder={t("leads.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={source} onChange={(event) => setSource(event.target.value)} options={[{ value: "", label: t("leads.allSources") }, { value: "manual", label: "Manual" }, { value: "website", label: "Website" }, { value: "telegram", label: "Telegram" }, { value: "whatsapp", label: "WhatsApp" }, { value: "instagram", label: "Instagram" }]} />
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="no-scrollbar grid gap-4 overflow-x-auto pb-4 lg:grid-cols-3 2xl:grid-cols-6">
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
                      return (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          clientName={client?.full_name || `Lead #${lead.id}`}
                          phone={client?.phone}
                          serviceName={service?.name}
                          onOpen={() => setDrawerEntity({ type: "lead", id: lead.id })}
                          onBook={() => { setSelected(lead); setAppointmentOpen(true); }}
                          onAiReply={() => setNotice("AI подготовил короткий ответ для заявки. Реальная отправка будет подключена через Conversations API.")}
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

      <Modal title={selected ? t("leads.intelligence") : t("leads.create")} open={open} onClose={() => { setOpen(false); setSelected(undefined); }}>
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
              <Button variant="ai" onClick={() => setNotice("AI подготовил черновик ответа для этой заявки. Подключение отправки будет через Conversations API.")}><Bot size={16} />{t("leads.aiReply")}</Button>
            </div>
          </div>
        ) : null}
        <LeadForm businessId={business.id} clients={clients.data || []} services={services.data || []} initial={selected} onSubmit={(payload) => leadMutation.mutateAsync(payload)} />
      </Modal>

      <Modal title={t("leads.bookFromLead")} open={appointmentOpen} onClose={() => setAppointmentOpen(false)}>
        <AppointmentForm
          businessId={business.id}
          clients={clients.data || []}
          services={services.data || []}
          resources={resources.data || []}
          leads={leads.data || []}
          onSubmit={(payload) => appointmentMutation.mutateAsync({ ...payload, lead: selected?.id || payload.lead, client: selected?.client || payload.client, service: selected?.service || payload.service })}
        />
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
