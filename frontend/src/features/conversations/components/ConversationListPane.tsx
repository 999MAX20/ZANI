import type { InboxConversation, InboxFilters } from "../../../api/inbox";
import { WorkQueueListPane } from "../../../components/layout/WorkQueueLayout";
import { Button } from "../../../components/ui/Button";
import { EmptyState, LoadingState } from "../../../components/ui/StateViews";
import type { InboxSort, Translate } from "../conversationTypes";
import { ConversationItem } from "./ConversationItem";
import { ConversationQueueFilters } from "./ConversationQueueFilters";

type FilterOption = { value: string; label: string };
type AgentFilterOption = { value: string | number; label: string };

type ConversationListPaneProps = {
  mobileThreadOpen: boolean;
  filters: InboxFilters;
  sortBy: InboxSort;
  hasActiveFilters: boolean;
  activeFilterSummary: string[];
  queueFilterOptions: FilterOption[];
  ownerFilterOptions: FilterOption[];
  agentFilterOptions: AgentFilterOption[];
  channelOptions: FilterOption[];
  priorityOptions: FilterOption[];
  statusOptions: FilterOption[];
  sortOptions: FilterOption[];
  onQueueChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onFilterChange: (filters: InboxFilters) => void;
  onSortChange: (value: string) => void;
  onReset: () => void;
  items: InboxConversation[];
  sortedItems: InboxConversation[];
  selectedId?: number | null;
  loading: boolean;
  bulkMode: boolean;
  selectedIds: number[];
  onSelectVisible: () => void;
  onResetBulk: () => void;
  onBulkAction: (action: "markRead" | "assign" | "handoff" | "pauseBot" | "close") => void;
  bulkPending: boolean;
  onToggleBulkId: (id: number) => void;
  onSelectConversation: (id: number) => void;
  t: Translate;
};

export function ConversationListPane({
  mobileThreadOpen,
  filters,
  sortBy,
  hasActiveFilters,
  activeFilterSummary,
  queueFilterOptions,
  ownerFilterOptions,
  agentFilterOptions,
  channelOptions,
  priorityOptions,
  statusOptions,
  sortOptions,
  onQueueChange,
  onOwnerChange,
  onFilterChange,
  onSortChange,
  onReset,
  items,
  sortedItems,
  selectedId,
  loading,
  bulkMode,
  selectedIds,
  onSelectVisible,
  onResetBulk,
  onBulkAction,
  bulkPending,
  onToggleBulkId,
  onSelectConversation,
  t,
}: ConversationListPaneProps) {
  return (
    <WorkQueueListPane mobileDetailOpen={mobileThreadOpen}>
      <ConversationQueueFilters
        filters={filters}
        sortBy={sortBy}
        hasActiveFilters={hasActiveFilters}
        activeFilterSummary={activeFilterSummary}
        queueOptions={queueFilterOptions}
        ownerOptions={ownerFilterOptions}
        agentOptions={agentFilterOptions}
        channelOptions={channelOptions}
        priorityOptions={priorityOptions}
        statusOptions={statusOptions}
        sortOptions={sortOptions}
        labels={{
          filters: t("conversations.filters"),
          advancedFilters: t("conversations.advancedFilters"),
          resetFilters: t("conversations.resetFilters"),
          agent: t("conversations.agent"),
          channel: t("conversations.channel"),
          priority: t("conversations.priority"),
          status: t("conversations.status"),
          bot: t("conversations.bot"),
          sort: t("conversations.sort"),
          noFilter: t("conversations.noFilter"),
          botEnabled: t("conversations.botActive"),
          botPaused: t("conversations.botPaused"),
        }}
        onQueueChange={onQueueChange}
        onOwnerChange={onOwnerChange}
        onFilterChange={onFilterChange}
        onSortChange={onSortChange}
        onReset={onReset}
      />

      {items.length ? (
        <div className="border-b border-slate-100 px-3 py-2">
          {!bulkMode ? (
            <button type="button" className="text-xs font-black text-brand-600" onClick={onSelectVisible}>
              {t("conversations.selectMultiple")}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-midnight">{t("conversations.selectedCount", { count: selectedIds.length })}</p>
                <button type="button" className="text-sm font-black text-slate-400" onClick={onResetBulk}>
                  {t("common.cancel")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("markRead")} isLoading={bulkPending}>
                  {t("conversations.markRead")}
                </Button>
                <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("assign")} isLoading={bulkPending}>
                  {t("conversations.take")}
                </Button>
                <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("pauseBot")} isLoading={bulkPending}>
                  {t("conversations.pause")}
                </Button>
                <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("handoff")} isLoading={bulkPending}>
                  {t("conversations.operator")}
                </Button>
                <Button className="h-8 rounded-lg px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("close")} isLoading={bulkPending}>
                  {t("common.close")}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pb-28 lg:pb-0">
        {loading ? <div className="p-5"><LoadingState label={t("conversations.loadingDialogs")} /></div> : null}
        {!loading && !items.length ? (
          <div className="p-5">
            <EmptyState title={t("conversations.emptyTitle")} description={t("conversations.emptyText")} />
          </div>
        ) : null}
        {sortedItems.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === selectedId}
            selectable={bulkMode}
            selectedForBulk={selectedIds.includes(conversation.id)}
            onToggleSelected={() => onToggleBulkId(conversation.id)}
            onClick={() => onSelectConversation(conversation.id)}
            t={t}
          />
        ))}
      </div>
    </WorkQueueListPane>
  );
}
