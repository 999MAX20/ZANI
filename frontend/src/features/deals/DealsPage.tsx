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
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { dealsApi } from "../../api/deals";
import { tasksApi } from "../../api/tasks";
import { teamApi } from "../../api/team";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { FilterChips, IconBubble, ProductionKpiCard } from "../../components/ui/Primitives";
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
  return (name || "К")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function sourceLabel(source?: string) {
  const labels: Record<string, string> = {
    website: "Сайт",
    landing: "Лендинг",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    manual: "Вручную",
    parser: "Парсер",
    other: "Другое",
  };
  return labels[source || ""] || source || "Вручную";
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
}: {
  deal: Deal;
  client?: Client;
  stage?: PipelineStage;
  task?: Task;
  selected: boolean;
  onSelect: () => void;
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
          <p className="mt-1 truncate text-sm font-semibold text-slate-500">{client?.full_name || "Клиент не указан"}</p>
        </div>
        <StatusBadge status={deal.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Сумма</p>
          <p className="mt-1 truncate text-sm font-black text-midnight">{money(deal.amount, deal.currency)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Этап</p>
          <p className="mt-1 truncate text-sm font-black text-midnight">{stage?.name || "Без этапа"}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
        <span className={`h-2.5 w-2.5 rounded-full ${toneClass}`} />
        <span className="min-w-0 truncate">{task ? `${task.title} · ${formatDateTime(task.due_at)}` : "Следующее действие не задано"}</span>
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
    title: "Связаться с клиентом",
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
    { value: "all", label: `Все этапы (${pipelineRows.length})` },
    ...activeStages.map((stage) => ({
      value: String(stage.id),
      label: `${stage.name} (${pipelineRows.filter((deal) => deal.stage === stage.id).length})`,
    })),
  ];

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
      title: "Связаться с клиентом",
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
      setStageGuard("Перед продвижением сделки вперед нужно создать next action: кто, что и когда делает дальше.");
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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">Сделки</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-midnight sm:text-5xl">Pipeline продаж</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Рабочий экран менеджера: воронка, next action, клиент, источник, переписки и закрытие сделки без лишних блоков.
          </p>
        </div>
        <Button variant="ai" onClick={() => setCreateOpen(true)}>
          <Plus size={18} /> Создать сделку
        </Button>
      </div>

      {createMutation.error || moveMutation.error || quickActionMutation.error || createTaskMutation.error || updateDealMutation.error ? (
        <div className="mt-4"><ErrorState message="Не удалось сохранить изменение. Проверьте данные и попробуйте еще раз." /></div>
      ) : null}
      {stageGuard ? (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{stageGuard}</div>
      ) : null}

      {!pipelineOptions.length ? (
        <div className="mt-6"><ErrorState message={t("deals.noPipeline")} /></div>
      ) : (
        <>
          <section className="my-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ProductionKpiCard label="Открытая воронка" value={money(pipelineValue)} hint={`${openDeals.length} сделок в работе`} icon={CircleDollarSign} tone="brand" />
            <ProductionKpiCard label="Выиграно" value={wonDeals.length} hint="Успешно закрытые сделки" icon={CheckCircle2} tone="green" />
            <ProductionKpiCard label="Потеряно" value={lostDeals.length} hint="Причины видны в карточке" icon={XCircle} tone="red" />
            <ProductionKpiCard label="Риски" value={staleDeals.length} hint={overdueDeals.length ? "Просрочен SLA" : "Нет next action / close date"} icon={AlertTriangle} tone={staleDeals.length ? "amber" : "green"} />
          </section>

          <section className="mb-5 rounded-3xl border border-white/75 bg-white/82 p-4 shadow-sm">
            <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_200px_220px]">
              <Select
                value={String(activePipeline || "")}
                onChange={(event) => setPipelineId(event.target.value)}
                options={pipelineOptions.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))}
              />
              <Input placeholder="Поиск по сделке, клиенту, телефону или источнику" value={search} onChange={(event) => setSearch(event.target.value)} />
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as DealStatusFilter)}
                options={[
                  { value: "open", label: "Открытые" },
                  { value: "won", label: "Выигранные" },
                  { value: "lost", label: "Потерянные" },
                  { value: "all", label: "Все статусы" },
                ]}
              />
              <Select
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
                options={[
                  { value: "", label: "Все менеджеры" },
                  ...(teamMembers.data || []).map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                ]}
              />
            </div>
            <div className="mt-3">
              <FilterChips value={stageFilter} options={stageFilterOptions} onChange={setStageFilter} />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.35fr)]">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-black text-midnight">Список сделок</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{rows.length}</span>
              </div>
              <div className="space-y-3">
                {rows.map((deal) => (
                  <DealListItem
                    key={deal.id}
                    deal={deal}
                    client={clientMap.get(deal.client)}
                    stage={stageMap.get(deal.stage)}
                    task={nextOpenTask(tasksByDeal.get(deal.id) || [])}
                    selected={selectedDeal?.id === deal.id}
                    onSelect={() => setSelectedDealId(deal.id)}
                  />
                ))}
                {!rows.length ? <EmptyPanel title="Сделок не найдено" text="Измените фильтр или создайте новую сделку из заявки/клиента." /> : null}
              </div>
            </div>

            {selectedDeal ? (
              <div className="rounded-[2rem] border border-white/75 bg-white/86 p-5 shadow-soft">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedDeal.status} />
                      {selectedDeal.sla_overdue ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">SLA просрочен</span> : null}
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">{selectedStage?.name || "Без этапа"}</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-black tracking-tight text-midnight">{selectedDeal.title}</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      {money(selectedDeal.amount, selectedDeal.currency)} · {selectedDeal.probability || selectedStage?.probability || 0}% · {sourceLabel(selectedDeal.source)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDeal.status === "open" ? (
                      <>
                        <Button variant="secondary" onClick={() => { setActionFlow({ type: "won", deal: selectedDeal }); setActionDraft({ amount: selectedDeal.amount || "0", lost_reason: "" }); }}>
                          <CheckCircle2 size={16} /> Won
                        </Button>
                        <Button variant="danger" onClick={() => { setActionFlow({ type: "lost", deal: selectedDeal }); setActionDraft({ amount: "", lost_reason: "" }); }}>
                          <XCircle size={16} /> Lost
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" onClick={() => quickActionMutation.mutate({ id: selectedDeal.id, action: "reopen" })} isLoading={quickActionMutation.isPending}>
                        <RotateCcw size={16} /> Вернуть в работу
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setDrawerEntity({ type: "deal", id: selectedDeal.id })}>
                      Полная карточка <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-black text-midnight">
                        <ClipboardList size={18} className="text-brand-600" /> Next action
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => openNextActionModal(selectedDeal)} isLoading={createTaskMutation.isPending}>
                        <Plus size={14} /> Добавить
                      </Button>
                    </div>
                    {selectedDeal.status === "open" && !selectedNextTask && !selectedDeal.next_action_at ? (
                      <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                        Эта сделка не должна двигаться дальше без назначенного следующего действия.
                      </div>
                    ) : null}
                    {selectedNextTask ? (
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="font-black text-midnight">{selectedNextTask.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(selectedNextTask.due_at)} · {selectedNextTask.priority}</p>
                      </div>
                    ) : (
                      <p className="rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-amber-700">У сделки нет следующего действия. Это риск потери продажи.</p>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                      <UserRound size={18} className="text-brand-600" /> Клиент
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-50 text-sm font-black text-ai-700 ring-1 ring-ai-100">
                        {initials(selectedClient?.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-midnight">{selectedClient?.full_name || "Клиент не указан"}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-500">{selectedClient?.phone || selectedClient?.email || "Контактов нет"}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedClient?.phone ? (
                            <Button variant="secondary" size="sm" onClick={() => window.open(`https://wa.me/${selectedClient.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}>
                              <Phone size={14} /> WhatsApp
                            </Button>
                          ) : null}
                          {selectedClient ? (
                            <Button variant="ghost" size="sm" onClick={() => setDrawerEntity({ type: "client", id: selectedClient.id })}>Открыть</Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Источник</p>
                    <p className="mt-2 font-black text-midnight">{sourceLabel(selectedDeal.source)}</p>
                    <p className="mt-1 text-sm text-slate-500">Лид: {selectedLead ? `#${selectedLead.id} · ${selectedLead.status}` : "не связан"}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Закрытие</p>
                    <p className="mt-2 font-black text-midnight">{selectedDeal.expected_close_at ? formatDate(selectedDeal.expected_close_at) : "Не задано"}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedDeal.lost_reason || "Причина проигрыша появится после Lost"}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Этап</p>
                    <Select
                      value={String(selectedDeal.stage)}
                      onChange={(event) => handleStageChange(selectedDeal, Number(event.target.value))}
                      options={activeStages.map((stage) => ({ value: String(stage.id), label: stage.name }))}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ответственный</p>
                    <Select
                      value={selectedDeal.owner ? String(selectedDeal.owner) : ""}
                      onChange={(event) => updateDealMutation.mutate({ id: selectedDeal.id, payload: { owner: event.target.value ? Number(event.target.value) : null } })}
                      options={[
                        { value: "", label: "Не назначен" },
                        ...(teamMembers.data || []).map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
                      ]}
                    />
                    <p className="mt-2 text-sm font-semibold text-slate-500">{selectedOwner?.user.email || "Выберите менеджера для ответственности за сделку."}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Риск сделки</p>
                    <p className={`mt-2 font-black ${staleDeals.some((deal) => deal.id === selectedDeal.id) ? "text-amber-700" : "text-emerald-700"}`}>
                      {staleDeals.some((deal) => deal.id === selectedDeal.id) ? "Нужен контроль" : "Под контролем"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedDeal.sla_overdue
                        ? "SLA просрочен."
                        : isPastDate(selectedDeal.expected_close_at)
                          ? "Expected close уже прошел."
                          : selectedNextTask || selectedDeal.next_action_at
                            ? "Есть следующее действие."
                            : "Нет next action."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <section className="rounded-3xl border border-slate-100 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                      <MessageSquareText size={18} className="text-brand-600" /> Сообщения
                    </div>
                    <div className="space-y-2">
                      {selectedConversations.map((conversation: BotConversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          className="w-full rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-brand-50"
                          onClick={() => setDrawerEntity({ type: "client", id: conversation.client || selectedDeal.client })}
                        >
                          <p className="font-black text-midnight">{sourceLabel(conversation.channel)} · {conversation.status}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{conversation.last_message?.text || "Последнее сообщение не найдено"}</p>
                        </button>
                      ))}
                      {!selectedConversations.length ? <p className="text-sm font-semibold text-slate-500">Связанных диалогов пока нет.</p> : null}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-100 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 font-black text-midnight">
                      <CalendarClock size={18} className="text-brand-600" /> История
                    </div>
                    <div className="space-y-2">
                      {selectedTimeline.map((event: ActivityEvent) => (
                        <div key={event.id} className="rounded-2xl bg-slate-50 p-3">
                          <p className="font-semibold text-midnight">{event.text || event.event_type}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">{formatDateTime(event.created_at)}</p>
                        </div>
                      ))}
                      {!selectedTimeline.length ? <p className="text-sm font-semibold text-slate-500">История по сделке пока пустая.</p> : null}
                    </div>
                  </section>
                </div>

                {selectedDeal.notes ? <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{selectedDeal.notes}</div> : null}
              </div>
            ) : (
              <EmptyPanel title="Выберите сделку" text="Справа появятся клиент, next action, сообщения и история." />
            )}
          </section>
        </>
      )}

      <Modal title="Создать сделку" open={createOpen} onClose={() => setCreateOpen(false)}>
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
          {!clients.data?.length ? <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-900">Сначала нужен клиент.</div> : null}
          <Input placeholder="Название сделки" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Select
            value={form.client}
            onChange={(event) => setForm({ ...form, client: event.target.value })}
            options={[{ value: "", label: "Выберите клиента" }, ...(clients.data || []).map((client) => ({ value: String(client.id), label: client.full_name }))]}
          />
          <Select
            value={form.pipeline || String(defaultPipeline?.id || "")}
            onChange={(event) => setForm({ ...form, pipeline: event.target.value, stage: "" })}
            options={pipelineOptions.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))}
          />
          <Select
            value={form.stage}
            onChange={(event) => setForm({ ...form, stage: event.target.value })}
            options={[{ value: "", label: "Первый этап" }, ...stagesForForm.map((stage) => ({ value: String(stage.id), label: stage.name }))]}
          />
          <Select
            value={form.source}
            onChange={(event) => setForm({ ...form, source: event.target.value })}
            options={[
              { value: "manual", label: "Вручную" },
              { value: "website", label: "Сайт" },
              { value: "telegram", label: "Telegram" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "instagram", label: "Instagram" },
            ]}
          />
          <Input type="number" placeholder="Сумма" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          <Button type="submit" isLoading={createMutation.isPending} disabled={!clients.data?.length || !stagesForForm.length}>Сохранить</Button>
        </form>
      </Modal>

      <Modal title={actionFlow?.type === "won" ? "Закрыть как Won" : "Закрыть как Lost"} open={Boolean(actionFlow)} onClose={() => setActionFlow(null)}>
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
              <Input label="Финальная сумма" type="number" value={actionDraft.amount} onChange={(event) => setActionDraft({ ...actionDraft, amount: event.target.value })} />
            ) : (
              <Input label="Причина проигрыша" value={actionDraft.lost_reason} onChange={(event) => setActionDraft({ ...actionDraft, lost_reason: event.target.value })} required />
            )}
            <Button type="submit" variant={actionFlow.type === "won" ? "primary" : "danger"} isLoading={quickActionMutation.isPending}>
              {actionFlow.type === "won" ? "Подтвердить Won" : "Подтвердить Lost"}
            </Button>
          </form>
        ) : null}
      </Modal>

      <Modal title="Следующее действие" open={Boolean(nextActionDeal)} onClose={() => setNextActionDeal(null)}>
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
            <Input label="Задача" value={nextActionDraft.title} onChange={(event) => setNextActionDraft({ ...nextActionDraft, title: event.target.value })} required />
            <Input label="Дедлайн" type="datetime-local" value={nextActionDraft.due_at} onChange={(event) => setNextActionDraft({ ...nextActionDraft, due_at: event.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Ответственный"
                value={nextActionDraft.assignee}
                onChange={(event) => setNextActionDraft({ ...nextActionDraft, assignee: event.target.value })}
                options={[
                  { value: "", label: "Ответственный сделки" },
                  ...(teamMembers.data || []).map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
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
            <Button type="submit" isLoading={createTaskMutation.isPending}>Создать next action</Button>
          </form>
        ) : null}
      </Modal>

      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
