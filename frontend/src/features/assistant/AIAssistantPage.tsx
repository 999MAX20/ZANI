import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpenText,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Cpu,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { aiApi, businessKnowledgeApi } from "../../api/ai";
import type { BusinessKnowledgeItem, Id } from "../../types";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { AiInsightCard, aiInsightDotClass, type AiInsightSeverity } from "../../components/ai/AiInsightCard";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";

type NavigatorInsight = {
  id: string;
  severity: AiInsightSeverity;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  icon: LucideIcon;
};

const memoryCategories = [
  { value: "business", labelKey: "aiAssistant.memory.category.business" },
  { value: "sales", labelKey: "aiAssistant.memory.category.sales" },
  { value: "service", labelKey: "aiAssistant.memory.category.service" },
  { value: "operations", labelKey: "aiAssistant.memory.category.operations" },
  { value: "tone", labelKey: "aiAssistant.memory.category.tone" },
  { value: "policy", labelKey: "aiAssistant.memory.category.policy" },
];

const emptyMemoryDraft = {
  title: "",
  content: "",
  category: "business",
  is_active: true,
};

function memoryDraftFromItem(item?: BusinessKnowledgeItem) {
  return item
    ? {
        title: item.title,
        content: item.content,
        category: item.category || "business",
        is_active: item.is_active,
      }
    : emptyMemoryDraft;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isWithin(dateValue: string | null | undefined, from: Date, to: Date) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date >= from && date < to;
}

function hoursSince(dateValue: string | null | undefined, now: Date) {
  if (!dateValue) return 0;
  return (now.getTime() - new Date(dateValue).getTime()) / 36e5;
}

