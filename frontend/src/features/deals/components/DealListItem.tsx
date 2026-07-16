import { memo } from "react";
import { CalendarClock, MessageCircle } from "lucide-react";

import { cn } from "../../../lib/cn";
import { formatDate, formatDateTime } from "../../../lib/format";
import type { DealRow, Translate } from "../types";
import { DealAmount } from "./common/DealAmount";

export const DealListItem = memo(function DealListItem({
  deal,
  selected,
  onOpen,
  onMore,
  t,
}: {
  deal: DealRow;
  selected: boolean;
  onOpen: (deal: DealRow) => void;
  onMore: (deal: DealRow) => void;
  t: Translate;
}) {
  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(deal.id))}
      className={cn(
        "group relative rounded-lg border bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.035)] transition duration-150 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]",
        selected && "border-brand-500 shadow-md ring-2 ring-brand-100",
        !selected && "border-slate-200",
      )}
    >
      <div className="flex items-start">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(deal)} onDoubleClick={() => onMore(deal)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: deal.stageEntity?.color || "#d96718" }} />
                <h3 className="min-w-0 truncate text-[13px] font-black leading-5 text-slate-950">{deal.title}</h3>
              </div>
              <p className="mt-0.5 truncate pl-3 text-[11px] font-semibold text-slate-500">{deal.clientEntity?.full_name || t("deals.clientMissing")}</p>
            </div>
            <span className="h-6 w-6 shrink-0 rounded-full bg-brand-50 text-center text-[11px] font-black leading-6 text-brand-700">
              {(deal.ownerEntity?.user.full_name || deal.ownerEntity?.user.email || "Z").slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 pl-3">
            <DealAmount value={deal.amount} currency={deal.currency} className="text-[12px] font-black text-slate-950" />
            <span className="text-slate-300">·</span>
            <span className="truncate text-[11px] font-semibold text-slate-500">{deal.status}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 pl-3 text-[11px] font-semibold text-slate-500">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarClock size={13} /> <span className="truncate">{deal.nextTask ? formatDateTime(deal.nextTask.due_at) : formatDate(deal.created_at)}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-brand-700">
              <MessageCircle size={13} /> {deal.nextTask ? 1 : 0}
            </span>
          </div>
        </button>
      </div>
    </article>
  );
});
