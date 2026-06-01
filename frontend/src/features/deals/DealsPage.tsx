import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  MessageSquareText,
  Phone,
  Plus,
  RotateCcw,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { dealsApi } from "../../api/deals";
import { tasksApi } from "../../api/tasks";
import { teamApi } from "../../api/team";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { WorkQueueDetailPane, WorkQueueLayout, WorkQueueListPane } from "../../components/layout/WorkQueueLayout";
import { Button } from "../../components/ui/Button";
import { FilterBar } from "../../components/ui/FilterBar";
import { Input } from "../../components/ui/Input";
import { MetricCard } from "../../components/ui/MetricCard";
import { Modal } from "../../components/ui/Modal";
import { IconBubble } from "../../components/ui/Primitives";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { ActivityEvent, BotConversation, Client, Deal, Id, PipelineStage, Task } from "../../types";

type DealStatusFilter = "open" | "won" | "lost" | "all";
type DealActionFlow = { type: "won" | "lost"; deal: Deal } | null;

function money(value: string | number, currency = "KZT") {
  return `${Number(value || 0).toLocaleString("ru-RU")} ${currency}`;
}

function initials(name?: string) {
  return (name || "D")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

type Translate = ReturnType<typeof useI18n>["t"];

function sourceLabel(source: string | undefined, t: Translate) {
  const labels: Record<string, string> = {
    website: "deals.sourceWebsite",
    landing: "deals.sourceLanding",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    manual: "deals.sourceManual",
    parser: "deals.sourceParser",
    other: "deals.sourceOther",
  };
  const label = labels[source || ""];
  return label ? t(label) : source || t("deals.sourceManual");
}

function nextOpenTask(tasks: Task[]) {
  return tasks
    .filter((task) => !["done", "cancelled"].includes(task.status))
    .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")))[0];
}

function toDateTimeLocal(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function isPastDate(value?: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

function DealListItem({
  deal,
  client,
  stage,
  task,
  selected,
  onSelect,
  t,
}: {
  deal: Deal;
  client?: Client;
  stage?: PipelineStage;
  task?: Task;
  selected: boolean;
  onSelect: () => void;
  t: Translate;
}) {
  const toneClass = deal.status === "won"
    ? "bg-emerald-500"
    : deal.status === "lost"
      ? "bg-red-500"
      : deal.sla_overdue
        ? "bg-amber-500"
        : "bg-brand-500";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${
        selected ? "border-brand-200 bg-white ring-4 ring-brand-100" : "border-white/75 bg-white/82"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-midnight">{deal.title}</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-500">{client?.full_name || t("deals.clientMissing")}</p>
        </div>
        <StatusBadge status={deal.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{t("deals.amount")}</p>
          <p className="mt-1 truncate text-sm font-black text-midnight">{money(deal.amount, deal.currency)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{t("deals.stage")}</p>
          <p className="mt-1 truncate text-sm font-black text-midnight">{stage?.name || t("deals.noStage")}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
        <span className={`h-2.5 w-2.5 rounded-full ${toneClass}`} />
        <span className="min-w-0 truncate">{task ? `${task.title} · ${formatDateTime(task.due_at)}` : t("deals.noPlan")}</span>
      </div>
    </button>
  );
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/65 p-8 text-center">
      <IconBubble icon={ClipboardList} tone="slate" className="mx-auto" />
      <p className="mt-4 font-black text-midnight">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

export function DealsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { clients, leads, pipelines, pipelineStages, deals, tasks, activityEvents, botConversations } = useEntityData({
    clients: true,
    leads: true,
    pipelines: true,
    pipelineStages: true,
    deals: true,
    tasks: true,
    activityEvents: true,
    botConversations: true,
  });
  const [searchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<Id | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<DealStatusFilter>("open");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [search, setSearch] = useState("");
  const [actionFlow, setActionFlow] = useState<DealActionFlow>(null);
  const [actionDraft, setActionDraft] = useState({ amount: "", lost_reason: "" });
  const [stageGuard, setStageGuard] = useState("");
  const [nextActionDeal, setNextActionDeal] = useState<Deal | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState({
    title: t("deals.defaultNextAction"),
    due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    assignee: "",
    priority: "normal" as Task["priority"],
  });
  const [form, setForm] = useState({ title: "", client: "", pipeline: "", stage: "", amount: "0", source: "manual" });
  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
    retry: false,
  });

  useEffect(() => {
    const dealId = Number(searchParams.get("deal") || "");
    if (dealId) setSelectedDealId(dealId);
  }, [searchParams]);

  const activePipeline = Number(pipelineId || pipelines.data?.find((pipeline) => pipeline.is_default)?.id || pipelines.data?.[0]?.id || 0);
  const activeStages = useMemo(
    () => (pipelineStages.data || []).filter((stage) => stage.pipeline === activePipeline).sort((a, b) => a.order - b.order),
    [activePipeline, pipelineStages.data],
  );
  const stageMap = useMemo(() => new Map((pipelineStages.data || []).map((stage) => [stage.id, stage])), [pipelineStages.data]);
  const clientMap = useMemo(() => new Map((clients.data || []).map((client) => [client.id, client])), [clients.data]);
  const tasksByDeal = useMemo(() => {
    const map = new Map<Id, Task[]>();
    (tasks.data || []).forEach((task) => {
      if (!task.deal) return;
      map.set(task.deal, [...(map.get(task.deal) || []), task]);
    });
    return map;
  }, [tasks.data]);

  const rows = useMemo(() => {
    const searchValue = search.toLowerCase();
    return (deals.data || []).filter((deal) => {
      const client = clientMap.get(deal.client);
      const matchesSearch = [deal.title, deal.source, client?.full_name, client?.phone, client?.email]
        .join(" ")
        .toLowerCase()
        .includes(searchValue);
      return (
        deal.pipeline === activePipeline &&
        (statusFilter === "all" || deal.status === statusFilter) &&
        (!ownerFilter || String(deal.owner || "") === ownerFilter) &&
        (stageFilter === "all" || String(deal.stage) === stageFilter) &&
        (!searchValue || matchesSearch)
      );
    });
  }, [activePipeline, clientMap, deals.data, ownerFilter, search, stageFilter, statusFilter]);

  useEffect(() => {
    if (selectedDealId && rows.some((deal) => deal.id === selectedDealId)) return;
    setSelectedDealId(rows[0]?.id || null);
  }, [rows, selectedDealId]);

  const selectedDeal = (deals.data || []).find((deal) => deal.id === selectedDealId) || rows[0] || null;
  const selectedClient = selectedDeal ? clientMap.get(selectedDeal.client) : undefined;
  const selectedLead = selectedDeal?.lead ? leads.data?.find((lead) => lead.id === selectedDeal.lead) : undefined;
  const selectedStage = selectedDeal ? stageMap.get(selectedDeal.stage) : undefined;
  const selectedOwner = selectedDeal?.owner ? (teamMembers.data || []).find((member) => member.user.id === selectedDeal.owner) : undefined;
  const selectedTasks = selectedDeal ? tasksByDeal.get(selectedDeal.id) || [] : [];
  const selectedNextTask = nextOpenTask(selectedTasks);
  const selectedConversations = selectedDeal
    ? (botConversations.data || []).filter((conversation) => conversation.deal === selectedDeal.id || conversation.client === selectedDeal.client)
    : [];
  const selectedTimeline = selectedDeal
    ? (activityEvents.data || []).filter((event) => event.entity_type === "Deal" && event.entity_id === String(selectedDeal.id)).slice(0, 6)
    : [];
  const pipelineRows = (deals.data || []).filter((deal) => deal.pipeline === activePipeline);
  const openDeals = pipelineRows.filter((deal) => deal.status === "open");
  const wonDeals = pipelineRows.filter((deal) => deal.status === "won");
  const lostDeals = pipelineRows.filter((deal) => deal.status === "lost");
  const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const noNextAction = openDeals.filter((deal) => !nextOpenTask(tasksByDeal.get(deal.id) || []) && !deal.next_action_at);
  const overdueDeals = openDeals.filter((deal) => deal.sla_overdue);
  const staleDeals = openDeals.filter((deal) => {
    const dealTasks = tasksByDeal.get(deal.id) || [];
    return deal.sla_overdue || isPastDate(deal.expected_close_at) || (!nextOpenTask(dealTasks) && !deal.next_action_at);
  });

  const pipelineOptions = pipelines.data || [];
  const defaultPipeline = pipelineOptions.find((pipeline) => pipeline.id === activePipeline) || pipelineOptions[0];
  const stagesForForm = (pipelineStages.data || []).filter((stage) => stage.pipeline === Number(form.pipeline || defaultPipeline?.id));
  const stageFilterOptions = [
    { value: "all", label: t("deals.allStages"), count: pipelineRows.length },
    ...activeStages.map((stage) => ({
      value: String(stage.id),
      label: stage.name,
      count: pipelineRows.filter((deal) => deal.stage === stage.id).length,
    })),
  ];

  function openDeal(dealId: Id) {
    setSelectedDealId(dealId);
    setMobileDetailOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Deal>) => dealsApi.create(payload),
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setCreateOpen(false);
      setSelectedDealId(deal.id);
      setForm({ title: "", client: "", pipeline: "", stage: "", amount: "0", source: "manual" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage, lost_reason }: { id: Id; stage: Id; lost_reason?: string }) => dealsApi.moveStage({ id, stage, lost_reason }),
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setSelectedDealId(deal.id);
    },
  });

  const quickActionMutation = useMutation({
    mutationFn: ({ id, action, lost_reason, amount }: { id: Id; action: "won" | "lost" | "reopen"; lost_reason?: string; amount?: string | number }) => {
      if (action === "won") return dealsApi.markWon({ id, amount });
      if (action === "lost") return dealsApi.markLost({ id, lost_reason: lost_reason || "" });
      return dealsApi.reopen({ id });
    },
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["activity-events"] });
      setSelectedDealId(deal.id);
      setActionFlow(null);
      setActionDraft({ amount: "", lost_reason: "" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: Partial<Task>) => tasksApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setNextActionDeal(null);
      setStageGuard("");
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: Partial<Deal> }) => dealsApi.update({ id, payload }),
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setSelectedDealId(deal.id);
    },
  });

  function createNextAction(deal: Deal) {
    createTaskMutation.mutate({
      business: business!.id,
      title: nextActionDraft.title,
      description: "",
      client: deal.client,
      lead: deal.lead,
      deal: deal.id,
      appointment: null,
      parent_task: null,
      assignee: nextActionDraft.assignee ? Number(nextActionDraft.assignee) : deal.owner || null,
      created_by: null,
      watchers: [],
      due_at: new Date(nextActionDraft.due_at).toISOString(),
      reminder_at: null,
      snoozed_until: null,
      priority: nextActionDraft.priority,
      status: "open",
      recurrence_rule: "",
    });
  }

  function openNextActionModal(deal: Deal) {
    setNextActionDeal(deal);
    setNextActionDraft({
      title: t("deals.defaultNextAction"),
      due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      assignee: deal.owner ? String(deal.owner) : "",
      priority: "normal",
    });
  }

  function handleStageChange(deal: Deal, stageId: Id) {
    const targetStage = activeStages.find((stage) => stage.id === stageId);
    const currentStage = activeStages.find((stage) => stage.id === deal.stage);
    if (!targetStage) return;
    if (targetStage.is_won) {
      setActionFlow({ type: "won", deal });
      setActionDraft({ amount: deal.amount || "0", lost_reason: "" });
      return;
    }
    if (targetStage.is_lost) {
      setActionFlow({ type: "lost", deal });
      setActionDraft({ amount: "", lost_reason: deal.lost_reason || "" });
      return;
    }
    const isAdvancing = currentStage ? targetStage.order > currentStage.order : true;
    const hasNextAction = Boolean(nextOpenTask(tasksByDeal.get(deal.id) || []) || deal.next_action_at);
    if (deal.status === "open" && isAdvancing && !hasNextAction) {
      setStageGuard(t("deals.stageGuard"));
      openNextActionModal(deal);
      return;
    }
    setStageGuard("");
    moveMutation.mutate({ id: deal.id, stage: stageId });
  }

  if (!business) return <ErrorState message={t("deals.noBusiness")} />;
  if (clients.isLoading || pipelines.isLoading || pipelineStages.isLoading || deals.isLoading || tasks.isLoading) return <LoadingState />;

  return (
    <>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">{t("deals.title")}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-midnight sm:text-4xl">{t("deals.salesTitle")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            {t("deals.salesDescription")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={18} /> {t("deals.create")}
        </Button>
      </div>

      {createMutation.error || moveMutation.error || quickActionMutation.error || createTaskMutation.error || updateDealMutation.error ? (
        <div className="mt-4"><ErrorState message={t("deals.saveChangeError")} /></div>
      ) : null}
      {stageGuard ? (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{stageGuard}</div>
      ) : null}

      {!pipelineOptions.length ? (
        <div className="mt-6"><ErrorState message={t("deals.noPipeline")} /></div>
      ) : (
        <>
          <section className="my-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={t("deals.metricOpenPipeline")} value={money(pipelineValue)} hint={t("deals.metricOpenPipelineHint", { count: openDeals.length })} icon={CircleDollarSign} />
            <MetricCard label={t("deals.metricWon")} value={wonDeals.length} hint={t("deals.metricWonHint")} icon={CheckCircle2} tone="emerald" />
            <MetricCard label={t("deals.metricLost")} value={lostDeals.length} hint={t("deals.metricLostHint")} icon={XCircle} tone="red" />
            <MetricCard label={t("deals.metricControl")} value={staleDeals.length} hint={overdueDeals.length ? t("deals.metricControlOverdue") : t("deals.metricControlNoNext")} icon={AlertTriangle} tone={staleDeals.length ? "amber" : "emerald"} />
          </section>

          <section className="mb-4 rounded-3xl border border-white/75 bg-white/82 p-3 shadow-sm sm:p-4">
            <div className="grid gap-2 xl:grid-cols-[220px_minmax(0,1fr)_180px_200px]">
              <Select
                value={String(activePipeline || "")}
                onChange={(event) => setPipelineId(event.target.value)}
                options={pipelineOptions.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))}
              />
              <Input placeholder={t("deals.queueSearch")} value={search} onChange={(event) => setSearch(event.target.value)} />
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as DealStatusFilter)}
                options={[
                  { value: "open", label: t("deals.statusOpen") },
                  { value: "won", label: t("deals.statusWon") },
                  { value: "lost", label: t("deals.statusLost") },
                  { value: "all", label: t("deals.allStatuses") },
                ]}
              />
              <Select
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
                options={[
                  { value: "", label: t("deals.allManagers") },
                  ...(teamMembers.data || []).map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                ]}
              />
            </div>
            <div className="mt-2">
              <FilterBar value={stageFilter} options={stageFilterOptions} onChange={setStageFilter} ariaLabel={t("deals.stageFilterLabel")} />
            </div>
          </section>

          <WorkQueueLayout className="lg:grid-cols-[430px_minmax(0,1fr)]">
            <WorkQueueListPane mobileDetailOpen={mobileDetailOpen}>
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="text-lg font-black text-midnight">{t("deals.listTitle")}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{rows.length}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-28 lg:pb-3">
                {rows.map((deal) => (
                  <DealListItem
                    key={deal.id}
                    deal={deal}
                    client={clientMap.get(deal.client)}
                    stage={stageMap.get(deal.stage)}
                    task={nextOpenTask(tasksByDeal.get(deal.id) || [])}
                    selected={selectedDeal?.id === deal.id}
                    onSelect={() => openDeal(deal.id)}
                    t={t}
                  />
                ))}
                {!rows.length ? <EmptyPanel title={t("deals.notFoundTitle")} text={t("deals.notFoundText")} /> : null}
              </div>
            </WorkQueueListPane>

            <WorkQueueDetailPane mobileDetailOpen={mobileDetailOpen} closeLabel={t("common.close")} onMobileClose={() => setMobileDetailOpen(false)}>
              {selectedDeal ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-28 lg:pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedDeal.status} />
                      {selectedDeal.sla_overdue ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{t("deals.overdue")}</span> : null}
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">{selectedStage?.name || t("deals.noStage")}</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-black tracking-tight text-midnight">{selectedDeal.title}</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      {money(selectedDeal.amount, selectedDeal.currency)} · {selectedDeal.probability || selectedStage?.probability || 0}% · {sourceLabel(selectedDeal.source, t)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDeal.status === "open" ? (
                      <>
                        <Button variant="secondary" onClick={() => { setActionFlow({ type: "won", deal: selectedDeal }); setActionDraft({ amount: selectedDeal.amount || "0", lost_reason: "" }); }}>
                          <CheckCircle2 size={16} /> {t("deals.success")}
                        </Button>
                        <Button variant="danger" onClick={() => { setActionFlow({ type: "lost", deal: selectedDeal }); setActionDraft({ amount: "", lost_reason: "" }); }}>
                          <XCircle size={16} /> {t("deals.lost")}
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" onClick={() => quickActionMutation.mutate({ id: selectedDeal.id, action: "reopen" })} isLoading={quickActionMutation.isPending}>
                        <RotateCcw size={16} /> {t("deals.reopen")}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setDrawerEntity({ type: "deal", id: selectedDeal.id })}>
                      {t("deals.fullCard")} <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-black text-midnight">
                        <ClipboardList size={18} className="text-brand-600" /> {t("deals.nearestStep")}
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => openNextActionModal(selectedDeal)} isLoading={createTaskMutation.isPending}>
                        <Plus size={14} /> {t("deals.add")}
                      </Button>
                    </div>
                    {selectedDeal.status === "open" && !selectedNextTask && !selectedDeal.next_action_at ? (
                      <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                        {t("deals.noMoveWithoutNext")}
                      </div>
                    ) : null}
                    {selectedNextTask ? (
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="font-black text-midnight">{selectedNextTask.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(selectedNextTask.due_at)} · {selectedNextTask.priority}</p>
                      </div>
                    ) : (
                      <p className="rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-amber-700">{t("deals.noNearestStepText")}</p>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                      <UserRound size={18} className="text-brand-600" /> {t("deals.client")}
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-50 text-sm font-black text-ai-700 ring-1 ring-ai-100">
                        {initials(selectedClient?.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-midnight">{selectedClient?.full_name || t("deals.clientMissing")}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-500">{selectedClient?.phone || selectedClient?.email || t("deals.noContacts")}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedClient?.phone ? (
                            <Button variant="secondary" size="sm" onClick={() => window.open(`https://wa.me/${selectedClient.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}>
                              <Phone size={14} /> WhatsApp
                            </Button>
                          ) : null}
                          {selectedClient ? (
                            <Button variant="ghost" size="sm" onClick={() => setDrawerEntity({ type: "client", id: selectedClient.id })}>{t("common.open")}</Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("deals.source")}</p>
                    <p className="mt-2 font-black text-midnight">{sourceLabel(selectedDeal.source, t)}</p>
                    <p className="mt-1 text-sm text-slate-500">{t("deals.leadLine", { value: selectedLead ? `#${selectedLead.id} · ${selectedLead.status}` : t("deals.notLinked") })}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("deals.closing")}</p>
                    <p className="mt-2 font-black text-midnight">{selectedDeal.expected_close_at ? formatDate(selectedDeal.expected_close_at) : t("deals.notSet")}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedDeal.lost_reason || t("deals.lostReasonAfterClose")}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("deals.stage")}</p>
                    <Select
                      value={String(selectedDeal.stage)}
                      onChange={(event) => handleStageChange(selectedDeal, Number(event.target.value))}
                      options={activeStages.map((stage) => ({ value: String(stage.id), label: stage.name }))}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("deals.responsible")}</p>
                    <Select
                      value={selectedDeal.owner ? String(selectedDeal.owner) : ""}
                      onChange={(event) => updateDealMutation.mutate({ id: selectedDeal.id, payload: { owner: event.target.value ? Number(event.target.value) : null } })}
                      options={[
                        { value: "", label: t("deals.unassigned") },
                        ...(teamMembers.data || []).map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                      ]}
                    />
                    <p className="mt-2 text-sm font-semibold text-slate-500">{selectedOwner?.user.email || t("deals.chooseResponsible")}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{t("deals.dealRisk")}</p>
                    <p className={`mt-2 font-black ${staleDeals.some((deal) => deal.id === selectedDeal.id) ? "text-amber-700" : "text-emerald-700"}`}>
                      {staleDeals.some((deal) => deal.id === selectedDeal.id) ? t("deals.needsControl") : t("deals.underControl")}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedDeal.sla_overdue
                        ? t("deals.riskSlaOverdue")
                        : isPastDate(selectedDeal.expected_close_at)
                          ? t("deals.riskExpectedClosePassed")
                          : selectedNextTask || selectedDeal.next_action_at
                            ? t("deals.riskHasNext")
                            : t("deals.riskNoNext")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <section className="rounded-3xl border border-slate-100 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                      <MessageSquareText size={18} className="text-brand-600" /> {t("deals.messages")}
                    </div>
                    <div className="space-y-2">
                      {selectedConversations.map((conversation: BotConversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          className="w-full rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-brand-50"
                          onClick={() => setDrawerEntity({ type: "client", id: conversation.client || selectedDeal.client })}
                        >
                          <p className="font-black text-midnight">{sourceLabel(conversation.channel, t)} · {conversation.status}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{conversation.last_message?.text || t("deals.lastMessageMissing")}</p>
                        </button>
                      ))}
                      {!selectedConversations.length ? <p className="text-sm font-semibold text-slate-500">{t("deals.noLinkedConversations")}</p> : null}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-100 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                      <CalendarClock size={18} className="text-brand-600" /> {t("deals.timeline")}
                    </div>
                    <div className="space-y-2">
                      {selectedTimeline.map((event: ActivityEvent) => (
                        <div key={event.id} className="rounded-2xl bg-slate-50 p-3">
                          <p className="font-semibold text-midnight">{event.text || event.event_type}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">{formatDateTime(event.created_at)}</p>
                        </div>
                      ))}
                      {!selectedTimeline.length ? <p className="text-sm font-semibold text-slate-500">{t("deals.emptyDealHistory")}</p> : null}
                    </div>
                  </section>
                </div>

                {selectedDeal.notes ? <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{selectedDeal.notes}</div> : null}
              </div>
              ) : (
                <div className="grid flex-1 place-items-center p-8">
                  <EmptyPanel title={t("deals.selectDeal")} text={t("deals.selectDealText")} />
                </div>
              )}
            </WorkQueueDetailPane>
          </WorkQueueLayout>
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
          {!clients.data?.length ? <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-900">{t("deals.needClientFirst")}</div> : null}
          <Input placeholder={t("deals.titlePlaceholder")} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Select
            value={form.client}
            onChange={(event) => setForm({ ...form, client: event.target.value })}
            options={[{ value: "", label: t("deals.selectClient") }, ...(clients.data || []).map((client) => ({ value: String(client.id), label: client.full_name }))]}
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
              { value: "manual", label: t("deals.sourceManual") },
              { value: "website", label: t("deals.sourceWebsite") },
              { value: "telegram", label: "Telegram" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "instagram", label: "Instagram" },
            ]}
          />
          <Input type="number" placeholder={t("deals.amountPlaceholder")} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          <Button type="submit" isLoading={createMutation.isPending} disabled={!clients.data?.length || !stagesForForm.length}>{t("common.save")}</Button>
        </form>
      </Modal>

      <Modal title={actionFlow?.type === "won" ? t("deals.closeAsWon") : t("deals.closeAsLost")} open={Boolean(actionFlow)} onClose={() => setActionFlow(null)}>
        {actionFlow ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              quickActionMutation.mutate({
                id: actionFlow.deal.id,
                action: actionFlow.type,
                amount: actionDraft.amount,
                lost_reason: actionDraft.lost_reason,
              });
            }}
          >
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="font-black text-midnight">{actionFlow.deal.title}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{money(actionFlow.deal.amount, actionFlow.deal.currency)}</p>
            </div>
            {actionFlow.type === "won" ? (
              <Input label={t("deals.finalAmount")} type="number" value={actionDraft.amount} onChange={(event) => setActionDraft({ ...actionDraft, amount: event.target.value })} />
            ) : (
              <Input label={t("deals.lossReason")} value={actionDraft.lost_reason} onChange={(event) => setActionDraft({ ...actionDraft, lost_reason: event.target.value })} required />
            )}
            <Button type="submit" variant={actionFlow.type === "won" ? "primary" : "danger"} isLoading={quickActionMutation.isPending}>
              {actionFlow.type === "won" ? t("deals.confirmWon") : t("deals.confirmLost")}
            </Button>
          </form>
        ) : null}
      </Modal>

      <Modal title={t("deals.nextActionModal")} open={Boolean(nextActionDeal)} onClose={() => setNextActionDeal(null)}>
        {nextActionDeal ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createNextAction(nextActionDeal);
            }}
          >
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="font-black text-midnight">{nextActionDeal.title}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{money(nextActionDeal.amount, nextActionDeal.currency)}</p>
            </div>
            <Input label={t("deals.task")} value={nextActionDraft.title} onChange={(event) => setNextActionDraft({ ...nextActionDraft, title: event.target.value })} required />
            <Input label={t("deals.deadline")} type="datetime-local" value={nextActionDraft.due_at} onChange={(event) => setNextActionDraft({ ...nextActionDraft, due_at: event.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t("deals.responsible")}
                value={nextActionDraft.assignee}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, assignee: event.target.value })}
                options={[
                  { value: "", label: t("deals.dealResponsible") },
                  ...(teamMembers.data || []).map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                ]}
              />
              <Select
                label={t("deals.priority")}
                value={nextActionDraft.priority}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, priority: event.target.value as Task["priority"] })}
                options={[
                  { value: "low", label: t("deals.priorityLow") },
                  { value: "normal", label: t("deals.priorityNormal") },
                  { value: "high", label: t("deals.priorityHigh") },
                  { value: "urgent", label: t("deals.priorityUrgent") },
                ]}
              />
            </div>
            <Button type="submit" isLoading={createTaskMutation.isPending}>{t("deals.createTask")}</Button>
          </form>
        ) : null}
      </Modal>

      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
