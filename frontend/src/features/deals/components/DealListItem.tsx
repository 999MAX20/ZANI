import { memo } from "react";
import { CalendarClock, UserRound } from "lucide-react";

import { cn } from "../../../lib/cn";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { DealRow, Translate } from "../types";
import { DealAmount } from "./common/DealAmount";
import { DealRiskIndicator } from "./common/DealRiskIndicator";
import { DealStageBadge, StatusPill } from "./common/DealStageBadge";
import { QuickActions } from "./common/QuickActions";

export const DealListItem = memo(function DealListItem({
  deal,
  selected,
  checked,
  onOpen,
  onCheck,
  onTask,
  onMore,
  t,
}: {
  deal: DealRow;
  selected: boolean;
  checked: boolean;
  onOpen: (deal: DealRow) => void;
  onCheck: (deal: DealRow) => void;
  onTask: (deal: DealRow) => void;
  onMore: (deal: DealRow) => void;
  t: Translate;
}) {
  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(deal.id))}
      className={cn(
        "group rounded-xl border bg-white p-3 shadow-sm transition hover:bg-blue-50/30 hover:shadow-md",
        selected && "border-blue-500 shadow-md ring-2 ring-blue-100",
        !selected && "border-slate-200",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300"
          checked={checked}
          aria-label={`Выбрать ${deal.title}`}
          onChange={() => onCheck(deal)}
          onClick={(event) => event.stopPropagation()}
        />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(deal)} onDoubleClick={() => onMore(deal)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-midnight">{deal.title}</h3>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">{deal.clientEntity?.full_name || t("deals.clientMissing")}</p>
            </div>
            <DealAmount value={deal.amount} currency={deal.currency} className="text-base font-black text-midnight" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DealStageBadge stage={deal.stageEntity} fallback={t("deals.noStage")} />
            <StatusPill status={deal.status} />
            <DealRiskIndicator deal={deal} compact />
          </div>
          <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-3">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <UserRound size={14} /> <span className="truncate">{deal.ownerEntity?.user.full_name || deal.ownerEntity?.user.email || t("deals.unassigned")}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarClock size={14} /> <span className="truncate">{formatDate(deal.created_at)}</span>
            </span>
            <span className="truncate">{deal.nextTask ? `${deal.nextTask.title} · ${formatDateTime(deal.nextTask.due_at)}` : t("deals.noPlan")}</span>
          </div>
        </button>
        <QuickActions deal={deal} client={deal.clientEntity} onTask={onTask} onMore={onMore} />
      </div>
    </article>
  );
});
