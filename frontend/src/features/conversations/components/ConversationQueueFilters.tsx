import { MoreHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { InboxFilters } from "../../../api/inbox";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/cn";

type ConversationQueueFiltersProps = {
  filters: InboxFilters;
  sortBy: string;
  hasActiveFilters: boolean;
  activeFilterSummary: string[];
  queueOptions: Array<{ value: string; label: string }>;
  ownerOptions: Array<{ value: string; label: string }>;
  agentOptions: Array<{ value: string | number; label: string }>;
  channelOptions: Array<{ value: string; label: string }>;
  priorityOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: string; label: string }>;
  sortOptions: Array<{ value: string; label: string }>;
  labels: {
    filters: string;
    advancedFilters: string;
    resetFilters: string;
    agent: string;
    channel: string;
    priority: string;
    status: string;
    bot: string;
    sort: string;
    noFilter: string;
    botEnabled: string;
    botPaused: string;
  };
  onQueueChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onFilterChange: (next: InboxFilters) => void;
  onSortChange: (value: string) => void;
  onReset: () => void;
};

export function ConversationQueueFilters({
  filters,
  sortBy,
  hasActiveFilters,
  activeFilterSummary,
  queueOptions,
  ownerOptions,
  agentOptions,
  channelOptions,
  priorityOptions,
  statusOptions,
  sortOptions,
  labels,
  onQueueChange,
  onOwnerChange,
  onFilterChange,
  onSortChange,
  onReset,
}: ConversationQueueFiltersProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const queueValue = useMemo(() => {
    if (filters.status === "closed") return "closed";
    if (filters.bot_enabled === "false") return "paused";
    if (filters.handoff_required === "true") return "attention";
    if (filters.unread === "true") return "new";
    return "all";
  }, [filters.bot_enabled, filters.handoff_required, filters.status, filters.unread]);

  const ownerValue = filters.assigned_to || "all";
  const advancedCount = activeFilterSummary.length;

  return (
    <div className="relative border-b border-zani-border p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-2">
        <Select
          className="min-h-10 rounded-control px-2.5 text-xs font-bold text-zani-text"
          value={queueValue}
          onChange={(event) => onQueueChange(event.target.value)}
          options={queueOptions}
          aria-label={labels.filters}
        />
        <Select
          className="min-h-10 rounded-control px-2.5 text-xs font-bold text-zani-text"
          value={ownerValue}
          onChange={(event) => onOwnerChange(event.target.value)}
          options={ownerOptions}
          aria-label={labels.agent}
        />
        <button
          type="button"
          className={cn(
            "relative grid h-10 w-11 place-items-center rounded-control border border-zani-border bg-zani-card text-zani-muted shadow-sm transition hover:border-brand-200 hover:bg-surface-hover",
            isAdvancedOpen && "border-brand-200 bg-brand-50 text-brand-700",
          )}
          onClick={() => setIsAdvancedOpen((value) => !value)}
          aria-expanded={isAdvancedOpen}
          aria-label={labels.advancedFilters}
        >
          <MoreHorizontal size={18} />
          {advancedCount ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
              {advancedCount}
            </span>
          ) : null}
        </button>
      </div>

      {activeFilterSummary.length ? (
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {activeFilterSummary.slice(0, 3).map((label) => (
            <span key={label} className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-[10px] font-bold text-zani-muted">
              {label}
            </span>
          ))}
          {activeFilterSummary.length > 3 ? (
            <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-[10px] font-bold text-zani-muted">
              +{activeFilterSummary.length - 3}
            </span>
          ) : null}
          <button
            type="button"
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-brand-600 hover:bg-brand-50"
            onClick={onReset}
          >
            <X size={12} />
            {labels.resetFilters}
          </button>
        </div>
      ) : null}

      {isAdvancedOpen ? (
        <div className="absolute left-3 right-3 top-[calc(100%+8px)] z-40 rounded-card border border-zani-border bg-zani-card p-3 shadow-premium">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-zani-muted">{labels.advancedFilters}</p>
            {hasActiveFilters ? (
              <button type="button" className="text-xs font-bold text-brand-600" onClick={onReset}>
                {labels.resetFilters}
              </button>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Select
              label={labels.agent}
              className="min-h-10 rounded-control text-xs font-bold text-zani-text"
              value={filters.bot || ""}
              onChange={(event) => onFilterChange({ ...filters, bot: event.target.value || undefined })}
              options={agentOptions}
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                label={labels.channel}
                className="min-h-10 rounded-control text-xs font-bold text-zani-text"
                value={filters.channel || ""}
                onChange={(event) => onFilterChange({ ...filters, channel: event.target.value || undefined })}
                options={channelOptions}
              />
              <Select
                label={labels.priority}
                className="min-h-10 rounded-control text-xs font-bold text-zani-text"
                value={filters.priority || ""}
                onChange={(event) => onFilterChange({ ...filters, priority: event.target.value || undefined })}
                options={priorityOptions}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                label={labels.bot}
                className="min-h-10 rounded-control text-xs font-bold text-zani-text"
                value={filters.bot_enabled === "false" ? "false" : filters.bot_enabled === "true" ? "true" : "all"}
                onChange={(event) => {
                  const raw = event.target.value;
                  onFilterChange({ ...filters, bot_enabled: raw === "all" ? undefined : raw });
                }}
                options={[
                  { value: "all", label: labels.noFilter },
                  { value: "true", label: labels.botEnabled },
                  { value: "false", label: labels.botPaused },
                ]}
              />
              <Select
                label={labels.status}
                className="min-h-10 rounded-control text-xs font-bold text-zani-text"
                value={filters.status || "all"}
                onChange={(event) => {
                  const raw = event.target.value;
                  onFilterChange({ ...filters, status: raw === "all" ? "" : raw });
                }}
                options={statusOptions}
              />
            </div>
            <Select
              label={labels.sort}
              className="min-h-10 rounded-control text-xs font-bold text-zani-text"
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value)}
              options={sortOptions}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
