import type { Ref } from "react";
import {
  CheckCheck,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  UserCheck,
} from "lucide-react";

import type { InboxConversation, InboxMessage } from "../../../api/inbox";
import { WorkQueueDetailPane } from "../../../components/layout/WorkQueueLayout";
import { Button } from "../../../components/ui/Button";
import { EmptyState, LoadingState } from "../../../components/ui/StateViews";
import type { Translate } from "../conversationTypes";
import { channelLabel, conversationTitle } from "../conversationUtils";
import { ConversationComposer } from "./ConversationComposer";
import { Pill, Tooltip } from "./ConversationPrimitives";
import { MessageBubble } from "./MessageBubble";

type ConversationThreadPaneProps = {
  selected: InboxConversation | null;
  mobileThreadOpen: boolean;
  onMobileClose: () => void;
  messageScrollRef: Ref<HTMLDivElement>;
  messageEndRef: Ref<HTMLDivElement>;
  messagesLoading: boolean;
  messageList: InboxMessage[];
  canLoadMoreMessages: boolean;
  isFetchingNextPage: boolean;
  onLoadMoreMessages: () => void;
  onRetryMessage: (message: InboxMessage) => void;
  canRetryMessages: boolean;
  draft: string;
  composerRef: Ref<HTMLTextAreaElement>;
  sendPending: boolean;
  onDraftChange: (value: string) => void;
  onResizeComposer: () => void;
  onOpenQuickReplies: () => void;
  onSendReply: () => void;
  onAssign: () => void;
  assignPending: boolean;
  onToggleBot: () => void;
  toggleBotPending: boolean;
  onCloseConversation: () => void;
  closePending: boolean;
  onReopenConversation: () => void;
  reopenPending: boolean;
  t: Translate;
};

export function ConversationThreadPane({
  selected,
  mobileThreadOpen,
  onMobileClose,
  messageScrollRef,
  messageEndRef,
  messagesLoading,
  messageList,
  canLoadMoreMessages,
  isFetchingNextPage,
  onLoadMoreMessages,
  onRetryMessage,
  canRetryMessages,
  draft,
  composerRef,
  sendPending,
  onDraftChange,
  onResizeComposer,
  onOpenQuickReplies,
  onSendReply,
  onAssign,
  assignPending,
  onToggleBot,
  toggleBotPending,
  onCloseConversation,
  closePending,
  onReopenConversation,
  reopenPending,
  t,
}: ConversationThreadPaneProps) {
  return (
    <WorkQueueDetailPane
      mobileDetailOpen={mobileThreadOpen}
      closeLabel={t("common.close")}
      onMobileClose={onMobileClose}
    >
      {!selected ? (
        <div className="grid flex-1 place-items-center p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-card bg-zani-card text-brand-600 shadow-sm">
              <MessageSquare aria-hidden="true" size={26} />
            </div>
            <p className="text-2xl font-bold text-zani-muted">
              {t("conversations.selectDialog")}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-zani-border bg-zani-card px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-bold text-zani-text">
                    {conversationTitle(selected, t)}
                  </h2>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Pill className="bg-brand-50 text-brand-700 ring-brand-100">
                    {channelLabel(selected.channel, t)}
                  </Pill>
                  {selected.bot_enabled ? (
                    <Pill className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                      {t("conversations.botActive")}
                    </Pill>
                  ) : (
                    <Pill className="bg-surface-muted text-zani-muted ring-zani-border">
                      {t("conversations.botPaused")}
                    </Pill>
                  )}
                  {selected.handoff_required ? (
                    <Pill className="bg-amber-50 text-amber-700 ring-amber-200">
                      {t("conversations.needsOperator")}
                    </Pill>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Tooltip label={t("conversations.assignTooltip")}>
                  <Button
                    data-conversation-action-id="assign"
                    className="h-9 rounded-control px-3 text-xs"
                    variant="secondary"
                    disabled={!selected}
                    onClick={onAssign}
                    isLoading={assignPending}
                    aria-label={t("conversations.takeDialog")}
                  >
                    <UserCheck size={16} /> {t("conversations.takeDialog")}
                  </Button>
                </Tooltip>
                <Tooltip
                  label={
                    selected.bot_enabled
                      ? t("conversations.pauseBotTooltip")
                      : t("conversations.enableBotTooltip")
                  }
                >
                  <Button
                    data-conversation-action-id="toggle-bot"
                    className="h-9 rounded-control px-3 text-xs"
                    variant="secondary"
                    disabled={!selected}
                    onClick={onToggleBot}
                    isLoading={toggleBotPending}
                    aria-label={
                      selected.bot_enabled
                        ? t("conversations.pauseBot")
                        : t("conversations.enableBot")
                    }
                  >
                    {selected.bot_enabled ? (
                      <PauseCircle size={16} />
                    ) : (
                      <PlayCircle size={16} />
                    )}
                    {selected.bot_enabled
                      ? t("conversations.pauseBot")
                      : t("conversations.enableBot")}
                  </Button>
                </Tooltip>
                {selected.status === "closed" ? (
                  <Tooltip label={t("conversations.reopenTooltip")}>
                    <Button
                      data-conversation-action-id="reopen"
                      className="h-9 rounded-control px-3 text-xs"
                      variant="secondary"
                      onClick={onReopenConversation}
                      isLoading={reopenPending}
                      aria-label={t("conversations.openDialog")}
                    >
                      <PlayCircle size={16} /> {t("common.open")}
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip label={t("conversations.closeTooltip")}>
                    <Button
                      data-conversation-action-id="close"
                      className="h-9 rounded-control px-3 text-xs"
                      variant="secondary"
                      onClick={onCloseConversation}
                      isLoading={closePending}
                      aria-label={t("conversations.closeDialog")}
                    >
                      <CheckCheck size={16} /> {t("common.close")}
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          <div
            ref={messageScrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-warm p-5 pb-28 lg:pb-5"
          >
            {messagesLoading ? (
              <LoadingState label={t("conversations.loadingHistory")} />
            ) : null}
            {canLoadMoreMessages ? (
              <Button
                type="button"
                className="h-8 min-h-8 rounded-control px-3 text-xs"
                variant="secondary"
                onClick={onLoadMoreMessages}
                isLoading={isFetchingNextPage}
              >
                {t("conversations.loadEarlier")}
              </Button>
            ) : null}
            {!messagesLoading && !messageList.length ? (
              <EmptyState
                title={t("conversations.noMessagesTitle")}
                description={t("conversations.noMessagesText")}
              />
            ) : null}
            {messageList.length ? (
              <div className="sticky top-0 z-10 flex justify-center">
                <span className="rounded-full bg-zani-card/90 px-3 py-1 text-xs font-bold text-zani-muted shadow-sm ring-1 ring-zani-border">
                  {t("common.today")}
                </span>
              </div>
            ) : null}
            {messageList.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                t={t}
                onRetry={canRetryMessages ? onRetryMessage : undefined}
              />
            ))}
            <div ref={messageEndRef} aria-hidden="true" />
          </div>

          <ConversationComposer
            selected={selected}
            draft={draft}
            composerRef={composerRef}
            sendPending={sendPending}
            onDraftChange={onDraftChange}
            onResizeComposer={onResizeComposer}
            onOpenQuickReplies={onOpenQuickReplies}
            onSendReply={onSendReply}
            t={t}
          />
        </>
      )}
    </WorkQueueDetailPane>
  );
}
