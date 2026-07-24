import type { InboxConversation, InboxFilters } from "../../../api/inbox";
import type { InboxSummary } from "../../../api/inbox";
import { Link } from "react-router-dom";
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
  onRetryLastMessage: (conversation: InboxConversation) => void;
  retryingMessageId?: number | null;
  priorityActions: InboxSummary["next_actions"];
  unavailableChannelCount: number;
  canViewIntegrations: boolean;
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
  onRetryLastMessage,
  retryingMessageId,
  priorityActions,
  unavailableChannelCount,
  canViewIntegrations,
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

      {priorityActions.length ? (
        <div className="space-y-2 border-b border-zani-border bg-surface-warm px-3 py-3" data-testid="inbox-priority-actions">
          {priorityActions.slice(0, 3).map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              to={action.href}
              className="flex min-h-9 items-center justify-between gap-2 rounded-control border border-zani-border bg-surface-card px-3 text-xs font-bold text-zani-text transition hover:border-brand-100 hover:bg-brand-50"
            >
              <span className="truncate">{action.label}</span>
              <span className="shrink-0 text-brand-700">{t("conversations.openPriority")}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {unavailableChannelCount ? (
        <div className="border-b border-[rgba(183,121,31,0.22)] bg-[var(--zani-warning-soft)] px-3 py-2 text-xs font-semibold text-zani-warning" data-testid="inbox-provider-unavailable">
          <p>{t("conversations.channelsUnavailable", { count: unavailableChannelCount })}</p>
          {canViewIntegrations ? (
            <Link className="mt-1 inline-flex font-bold underline" to="/app/integrations">
              {t("conversations.openIntegrations")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {items.length ? (
        <div className="border-b border-zani-border px-3 py-2">
          {!bulkMode ? (
            <button type="button" className="text-xs font-bold text-brand-600" onClick={onSelectVisible}>
              {t("conversations.selectMultiple")}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-zani-text">{t("conversations.selectedCount", { count: selectedIds.length })}</p>
                <button type="button" className="text-sm font-bold text-zani-muted transition hover:text-zani-text" onClick={onResetBulk}>
                  {t("common.cancel")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="h-8 rounded-control px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("markRead")} isLoading={bulkPending}>
                  {t("conversations.markRead")}
                </Button>
                <Button className="h-8 rounded-control px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("assign")} isLoading={bulkPending}>
                  {t("conversations.take")}
                </Button>
                <Button className="h-8 rounded-control px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("pauseBot")} isLoading={bulkPending}>
                  {t("conversations.pause")}
                </Button>
                <Button className="h-8 rounded-control px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("handoff")} isLoading={bulkPending}>
                  {t("conversations.operator")}
                </Button>
                <Button className="h-8 rounded-control px-3 text-xs" variant="secondary" disabled={!selectedIds.length} onClick={() => onBulkAction("close")} isLoading={bulkPending}>
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
            onRetryLastMessage={() => onRetryLastMessage(conversation)}
            retryPending={Boolean(conversation.last_message?.id && retryingMessageId === conversation.last_message.id)}
            t={t}
          />
        ))}
      </div>
    </WorkQueueListPane>
  );
}
