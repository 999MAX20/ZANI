import { ChevronDown, FolderSearch, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";
import { formatDate } from "../../../lib/format";
import type { DealRow, DealViewMode, Translate } from "../types";
import { DealAmount } from "./common/DealAmount";
import { DealRiskIndicator } from "./common/DealRiskIndicator";
import { DealStageBadge } from "./common/DealStageBadge";
import { DealListItem } from "./DealListItem";

type StageGroup = { id: string; name: string; rows: DealRow[] };

function EmptyDeals({ onCreate, t }: { onCreate: () => void; t: Translate }) {
  return (
    <div className="grid min-h-[340px] place-items-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <FolderSearch size={26} />
        </div>
        <p className="mt-4 text-lg font-black text-midnight">{t("deals.notFoundTitle")}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t("deals.notFoundText")}</p>
        <Button className="mt-4" onClick={onCreate}>
          <Plus size={16} /> {t("deals.create")}
        </Button>
      </div>
    </div>
  );
}

export function DealsList({
  rows,
  viewMode,
  stages,
  selectedDealId,
  selectedIds,
  onOpen,
  onCheck,
  onSelectAll,
  onCreate,
  onTask,
  onMore,
  onStageChange,
  t,
}: {
  rows: DealRow[];
  viewMode: DealViewMode;
  stages: Array<{ id: number; name: string }>;
  selectedDealId?: number | null;
  selectedIds: number[];
  onOpen: (deal: DealRow) => void;
  onCheck: (deal: DealRow) => void;
  onSelectAll: () => void;
  onCreate: () => void;
  onTask: (deal: DealRow) => void;
  onMore: (deal: DealRow) => void;
  onStageChange: (deal: DealRow, stageId: number) => void;
  t: Translate;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const dealMap = useMemo(() => new Map(rows.map((deal) => [deal.id, deal])), [rows]);
  const groups = useMemo<StageGroup[]>(() => {
    const active = stages.map((stage) => ({ id: String(stage.id), name: stage.name, rows: rows.filter((deal) => deal.stage === stage.id) }));
    const withoutStage = rows.filter((deal) => !stages.some((stage) => stage.id === deal.stage));
    return withoutStage.length ? [...active, { id: "none", name: t("deals.noStage"), rows: withoutStage }] : active;
  }, [rows, stages, t]);

  if (!rows.length) return <EmptyDeals onCreate={onCreate} t={t} />;

  if (viewMode === "table") {
    return (
      <div className="min-h-0 overflow-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-12 border-b border-slate-200 p-3"><input type="checkbox" checked={selectedIds.length === rows.length} onChange={onSelectAll} /></th>
              <th className="border-b border-slate-200 p-3">Сделка</th>
              <th className="border-b border-slate-200 p-3">Клиент</th>
              <th className="border-b border-slate-200 p-3">Сумма</th>
              <th className="border-b border-slate-200 p-3">Стадия</th>
              <th className="border-b border-slate-200 p-3">Риск</th>
              <th className="border-b border-slate-200 p-3">Дата</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((deal) => (
              <tr key={deal.id} className={cn("cursor-pointer hover:bg-blue-50/40", selectedDealId === deal.id && "bg-blue-50")}>
                <td className="border-b border-slate-100 p-3"><input type="checkbox" checked={selectedIds.includes(deal.id)} onChange={() => onCheck(deal)} /></td>
                <td className="border-b border-slate-100 p-3 font-black text-midnight" onClick={() => onOpen(deal)}>{deal.title}</td>
                <td className="border-b border-slate-100 p-3 text-slate-600">{deal.clientEntity?.full_name || t("deals.clientMissing")}</td>
                <td className="border-b border-slate-100 p-3"><DealAmount value={deal.amount} currency={deal.currency} /></td>
                <td className="border-b border-slate-100 p-3"><DealStageBadge stage={deal.stageEntity} fallback={t("deals.noStage")} /></td>
                <td className="border-b border-slate-100 p-3"><DealRiskIndicator deal={deal} compact /></td>
                <td className="border-b border-slate-100 p-3 text-slate-500">{formatDate(deal.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (viewMode === "kanban") {
    return (
      <div className="grid min-h-0 auto-cols-[300px] grid-flow-col gap-3 overflow-x-auto p-3">
        {groups.map((group) => (
          <section
            key={group.id}
            className="flex max-h-[calc(100vh-320px)] min-h-[420px] flex-col rounded-xl border border-slate-200 bg-slate-50"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const deal = dealMap.get(Number(event.dataTransfer.getData("text/plain")));
              if (deal && group.id !== "none") onStageChange(deal, Number(group.id));
            }}
          >
            <header className="flex items-center justify-between border-b border-slate-200 p-3">
              <h3 className="font-black text-midnight">{group.name}</h3>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500">{group.rows.length}</span>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {group.rows.map((deal) => (
                <DealListItem key={deal.id} deal={deal} selected={selectedDealId === deal.id} checked={selectedIds.includes(deal.id)} onOpen={onOpen} onCheck={onCheck} onTask={onTask} onMore={onMore} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {groups.map((group) => (
        <section
          key={group.id}
          className="mb-3 rounded-xl border border-slate-200 bg-slate-50"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const deal = dealMap.get(Number(event.dataTransfer.getData("text/plain")));
            if (deal && group.id !== "none") onStageChange(deal, Number(group.id));
          }}
        >
          <button type="button" className="flex w-full items-center justify-between gap-3 p-3 text-left" onClick={() => setCollapsed((state) => ({ ...state, [group.id]: !state[group.id] }))}>
            <span className="font-black text-midnight">{group.name}</span>
            <span className="inline-flex items-center gap-2 text-xs font-black text-slate-500">
              {group.rows.length}
              <ChevronDown size={16} className={cn("transition", collapsed[group.id] && "-rotate-90")} />
            </span>
          </button>
          {!collapsed[group.id] ? (
            <div className="space-y-2 px-2 pb-2">
              {group.rows.map((deal) => (
                <DealListItem key={deal.id} deal={deal} selected={selectedDealId === deal.id} checked={selectedIds.includes(deal.id)} onOpen={onOpen} onCheck={onCheck} onTask={onTask} onMore={onMore} t={t} />
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
