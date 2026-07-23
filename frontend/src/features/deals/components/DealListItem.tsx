import { memo } from "react";
import {
  CalendarClock,
  MessageCircle,
  SquareArrowOutUpRight,
} from "lucide-react";

import { cn } from "../../../lib/cn";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { DealRow, Translate } from "../types";
import { DealAmount } from "./common/DealAmount";
import { DealRiskIndicator } from "./common/DealRiskIndicator";

export const DealListItem = memo(function DealListItem({
  deal,
  selected,
  onSelect,
  onOpen,
  t,
}: {
  deal: DealRow;
  selected: boolean;
  onSelect: (deal: DealRow) => void;
  onOpen: (deal: DealRow) => void;
  onMore: (deal: DealRow) => void;
  t: Translate;
}) {
  const ownerInitial = (
    deal.ownerEntity?.user.full_name ||
    deal.ownerEntity?.user.email ||
    "Z"
  )
    .slice(0, 1)
    .toUpperCase();

  return (
    <article
      draggable
      onDragStart={(event) =>
        event.dataTransfer.setData("text/plain", String(deal.id))
      }
      className={cn(
        "group relative rounded-card border bg-surface-card p-3 shadow-soft transition duration-150 hover:border-brand-100 hover:bg-surface-warm hover:shadow-card",
        selected &&
          "border-brand-300 bg-brand-50/70 shadow-card ring-2 ring-[var(--zani-focus-ring)]",
        !selected && "border-zani-border",
      )}
    >
      <div className="flex items-start">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onSelect(deal)}
          onDoubleClick={() => onOpen(deal)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: deal.stageEntity?.color || "#FF7A1A",
                  }}
                />
                <h3 className="min-w-0 truncate text-[13px] font-bold leading-5 text-zani-text">
                  {deal.title}
                </h3>
              </div>
              <p className="mt-0.5 truncate pl-3 text-[11px] font-semibold text-zani-muted">
                {deal.clientEntity?.full_name || t("deals.clientMissing")}
              </p>
            </div>
            <span className="h-6 w-6 shrink-0 rounded-full bg-surface-muted text-center text-[11px] font-bold leading-6 text-brand-700 ring-1 ring-zani-border">
              {ownerInitial}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1.5 pl-3">
            <DealAmount
              value={deal.amount}
              currency={deal.currency}
              className="text-[12px] font-bold text-zani-text"
            />
            <span className="text-zani-muted">В·</span>
            <span className="truncate text-[11px] font-semibold text-zani-muted">
              {deal.stageEntity?.name || deal.status}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 pl-3 text-[11px] font-semibold text-zani-muted">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarClock size={13} />
              <span className="truncate">
                {deal.nextTask
                  ? deal.nextTask.title
                  : formatDate(deal.created_at)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-zani-muted">
              <MessageCircle size={13} /> {deal.nextTask ? 1 : 0}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 pl-3">
            <DealRiskIndicator deal={deal} compact t={t} />
            <span className="truncate text-[11px] font-semibold text-zani-muted">
              {deal.nextTask?.due_at
                ? formatDateTime(deal.nextTask.due_at)
                : t("deals.noTasksFilter")}
            </span>
          </div>
        </button>

        <button
          type="button"
          data-testid="deal-card-action-open"
          className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zani-muted opacity-100 transition hover:bg-brand-50 hover:text-brand-700 md:opacity-0 md:group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(deal);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          aria-label={t("deals.openDeal")}
        >
          <SquareArrowOutUpRight size={16} />
        </button>
      </div>
    </article>
  );
});
