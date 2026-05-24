import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, GripVertical, KanbanSquare, ListChecks, MessageSquareText, Plus, RotateCcw, Sparkles, UserRound, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { dealsApi } from "../../api/deals";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { ActivityEvent, Client, Deal, Id, PipelineStage, Task } from "../../types";

function money(value: string | number, currency = "KZT") {
  return `${Number(value || 0).toLocaleString("ru-RU")} ${currency}`;
}

function DealCard({
  deal,
  client,
  stage,
  nextTask,
  lastActivity,
  onOpen,
  onMarkWon,
  onMarkLost,
  onReopen,
  isActionPending,
  t,
}: {
  deal: Deal;
  client?: Client;
  stage: PipelineStage;
  nextTask?: Task;
  lastActivity?: ActivityEvent;
  onOpen: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  onReopen: () => void;
  isActionPending?: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `deal-${deal.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`group rounded-3xl border border-white/80 bg-white/90 p-4 shadow-soft backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-premium ${
        isDragging ? "opacity-60 ring-2 ring-brand-300" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              className="cursor-grab rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
              {...attributes}
              {...listeners}
              aria-label={t("deals.dragDeal")}
            >
              <GripVertical size={14} />
            </button>
            <p className="truncate font-bold text-midnight">{deal.title}</p>
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{client?.full_name || t("deals.clientFallback")} · {money(deal.amount, deal.currency)}</p>
        </div>
        <StatusBadge status={deal.status} />
      </div>
      {deal.sla_overdue ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          <AlertTriangle size={14} /> {t("deals.slaOverdue")}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-slate-400">{t("deals.probability")}</p>
          <p className="mt-1 font-black text-midnight">{deal.probability || stage.probability}%</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-slate-400">{t("deals.source")}</p>
          <p className="mt-1 font-black text-midnight">{deal.source ? t(`source.${deal.source}`) : t("source.manual")}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <ListChecks size={14} className="text-brand-500" />
          <span className="truncate">{nextTask ? `${nextTask.title} · ${formatDateTime(nextTask.due_at)}` : t("deals.noNextTask")}</span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarClock size={14} className="text-slate-400" />
          <span className="truncate">{lastActivity?.text || lastActivity?.event_type || `Updated ${formatDateTime(deal.updated_at)}`}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {deal.status === "open" ? (
          <>
            <Button type="button" variant="secondary" className="h-9 rounded-xl px-2 text-xs" onClick={onMarkWon} disabled={isActionPending}>
              <CheckCircle2 size={14} /> {t("deals.markWon")}
            </Button>
            <Button type="button" variant="danger" className="h-9 rounded-xl px-2 text-xs" onClick={onMarkLost} disabled={isActionPending}>
              <XCircle size={14} /> {t("deals.markLost")}
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" className="col-span-2 h-9 rounded-xl px-2 text-xs" onClick={onReopen} disabled={isActionPending}>
            <RotateCcw size={14} /> {t("deals.reopen")}
          </Button>
        )}
      </div>
      <Button variant="ghost" className="mt-2 h-9 w-full rounded-xl text-xs" onClick={onOpen}>
        {t("deals.openDeal")} <ArrowRight size={14} />
      </Button>
    </article>
  );
}

function StageColumn({
  stage,
  deals,
  children,
  t,
}: {
  stage: PipelineStage;
  deals: Deal[];
  children: React.ReactNode;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}` });
  const total = deals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);

  return (
    <section
      ref={setNodeRef}
      className={`min-h-[540px] min-w-[330px] rounded-3xl border border-white/70 bg-white/45 p-3 shadow-soft backdrop-blur-xl transition ${
        isOver ? "ring-2 ring-brand-300" : ""
      }`}
    >
      <div className="mb-3 rounded-3xl bg-white/80 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
              <h2 className="font-black text-midnight">{stage.name}</h2>
            </div>
        <p className="mt-1 text-xs text-slate-500">{t("deals.stageMeta", { probability: stage.probability, sla: stage.sla_minutes || "-" })}</p>
        {stage.required_fields_json?.fields?.length ? (
          <p className="mt-1 text-[11px] font-semibold text-amber-600">{t("deals.requiredFields", { fields: stage.required_fields_json.fields.join(", ") })}</p>
        ) : null}
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{deals.length}</span>
        </div>
        <p className="mt-3 text-sm font-bold text-slate-700">{money(total)}</p>
      </div>
      {children}
    </section>
  );
}

export function DealsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { clients, leads, pipelines, pipelineStages, deals, tasks, activityEvents, botConversations } = useEntityData();
  const [searchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [pipelineId, setPipelineId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", client: "", pipeline: "", stage: "", amount: "0", source: "manual" });
  const [actionDealId, setActionDealId] = useState<Id | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    const dealId = Number(searchParams.get("deal") || "");
    if (dealId) setDrawerEntity({ type: "deal", id: dealId });
  }, [searchParams]);

  const activePipeline = Number(pipelineId || pipelines.data?.find((pipeline) => pipeline.is_default)?.id || pipelines.data?.[0]?.id || 0);
  const activeStages = useMemo(
    () => (pipelineStages.data || []).filter((stage) => stage.pipeline === activePipeline).sort((a, b) => a.order - b.order),
    [activePipeline, pipelineStages.data],
  );
  const rows = useMemo(() => {
    const searchValue = search.toLowerCase();
    return (deals.data || []).filter((deal) => {
      const client = clients.data?.find((item) => item.id === deal.client);
      const haystack = [deal.title, deal.source, client?.full_name, client?.phone].join(" ").toLowerCase();
      return deal.pipeline === activePipeline && (!searchValue || haystack.includes(searchValue));
    });
  }, [activePipeline, clients.data, deals.data, search]);

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Deal>) => dealsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setCreateOpen(false);
      setForm({ title: "", client: "", pipeline: "", stage: "", amount: "0", source: "manual" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage, lost_reason }: { id: Id; stage: Id; lost_reason?: string }) => dealsApi.moveStage({ id, stage, lost_reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
  });

  const quickActionMutation = useMutation({
    mutationFn: ({ id, action, lost_reason, amount }: { id: Id; action: "won" | "lost" | "reopen"; lost_reason?: string; amount?: string | number }) => {
      if (action === "won") return dealsApi.markWon({ id, amount });
      if (action === "lost") return dealsApi.markLost({ id, lost_reason: lost_reason || "" });
      return dealsApi.reopen({ id });
    },
    onMutate: ({ id }) => setActionDealId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["activity-events"] });
    },
    onSettled: () => setActionDealId(null),
  });

  function handleMarkWon(deal: Deal) {
    const amount = Number(deal.amount || 0) > 0 ? deal.amount : window.prompt(t("deals.paymentAmountPrompt"), "0");
    if (amount === null) return;
    quickActionMutation.mutate({ id: deal.id, action: "won", amount });
  }

  function handleMarkLost(deal: Deal) {
    const lostReason = window.prompt(t("deals.lostReasonPrompt"));
    if (!lostReason) return;
    quickActionMutation.mutate({ id: deal.id, action: "lost", lost_reason: lostReason });
  }

  function handleReopen(deal: Deal) {
    quickActionMutation.mutate({ id: deal.id, action: "reopen" });
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = String(event.over?.id || "");
    if (!activeId.startsWith("deal-") || !overId) return;
    const dealId = Number(activeId.replace("deal-", ""));
    const hoveredDealId = overId.startsWith("deal-") ? Number(overId.replace("deal-", "")) : null;
    const hoveredDeal = rows.find((deal) => deal.id === hoveredDealId);
    const targetStageId = overId.startsWith("stage-") ? Number(overId.replace("stage-", "")) : hoveredDeal?.stage;
    const currentDeal = rows.find((deal) => deal.id === dealId);
    if (!targetStageId || !currentDeal || currentDeal.stage === targetStageId) return;
    const targetStage = activeStages.find((stage) => stage.id === targetStageId);
    const lostReason = targetStage?.is_lost ? window.prompt(t("deals.stageLostReasonPrompt")) || "" : undefined;
    moveMutation.mutate({ id: dealId, stage: targetStageId, lost_reason: lostReason });
  }

  if (!business) return <ErrorState message={t("deals.noBusiness")} />;
  if (clients.isLoading || pipelines.isLoading || pipelineStages.isLoading || deals.isLoading || tasks.isLoading) return <LoadingState />;

  const pipelineOptions = pipelines.data || [];
  const defaultPipeline = pipelineOptions.find((pipeline) => pipeline.id === activePipeline) || pipelineOptions[0];
  const stagesForForm = (pipelineStages.data || []).filter((stage) => stage.pipeline === Number(form.pipeline || defaultPipeline?.id));
  const selectedClient = detailDeal ? clients.data?.find((client) => client.id === detailDeal.client) : null;
  const selectedLead = detailDeal?.lead ? leads.data?.find((lead) => lead.id === detailDeal.lead) : null;
  const selectedTasks = detailDeal ? (tasks.data || []).filter((task) => task.deal === detailDeal.id) : [];
  const selectedTimeline = detailDeal
    ? (activityEvents.data || []).filter((event) => event.entity_type === "Deal" && event.entity_id === String(detailDeal.id)).slice(0, 6)
    : [];
  const selectedConversations = selectedClient ? (botConversations.data || []).filter((conversation) => conversation.client === selectedClient.id) : [];

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">{t("deals.eyebrow")}</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-midnight sm:text-5xl">{t("deals.title")}</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">{t("deals.description")}</p>
        </div>
        <Button variant="ai" onClick={() => setCreateOpen(true)}>
          <Plus size={18} />{t("deals.create")}
        </Button>
      </div>

      {createMutation.error || moveMutation.error || quickActionMutation.error ? (
        <div className="mt-4"><ErrorState message={t("deals.saveError")} /></div>
      ) : null}

      {!pipelineOptions.length ? (
        <div className="mt-6">
          <ErrorState message={t("deals.noPipeline")} />
        </div>
      ) : (
        <>
          <div className="my-5 grid gap-3 lg:grid-cols-[260px_1fr_220px]">
            <Select
              value={String(activePipeline || "")}
              onChange={(event) => setPipelineId(event.target.value)}
              options={pipelineOptions.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))}
            />
            <Input placeholder={t("deals.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
            <Card>
              <CardBody className="flex items-center gap-3 py-3">
                <KanbanSquare size={18} className="text-brand-600" />
                <div>
                  <p className="text-xs text-slate-500">{t("deals.pipelineValue")}</p>
                  <p className="font-black text-midnight">{money(rows.reduce((sum, deal) => sum + Number(deal.amount || 0), 0))}</p>
                </div>
              </CardBody>
            </Card>
          </div>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="no-scrollbar grid gap-4 overflow-x-auto pb-4 xl:grid-cols-3 2xl:grid-cols-5">
              {activeStages.map((stage) => {
                const stageDeals = rows.filter((deal) => deal.stage === stage.id);
                return (
                  <SortableContext key={stage.id} items={stageDeals.map((deal) => `deal-${deal.id}`)} strategy={verticalListSortingStrategy}>
                    <StageColumn stage={stage} deals={stageDeals} t={t}>
                      <div className="space-y-3">
                        {stageDeals.map((deal) => {
                          const client = clients.data?.find((item) => item.id === deal.client);
                          const nextTask = (tasks.data || [])
                            .filter((task) => task.deal === deal.id && !["done", "cancelled"].includes(task.status))
                            .sort((a, b) => String(a.due_at || "").localeCompare(String(b.due_at || "")))[0];
                          const lastActivity = (activityEvents.data || [])
                            .filter((event) => event.entity_type === "Deal" && event.entity_id === String(deal.id))
                            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                          return (
                            <DealCard
                              key={deal.id}
                              deal={deal}
                              client={client}
                              stage={stage}
                              nextTask={nextTask}
                              lastActivity={lastActivity}
                              onOpen={() => setDrawerEntity({ type: "deal", id: deal.id })}
                              onMarkWon={() => handleMarkWon(deal)}
                              onMarkLost={() => handleMarkLost(deal)}
                              onReopen={() => handleReopen(deal)}
                              isActionPending={quickActionMutation.isPending && actionDealId === deal.id}
                              t={t}
                            />
                          );
                        })}
                        {!stageDeals.length ? (
                          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/50 p-6 text-center text-sm text-slate-400">
                            {t("deals.dropHere")}
                          </div>
                        ) : null}
                      </div>
                    </StageColumn>
                  </SortableContext>
                );
              })}
            </div>
          </DndContext>
        </>
      )}

      <Modal title={t("deals.createModalTitle")} open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!clients.data?.length || !stagesForForm.length) return;
            createMutation.mutate({
              business: business.id,
              title: form.title,
              client: Number(form.client),
              pipeline: Number(form.pipeline || defaultPipeline?.id),
              stage: Number(form.stage || stagesForForm[0]?.id),
              amount: form.amount,
              currency: "KZT",
              source: form.source,
            });
          }}
        >
          {!clients.data?.length ? (
            <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              {t("deals.clientRequired")}
            </div>
          ) : null}
          {!stagesForForm.length ? (
            <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              {t("deals.stageRequired")}
            </div>
          ) : null}
          <Input placeholder={t("deals.titlePlaceholder")} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Select
            value={form.client}
            onChange={(event) => setForm({ ...form, client: event.target.value })}
            options={[{ value: "", label: t("deals.clientSelect") }, ...(clients.data || []).map((client) => ({ value: String(client.id), label: client.full_name }))]}
          />
          <Select
            value={form.pipeline || String(defaultPipeline?.id || "")}
            onChange={(event) => setForm({ ...form, pipeline: event.target.value, stage: "" })}
            options={pipelineOptions.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))}
          />
          <Select
            value={form.stage}
            onChange={(event) => setForm({ ...form, stage: event.target.value })}
            options={[{ value: "", label: t("deals.firstStage") }, ...stagesForForm.map((stage) => ({ value: String(stage.id), label: stage.name }))]}
          />
          <Select
            value={form.source}
            onChange={(event) => setForm({ ...form, source: event.target.value })}
            options={[
              { value: "manual", label: t("source.manual") },
              { value: "website", label: t("source.website") },
              { value: "telegram", label: "Telegram" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "instagram", label: "Instagram" },
            ]}
          />
          <Input type="number" placeholder={t("deals.amountPlaceholder")} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          <Button type="submit" isLoading={createMutation.isPending} disabled={!clients.data?.length || !stagesForForm.length}>{t("common.save")}</Button>
        </form>
      </Modal>

      <Modal title={detailDeal?.title || t("deals.detailTitle")} open={Boolean(detailDeal)} onClose={() => setDetailDeal(null)}>
        {detailDeal ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{t("deals.amount")}</p>
                <p className="mt-1 text-xl font-black text-midnight">{money(detailDeal.amount, detailDeal.currency)}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{t("deals.expectedClose")}</p>
                <p className="mt-1 text-sm font-bold text-midnight">{formatDate(detailDeal.expected_close_at)}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{t("deals.source")}</p>
                <p className="mt-1 text-sm font-bold text-midnight">{detailDeal.source ? t(`source.${detailDeal.source}`) : t("source.manual")}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardBody>
                  <div className="mb-3 flex items-center gap-2 font-bold text-midnight">
                    <UserRound size={18} /> {t("deals.client")}
                  </div>
                  <p className="font-semibold">{selectedClient?.full_name || t("deals.clientFallback")}</p>
                  <p className="mt-1 text-sm text-slate-500">{selectedClient?.phone || selectedClient?.email || t("deals.noContacts")}</p>
                  <p className="mt-3 text-xs text-slate-400">{t("deals.leadLabel")}: {selectedLead ? `#${selectedLead.id} · ${selectedLead.status}` : t("deals.notLinked")}</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="mb-3 flex items-center gap-2 font-bold text-midnight">
                    <Sparkles size={18} /> {t("deals.aiNextAction")}
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    {t("deals.aiNextActionText")}
                  </p>
                </CardBody>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardBody>
                  <div className="mb-3 flex items-center gap-2 font-bold text-midnight">
                    <ListChecks size={18} /> {t("deals.tasks")}
                  </div>
                  <div className="space-y-2">
                    {selectedTasks.map((task) => (
                      <div key={task.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                        <p className="font-semibold text-midnight">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{task.status} · {formatDateTime(task.due_at)}</p>
                      </div>
                    ))}
                    {!selectedTasks.length ? <p className="text-sm text-slate-500">{t("deals.noTasks")}</p> : null}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="mb-3 flex items-center gap-2 font-bold text-midnight">
                    <MessageSquareText size={18} /> {t("deals.conversations")}
                  </div>
                  <div className="space-y-2">
                    {selectedConversations.map((conversation) => (
                      <div key={conversation.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                        <p className="font-semibold text-midnight">{conversation.channel}</p>
                        <p className="mt-1 text-xs text-slate-500">{t("deals.unread", { count: conversation.unread_count || 0 })}</p>
                      </div>
                    ))}
                    {!selectedConversations.length ? <p className="text-sm text-slate-500">{t("deals.noConversations")}</p> : null}
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardBody>
                <h3 className="mb-3 font-bold text-midnight">{t("deals.timeline")}</h3>
                <div className="space-y-3">
                  {selectedTimeline.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-slate-100 p-3 text-sm">
                      <p className="font-semibold text-midnight">{event.text || event.event_type}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.created_at)}</p>
                    </div>
                  ))}
                  {!selectedTimeline.length ? <p className="text-sm text-slate-500">{t("deals.noTimeline")}</p> : null}
                </div>
              </CardBody>
            </Card>

            {detailDeal.notes ? (
              <div className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{detailDeal.notes}</div>
            ) : null}
          </div>
        ) : null}
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