export function AIAssistantPage() {
  const { t } = useI18n();
  const { business, isLoading } = useActiveBusiness();
  const queryClient = useQueryClient();
  const [aiBrief, setAiBrief] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<BusinessKnowledgeItem | undefined>();
  const [memoryDraft, setMemoryDraft] = useState(emptyMemoryDraft);

  const { clients, leads, appointments, deals, tasks, botConversations, activityEvents } = useEntityData({
    enabled: Boolean(business),
    clients: true,
    leads: true,
    appointments: true,
    deals: true,
    tasks: true,
    botConversations: true,
    activityEvents: true,
  });

  const memory = useQuery({
    queryKey: ["ai-knowledge-items", business?.id],
    queryFn: businessKnowledgeApi.list,
    enabled: Boolean(business),
  });

  const aiStatus = useQuery({
    queryKey: ["ai-assistant-status", business?.id],
    queryFn: () => aiApi.assistantStatus(business!.id),
    enabled: Boolean(business),
  });

  const memoryMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is not selected.");
      const payload = { ...memoryDraft, business: business.id };
      return editingMemory
        ? businessKnowledgeApi.update({ id: editingMemory.id, payload })
        : businessKnowledgeApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-items"] });
      setMemoryOpen(false);
      setEditingMemory(undefined);
      setMemoryDraft(emptyMemoryDraft);
    },
  });

  const navigatorData = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = addDays(todayStart, 1);
    const yesterdayStart = addDays(todayStart, -1);

    const clientRows = clients.data || [];
    const leadRows = (leads.data || []).filter((lead) => !lead.is_archived);
    const appointmentRows = (appointments.data || []).filter((appointment) => !appointment.is_archived);
    const dealRows = (deals.data || []).filter((deal) => !deal.is_archived);
    const taskRows = (tasks.data || []).filter((task) => !task.is_archived);
    const conversationRows = botConversations.data || [];
    const eventRows = activityEvents.data || [];

    const leadsToday = leadRows.filter((lead) => isWithin(lead.created_at, todayStart, tomorrowStart));
    const leadsYesterday = leadRows.filter((lead) => isWithin(lead.created_at, yesterdayStart, todayStart));
    const activeAppointmentsToday = appointmentRows.filter(
      (appointment) => isWithin(appointment.start_at, todayStart, tomorrowStart)
        && ["created", "confirmed"].includes(appointment.status),
    );
    const overdueTasks = taskRows.filter(
      (task) => ["open", "in_progress"].includes(task.status) && task.due_at && new Date(task.due_at) < now,
    );
    const staleLeads = leadRows.filter(
      (lead) => ["new", "in_progress"].includes(lead.status) && hoursSince(lead.updated_at || lead.created_at, now) >= 2,
    );
    const stuckDeals = dealRows.filter(
      (deal) => deal.status === "open" && (deal.sla_overdue || hoursSince(deal.updated_at || deal.created_at, now) >= 48),
    );
    const handoffConversations = conversationRows.filter(
      (conversation) => conversation.status === "open" && (conversation.handoff_required || (conversation.unread_count || 0) > 0),
    );
    const lostLeadsToday = leadRows.filter((lead) => lead.status === "lost" && isWithin(lead.lost_at || lead.updated_at, todayStart, tomorrowStart));
    const salesEventsToday = eventRows.filter(
      (event) => isWithin(event.created_at, todayStart, tomorrowStart)
        && ["sale_imported", "kaspi_sale_detected", "kaspi_order_imported"].includes(event.event_type),
    );

    const insights: NavigatorInsight[] = [];

    if (leadsYesterday.length >= 3 && leadsToday.length < Math.ceil(leadsYesterday.length * 0.75)) {
      const delta = Math.round(((leadsYesterday.length - leadsToday.length) / leadsYesterday.length) * 100);
      insights.push({
        id: "lead_drop",
        severity: "warning",
        title: t("aiNavigator.insight.leadDrop.title", { percent: delta }),
        description: t("aiNavigator.insight.leadDrop.text", { today: leadsToday.length, yesterday: leadsYesterday.length }),
        actionLabel: t("aiNavigator.openLeads"),
        href: "/dashboard/leads",
        icon: TrendingDown,
      });
    }

    if (staleLeads.length) {
      insights.push({
        id: "stale_leads",
        severity: staleLeads.length >= 5 ? "critical" : "warning",
        title: t("aiNavigator.insight.staleLeads.title", { count: staleLeads.length }),
        description: t("aiNavigator.insight.staleLeads.text"),
        actionLabel: t("aiNavigator.openLeads"),
        href: "/dashboard/leads",
        icon: Clock3,
      });
    }

    if (handoffConversations.length) {
      insights.push({
        id: "handoff_conversations",
        severity: handoffConversations.length >= 3 ? "critical" : "warning",
        title: t("aiNavigator.insight.handoff.title", { count: handoffConversations.length }),
        description: t("aiNavigator.insight.handoff.text"),
        actionLabel: t("aiNavigator.openConversations"),
        href: "/dashboard/conversations",
        icon: MessageSquareWarning,
      });
    }

    if (overdueTasks.length) {
      insights.push({
        id: "overdue_tasks",
        severity: overdueTasks.length >= 5 ? "critical" : "warning",
        title: t("aiNavigator.insight.overdueTasks.title", { count: overdueTasks.length }),
        description: t("aiNavigator.insight.overdueTasks.text"),
        actionLabel: t("aiNavigator.openTasks"),
        href: "/dashboard/tasks",
        icon: AlertTriangle,
      });
    }

    if (stuckDeals.length) {
      insights.push({
        id: "stuck_deals",
        severity: "warning",
        title: t("aiNavigator.insight.stuckDeals.title", { count: stuckDeals.length }),
        description: t("aiNavigator.insight.stuckDeals.text"),
        actionLabel: t("aiNavigator.openDeals"),
        href: "/dashboard/deals",
        icon: Clock3,
      });
    }

    if (!insights.length && leadRows.length + appointmentRows.length + taskRows.length < 5) {
      insights.push({
        id: "not_enough_data",
        severity: "info",
        title: t("aiNavigator.insight.notEnough.title"),
        description: t("aiNavigator.insight.notEnough.text"),
        actionLabel: t("aiNavigator.openIntegrations"),
        href: "/dashboard/integrations",
        icon: BookOpenText,
      });
    }

    if (!insights.length) {
      insights.push({
        id: "stable",
        severity: "good",
        title: t("aiNavigator.insight.stable.title"),
        description: t("aiNavigator.insight.stable.text"),
        actionLabel: t("aiNavigator.openDashboard"),
        href: "/dashboard",
        icon: CheckCircle2,
      });
    }

    const summary = [
      leadsToday.length > 0
        ? t("aiNavigator.summary.leadsToday", { count: leadsToday.length })
        : t("aiNavigator.summary.noNewLeads"),
      activeAppointmentsToday.length > 0
        ? t("aiNavigator.summary.appointmentsToday", { count: activeAppointmentsToday.length })
        : t("aiNavigator.summary.noAppointments"),
      overdueTasks.length > 0
        ? t("aiNavigator.summary.overdueTasks", { count: overdueTasks.length })
        : t("aiNavigator.summary.noOverdueTasks"),
      staleLeads.length > 0
        ? t("aiNavigator.summary.staleLeads", { count: staleLeads.length })
        : t("aiNavigator.summary.noStaleLeads"),
    ];

    return {
      now,
      summary,
      insights,
      metrics: {
        leadsToday: leadsToday.length,
        appointmentsToday: activeAppointmentsToday.length,
        overdueTasks: overdueTasks.length,
        clients: clientRows.length,
        staleLeads: staleLeads.length,
        stuckDeals: stuckDeals.length,
        lostLeadsToday: lostLeadsToday.length,
        salesEventsToday: salesEventsToday.length,
      },
      factsForAi: {
        business_id: business?.id,
        business_name: business?.name,
        leads_today: leadsToday.length,
        leads_yesterday: leadsYesterday.length,
        active_appointments_today: activeAppointmentsToday.length,
        overdue_tasks: overdueTasks.length,
        stale_leads_over_2h: staleLeads.length,
        stuck_deals_over_48h: stuckDeals.length,
        handoff_conversations: handoffConversations.length,
        lost_leads_today: lostLeadsToday.length,
        sales_events_today: salesEventsToday.length,
        clients_total: clientRows.length,
        generated_at: now.toISOString(),
      },
    };
  }, [activityEvents.data, appointments.data, botConversations.data, business?.id, business?.name, clients.data, deals.data, leads.data, tasks.data, t]);

  const briefMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is not selected.");
      return aiApi.assistantChat({
        business: business.id,
        prompt_type: "daily_summary",
        message: [
          "Сформируй короткую бизнес-сводку ZANI.",
          "Используй только факты ниже. Не добавляй внешние данные, рынок, конкурентов или неподтвержденные причины.",
          "Если фактов недостаточно, прямо напиши: недостаточно данных для вывода.",
          `Факты кабинета: ${JSON.stringify(navigatorData.factsForAi)}`,
        ].join("\n"),
      });
    },
    onSuccess: (response) => setAiBrief(response.answer),
  });

  if (isLoading) return <LoadingState />;
  if (!business) return <ErrorState message={t("aiAssistant.noBusiness")} />;

  const isDataLoading = clients.isLoading || leads.isLoading || appointments.isLoading || deals.isLoading || tasks.isLoading || botConversations.isLoading || activityEvents.isLoading;
  const activeMemoryItems = (memory.data || []).filter((item) => item.is_active);
  const memoryCategoryOptions = memoryCategories.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const providerLabel = aiStatus.data
    ? t("aiAssistant.providerStatus", {
        provider: aiStatus.data.provider,
        mode: aiStatus.data.mode === "live" ? t("aiAssistant.modeLive") : t("aiAssistant.modeMock"),
        model: aiStatus.data.model,
      })
    : t("aiAssistant.providerChecking");

  return (
    <>
      <PageHeader
        title={t("aiNavigator.title")}
        description={t("aiNavigator.description")}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { setEditingMemory(undefined); setMemoryDraft(emptyMemoryDraft); setMemoryOpen(true); }}>
              <Plus size={18} />{t("aiAssistant.addMemoryFact")}
            </Button>
            <Button variant="ai" onClick={() => briefMutation.mutate()} isLoading={briefMutation.isPending}>
              <RefreshCw size={18} />{t("aiNavigator.refreshBrief")}
            </Button>
          </div>
        )}
      />

      {briefMutation.error || memoryMutation.error ? (
        <div className="mb-4"><ErrorState message={getApiErrorMessage(briefMutation.error || memoryMutation.error)} /></div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card className="overflow-hidden border-0 bg-ai-gradient text-white shadow-glow">
            <CardBody className="p-5 sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-white/80">
                    <Sparkles size={15} />
                    {t("aiNavigator.todayBrief")}
                  </div>
                  <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                    {t("aiNavigator.businessUnderControl")}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                    {t("aiNavigator.factBasedNotice")}
                  </p>
                </div>
                <div className="rounded-3xl bg-white/15 p-4 text-sm font-bold text-white/85">
                  {isDataLoading ? t("common.loading") : t("aiNavigator.generatedFromCabinet")}
                </div>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile label={t("aiNavigator.metric.leadsToday")} value={navigatorData.metrics.leadsToday} />
                <MetricTile label={t("aiNavigator.metric.appointments")} value={navigatorData.metrics.appointmentsToday} />
                <MetricTile label={t("aiNavigator.metric.overdueTasks")} value={navigatorData.metrics.overdueTasks} />
                <MetricTile label={t("aiNavigator.metric.clients")} value={navigatorData.metrics.clients} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("aiNavigator.summaryEyebrow")}</p>
                  <h2 className="mt-2 text-2xl font-black text-midnight">{t("aiNavigator.summaryTitle")}</h2>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-500">
                  {t("aiNavigator.noExternalData")}
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {navigatorData.summary.map((item, index) => (
                  <div key={item} className="flex items-start gap-3 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                    <span className={`mt-1 h-3 w-3 rounded-full ${aiInsightDotClass(index === 0 ? "info" : index === 1 ? "good" : index === 2 ? "warning" : "critical")}`} />
                    <p className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
              {aiBrief ? (
                <div className="mt-5 rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("aiNavigator.aiInterpretation")}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{aiBrief}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-red-500">{t("aiNavigator.attentionEyebrow")}</p>
                  <h2 className="mt-2 text-2xl font-black text-midnight">{t("aiNavigator.attentionTitle")}</h2>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-500">
                  {t("aiNavigator.itemsCount", { count: navigatorData.insights.length })}
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {navigatorData.insights.map((insight) => (
                  <AiInsightCard
                    key={insight.id}
                    title={insight.title}
                    description={insight.description}
                    actionLabel={insight.actionLabel}
                    href={insight.href}
                    icon={insight.icon}
                    severity={insight.severity}
                  />
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
          <Card>
            <CardBody>
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-50 text-brand-700">
                  <Cpu size={20} />
                </div>
                <div>
                  <p className="font-black text-midnight">{t("aiNavigator.dataPolicyTitle")}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{t("aiNavigator.dataPolicyText")}</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
                {providerLabel}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Users size={20} />
                </div>
                <div>
                  <p className="font-black text-midnight">{t("aiNavigator.roleHelpTitle")}</p>
                  <p className="text-sm text-slate-500">{t("aiNavigator.roleHelpText")}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">{t("aiNavigator.ownerHelp")}</p>
                <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">{t("aiNavigator.managerHelp")}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="mb-4 flex items-start gap-3 rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm">
                  <BookOpenText size={19} />
                </div>
                <div>
                  <p className="font-bold text-midnight">{t("aiAssistant.businessMemory")}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {t("aiAssistant.activeFactsSummary", { count: activeMemoryItems.length })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-midnight">{t("aiAssistant.memoryTitle")}</h2>
                <Button variant="ghost" size="sm" onClick={() => { setEditingMemory(undefined); setMemoryDraft(emptyMemoryDraft); setMemoryOpen(true); }}>
                  <Plus size={15} />{t("aiAssistant.add")}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {(memory.data || []).slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setEditingMemory(item); setMemoryDraft(memoryDraftFromItem(item)); setMemoryOpen(true); }}
                    className="w-full rounded-3xl border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:bg-white hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-midnight">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{item.content}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {item.is_active ? t("aiAssistant.active") : t("aiAssistant.off")}
                      </span>
                    </div>
                  </button>
                ))}
                {!memory.data?.length ? (
                  <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                    {t("aiAssistant.emptyMemoryText")}
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      <Modal title={editingMemory ? t("aiAssistant.editMemoryTitle") : t("aiAssistant.addMemoryTitle")} open={memoryOpen} onClose={() => { setMemoryOpen(false); setEditingMemory(undefined); setMemoryDraft(emptyMemoryDraft); }}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            memoryMutation.mutate();
          }}
        >
          <Input
            label={t("aiAssistant.nameLabel")}
            value={memoryDraft.title}
            onChange={(event) => setMemoryDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder={t("aiAssistant.namePlaceholder")}
            required
          />
          <Select
            label={t("aiAssistant.categoryLabel")}
            value={memoryDraft.category}
            onChange={(event) => setMemoryDraft((current) => ({ ...current, category: event.target.value }))}
            options={memoryCategoryOptions}
          />
          <Textarea
            label={t("aiAssistant.contentLabel")}
            value={memoryDraft.content}
            onChange={(event) => setMemoryDraft((current) => ({ ...current, content: event.target.value }))}
            placeholder={t("aiAssistant.contentPlaceholder")}
            required
          />
          <label className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={memoryDraft.is_active}
              onChange={(event) => setMemoryDraft((current) => ({ ...current, is_active: event.target.checked }))}
            />
            {t("aiAssistant.useInContext")}
          </label>
          <Button type="submit" variant="ai" isLoading={memoryMutation.isPending} disabled={!memoryDraft.title.trim() || !memoryDraft.content.trim()}>
            {t("aiAssistant.saveMemory")}
          </Button>
        </form>
      </Modal>
    </>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white/15 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  );
}
