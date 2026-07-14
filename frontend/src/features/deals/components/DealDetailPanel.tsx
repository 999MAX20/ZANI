import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, MessageSquareText, Phone, Plus, RotateCcw, UserRound, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { ActivityEvent, BotConversation, Id, Lead, PipelineStage, Task, TeamMember } from "../../../types";
import type { DealDetailTab, DealRow, Translate } from "../types";
import { initials, isPastDate, money, sourceLabel, stageProbability } from "../utils/dealHelpers";
import { DealRiskIndicator } from "./common/DealRiskIndicator";
import { DealTimeline } from "./common/DealTimeline";
import { DealStageBadge, StatusPill } from "./common/DealStageBadge";

function PanelBlock({ title, icon: Icon, children }: { title: string; icon: typeof ClipboardList; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 font-black text-midnight">
        <Icon size={18} className="text-blue-600" /> {title}
      </div>
      {children}
    </section>
  );
}

export function DealDetailPanel({
  deal,
  leads,
  stages,
  tasks,
  conversations,
  timeline,
  teamMembers,
  onMarkWon,
  onMarkLost,
  onReopen,
  onFullCard,
  onClientCard,
  onStageChange,
  onOwnerChange,
  onAddTask,
  t,
}: {
  deal: DealRow | null;
  leads: Lead[];
  stages: PipelineStage[];
  tasks: Task[];
  conversations: BotConversation[];
  timeline: ActivityEvent[];
  teamMembers: TeamMember[];
  onMarkWon: (deal: DealRow) => void;
  onMarkLost: (deal: DealRow) => void;
  onReopen: (deal: DealRow) => void;
  onFullCard: (deal: DealRow) => void;
  onClientCard: (clientId: Id) => void;
  onStageChange: (deal: DealRow, stageId: Id) => void;
  onOwnerChange: (deal: DealRow, ownerId: Id | null) => void;
  onAddTask: (deal: DealRow) => void;
  t: Translate;
}) {
  const [tab, setTab] = useState<DealDetailTab>("overview");
  const selectedLead = useMemo(() => (deal?.lead ? leads.find((lead) => lead.id === deal.lead) : undefined), [deal?.lead, leads]);

  if (!deal) {
    return (
      <div className="grid flex-1 place-items-center p-8">
        <div className="max-w-sm rounded-xl border border-dashed border-slate-200 bg-white/65 p-8 text-center">
          <ClipboardList className="mx-auto text-slate-400" size={34} />
          <p className="mt-4 font-black text-midnight">{t("deals.selectDeal")}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{t("deals.selectDealText")}</p>
        </div>
      </div>
    );
  }

  const probability = stageProbability(deal, deal.stageEntity);
  const riskText = deal.sla_overdue
    ? t("deals.riskSlaOverdue")
    : isPastDate(deal.expected_close_at)
      ? t("deals.riskExpectedClosePassed")
      : deal.nextTask || deal.next_action_at
        ? t("deals.riskHasNext")
        : t("deals.riskNoNext");

  return (
    <article className="flex min-h-0 flex-1 flex-col bg-slate-50/60">
      <header className="border-b border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={deal.status} />
              <DealStageBadge stage={deal.stageEntity} fallback={t("deals.noStage")} />
            </div>
            <h2 className="mt-3 truncate text-2xl font-black tracking-tight text-midnight">{deal.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {money(deal.amount, deal.currency)} · {probability}% · {sourceLabel(deal.source, t)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {deal.status === "open" ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => onMarkWon(deal)}>
                  <CheckCircle2 size={15} /> {t("deals.success")}
                </Button>
                <Button variant="danger" size="sm" onClick={() => onMarkLost(deal)}>
                  <XCircle size={15} /> {t("deals.lost")}
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => onReopen(deal)}>
                <RotateCcw size={15} /> {t("deals.reopen")}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onFullCard(deal)}>
              {t("deals.fullCard")} <ArrowRight size={15} />
            </Button>
          </div>
        </div>
        <nav className="mt-4 grid grid-cols-3 rounded-lg bg-slate-100 p-1" aria-label="Разделы сделки">
          {[
            ["overview", "Обзор"],
            ["activities", "Активности"],
            ["history", "История"],
          ].map(([value, label]) => (
            <button key={value} type="button" className={cn("rounded-md px-3 py-2 text-sm font-bold transition", tab === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-600")} onClick={() => setTab(value as DealDetailTab)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24">
        {tab === "overview" ? (
          <div className="grid gap-4">
            <PanelBlock title={t("deals.nearestStep")} icon={ClipboardList}>
              {deal.status === "open" && !deal.nextTask && !deal.next_action_at ? (
                <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-800">{t("deals.noMoveWithoutNext")}</div>
              ) : null}
              {deal.nextTask ? (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-black text-midnight">{deal.nextTask.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(deal.nextTask.due_at)} · {deal.nextTask.priority}</p>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-amber-700">{t("deals.noNearestStepText")}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => onAddTask(deal)}><Plus size={14} /> {t("deals.add")}</Button>
                <Button size="sm" variant="ghost">Отложить</Button>
              </div>
            </PanelBlock>

            <PanelBlock title={t("deals.client")} icon={UserRound}>
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-sm font-black text-blue-700 ring-1 ring-blue-100">{initials(deal.clientEntity?.full_name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-midnight">{deal.clientEntity?.full_name || t("deals.clientMissing")}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-500">{deal.clientEntity?.phone || deal.clientEntity?.email || t("deals.noContacts")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {deal.clientEntity?.phone ? (
                      <Button variant="secondary" size="sm" onClick={() => window.open(`https://wa.me/${deal.clientEntity?.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}>
                        <Phone size={14} /> WhatsApp
                      </Button>
                    ) : null}
                    {deal.clientEntity ? <Button variant="ghost" size="sm" onClick={() => onClientCard(deal.clientEntity!.id)}>{t("common.open")}</Button> : null}
                  </div>
                </div>
              </div>
            </PanelBlock>

            <PanelBlock title="Сделка" icon={ClipboardList}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">{t("deals.amount")}</p>
                  <p className="mt-1 text-2xl font-black text-midnight">{money(deal.amount, deal.currency)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">{t("deals.probability")}</p>
                  <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${probability}%` }} /></div>
                  <p className="mt-1 text-sm font-bold text-slate-500">{probability}%</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">{t("deals.source")}</p>
                  <p className="mt-1 font-bold text-midnight">{sourceLabel(deal.source, t)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">{t("deals.closing")}</p>
                  <p className="mt-1 font-bold text-midnight">{deal.expected_close_at ? formatDate(deal.expected_close_at) : t("deals.notSet")}</p>
                </div>
              </div>
            </PanelBlock>

            <PanelBlock title="Воронка" icon={CalendarClock}>
              <Select value={String(deal.stage)} onChange={(event) => onStageChange(deal, Number(event.target.value))} options={stages.map((stage) => ({ value: String(stage.id), label: stage.name }))} />
              <div className="mt-4 flex items-center gap-1 overflow-x-auto">
                {stages.map((stage) => <span key={stage.id} className={cn("h-2 min-w-12 rounded-full", stage.order <= (deal.stageEntity?.order || 0) ? "bg-blue-600" : "bg-slate-200")} />)}
              </div>
              <Select
                label={t("deals.responsible")}
                className="mt-3"
                value={deal.owner ? String(deal.owner) : ""}
                onChange={(event) => onOwnerChange(deal, event.target.value ? Number(event.target.value) : null)}
                options={[{ value: "", label: t("deals.unassigned") }, ...teamMembers.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email }))]}
              />
            </PanelBlock>

            <PanelBlock title={t("deals.dealRisk")} icon={CalendarClock}>
              <DealRiskIndicator deal={deal} />
              <p className="mt-2 text-sm leading-6 text-slate-600">{riskText}</p>
              <Button variant="ghost" size="sm" className="mt-2">Показать рекомендации</Button>
            </PanelBlock>
          </div>
        ) : null}

        {tab === "activities" ? (
          <div className="grid gap-4">
            <PanelBlock title={t("deals.messages")} icon={MessageSquareText}>
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <button key={conversation.id} type="button" className="w-full rounded-lg bg-slate-50 p-3 text-left transition hover:bg-blue-50" onClick={() => onClientCard(conversation.client || deal.client)}>
                    <p className="font-black text-midnight">{sourceLabel(conversation.channel, t)} · {conversation.status}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{conversation.last_message?.text || t("deals.lastMessageMissing")}</p>
                  </button>
                ))}
                {!conversations.length ? <p className="text-sm font-semibold text-slate-500">{t("deals.noLinkedConversations")}</p> : null}
              </div>
            </PanelBlock>
            <PanelBlock title={t("deals.tasks")} icon={ClipboardList}>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <label key={task.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <input type="checkbox" checked={task.status === "done"} readOnly />
                    <span className="min-w-0 flex-1 truncate font-bold text-midnight">{task.title}</span>
                    <span className="text-xs font-semibold text-slate-500">{formatDateTime(task.due_at)}</span>
                  </label>
                ))}
                {!tasks.length ? <p className="text-sm font-semibold text-slate-500">{t("deals.noTasks")}</p> : null}
              </div>
              <Button size="sm" className="mt-3" onClick={() => onAddTask(deal)}><Plus size={14} /> {t("deals.add")}</Button>
            </PanelBlock>
          </div>
        ) : null}

        {tab === "history" ? (
          <PanelBlock title={t("deals.timeline")} icon={CalendarClock}>
            <DealTimeline events={timeline} emptyText={t("deals.emptyDealHistory")} />
            <textarea className="mt-4 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Добавить комментарий" />
            <p className="mt-3 text-sm text-slate-500">{selectedLead ? t("deals.leadLine", { value: `#${selectedLead.id} · ${selectedLead.status}` }) : t("deals.notLinked")}</p>
          </PanelBlock>
        ) : null}
      </div>
    </article>
  );
}
