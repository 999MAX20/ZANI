import {
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  SquareArrowOutUpRight,
  UserRound,
} from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { formatDateTime } from "../../../lib/format";
import type { DealRow, Translate } from "../types";
import { money, sourceLabel, stageProbability } from "../utils/dealHelpers";
import { DealRiskIndicator } from "./common/DealRiskIndicator";
import { DealStageBadge, StatusPill } from "./common/DealStageBadge";

export function DealQuickInspector({
  deal,
  taskCount,
  conversationCount,
  t,
  onOpen,
  onCreateTask,
}: {
  deal: DealRow | null;
  taskCount: number;
  conversationCount: number;
  t: Translate;
  onOpen: (deal: DealRow) => void;
  onCreateTask: (deal: DealRow) => void;
}) {
  if (!deal) {
    return (
      <div className="grid min-h-[260px] place-items-center p-4 text-center">
        <div>
          <p className="text-sm font-bold text-zani-text">
            {t("deals.selectDeal")}
          </p>
          <p className="mt-1 text-sm font-semibold text-zani-muted">
            {t("deals.selectDealText")}
          </p>
        </div>
      </div>
    );
  }

  const owner =
    deal.ownerEntity?.user.full_name ||
    deal.ownerEntity?.user.email ||
    t("clients.unassigned");
  const probability = stageProbability(deal, deal.stageEntity);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-zani-border p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zani-muted">
              {t("deals.deal")}
            </p>
            <h2 className="mt-1 truncate text-base font-bold text-zani-text">
              {deal.title}
            </h2>
          </div>
          <StatusPill status={deal.status} t={t} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <DealStageBadge
            stage={deal.stageEntity}
            fallback={t("deals.noStage")}
          />
          <DealRiskIndicator deal={deal} compact t={t} />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <section className="rounded-card border border-zani-border bg-surface-muted p-3">
          <p className="text-xs font-semibold text-zani-muted">
            {t("deals.nextAction")}
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-zani-text">
            {deal.nextTask?.title || t("deals.noNearestStepText")}
          </p>
          <p className="mt-1 text-xs font-semibold text-zani-muted">
            {deal.nextTask?.due_at
              ? formatDateTime(deal.nextTask.due_at)
              : t("deals.noTasksFilter")}
          </p>
        </section>

        <div className="grid gap-2">
          <MetaRow
            icon={BriefcaseBusiness}
            label={t("deals.amount")}
            value={money(deal.amount, deal.currency)}
          />
          <MetaRow icon={UserRound} label={t("deals.manager")} value={owner} />
          <MetaRow
            icon={CalendarClock}
            label={t("deals.closing")}
            value={
              deal.expected_close_at
                ? formatDateTime(deal.expected_close_at)
                : t("common.today")
            }
          />
          <MetaRow
            icon={ClipboardList}
            label={t("deals.source")}
            value={sourceLabel(deal.source, t)}
          />
        </div>

        <section className="rounded-card border border-zani-border bg-surface-card p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-zani-muted">
            <span>{t("deals.probability")}</span>
            <span>{probability}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-surface-muted">
            <div
              className="h-2 rounded-full bg-brand-600"
              style={{ width: `${Math.max(4, Math.min(100, probability))}%` }}
            />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <RelatedStat value={taskCount} label={t("nav.tasks")} />
          <RelatedStat
            value={conversationCount}
            label={t("nav.conversations")}
          />
        </div>
      </div>

      <div className="grid gap-2 border-t border-zani-border p-4">
        <Button type="button" onClick={() => onOpen(deal)}>
          <SquareArrowOutUpRight size={16} />
          {t("deals.openDeal")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onCreateTask(deal)}
        >
          <ClipboardList size={16} />
          {t("deals.createTask")}
        </Button>
      </div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-control border border-zani-border bg-surface-card px-3 py-2">
      <Icon size={16} className="shrink-0 text-zani-muted" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-zani-muted">{label}</p>
        <p className="truncate text-sm font-bold text-zani-text">{value}</p>
      </div>
    </div>
  );
}

function RelatedStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 rounded-control bg-surface-muted p-2">
      <p className="text-base font-bold text-zani-text">{value}</p>
      <p className="truncate text-[11px] font-semibold text-zani-muted">
        {label}
      </p>
    </div>
  );
}
