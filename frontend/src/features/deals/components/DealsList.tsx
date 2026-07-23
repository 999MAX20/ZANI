import { ChevronDown, FolderSearch, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { CRM_TABLE_ROW_HEIGHT } from "../../../components/crm";
import { cn } from "../../../lib/cn";
import { formatDate } from "../../../lib/format";
import type { DealRow, DealViewMode, Translate } from "../types";
import { DealAmount } from "./common/DealAmount";
import { DealRiskIndicator } from "./common/DealRiskIndicator";
import { DealStageBadge } from "./common/DealStageBadge";
import { DealListItem } from "./DealListItem";
import { money } from "../utils/dealHelpers";

type StageGroup = { id: string; name: string; color: string; rows: DealRow[] };
const stageFallbackColors = [
  "#FF7A1A",
  "#B7791F",
  "#15803D",
  "#0E7490",
  "#6F4CC3",
  "#C2410C",
];

function EmptyDeals({
  hasFilters,
  onCreate,
  onResetFilters,
  t,
}: {
  hasFilters: boolean;
  onCreate: () => void;
  onResetFilters: () => void;
  t: Translate;
}) {
  return (
    <div className="grid min-h-[340px] place-items-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-card bg-surface-muted text-zani-muted">
          <FolderSearch size={26} />
        </div>
        <p className="mt-4 text-lg font-bold text-zani-text">
          {t("deals.notFoundTitle")}
        </p>
        <p className="mt-2 text-sm leading-6 text-zani-muted">
          {t("deals.notFoundText")}
        </p>
        <Button
          className="mt-4"
          variant={hasFilters ? "secondary" : "primary"}
          onClick={hasFilters ? onResetFilters : onCreate}
        >
          {hasFilters ? t("tasks.resetFilters") : (
            <>
              <Plus size={16} /> {t("deals.create")}
            </>
          )}
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
  onSelect,
  onCheck,
  onSelectAll,
  onCreate,
  hasFilters,
  onResetFilters,
  onMore,
  onStageChange,
  hasMoreByStage,
  onLoadMoreStage,
  isLoadingMore,
  t,
}: {
  rows: DealRow[];
  viewMode: DealViewMode;
  stages: Array<{ id: number; name: string }>;
  selectedDealId?: number | null;
  selectedIds: number[];
  onOpen: (deal: DealRow) => void;
  onSelect: (deal: DealRow) => void;
  onCheck: (deal: DealRow) => void;
  onSelectAll: () => void;
  onCreate: () => void;
  hasFilters: boolean;
  onResetFilters: () => void;
  onMore: (deal: DealRow) => void;
  onStageChange: (deal: DealRow, stageId: number) => void;
  hasMoreByStage?: Map<string, boolean>;
  onLoadMoreStage?: (stageId: string) => void;
  isLoadingMore?: boolean;
  t: Translate;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [visibleByStage, setVisibleByStage] = useState<Record<string, number>>(
    {},
  );
  const dealMap = useMemo(
    () => new Map(rows.map((deal) => [deal.id, deal])),
    [rows],
  );
  const groups = useMemo<StageGroup[]>(() => {
    const active = stages.map((stage, index) => ({
      id: String(stage.id),
      name: stage.name,
      color:
        "color" in stage && stage.color
          ? String(stage.color)
          : stageFallbackColors[index % stageFallbackColors.length],
      rows: rows.filter((deal) => deal.stage === stage.id),
    }));
    const withoutStage = rows.filter(
      (deal) => !stages.some((stage) => stage.id === deal.stage),
    );
    return withoutStage.length
      ? [
          ...active,
          {
            id: "none",
            name: t("deals.noStage"),
            color: "#8A7B70",
            rows: withoutStage,
          },
        ]
      : active;
  }, [rows, stages, t]);

  if (!rows.length)
    return (
      <EmptyDeals
        hasFilters={hasFilters}
        onCreate={onCreate}
        onResetFilters={onResetFilters}
        t={t}
      />
    );

  if (viewMode === "table") {
    return (
      <div className="min-h-0 overflow-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-surface-muted text-xs font-semibold text-zani-muted">
            <tr className="h-10">
              <th className="w-12 border-b border-zani-border px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.length === rows.length}
                  onChange={onSelectAll}
                />
              </th>
              <th className="border-b border-zani-border px-3 py-2">
                {t("deals.deal")}
              </th>
              <th className="border-b border-zani-border px-3 py-2">
                {t("deals.client")}
              </th>
              <th className="border-b border-zani-border px-3 py-2">
                {t("deals.amount")}
              </th>
              <th className="border-b border-zani-border px-3 py-2">
                {t("deals.stage")}
              </th>
              <th className="border-b border-zani-border px-3 py-2">
                {t("deals.risk")}
              </th>
              <th className="border-b border-zani-border px-3 py-2">
                {t("deals.date")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((deal) => (
              <tr
                key={deal.id}
                className={cn(
                  "cursor-pointer hover:bg-surface-warm",
                  selectedDealId === deal.id && "bg-brand-50",
                )}
                style={{ minHeight: CRM_TABLE_ROW_HEIGHT }}
                onClick={() => onSelect(deal)}
              >
                <td className="border-b border-zani-border px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(deal.id)}
                    onChange={() => onCheck(deal)}
                  />
                </td>
                <td
                  className="border-b border-zani-border px-3 py-2 font-bold text-zani-text"
                  onDoubleClick={() => onOpen(deal)}
                >
                  {deal.title}
                </td>
                <td className="border-b border-zani-border px-3 py-2 text-zani-muted">
                  {deal.clientEntity?.full_name || t("deals.clientMissing")}
                </td>
                <td className="border-b border-zani-border px-3 py-2">
                  <DealAmount value={deal.amount} currency={deal.currency} />
                </td>
                <td className="border-b border-zani-border px-3 py-2">
                  <DealStageBadge
                    stage={deal.stageEntity}
                    fallback={t("deals.noStage")}
                  />
                </td>
                <td className="border-b border-zani-border px-3 py-2">
                  <DealRiskIndicator deal={deal} compact t={t} />
                </td>
                <td className="border-b border-zani-border px-3 py-2 text-zani-muted">
                  {formatDate(deal.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (viewMode === "kanban") {
    return (
      <div className="grid min-h-[560px] auto-cols-[256px] grid-flow-col gap-3 overflow-x-auto p-3 lg:auto-cols-[276px] lg:gap-4 lg:p-3 xl:auto-cols-[292px]">
        {groups.map((group) => (
          <section
            key={group.id}
            className="flex min-h-[560px] flex-col overflow-hidden rounded-card border border-zani-border bg-surface-muted shadow-soft"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const deal = dealMap.get(
                Number(event.dataTransfer.getData("text/plain")),
              );
              if (deal && group.id !== "none")
                onStageChange(deal, Number(group.id));
            }}
          >
            <header className="bg-surface-card p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-bold text-zani-text">
                    {group.name}
                  </h3>
                  <p className="mt-2 text-[13px] font-bold text-zani-text">
                    {money(
                      group.rows.reduce(
                        (sum, deal) => sum + Number(deal.amount || 0),
                        0,
                      ),
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-bold text-zani-text ring-1 ring-zani-border">
                  {group.rows.length}
                </span>
              </div>
              <div className="mt-3 h-0.5 rounded-full bg-surface-muted">
                <div
                  className="h-0.5 rounded-full"
                  style={{
                    width: group.rows.length ? "62%" : "18%",
                    backgroundColor: group.color,
                  }}
                />
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-surface-muted p-2.5">
              {group.rows
                .slice(0, visibleByStage[group.id] || 10)
                .map((deal) => (
                  <DealListItem
                    key={deal.id}
                    deal={deal}
                    selected={selectedDealId === deal.id}
                    onSelect={onSelect}
                    onOpen={onOpen}
                    onMore={onMore}
                    t={t}
                  />
                ))}
              {(() => {
                const visibleCount = visibleByStage[group.id] || 10;
                const hiddenCount = Math.max(
                  group.rows.length - visibleCount,
                  0,
                );
                const canLoadMore = Boolean(hasMoreByStage?.get(group.id));
                if (!hiddenCount && !canLoadMore) return null;
                return (
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-2 text-left text-xs font-bold text-brand-700 hover:bg-brand-50"
                    disabled={isLoadingMore}
                    onClick={() => {
                      if (hiddenCount)
                        setVisibleByStage((state) => ({
                          ...state,
                          [group.id]: (state[group.id] || 10) + 10,
                        }));
                      else onLoadMoreStage?.(group.id);
                    }}
                  >
                    +{" "}
                    {t("deals.moreDeals", {
                      count: Math.min(10, hiddenCount || 10),
                    })}
                  </button>
                );
              })()}
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
          className="mb-3 rounded-card border border-zani-border bg-surface-card shadow-card"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const deal = dealMap.get(
              Number(event.dataTransfer.getData("text/plain")),
            );
            if (deal && group.id !== "none")
              onStageChange(deal, Number(group.id));
          }}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 p-3 text-left"
            onClick={() =>
              setCollapsed((state) => ({
                ...state,
                [group.id]: !state[group.id],
              }))
            }
          >
            <span className="font-bold text-zani-text">{group.name}</span>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-zani-muted">
              {group.rows.length}
              <ChevronDown
                size={16}
                className={cn(
                  "transition",
                  collapsed[group.id] && "-rotate-90",
                )}
              />
            </span>
          </button>
          {!collapsed[group.id] ? (
            <div className="space-y-2 px-2 pb-2">
              {group.rows.map((deal) => (
                <DealListItem
                  key={deal.id}
                  deal={deal}
                  selected={selectedDealId === deal.id}
                  onSelect={onSelect}
                  onOpen={onOpen}
                  onMore={onMore}
                  t={t}
                />
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
